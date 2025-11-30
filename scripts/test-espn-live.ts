// Test script for ESPN live data integration
// Run with: npx ts-node scripts/test-espn-live.ts
// Or: npx tsx scripts/test-espn-live.ts

async function testESPNLiveData() {
  console.log('🏈 Testing ESPN Live Data Integration\n')
  console.log('=' .repeat(60))
  
  // 1. Test the scoreboard endpoint (all live games)
  console.log('\n📊 Fetching NFL Scoreboard...\n')
  
  try {
    const scoreboardRes = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
    )
    
    if (!scoreboardRes.ok) {
      console.error('❌ Scoreboard API failed:', scoreboardRes.status)
      return
    }
    
    const scoreboard = await scoreboardRes.json()
    const events = scoreboard.events || []
    
    console.log(`✅ Found ${events.length} NFL games today\n`)
    
    // Display each game's status
    for (const event of events) {
      const competition = event.competitions?.[0]
      const status = event.status
      const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home')
      const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away')
      
      const gameState = status?.type?.state // 'pre', 'in', 'post'
      const statusDesc = status?.type?.description
      const period = status?.period
      const clock = status?.displayClock
      
      let statusEmoji = '⏰'
      if (gameState === 'in') statusEmoji = '🔴'
      else if (gameState === 'post') statusEmoji = '✅'
      
      console.log(`${statusEmoji} ${awayTeam?.team?.abbreviation} @ ${homeTeam?.team?.abbreviation}`)
      console.log(`   Score: ${awayTeam?.score || 0} - ${homeTeam?.score || 0}`)
      console.log(`   Status: ${statusDesc} ${period ? `(Q${period} ${clock})` : ''}`)
      console.log(`   Start: ${new Date(event.date).toLocaleString()}`)
      console.log(`   Game ID: ${event.id}`)
      console.log('')
    }
    
    // 2. Test box score for any live/completed game
    const liveGames = events.filter((e: any) => e.status?.type?.state === 'in')
    const completedGames = events.filter((e: any) => e.status?.type?.state === 'post')
    const gameToTest = liveGames[0] || completedGames[0]
    
    if (gameToTest) {
      console.log('=' .repeat(60))
      console.log(`\n🎯 Fetching Box Score for Game: ${gameToTest.shortName}\n`)
      
      const boxScoreRes = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameToTest.id}`
      )
      
      if (!boxScoreRes.ok) {
        console.error('❌ Box Score API failed:', boxScoreRes.status)
        return
      }
      
      const summary = await boxScoreRes.json()
      const boxscore = summary.boxscore
      
      if (boxscore?.players) {
        console.log('Player Stats Available:\n')
        
        for (const teamPlayers of boxscore.players) {
          const teamAbbr = teamPlayers.team?.abbreviation || 'Unknown'
          console.log(`\n--- ${teamAbbr} ---`)
          
          for (const statCategory of teamPlayers.statistics || []) {
            const statName = statCategory.name
            
            // Only show key stat categories
            if (!['passing', 'rushing', 'receiving'].includes(statName)) continue
            
            console.log(`\n  ${statName.toUpperCase()}:`)
            
            for (const athlete of statCategory.athletes || []) {
              const name = athlete.athlete?.displayName
              const stats = athlete.stats || []
              
              let statLine = ''
              if (statName === 'passing') {
                // C/ATT, YDS, AVG, TD, INT
                statLine = `${stats[0]} | ${stats[1]} YDS | ${stats[3]} TD | ${stats[4]} INT`
              } else if (statName === 'rushing') {
                // CAR, YDS, AVG, TD
                statLine = `${stats[0]} CAR | ${stats[1]} YDS | ${stats[3]} TD`
              } else if (statName === 'receiving') {
                // REC, YDS, AVG, TD, LONG, TGTS
                statLine = `${stats[0]} REC | ${stats[1]} YDS | ${stats[3]} TD`
              }
              
              console.log(`    ${name}: ${statLine}`)
            }
          }
        }
      } else {
        console.log('⚠️  No player stats available yet (game may not have started)')
      }
    } else {
      console.log('\n⚠️  No live or completed games to test box scores')
      console.log('   Wait for games to start to test player stats')
    }
    
    // Summary
    console.log('\n' + '=' .repeat(60))
    console.log('\n📋 SUMMARY:')
    console.log(`   Pre-game:  ${events.filter((e: any) => e.status?.type?.state === 'pre').length}`)
    console.log(`   Live:      ${events.filter((e: any) => e.status?.type?.state === 'in').length}`)
    console.log(`   Final:     ${events.filter((e: any) => e.status?.type?.state === 'post').length}`)
    console.log('')
    
    if (liveGames.length > 0) {
      console.log('🔴 GAMES ARE LIVE! Your live scoring should be active.')
    } else if (events.length > 0 && events.every((e: any) => e.status?.type?.state === 'pre')) {
      const nextGame = events.sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )[0]
      console.log(`⏰ Next game starts: ${new Date(nextGame.date).toLocaleString()}`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Test a specific player lookup (optional)
async function testPlayerLookup(playerName: string) {
  console.log(`\n🔍 Looking up player: ${playerName}`)
  
  // This would need to be run in the context of your app
  // For standalone testing, we'll just check rosters
  const teamIds = [22, 1, 33, 2, 29, 3, 4, 5, 6, 7, 8, 9, 34, 11, 30, 12, 13, 24, 14, 15, 16, 17, 18, 19, 20, 21, 23, 25, 26, 27, 10, 28]
  
  for (const teamId of teamIds) {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`,
        { cache: 'no-store' }
      )
      if (!res.ok) continue
      
      const data = await res.json()
      
      for (const group of data.athletes || []) {
        for (const player of group.items || []) {
          if (player.fullName?.toLowerCase().includes(playerName.toLowerCase())) {
            console.log(`✅ Found: ${player.fullName} (ID: ${player.id}, Team: ${data.team?.abbreviation})`)
            return player.id
          }
        }
      }
    } catch (e) {
      // Continue to next team
    }
  }
  
  console.log(`❌ Player "${playerName}" not found`)
  return null
}

// Run tests
testESPNLiveData()
  .then(() => {
    // Optionally test a player lookup
    // return testPlayerLookup('Patrick Mahomes')
  })
  .catch(console.error)

