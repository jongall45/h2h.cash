// Pick Resolution Logic - NO "use server" directive for helper functions
// Server actions are in separate async functions

import { LiveGame } from './liveStats'

// Pick status types
export type PickStatus = 'pending' | 'live_winning' | 'live_losing' | 'hit' | 'miss'

export interface PickResolution {
  status: PickStatus
  currentValue: number
  targetLine: number
  projectedValue: number // Pace-based projection
  percentComplete: number // 0-100, how close to hitting
  gameStatus: LiveGame['status'] | null
  earnedPoints: number // Points actually earned (0 until hit)
  lastUpdated: string
}

export interface TrackedPick {
  id: string
  playerId?: string
  playerName: string
  stat: string // "Passing Yards", "Rushing Yards", etc.
  line: number
  potentialPoints: number // Points IF the pick hits
  gameId: string
  teamAbbr?: string
}

// Calculate total points - ONLY count hits, not potential
export function calculateFinalPoints(
  picks: TrackedPick[],
  resolutions: Map<string, PickResolution>
): { totalPoints: number; potentialPoints: number; hits: number; misses: number; pending: number; isPerfect: boolean } {
  let totalPoints = 0
  let potentialPoints = 0
  let hits = 0
  let misses = 0
  let pending = 0

  picks.forEach(pick => {
    const resolution = resolutions.get(pick.id)
    potentialPoints += pick.potentialPoints
    
    if (!resolution) {
      pending++
      return
    }

    switch (resolution.status) {
      case 'hit':
        // Only count points when game is FINAL and pick hit
        hits++
        totalPoints += pick.potentialPoints
        break
      case 'live_winning':
        // Game still in progress - don't count points yet
        pending++
        break
      case 'miss':
        misses++
        // No points for misses
        break
      case 'live_losing':
      case 'pending':
        pending++
        break
    }
  })

  // Perfect lineup bonus (2x) if all 5 hit AND all games final
  const isPerfect = hits === 5 && misses === 0 && pending === 0
  if (isPerfect) {
    totalPoints *= 2
  }

  return { totalPoints, potentialPoints, hits, misses, pending, isPerfect }
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
