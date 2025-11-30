"use server"

import { enrichPropsWithTeams, getTeamAbbr } from "../lib/espn"

const API_KEY = process.env.ODDS_API_KEY;

/**
 * PROBABILITY-BASED POINTS SYSTEM
 * 
 * Formula: Points = 10 / impliedProbability
 * 
 * This creates a fair, continuous scale where:
 * - Riskier bets (lower probability) = more points
 * - Safer bets (higher probability) = fewer points
 * - Points scale infinitely with risk (no cap!)
 * - Decimal precision eliminates ties
 * 
 * Examples:
 * -500 odds = 83.3% prob = 1.20 points (very safe)
 * -200 odds = 66.7% prob = 1.50 points
 * -110 odds = 52.4% prob = 1.91 points (standard)
 * +100 odds = 50.0% prob = 2.00 points
 * +150 odds = 40.0% prob = 2.50 points
 * +200 odds = 33.3% prob = 3.00 points
 * +300 odds = 25.0% prob = 4.00 points
 * +500 odds = 16.7% prob = 6.00 points
 * +1000 odds = 9.1% prob = 11.00 points (longshot!)
 */

// Convert American odds to implied probability (0-1)
function americanToImpliedProbability(americanOdds: number): number {
  if (americanOdds < 0) {
    // Negative odds: probability = |odds| / (|odds| + 100)
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  } else {
    // Positive odds: probability = 100 / (odds + 100)
    return 100 / (americanOdds + 100);
  }
}

// Convert American odds to points using probability-based formula
// Points = multiplier / impliedProbability (with min/max bounds for UX)
function oddsToPoints(americanOdds: number): number {
  const impliedProb = americanToImpliedProbability(americanOdds);
  
  // Base formula: 1 / probability gives us the "fair" multiplier
  // We use 1.0 as the base multiplier for clean numbers
  // Then round to 2 decimal places for precision
  const rawPoints = 1.0 / impliedProb;
  
  // Round to 2 decimal places
  const points = Math.round(rawPoints * 100) / 100;
  
  // Minimum 1.00 points (for extreme favorites like -1000)
  // No maximum - let longshots be rewarded!
  return Math.max(1.00, points);
}

// Get risk label from odds (for visual UI)
function oddsToRiskLabel(americanOdds: number): string {
  if (americanOdds <= -200) return 'SAFE';
  if (americanOdds <= -110) return 'BASE';
  if (americanOdds <= +150) return 'RISK';
  return 'MAX';
}

// 1. Get ALL upcoming NFL games (The Wheel Data)
export async function getSchedule() {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); 

  const res = await fetch(
    `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=${API_KEY}&regions=us&markets=h2h&oddsFormat=american&commenceTimeFrom=${now.toISOString().split('.')[0]}Z&commenceTimeTo=${nextWeek.toISOString().split('.')[0]}Z`,
    { next: { revalidate: 3600 } }
  );
  
  if (!res.ok) return [];
  const games = await res.json();

  return games.map((game: any) => ({
    id: game.id,
    home_team: game.home_team,
    away_team: game.away_team,
    commence_time: game.commence_time,
    // Store team abbreviations for easier matching
    home_abbr: getTeamAbbr(game.home_team),
    away_abbr: getTeamAbbr(game.away_team)
  }));
}

// Get only main slate games (1PM EST and 4PM EST Sunday games)
// Excludes primetime games: SNF, MNF, TNF
export async function getMainSlateSchedule() {
  const allGames = await getSchedule();
  
  return allGames.filter((game: any) => {
    if (!game.commence_time) return false;
    
    const gameDate = new Date(game.commence_time);
    const dayOfWeek = gameDate.getUTCDay(); // 0 = Sunday
    const utcHour = gameDate.getUTCHours();
    
    // Only Sunday games (day 0)
    if (dayOfWeek !== 0) return false;
    
    // 1PM EST = 18:00 UTC
    // 4PM EST = 21:00 UTC (4:05 PM and 4:25 PM games typically start between 21:00-21:30 UTC)
    // Exclude anything after 22:00 UTC (5PM EST+) which would be SNF
    // Valid window: 18:00 - 21:30 UTC
    if (utcHour >= 18 && utcHour < 22) {
      // Additional check: exclude games that start after 5:30 PM EST (22:30 UTC)
      const utcMinutes = gameDate.getUTCMinutes();
      if (utcHour === 21 && utcMinutes > 30) return false;
      return true;
    }
    
    return false;
  });
}

