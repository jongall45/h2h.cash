// ESPN API Integration for Live NFL Stats
// Helper functions - no "use server" directive needed

export interface LiveGame {
  id: string
  name: string
  shortName: string
  status: {
    type: 'pre' | 'in' | 'post'
    description: string // "Scheduled", "In Progress", "Final", etc.
    period: number // Quarter (1-4, 5+ for OT)
    clock: string // "12:45" time remaining
    completed: boolean
  }
  homeTeam: {
    id: string
    name: string
    abbreviation: string
    score: number
    logo: string
  }
  awayTeam: {
    id: string
    name: string
    abbreviation: string
    score: number
    logo: string
  }
  startTime: string
}

export interface PlayerStats {
  playerId: string
  playerName: string
  teamId: string
  teamAbbr: string
  passingYards: number
  rushingYards: number
  receivingYards: number
  passingTouchdowns: number
  rushingTouchdowns: number
  receivingTouchdowns: number
  receptions: number
  interceptions: number
  completions: number
  attempts: number
}

export interface GameBoxScore {
  gameId: string
  status: LiveGame['status']
  players: PlayerStats[]
}

// Get the relevant stat value for a pick
export function getStatValue(stats: PlayerStats, statType: string): number {
  const type = statType.toLowerCase()
  
  if (type.includes('pass') && type.includes('yard')) {
    return stats.passingYards
  } else if (type.includes('rush') && type.includes('yard')) {
    return stats.rushingYards
  } else if ((type.includes('receiv') || type.includes('rec')) && type.includes('yard')) {
    return stats.receivingYards
  } else if (type.includes('reception')) {
    return stats.receptions
  } else if (type.includes('pass') && type.includes('td')) {
    return stats.passingTouchdowns
  } else if (type.includes('rush') && type.includes('td')) {
    return stats.rushingTouchdowns
  } else if (type.includes('receiv') && type.includes('td')) {
    return stats.receivingTouchdowns
  } else if (type.includes('interception')) {
    return stats.interceptions
  } else if (type.includes('completion')) {
    return stats.completions
  }
  
  // Default fallback based on common patterns
  if (type.includes('pass')) return stats.passingYards
  if (type.includes('rush')) return stats.rushingYards
  if (type.includes('rec')) return stats.receivingYards
  
  return 0
}

// Calculate pace (projected final value based on game progress)
export function calculatePace(
  currentValue: number, 
  gameStatus: LiveGame['status']
): number {
  if (gameStatus.type === 'pre') return 0
  if (gameStatus.type === 'post') return currentValue
  
  // Calculate what percentage of game is complete
  const period = gameStatus.period
  const clock = gameStatus.clock
  
  // Parse clock (format: "12:45" or "0:30")
  let secondsRemaining = 0
  if (clock) {
    const [mins, secs] = clock.split(':').map(Number)
    secondsRemaining = (mins || 0) * 60 + (secs || 0)
  }
  
  // Each quarter is 15 minutes (900 seconds)
  const totalGameSeconds = 4 * 15 * 60 // 3600 seconds
  const secondsPerQuarter = 15 * 60
  
  // Calculate elapsed time
  const completedQuarters = Math.max(0, period - 1)
  const elapsedInCurrentQuarter = secondsPerQuarter - secondsRemaining
  const totalElapsed = (completedQuarters * secondsPerQuarter) + elapsedInCurrentQuarter
  
  if (totalElapsed <= 0) return currentValue
  
  // Project to full game
  const percentComplete = totalElapsed / totalGameSeconds
  const projectedFinal = currentValue / percentComplete
  
  return Math.round(projectedFinal)
}

// Parse ESPN boxscore data into PlayerStats
export function parseBoxScore(boxscore: any): PlayerStats[] {
  const players: PlayerStats[] = []

  boxscore?.players?.forEach((teamPlayers: any) => {
    const teamId = teamPlayers.team?.id || ''
    const teamAbbr = teamPlayers.team?.abbreviation || ''

    teamPlayers.statistics?.forEach((statCategory: any) => {
      const statName = statCategory.name?.toLowerCase() || ''
      
      statCategory.athletes?.forEach((athlete: any) => {
        const playerId = athlete.athlete?.id || ''
        const playerName = athlete.athlete?.displayName || ''
        
        // Find or create player entry
        let playerEntry = players.find(p => p.playerId === playerId)
        if (!playerEntry) {
          playerEntry = {
            playerId,
            playerName,
            teamId,
            teamAbbr,
            passingYards: 0,
            rushingYards: 0,
            receivingYards: 0,
            passingTouchdowns: 0,
            rushingTouchdowns: 0,
            receivingTouchdowns: 0,
            receptions: 0,
            interceptions: 0,
            completions: 0,
            attempts: 0
          }
          players.push(playerEntry)
        }

        // Parse stats based on category
        const stats = athlete.stats || []
        
        if (statName === 'passing') {
          // Format: C/ATT, YDS, AVG, TD, INT, SACKS, QBR, RTG
          const [compAtt] = stats
          if (compAtt && compAtt.includes('/')) {
            const [comp, att] = compAtt.split('/')
            playerEntry.completions = parseInt(comp) || 0
            playerEntry.attempts = parseInt(att) || 0
          }
          playerEntry.passingYards = parseInt(stats[1]) || 0
          playerEntry.passingTouchdowns = parseInt(stats[3]) || 0
          playerEntry.interceptions = parseInt(stats[4]) || 0
        } else if (statName === 'rushing') {
          // Format: CAR, YDS, AVG, TD, LONG
          playerEntry.rushingYards = parseInt(stats[1]) || 0
          playerEntry.rushingTouchdowns = parseInt(stats[3]) || 0
        } else if (statName === 'receiving') {
          // Format: REC, YDS, AVG, TD, LONG, TGTS
          playerEntry.receptions = parseInt(stats[0]) || 0
          playerEntry.receivingYards = parseInt(stats[1]) || 0
          playerEntry.receivingTouchdowns = parseInt(stats[3]) || 0
        }
      })
    })
  })

  return players
}

// Parse game status from ESPN data
export function parseGameStatus(status: any): LiveGame['status'] {
  return {
    type: status?.type?.state === 'pre' ? 'pre' : 
          status?.type?.state === 'in' ? 'in' : 'post',
    description: status?.type?.description || 'Unknown',
    period: status?.period || 0,
    clock: status?.displayClock || '',
    completed: status?.type?.completed || false
  }
}

// Parse single game from ESPN data
export function parseGame(event: any): LiveGame {
  const competition = event.competitions?.[0]
  const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home')
  const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away')
  const status = event.status

  return {
    id: event.id,
    name: event.name,
    shortName: event.shortName,
    status: parseGameStatus(status),
    homeTeam: {
      id: homeTeam?.team?.id || '',
      name: homeTeam?.team?.displayName || '',
      abbreviation: homeTeam?.team?.abbreviation || '',
      score: parseInt(homeTeam?.score || '0'),
      logo: homeTeam?.team?.logo || ''
    },
    awayTeam: {
      id: awayTeam?.team?.id || '',
      name: awayTeam?.team?.displayName || '',
      abbreviation: awayTeam?.team?.abbreviation || '',
      score: parseInt(awayTeam?.score || '0'),
      logo: awayTeam?.team?.logo || ''
    },
    startTime: event.date
  }
}
