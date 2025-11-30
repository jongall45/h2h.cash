"use server"

import { parseBoxScore, parseGame, PlayerStats, LiveGame, getStatValue } from '../lib/liveStats'

// NO IN-MEMORY CACHE - Vercel serverless instances don't share memory
// Always fetch fresh from ESPN API for consistent data

// Fetch live NFL games from ESPN
export async function getLiveGames(): Promise<LiveGame[]> {
  try {
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      { cache: 'no-store' }
    )
    
    if (!response.ok) {
      console.error('ESPN API error:', response.status)
      return []
    }

    const data = await response.json()
    return (data.events || []).map(parseGame)
  } catch (error) {
    console.error('Error fetching live games:', error)
    return []
  }
}

// Fetch boxscore for a specific game
export async function getGameBoxscore(gameId: string): Promise<PlayerStats[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=' + gameId
    const response = await fetch(url, { cache: 'no-store' })
    
    if (!response.ok) {
      console.error('ESPN boxscore API error:', response.status)
      return []
    }

    const data = await response.json()
    return parseBoxScore(data.boxscore)
  } catch (error) {
    console.error('Error fetching boxscore:', error)
    return []
  }
}

export interface PickResolutionResult {
  playerName: string
  stat: string
  line: number
  currentValue: number
  hit: boolean | null
  gameStatus: 'pre' | 'in' | 'post'
  gameClock?: string
  projectedValue?: number
}

export async function resolvePicks(picks: {
  player: string
  team?: string  // Team abbreviation for accurate matching (e.g., "BUF", "JAX")
  stat: string
  line: number
  points: number
}[]): Promise<PickResolutionResult[]> {
  const games = await getLiveGames()
  
  const activeGameIds = games
    .filter(g => g.status.type !== 'pre')
    .map(g => g.id)

  const boxscores = await Promise.all(
    activeGameIds.map(async (id) => ({
      gameId: id,
      players: await getGameBoxscore(id)
    }))
  )

  const allPlayers: Map<string, { stats: PlayerStats; gameStatus: LiveGame['status'] }> = new Map()
  
  boxscores.forEach(({ gameId, players }) => {
    const game = games.find(g => g.id === gameId)
    if (!game) return
    
    players.forEach(player => {
      const key = player.playerName.toLowerCase()
      allPlayers.set(key, { stats: player, gameStatus: game.status })
    })
  })

  const normalizeName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[''`]/g, "'")
      .replace(/[-.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  return picks.map(pick => {
    const pickPlayerName = normalizeName(pick.player)
    const pickLastName = pickPlayerName.split(' ').pop() || ''
    const pickTeam = pick.team?.toUpperCase() // Team from pick data
    
    // Helper to verify team matches (returns true if teams match or no team data)
    const teamMatches = (playerTeam: string | undefined) => {
      if (!pickTeam) return true // No team in pick, allow match
      if (!playerTeam) return true // No team in data, allow match
      return pickTeam === playerTeam.toUpperCase()
    }
    
    let found = allPlayers.get(pickPlayerName)
    
    // Verify team for exact match - critical for names like "Josh Allen"
    if (found && !teamMatches(found.stats.teamAbbr)) {
      console.log('[Team Mismatch] ' + pick.player + ' found but wrong team: ' + found.stats.teamAbbr + ' vs ' + pickTeam)
      found = undefined // Wrong team, keep looking
    }
    
    // Try normalized match with team verification
    if (!found) {
      for (const [name, data] of allPlayers.entries()) {
        const normalizedBoxName = normalizeName(name)
        if (normalizedBoxName === pickPlayerName && teamMatches(data.stats.teamAbbr)) {
          found = data
          break
        }
      }
    }
    
    // Try partial match with team verification
    if (!found) {
      for (const [name, data] of allPlayers.entries()) {
        const normalizedBoxName = normalizeName(name)
        if ((normalizedBoxName.includes(pickPlayerName) || pickPlayerName.includes(normalizedBoxName)) 
            && teamMatches(data.stats.teamAbbr)) {
          found = data
          break
        }
      }
    }

    // Last resort: last name + first initial with team verification
    if (!found && pickLastName.length > 2) {
      const pickFirstInitial = pickPlayerName.charAt(0)
      
      for (const [name, data] of allPlayers.entries()) {
        const normalizedBoxName = normalizeName(name)
        const boxLastName = normalizedBoxName.split(' ').pop() || ''
        const boxFirstInitial = normalizedBoxName.charAt(0)
        
        if (boxLastName === pickLastName && boxFirstInitial === pickFirstInitial && teamMatches(data.stats.teamAbbr)) {
          found = data
          break
        }
      }
    }

    // Player not found - show as PENDING (game likely hasn't started)
    if (!found) {
      const allGamesFinished = games.every(g => g.status.type === 'post')
      
      if (allGamesFinished) {
        return {
          playerName: pick.player,
          stat: pick.stat,
          line: pick.line,
          currentValue: 0,
          hit: false,
          gameStatus: 'post' as const
        }
      } else {
        return {
          playerName: pick.player,
          stat: pick.stat,
          line: pick.line,
          currentValue: 0,
          hit: null,
          gameStatus: 'pre' as const
        }
      }
    }

    const currentValue = getStatValue(found.stats, pick.stat)
    const gameStatus = found.gameStatus

    let hit: boolean | null = null
    if (gameStatus.type === 'post') {
      hit = currentValue >= pick.line
    } else if (gameStatus.type === 'in') {
      if (currentValue >= pick.line) {
        hit = true
      } else {
        hit = null
      }
    }

    const gameClock = gameStatus.type === 'in' ? 'Q' + gameStatus.period + ' ' + gameStatus.clock : undefined

    return {
      playerName: pick.player,
      stat: pick.stat,
      line: pick.line,
      currentValue,
      hit,
      gameStatus: gameStatus.type,
      gameClock
    }
  })
}

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