// 2. Get Props for a Specific Game - NOW WITH ALTERNATE LINES
export async function getGameProps(gameId: string) {
  // Fetch both standard and alternate lines
  const res = await fetch(
    `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${gameId}/odds?apiKey=${API_KEY}&regions=us&markets=player_pass_yds,player_rush_yds,player_reception_yds,player_pass_yds_alternate,player_rush_yds_alternate,player_reception_yds_alternate&oddsFormat=american`,
    { cache: 'no-store' }
  );

  if (!res.ok) return null;
  const data = await res.json();

  // Group all lines by player and stat type
  const playerLines: Record<string, any[]> = {};
  
  // Log what markets are available for debugging
  console.log('[Odds API] Bookmakers:', data.bookmakers?.map((b: any) => b.key))
  console.log('[Odds API] Markets:', data.bookmakers?.flatMap((b: any) => b.markets?.map((m: any) => m.key)))
  
  data.bookmakers.forEach((bookie: any) => {
    // Accept more bookmakers to get better prop coverage
    const acceptedBooks = ['draftkings', 'fanduel', 'betmgm', 'pointsbetus', 'bovada', 'betonlineag', 'mybookieag', 'williamhill_us', 'caesars']
    if (!acceptedBooks.includes(bookie.key)) return;

    bookie.markets.forEach((market: any) => {
      const statType = market.key.replace('_alternate', '');
      
      market.outcomes.forEach((outcome: any) => {
        // Only look at "Over" outcomes
        if (outcome.name !== 'Over') return;
        
        const playerKey = `${outcome.description}-${statType}`;
        
        if (!playerLines[playerKey]) {
          playerLines[playerKey] = [];
        }
        
        // Add this line option
        playerLines[playerKey].push({
          line: outcome.point,
          odds: outcome.price,
          points: oddsToPoints(outcome.price),
          riskLabel: oddsToRiskLabel(outcome.price)
        });
      });
    });
  });

  // Convert to array of props with all available lines
  const propsWithLines: any[] = [];
  
  Object.entries(playerLines).forEach(([key, lines]) => {
    const [player, statType] = key.split('-player_');
    
    // Dedupe lines by line value, keeping best odds
    const uniqueLines = lines.reduce((acc: any[], line) => {
      const existing = acc.find(l => l.line === line.line);
      if (!existing) {
        acc.push(line);
      } else if (line.odds > existing.odds) {
        // Keep better odds
        Object.assign(existing, line);
      }
      return acc;
    }, []);
    
    // Sort by line value (lowest to highest)
    uniqueLines.sort((a, b) => a.line - b.line);
    
    if (uniqueLines.length > 0) {
      // Find the "base" line (closest to -110)
      const baseLine = uniqueLines.reduce((best, line) => {
        const bestDiff = Math.abs(best.odds - (-110));
        const lineDiff = Math.abs(line.odds - (-110));
        return lineDiff < bestDiff ? line : best;
      }, uniqueLines[0]);
      
      propsWithLines.push({
        id: key,
        player: player,
        stat: formatStatName('player_' + statType),
        type: 'player_' + statType,
        line: baseLine.line,
        odds: baseLine.odds,
        // All available alternate lines for this player/stat
        alternateLines: uniqueLines
      });
    }
  });

  // Group props by stat type to ensure balanced coverage
  const propsByStatType: Record<string, any[]> = {
    'player_pass_yds': [],
    'player_rush_yds': [],
    'player_reception_yds': []
  };
  
  propsWithLines.forEach(prop => {
    const baseType = prop.type.replace('_alternate', '');
    if (propsByStatType[baseType]) {
      propsByStatType[baseType].push(prop);
    }
  });
  
  // Log what we found for debugging
  console.log('[Odds API] Props by type:', {
    passing: propsByStatType['player_pass_yds'].length,
    rushing: propsByStatType['player_rush_yds'].length,
    receiving: propsByStatType['player_reception_yds'].length
  });
  
  // Take balanced props from each category (ensure rushing is included!)
  // Priority: 4 passing, 3 rushing, 3 receiving = 10 total
  const balancedProps = [
    ...propsByStatType['player_pass_yds'].slice(0, 4),
    ...propsByStatType['player_rush_yds'].slice(0, 3),
    ...propsByStatType['player_reception_yds'].slice(0, 3)
  ];
  
  // If we don't have enough of one type, fill with others
  const limitedProps = balancedProps.length >= 10 
    ? balancedProps 
    : [...balancedProps, ...propsWithLines.filter(p => !balancedProps.includes(p))].slice(0, 10);

  // ENRICH WITH TEAM DATA FROM ESPN
  const enrichedProps = await enrichPropsWithTeams(limitedProps);
  
  console.log('[Odds API] Final props:', enrichedProps.map(p => `${p.player} - ${p.stat}`));
  
  return enrichedProps;
}

function formatStatName(key: string) {
  if (key === 'player_pass_yds') return 'Passing Yards';
  if (key === 'player_rush_yds') return 'Rushing Yards';
  if (key === 'player_reception_yds') return 'Receiving Yards';
  return key;
}