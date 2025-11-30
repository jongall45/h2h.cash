"use server"

import { parseBoxScore, parseGame, PlayerStats, LiveGame, getStatValue } from '../lib/liveStats'

// Cache for ESPN data (server-side)
let scoreCache: {
  games: LiveGame[]
  boxscores: Map<string, PlayerStats[]>
  lastFetch: number
} = {
  games: [],
  boxscores: new Map(),
  lastFetch: 0
}

const CACHE_TTL = 30000 // 30 seconds

// Fetch live NFL games from ESPN
export async function getLiveGames(): Promise<LiveGame[]> {
  const now = Date.now()
  
  // Return cached if fresh enough
  if (scoreCache.games.length > 0 && now - scoreCache.lastFetch < CACHE_TTL) {
    return scoreCache.games
  }

  try {
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      { next: { revalidate: 30 } }
    )
    
    if (!response.ok) {
      console.error('ESPN API error:', response.status)
      return scoreCache.games // Return stale cache on error
    }

    const data = await response.json()
    const games = (data.events || []).map(parseGame)
    
    scoreCache.games = games
    scoreCache.lastFetch = now
    
    return games
  } catch (error) {
    console.error('Error fetching live games:', error)
    return scoreCache.games
  }
}

// Fetch boxscore for a specific game
export async function getGameBoxscore(gameId: string): Promise<PlayerStats[]> {
  const cached = scoreCache.boxscores.get(gameId)
  const now = Date.now()
  
  // Return cached if fresh enough
  if (cached && now - scoreCache.lastFetch < CACHE_TTL) {
    return cached
  }

  try {
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`,
      { next: { revalidate: 30 } }
    )
    
    if (!response.ok) {
      console.error('ESPN boxscore API error:', response.status)
      return cached || []
    }

    const data = await response.json()
    const players = parseBoxScore(data.boxscore)
    
    scoreCache.boxscores.set(gameId, players)
    scoreCache.lastFetch = now
    
    return players
  } catch (error) {
    console.error('Error fetching boxscore:', error)
    return cached || []
  }
}

// Resolve a pick against live data
export interface PickResolutionResult {
  playerName: string
  stat: string
  line: number
  currentValue: number
  hit: boolean | null // null = pending/in progress
  gameStatus: 'pre' | 'in' | 'post'
  gameClock?: string
  projectedValue?: number
}

export async function resolvePicks(picks: {
  player: string
  stat: string
  line: number
  points: number
}[]): Promise<PickResolutionResult[]> {
  // Get all live games
  const games = await getLiveGames()
  
  // Find games that are in progress or completed
  const activeGameIds = games
    .filter(g => g.status.type !== 'pre')
    .map(g => g.id)

  // Fetch boxscores for active games
  const boxscores = await Promise.all(
    activeGameIds.map(async (id) => ({
      gameId: id,
      players: await getGameBoxscore(id)
    }))
  )

  // Flatten all player stats
  const allPlayers: Map<string, { stats: PlayerStats; gameStatus: LiveGame['status'] }> = new Map()
  
  boxscores.forEach(({ gameId, players }) => {
    const game = games.find(g => g.id === gameId)
    if (!game) return
    
    players.forEach(player => {
      // Use lowercase name for matching
      const key = player.playerName.toLowerCase()
      allPlayers.set(key, { stats: player, gameStatus: game.status })
    })
  })

  // Helper to normalize player names for matching
  const normalizeName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[''`]/g, "'")  // Normalize apostrophes
      .replace(/[-.]/g, ' ')   // Replace dashes/dots with spaces
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim()
  }

  // Resolve each pick
  return picks.map(pick => {
    const pickPlayerName = normalizeName(pick.player)
    const pickLastName = pickPlayerName.split(' ').pop() || ''
    
    // Try to find player in boxscores
    let found = allPlayers.get(pickPlayerName)
    
    // If not found, try normalized match
    if (!found) {
      for (const [name, data] of allPlayers.entries()) {
        const normalizedBoxName = normalizeName(name)
        if (normalizedBoxName === pickPlayerName) {
          found = data
          break
        }
      }
    }
    
    // If not found, try partial match
    if (!found) {
      for (const [name, data] of allPlayers.entries()) {
        const normalizedBoxName = normalizeName(name)
        if (normalizedBoxName.includes(pickPlayerName) || pickPlayerName.includes(normalizedBoxName)) {
          found = data
          break
        }
      }
    }
    
    // If still not found, try matching by last name AND first initial
    // This prevents matching "James Cook" to "Bryan Cook"
    if (!found && pickLastName.length > 2) {
      const pickFirstInitial = pickPlayerName.charAt(0)
      
      for (const [name, data] of allPlayers.entries()) {
        const normalizedBoxName = normalizeName(name)
        const boxLastName = normalizedBoxName.split(' ').pop() || ''
        const boxFirstInitial = normalizedBoxName.charAt(0)
        
        // Must match last name AND first initial
        if (boxLastName === pickLastName && boxFirstInitial === pickFirstInitial) {
          console.log(`[Player Match] Matched "${pick.player}" to "${name}" by last name + first initial`)
          found = data
          break
        }
      }
    }

    // If player not found in any boxscore, they're either:
    // 1. In a game that hasn't started yet (PENDING)
    // 2. In a game that's live but they have 0 stats
    // 3. Not playing today
    // We should show PENDING (not MISS) until we're sure their game is over
    if (!found) {
      // Check if there are any games that haven't finished yet
      const hasUnfinishedGames = games.some(g => g.status.type === 'pre' || g.status.type === 'in')
      
      return {
        playerName: pick.player,
        stat: pick.stat,
        line: pick.line,
        currentValue: 0,
        hit: hasUnfinishedGames ? null : false, // PENDING if games remain, MISS only if all games final
        gameStatus: hasUnfinishedGames ? 'pre' : 'post' as const
      }
    }

    // Get the stat value
    const currentValue = getStatValue(found.stats, pick.stat)
    const gameStatus = found.gameStatus

    // Determine if hit
    // IMPORTANT: If they've exceeded the line, it's a HIT even during live games!
    // The line can't "un-hit" - yards only go up
    let hit: boolean | null = null
    if (gameStatus.type === 'post') {
      // Game is final - definitive result
      hit = currentValue >= pick.line
    } else if (gameStatus.type === 'in') {
      // Game in progress - if they've already exceeded the line, it's a HIT!
      if (currentValue >= pick.line) {
        hit = true  // They've hit! This is locked in.
      } else {
        hit = null  // Still pending - could still hit
      }
    }

    return {
      playerName: pick.player,
      stat: pick.stat,
      line: pick.line,
      currentValue,
      hit,
      gameStatus: gameStatus.type,
      gameClock: gameStatus.type === 'in' ? `Q${gameStatus.period} ${gameStatus.clock}` : undefined
    }
  })
}

// Get contest status based on game times
export async function getContestLiveStatus(): Promise<{
  hasGamesStarted: boolean
  hasGamesCompleted: boolean
  allGamesCompleted: boolean
  inProgressCount: number
  completedCount: number
  pendingCount: number
}> {
  const games = await getLiveGames()
  
  const inProgress = games.filter(g => g.status.type === 'in').length
  const completed = games.filter(g => g.status.type === 'post').length
  const pending = games.filter(g => g.status.type === 'pre').length
  
  return {
    hasGamesStarted: inProgress > 0 || completed > 0,
    hasGamesCompleted: completed > 0,
    allGamesCompleted: pending === 0 && inProgress === 0 && completed > 0,
    inProgressCount: inProgress,
    completedCount: completed,
    pendingCount: pending
  }
}

