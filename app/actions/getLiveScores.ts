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
    
    let found = allPlayers.get(pickPlayerName)
    
    if (!found) {
      for (const [name, data] of allPlayers.entries()) {
        const normalizedBoxName = normalizeName(name)
        if (normalizedBoxName === pickPlayerName) {
          found = data
          break
        }
      }
    }
    
    if (!found) {
      for (const [name, data] of allPlayers.entries()) {
        const normalizedBoxName = normalizeName(name)
        if (normalizedBoxName.includes(pickPlayerName) || pickPlayerName.includes(normalizedBoxName)) {
          found = data
          break
        }
      }
    }

    if (!found && pickLastName.length > 2) {
      const pickFirstInitial = pickPlayerName.charAt(0)
      const pickTeam = (pick as any).team?.toUpperCase()
      
      for (const [name, data] of allPlayers.entries()) {
        const normalizedBoxName = normalizeName(name)
        const boxLastName = normalizedBoxName.split(' ').pop() || ''
        const boxFirstInitial = normalizedBoxName.charAt(0)
        
        if (boxLastName === pickLastName && boxFirstInitial === pickFirstInitial) {
          if (pickTeam && data.stats.teamAbbr && pickTeam !== data.stats.teamAbbr) {
            continue
          }
          found = data
          break
        }
      }
    }

    if (!found) {
      // Player not found in any boxscore - show as PENDING
      // Without team data, we cannot know which game is theirs
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
        // Show PENDING - game likely hasnt started
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
