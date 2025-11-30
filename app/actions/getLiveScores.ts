"use server"

import { parseBoxScore, parseGame, PlayerStats, LiveGame, getStatValue } from '../lib/liveStats'

// HARDCODED PLAYER TEAMS - for players with duplicate names
// Props are only for offensive players, so we hardcode the offensive player's team
const KNOWN_PLAYERS: Record<string, string> = {
  'josh allen': 'BUF',  // QB Josh Allen, not JAX linebacker Josh Allen
  // Add more if needed in the future
}

// Fetch live NFL games from ESPN - no caching
export async function getLiveGames(): Promise<LiveGame[]> {
  try {
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      { cache: 'no-store' }
    )
    if (!response.ok) return []
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
    if (!response.ok) return []
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
}

export async function resolvePicks(picks: {
  player: string
  team?: string
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

  // Build player map with game info
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
    return name.toLowerCase().replace(/[''`]/g, "'").replace(/[-.]/g, ' ').replace(/\s+/g, ' ').trim()
  }

  return picks.map(pick => {
    const pickPlayerName = normalizeName(pick.player)
    
    // Get the required team - from pick data OR hardcoded known players
    const knownTeam = KNOWN_PLAYERS[pickPlayerName]
    const requiredTeam = pick.team?.toUpperCase() || knownTeam
    
    // Helper to check if team matches (if we have a required team)
    const teamMatches = (playerTeam: string | undefined): boolean => {
      if (!requiredTeam) return true // No team requirement
      if (!playerTeam) return true // No team data on player
      return playerTeam.toUpperCase() === requiredTeam
    }
    
    // Search for player
    let found: { stats: PlayerStats; gameStatus: LiveGame['status'] } | undefined
    
    // Try exact name match
    const exactMatch = allPlayers.get(pickPlayerName)
    if (exactMatch && teamMatches(exactMatch.stats.teamAbbr)) {
      found = exactMatch
    }
    
    // Try normalized/partial matches
    if (!found) {
      for (const [name, data] of allPlayers.entries()) {
        const normalizedName = normalizeName(name)
        const nameMatches = normalizedName === pickPlayerName || 
                           normalizedName.includes(pickPlayerName) || 
                           pickPlayerName.includes(normalizedName)
        
        if (nameMatches && teamMatches(data.stats.teamAbbr)) {
          found = data
          break
        }
      }
    }
    
    // Try last name + first initial
    if (!found) {
      const pickLastName = pickPlayerName.split(' ').pop() || ''
      const pickFirstInitial = pickPlayerName.charAt(0)
      
      if (pickLastName.length > 2) {
        for (const [name, data] of allPlayers.entries()) {
          const normalizedName = normalizeName(name)
          const lastName = normalizedName.split(' ').pop() || ''
          const firstInitial = normalizedName.charAt(0)
          
          if (lastName === pickLastName && firstInitial === pickFirstInitial && teamMatches(data.stats.teamAbbr)) {
            found = data
            break
          }
        }
      }
    }

    // NOT FOUND = PENDING
    if (!found) {
      const allGamesFinished = games.every(g => g.status.type === 'post')
      return {
        playerName: pick.player,
        stat: pick.stat,
        line: pick.line,
        currentValue: 0,
        hit: allGamesFinished ? false : null,
        gameStatus: allGamesFinished ? 'post' as const : 'pre' as const
      }
    }

    // FOUND - get current stats
    const currentValue = getStatValue(found.stats, pick.stat)
    const gameStatus = found.gameStatus

    let hit: boolean | null = null
    if (gameStatus.type === 'post') {
      hit = currentValue >= pick.line
    } else if (gameStatus.type === 'in') {
      hit = currentValue >= pick.line ? true : null
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
