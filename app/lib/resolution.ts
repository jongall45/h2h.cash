"use server"

import { getGameStatus, getPlayerGameStats, getStatValue, calculatePace, LiveGame, PlayerStats } from './liveStats'

// Pick status types
export type PickStatus = 'pending' | 'live_winning' | 'live_losing' | 'hit' | 'miss'

export interface PickResolution {
  status: PickStatus
  currentValue: number
  targetLine: number
  projectedValue: number // Pace-based projection
  percentComplete: number // 0-100, how close to hitting
  gameStatus: LiveGame['status'] | null
  lastUpdated: string
}

export interface TrackedPick {
  id: string
  playerId?: string
  playerName: string
  stat: string // "Passing Yards", "Rushing Yards", etc.
  line: number
  points: number
  gameId: string
  teamAbbr?: string
}

// Resolve a single pick's status
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
      lastUpdated: now
    }
  }

  // Get the relevant stat value
  const currentValue = getStatValue(playerStats, pick.stat)
  const projectedValue = calculatePace(currentValue, gameStatus.status)
  const percentComplete = Math.min(100, (currentValue / pick.line) * 100)

  // Determine status
  let status: PickStatus

  if (gameStatus.status.type === 'post') {
    // Game is final - determine hit or miss
    status = currentValue >= pick.line ? 'hit' : 'miss'
  } else {
    // Game is live - determine if winning or losing
    // Consider it "winning" if current value exceeds line OR projected to hit
    if (currentValue >= pick.line) {
      status = 'live_winning' // Already hit the line!
    } else if (projectedValue >= pick.line) {
      status = 'live_winning' // On pace to hit
    } else {
      status = 'live_losing' // Behind pace
    }
  }

  return {
    status,
    currentValue,
    targetLine: pick.line,
    projectedValue,
    percentComplete,
    gameStatus: gameStatus.status,
    lastUpdated: now
  }
}

// Resolve multiple picks at once
export async function resolveMultiplePicks(
  picks: TrackedPick[]
): Promise<Map<string, PickResolution>> {
  const results = new Map<string, PickResolution>()
  
  // Group picks by gameId to minimize API calls
  const picksByGame = new Map<string, TrackedPick[]>()
  picks.forEach(pick => {
    const existing = picksByGame.get(pick.gameId) || []
    existing.push(pick)
    picksByGame.set(pick.gameId, existing)
  })

  // Resolve each game's picks
  for (const [gameId, gamePicks] of picksByGame) {
    for (const pick of gamePicks) {
      const resolution = await resolvePick(pick)
      results.set(pick.id, resolution)
    }
  }

  return results
}

// Calculate total points with hit/miss results
export function calculateFinalPoints(
  picks: TrackedPick[],
  resolutions: Map<string, PickResolution>
): { totalPoints: number; hits: number; misses: number; pending: number; isPerfect: boolean } {
  let totalPoints = 0
  let hits = 0
  let misses = 0
  let pending = 0

  picks.forEach(pick => {
    const resolution = resolutions.get(pick.id)
    if (!resolution) {
      pending++
      return
    }

    switch (resolution.status) {
      case 'hit':
      case 'live_winning':
        hits++
        totalPoints += pick.points
        break
      case 'miss':
        misses++
        break
      case 'live_losing':
      case 'pending':
        pending++
        break
    }
  })

  // Perfect lineup bonus (2x) if all 5 hit
  const isPerfect = hits === 5 && misses === 0 && pending === 0
  if (isPerfect) {
    totalPoints *= 2
  }

  return { totalPoints, hits, misses, pending, isPerfect }
}

// Get display text for pick status
export function getStatusDisplay(status: PickStatus): { text: string; color: string; icon: string } {
  switch (status) {
    case 'pending':
      return { text: 'Pending', color: '#888888', icon: '⏳' }
    case 'live_winning':
      return { text: 'On Pace', color: '#00FF00', icon: '🔥' }
    case 'live_losing':
      return { text: 'Behind', color: '#ff6b35', icon: '📉' }
    case 'hit':
      return { text: 'HIT', color: '#00FF00', icon: '✅' }
    case 'miss':
      return { text: 'MISS', color: '#ef4444', icon: '❌' }
    default:
      return { text: 'Unknown', color: '#888888', icon: '❓' }
  }
}

// Format game clock display
export function formatGameClock(gameStatus: LiveGame['status'] | null): string {
  if (!gameStatus) return ''
  
  if (gameStatus.type === 'pre') {
    return 'Not Started'
  }
  
  if (gameStatus.type === 'post') {
    return 'Final'
  }
  
  const quarter = gameStatus.period
  const clock = gameStatus.clock
  
  if (quarter <= 4) {
    return `Q${quarter} ${clock}`
  } else {
    return `OT ${clock}`
  }
}

