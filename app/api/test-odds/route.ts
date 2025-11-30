// Test endpoint to debug Odds API data
// Visit: http://localhost:3002/api/test-odds

import { NextResponse } from 'next/server'

const API_KEY = process.env.ODDS_API_KEY

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ error: 'ODDS_API_KEY not configured' }, { status: 500 })
  }

  try {
    // Test 1: Get all available markets for NFL
    const marketsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=${API_KEY}&regions=us&oddsFormat=american`,
      { cache: 'no-store' }
    )
    
    if (!marketsRes.ok) {
      const error = await marketsRes.text()
      return NextResponse.json({ error: 'API Error', details: error }, { status: marketsRes.status })
    }
    
    const games = await marketsRes.json()
    
    // Test 2: Get ALL player props to see what's available
    const propsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=${API_KEY}&regions=us&markets=player_pass_yds,player_rush_yds,player_reception_yds,player_pass_yds_alternate,player_rush_yds_alternate,player_reception_yds_alternate&oddsFormat=american`,
      { cache: 'no-store' }
    )
    
    const propsData = await propsRes.json()
    
    // Count props by type across all games
    const propCounts: Record<string, number> = {}
    const propsByType: Record<string, any[]> = {}
    
    for (const game of propsData) {
      for (const bookie of game.bookmakers || []) {
        for (const market of bookie.markets || []) {
          const marketKey = market.key
          if (!propCounts[marketKey]) {
            propCounts[marketKey] = 0
            propsByType[marketKey] = []
          }
          
          const players = market.outcomes
            .filter((o: any) => o.name === 'Over')
            .map((o: any) => ({
              player: o.description,
              line: o.point,
              odds: o.price,
              game: `${game.away_team} @ ${game.home_team}`
            }))
          
          propCounts[marketKey] += players.length
          propsByType[marketKey].push(...players)
        }
      }
    }
    
    // Test 3: Get rushing props specifically
    const rushRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=${API_KEY}&regions=us&markets=player_rush_yds,player_rush_yds_alternate&oddsFormat=american`,
      { cache: 'no-store' }
    )
    
    const rushData = await rushRes.json()
    
    // Extract all rushing props
    const rushingProps: any[] = []
    
    for (const game of rushData) {
      const gameInfo = {
        game: `${game.away_team} @ ${game.home_team}`,
        gameId: game.id,
        time: game.commence_time,
        bookmakers: [] as any[]
      }
      
      for (const bookie of game.bookmakers || []) {
        const bookieData = {
          name: bookie.key,
          markets: [] as any[]
        }
        
        for (const market of bookie.markets || []) {
          if (market.key.includes('rush')) {
            const players = market.outcomes
              .filter((o: any) => o.name === 'Over')
              .map((o: any) => ({
                player: o.description,
                line: o.point,
                odds: o.price
              }))
            
            if (players.length > 0) {
              bookieData.markets.push({
                type: market.key,
                players
              })
            }
          }
        }
        
        if (bookieData.markets.length > 0) {
          gameInfo.bookmakers.push(bookieData)
        }
      }
      
      if (gameInfo.bookmakers.length > 0) {
        rushingProps.push(gameInfo)
      }
    }
    
    // Test 3: Check what markets are available
    const availableMarkets = new Set<string>()
    for (const game of games) {
      for (const bookie of game.bookmakers || []) {
        for (const market of bookie.markets || []) {
          availableMarkets.add(market.key)
        }
      }
    }
    
    // Get remaining API quota
    const remaining = marketsRes.headers.get('x-requests-remaining')
    const used = marketsRes.headers.get('x-requests-used')
    
    return NextResponse.json({
      success: true,
      apiQuota: {
        remaining,
        used
      },
      totalGames: games.length,
      availableMarkets: Array.from(availableMarkets).sort(),
      propCountsByType: propCounts,
      samplePropsByType: {
        passing: propsByType['player_pass_yds']?.slice(0, 5) || [],
        passingAlt: propsByType['player_pass_yds_alternate']?.slice(0, 5) || [],
        rushing: propsByType['player_rush_yds']?.slice(0, 10) || [],
        rushingAlt: propsByType['player_rush_yds_alternate']?.slice(0, 10) || [],
        receiving: propsByType['player_reception_yds']?.slice(0, 5) || [],
        receivingAlt: propsByType['player_reception_yds_alternate']?.slice(0, 5) || []
      },
      rushingPropsAnalysis: {
        gamesWithRushingProps: rushingProps.length,
        details: rushingProps
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

