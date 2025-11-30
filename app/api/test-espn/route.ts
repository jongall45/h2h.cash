// Test endpoint for ESPN live data
// Visit: http://localhost:3000/api/test-espn

import { NextResponse } from 'next/server'
import { getLiveGames, getGameBoxScore } from '../../actions/liveScoring'

export async function GET() {
  try {
    // Get all games
    const games = await getLiveGames()
    
    // Find a game with stats (live or completed)
    const gameWithStats = games.find(g => g.status.type === 'in' || g.status.type === 'post')
    
    let sampleBoxScore = null
    if (gameWithStats) {
      sampleBoxScore = await getGameBoxScore(gameWithStats.id)
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalGames: games.length,
        preGame: games.filter(g => g.status.type === 'pre').length,
        inProgress: games.filter(g => g.status.type === 'in').length,
        final: games.filter(g => g.status.type === 'post').length,
      },
      games: games.map(g => ({
        id: g.id,
        name: g.shortName,
        status: g.status.description,
        state: g.status.type,
        clock: g.status.type === 'in' ? `Q${g.status.period} ${g.status.clock}` : null,
        score: `${g.awayTeam.abbreviation} ${g.awayTeam.score} - ${g.homeTeam.abbreviation} ${g.homeTeam.score}`,
        startTime: g.startTime
      })),
      sampleBoxScore: sampleBoxScore ? {
        gameId: sampleBoxScore.gameId,
        status: sampleBoxScore.status,
        playerCount: sampleBoxScore.players.length,
        samplePlayers: sampleBoxScore.players.slice(0, 5).map(p => ({
          name: p.playerName,
          team: p.teamAbbr,
          passYds: p.passingYards,
          rushYds: p.rushingYards,
          recYds: p.receivingYards,
          receptions: p.receptions
        }))
      } : null
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

