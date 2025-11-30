"use server"

import { parseBoxScore, parseGame, PlayerStats, LiveGame, getStatValue } from '../lib/liveStats'

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
    const pickTeam = pick.team?.toUpperCase()
    const pickStat = pick.stat.toUpperCase()
    
    // STRICT matching: player must have actual stats for the stat type
    // This prevents Josh Allen (JAX DEF) matching Josh Allen (BUF QB) PASS props
    const isValidMatch = (stats: PlayerStats): boolean => {
      // If we have team data, verify it matches
      if (pickTeam && stats.teamAbbr && pickTeam !== stats.teamAbbr.toUpperCase()) {
        return false
      }
      
      // STRICT stat verification - player must have ACTUAL stats
      if (pickStat === 'PASS') {
        // QB must have thrown at least one pass (completions > 0)
        // Defensive players will NEVER have completions
        return stats.completions > 0
      }
      if (pickStat === 'RUSH') {
        // Runner must have rushing yards (even 0 is fine if they have attempts)
        // But we need some indication they're a ball carrier
        return stats.rushingYards > 0 || stats.rushingTouchdowns > 0
      }
      if (pickStat === 'REC') {
        // Receiver must have at least one catch
        return stats.receptions > 0
      }
      return true
    }
    
    // Search for player with strict matching
    let found: { stats: PlayerStats; gameStatus: LiveGame['status'] } | undefined
    
    // Try exact name match first
    const exactMatch = allPlayers.get(pickPlayerName)
    if (exactMatch && isValidMatch(exactMatch.stats)) {
      found = exactMatch
    }
    
    // Try normalized/partial matches
    if (!found) {
      for (const [name, data] of allPlayers.entries()) {
        const normalizedName = normalizeName(name)
        const nameMatches = normalizedName === pickPlayerName || 
                           normalizedName.includes(pickPlayerName) || 
                           pickPlayerName.includes(normalizedName)
        
        if (nameMatches && isValidMatch(data.stats)) {
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
          
          if (lastName === pickLastName && firstInitial === pickFirstInitial && isValidMatch(data.stats)) {
            found = data
            break
          }
        }
      }
    }

    // NOT FOUND = PENDING (game likely hasn't started or player has no stats yet)
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
