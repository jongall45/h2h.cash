"use server"

import { LiveGame, PlayerStats, GameBoxScore, parseGame, parseBoxScore, parseGameStatus, getStatValue, calculatePace } from '../lib/liveStats'
import { PickResolution, PickStatus, TrackedPick } from '../lib/resolution'

// Fetch all live/upcoming NFL games
export async function getLiveGames(): Promise<LiveGame[]> {
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      { next: { revalidate: 30 } }
    )

    if (!res.ok) {
      console.error('ESPN scoreboard fetch failed:', res.status)
      return []
    }

    const data = await res.json()
    return (data.events || []).map(parseGame)
  } catch (err) {
    console.error('Error fetching live games:', err)
    return []
  }
}

// Get a specific game's status
export async function getGameStatus(gameId: string): Promise<LiveGame | null> {
  const games = await getLiveGames()
  return games.find(g => g.id === gameId) || null
}

// Fetch detailed box score with player stats
export async function getGameBoxScore(gameId: string): Promise<GameBoxScore | null> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`,
      { next: { revalidate: 30 } }
    )

    if (!res.ok) {
      console.error('ESPN summary fetch failed:', res.status)
      return null
    }

    const data = await res.json()
    const boxscore = data.boxscore
    const status = data.header?.competitions?.[0]?.status

    if (!boxscore) {
      return null
    }

    return {
      gameId,
      status: parseGameStatus(status),
      players: parseBoxScore(boxscore)
    }
  } catch (err) {
    console.error('Error fetching box score:', err)
    return null
  }
}

// Get stats for a specific player in a game
export async function getPlayerGameStats(
  gameId: string, 
  playerName: string
): Promise<PlayerStats | null> {
  const boxScore = await getGameBoxScore(gameId)
  if (!boxScore) return null

  // Find player by name (fuzzy match)
  const normalizedSearch = playerName.toLowerCase().trim()
  
  const player = boxScore.players.find(p => {
    const normalizedName = p.playerName.toLowerCase()
    return normalizedName === normalizedSearch || 
           normalizedName.includes(normalizedSearch) ||
           normalizedSearch.includes(normalizedName)
  })

  return player || null
}

// Resolve a single pick's status - THIS IS THE KEY FUNCTION
export async function resolvePick(pick: TrackedPick): Promise<PickResolution> {
  const now = new Date().toISOString()
  
  // Get game status
  const gameStatus = await getGameStatus(pick.gameId)
  
  if (!gameStatus) {
    return {
      status: 'pending',
      currentValue: 0,
      targetLine: pick.line,
      projectedValue: 0,
      percentComplete: 0,
      gameStatus: null,
      earnedPoints: 0, // No points until game completes and pick hits
      lastUpdated: now
    }
  }

  // Game hasn't started yet
  if (gameStatus.status.type === 'pre') {
    return {
      status: 'pending',
      currentValue: 0,
      targetLine: pick.line,
      projectedValue: 0,
      percentComplete: 0,
      gameStatus: gameStatus.status,
      earnedPoints: 0,
      lastUpdated: now
    }
  }

  // Get player stats
  const playerStats = await getPlayerGameStats(pick.gameId, pick.playerName)
  
  if (!playerStats) {
    // Player not in game yet or no stats
    return {
      status: gameStatus.status.type === 'post' ? 'miss' : 'pending',
      currentValue: 0,
      targetLine: pick.line,
      projectedValue: 0,
      percentComplete: 0,
      gameStatus: gameStatus.status,
      earnedPoints: 0,
      lastUpdated: now
    }
  }

  // Get the relevant stat value
  const currentValue = getStatValue(playerStats, pick.stat)
  const projectedValue = calculatePace(currentValue, gameStatus.status)
  const percentComplete = Math.min(100, (currentValue / pick.line) * 100)

  // Determine status
  let status: PickStatus
  let earnedPoints = 0

  if (gameStatus.status.type === 'post') {
    // Game is FINAL - this is when points are actually earned
    if (currentValue >= pick.line) {
      status = 'hit'
      earnedPoints = pick.potentialPoints // Only award points on final HIT
    } else {
      status = 'miss'
      earnedPoints = 0
    }
  } else {
    // Game is live - NO points yet, just tracking progress
    if (currentValue >= pick.line) {
      status = 'live_winning' // Already exceeded line, but game not final
    } else if (projectedValue >= pick.line) {
      status = 'live_winning' // On pace to hit
    } else {
      status = 'live_losing' // Behind pace
    }
    earnedPoints = 0 // No points during live games
  }

  return {
    status,
    currentValue,
    targetLine: pick.line,
    projectedValue,
    percentComplete,
    gameStatus: gameStatus.status,
    earnedPoints,
    lastUpdated: now
  }
}

// Resolve multiple picks at once
export async function resolveAllPicks(
  picks: TrackedPick[]
): Promise<PickResolution[]> {
  const results: PickResolution[] = []
  
  for (const pick of picks) {
    const resolution = await resolvePick(pick)
    results.push(resolution)
  }

  return results
}

// Calculate live leaderboard score for an entry
export async function calculateLiveScore(picks: TrackedPick[]): Promise<{
  earnedPoints: number
  potentialPoints: number
  hits: number
  misses: number
  pending: number
  isPerfect: boolean
}> {
  let earnedPoints = 0
  let potentialPoints = 0
  let hits = 0
  let misses = 0
  let pending = 0

  for (const pick of picks) {
    potentialPoints += pick.potentialPoints
    const resolution = await resolvePick(pick)
    
    switch (resolution.status) {
      case 'hit':
        hits++
        earnedPoints += pick.potentialPoints
        break
      case 'miss':
        misses++
        break
      case 'live_winning':
      case 'live_losing':
      case 'pending':
        pending++
        break
    }
  }

  // Perfect lineup bonus (2x) if all 5 hit AND all games final
  const isPerfect = hits === 5 && misses === 0 && pending === 0
  if (isPerfect) {
    earnedPoints *= 2
  }

  return { earnedPoints, potentialPoints, hits, misses, pending, isPerfect }
}

