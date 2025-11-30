import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Get all games
    const gamesRes = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      { cache: 'no-store' }
    )
    const gamesData = await gamesRes.json()
    
    // Find Texans game
    const texansGame = gamesData.events?.find((e: any) => 
      e.shortName?.includes('HOU') || e.name?.includes('Texans')
    )
    
    if (!texansGame) {
      return NextResponse.json({ error: 'No Texans game found', games: gamesData.events?.map((e: any) => e.shortName) })
    }
    
    // Get boxscore for Texans game
    const boxRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${texansGame.id}`,
      { cache: 'no-store' }
    )
    const boxData = await boxRes.json()
    
    // Find Christian Kirk in receiving stats
    const allReceivers: any[] = []
    boxData.boxscore?.players?.forEach((team: any) => {
      team.statistics?.forEach((stat: any) => {
        if (stat.name === 'receiving') {
          stat.athletes?.forEach((athlete: any) => {
            allReceivers.push({
              name: athlete.athlete?.displayName,
              team: team.team?.abbreviation,
              stats: athlete.stats,
              id: athlete.athlete?.id
            })
          })
        }
      })
    })
    
    const kirk = allReceivers.find(r => r.name?.toLowerCase().includes('kirk'))
    
    return NextResponse.json({
      game: {
        id: texansGame.id,
        name: texansGame.shortName,
        status: texansGame.status?.type?.state
      },
      kirkFound: !!kirk,
      kirk: kirk || 'NOT FOUND',
      allReceivers: allReceivers.map(r => ({ name: r.name, team: r.team, yards: r.stats?.[1] }))
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) })
  }
}
