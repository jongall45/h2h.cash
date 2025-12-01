"use server"

import { parseBoxScore, parseGame, PlayerStats, LiveGame, getStatValue } from '../lib/liveStats'

// HARDCODED PLAYER TEAMS - for players with duplicate names
const KNOWN_PLAYERS: Record<string, string> = {
  'josh allen': 'BUF',       // QB Josh Allen, not JAX linebacker  'christian kirk': 'HOU',   // WR Christian Kirk (traded to Texans 2024)
}

// Fetch live NFL games from ESPN
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
    const players = parseBoxScore(data.boxscore)
    console.log('[Boxscore] Game ' + gameId + ': ' + players.length + ' players')
    return players
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
  playerId?: string
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
  console.log('[Games] Total: ' + games.length + ', Active: ' + games.filter(g => g.status.type !== 'pre').length)
  
  const activeGameIds = games
    .filter(g => g.status.type !== 'pre')
    .map(g => g.id)

  const boxscores = await Promise.all(
    activeGameIds.map(async (id) => ({
      gameId: id,
      players: await getGameBoxscore(id)
    }))
  )

  // Build player map
  const allPlayers: Map<string, { stats: PlayerStats; gameStatus: LiveGame['status'] }> = new Map()
  
  boxscores.forEach(({ gameId, players }) => {
    const game = games.find(g => g.id === gameId)
    if (!game) return
    players.forEach(player => {
      const key = player.playerName.toLowerCase()
      allPlayers.set(key, { stats: player, gameStatus: game.status })
    })
  })
  
  console.log('[Players] Total in boxscores: ' + allPlayers.size)

  const normalizeName = (name: string) => {
    return name.toLowerCase().replace(/[''`]/g, "'").replace(/[-.]/g, ' ').replace(/\s+/g, ' ').trim()
  }

  return picks.map(pick => {
    const pickPlayerName = normalizeName(pick.player)
    const knownTeam = KNOWN_PLAYERS[pickPlayerName]
    const requiredTeam = pick.team?.toUpperCase() || knownTeam
    
    const teamMatches = (playerTeam: string | undefined): boolean => {
      if (!requiredTeam) return true
      if (!playerTeam) return true
      return playerTeam.toUpperCase() === requiredTeam
    }
    
    let found: { stats: PlayerStats; gameStatus: LiveGame['status'] } | undefined
    
    // Exact match
    const exactMatch = allPlayers.get(pickPlayerName)
    if (exactMatch && teamMatches(exactMatch.stats.teamAbbr)) {
      found = exactMatch
      console.log('[Match] EXACT: ' + pick.player + ' -> ' + exactMatch.stats.playerName + ' (' + exactMatch.stats.teamAbbr + ')')
    }
    
    // Partial match
    if (!found) {
      for (const [name, data] of allPlayers.entries()) {
        const normalizedName = normalizeName(name)
        if ((normalizedName === pickPlayerName || normalizedName.includes(pickPlayerName) || pickPlayerName.includes(normalizedName)) 
            && teamMatches(data.stats.teamAbbr)) {
          found = data
          console.log('[Match] PARTIAL: ' + pick.player + ' -> ' + data.stats.playerName + ' (' + data.stats.teamAbbr + ')')
          break
        }
      }
    }
    
    // Last name + first initial
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
            console.log('[Match] LASTNAME: ' + pick.player + ' -> ' + data.stats.playerName + ' (' + data.stats.teamAbbr + ')')
            break
          }
        }
      }
    }

    if (!found) {
      console.log('[No Match] ' + pick.player + ' - not found in ' + allPlayers.size + ' players')
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
      playerId: found.stats.playerId,
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
