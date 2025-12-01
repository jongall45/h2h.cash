"use server"

import { createClient } from '@supabase/supabase-js'
import { resolvePicks, getContestLiveStatus } from './getLiveScores'
import { EntryPick } from '../lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface ContestResolution {
  contestId: string
  status: 'pending' | 'in_resolution' | 'completed'
  totalEntries: number
  winners: WinnerInfo[]
  finalizedAt?: string
}

interface WinnerInfo {
  entryId: string
  userId: string
  username: string
  rank: number
  totalPoints: number
  hitsCount: number
  multiplier: number
  prizeAmount: number
  picks: ResolvedPick[]
}

interface ResolvedPick {
  player: string
  stat: string
  line: number
  actualValue: number
  hit: boolean
  pointsEarned: number
}

// Check if contest should enter resolution period
export async function checkContestResolution(contestId: string): Promise<{
  shouldResolve: boolean
  allGamesComplete: boolean
  resolutionStartTime?: string
}> {
  const liveStatus = await getContestLiveStatus()
  
  if (!liveStatus.allGamesCompleted) {
    return { shouldResolve: false, allGamesComplete: false }
  }
  
  // Check if contest is already resolved
  const { data: contest } = await supabase
    .from('contests')
    .select('status, resolution_started_at')
    .eq('id', contestId)
    .single()
  
  if (contest?.status === 'completed') {
    return { shouldResolve: false, allGamesComplete: true }
  }
  
  // If resolution hasn't started, start it now
  if (!contest?.resolution_started_at) {
    const now = new Date().toISOString()
    await supabase
      .from('contests')
      .update({ 
        status: 'resolving',
        resolution_started_at: now 
      })
      .eq('id', contestId)
    
    return { 
      shouldResolve: false, 
      allGamesComplete: true,
      resolutionStartTime: now
    }
  }
  
  // Check if 10 minutes have passed since resolution started
  const resolutionStart = new Date(contest.resolution_started_at)
  const now = new Date()
  const minutesPassed = (now.getTime() - resolutionStart.getTime()) / (1000 * 60)
  
  return {
    shouldResolve: minutesPassed >= 10,
    allGamesComplete: true,
    resolutionStartTime: contest.resolution_started_at
  }
}

// Calculate points with multiplier system
function calculateFinalScore(picks: EntryPick[], results: any[]): {
  totalPoints: number
  hitsCount: number
  multiplier: number
  resolvedPicks: ResolvedPick[]
} {
  let hitsCount = 0
  const resolvedPicks: ResolvedPick[] = []
  
  picks.forEach((pick, i) => {
    const result = results[i]
    const hit = result?.hit === true
    if (hit) hitsCount++
    
    resolvedPicks.push({
      player: pick.player,
      stat: pick.stat,
      line: pick.line,
      actualValue: result?.currentValue || 0,
      hit,
      pointsEarned: hit ? pick.points : 0
    })
  })
  
  const multiplier = hitsCount
  const basePoints = resolvedPicks.reduce((sum, p) => sum + p.pointsEarned, 0)
  const totalPoints = basePoints * multiplier
  
  return { totalPoints, hitsCount, multiplier, resolvedPicks }
}

// Finalize contest - calculate rankings, assign prizes, record payouts
export async function finalizeContest(contestId: string): Promise<ContestResolution | null> {
  try {
    // Get contest details
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('*, entries(*)')
      .eq('id', contestId)
      .single()
    
    if (contestError || !contest) {
      console.error('Error fetching contest:', contestError)
      return null
    }
    
    // Get payout structure
    const payoutStructure = contest.payout_structure || []
    const prizePool = contest.prize_pool || 0
    
    // Calculate final scores for all entries
    const scoredEntries: {
      entry: any
      score: ReturnType<typeof calculateFinalScore>
    }[] = []
    
    for (const entry of contest.entries) {
      const picks = entry.picks as EntryPick[]
      const results = await resolvePicks(picks.map(p => ({
        player: p.player,
        team: p.team,
        stat: p.stat,
        line: p.line,
        points: p.points
      })))
      
      const score = calculateFinalScore(picks, results)
      scoredEntries.push({ entry, score })
    }
    
    // Sort by total points (descending), then by hits (descending)
    scoredEntries.sort((a, b) => {
      if (b.score.totalPoints !== a.score.totalPoints) {
        return b.score.totalPoints - a.score.totalPoints
      }
      return b.score.hitsCount - a.score.hitsCount
    })
    
    // Assign ranks and prizes
    const winners: WinnerInfo[] = []
    
    for (let i = 0; i < scoredEntries.length; i++) {
      const { entry, score } = scoredEntries[i]
      const rank = i + 1
      
      // Find prize for this rank
      const payout = payoutStructure.find((p: any) => {
        const place = p.place.replace(/[^0-9-]/g, '')
        if (place.includes('-')) {
          const [start, end] = place.split('-').map(Number)
          return rank >= start && rank <= end
        }
        return parseInt(place) === rank
      })
      
      const prizeAmount = payout ? Math.floor(prizePool * payout.percent / 100) : 0
      
      // Update entry in database
      await supabase
        .from('entries')
        .update({
          total_points: score.totalPoints,
          hits_count: score.hitsCount,
          is_perfect: score.hitsCount === 5,
          rank,
          prize: prizeAmount
        })
        .eq('id', entry.id)
      
      // Record payout if won money
      if (prizeAmount > 0) {
        // Add to user's balance
        await supabase.rpc('add_user_balance', {
          user_id: entry.user_id,
          amount: prizeAmount
        })
        
        // Create payout record
        await supabase
          .from('payouts')
          .insert({
            user_id: entry.user_id,
            contest_id: contestId,
            entry_id: entry.id,
            amount: prizeAmount,
            rank,
            status: 'completed'
          })
        
        // Create notification
        await supabase
          .from('notifications')
          .insert({
            user_id: entry.user_id,
            type: 'contest_won',
            title: `You won $${prizeAmount}!`,
            message: `Congrats! You placed #${rank} in ${contest.name} with ${score.hitsCount}/5 hits and ${score.totalPoints.toFixed(2)} points.`,
            data: {
              contestId,
              entryId: entry.id,
              rank,
              prizeAmount,
              totalPoints: score.totalPoints,
              hitsCount: score.hitsCount,
              multiplier: score.multiplier,
              picks: score.resolvedPicks
            },
            read: false
          })
        
        winners.push({
          entryId: entry.id,
          userId: entry.user_id,
          username: entry.username,
          rank,
          totalPoints: score.totalPoints,
          hitsCount: score.hitsCount,
          multiplier: score.multiplier,
          prizeAmount,
          picks: score.resolvedPicks
        })
      }
    }
    
    // Mark contest as completed
    const finalizedAt = new Date().toISOString()
    await supabase
      .from('contests')
      .update({
        status: 'completed',
        finalized_at: finalizedAt
      })
      .eq('id', contestId)
    
    return {
      contestId,
      status: 'completed',
      totalEntries: contest.entries.length,
      winners,
      finalizedAt
    }
  } catch (error) {
    console.error('Error finalizing contest:', error)
    return null
  }
}

// Get user's notifications (for winner popups)
export async function getUserNotifications(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('read', false)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching notifications:', error)
    return []
  }
  
  return data || []
}

// Mark notification as read
export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
  
  return !error
}

// Get user's total winnings
export async function getUserWinnings(userId: string): Promise<{
  totalWinnings: number
  contestsWon: number
  payouts: any[]
}> {
  const { data: payouts, error } = await supabase
    .from('payouts')
    .select('*, contests(name)')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching winnings:', error)
    return { totalWinnings: 0, contestsWon: 0, payouts: [] }
  }
  
  const totalWinnings = payouts?.reduce((sum, p) => sum + p.amount, 0) || 0
  const contestsWon = payouts?.length || 0
  
  return { totalWinnings, contestsWon, payouts: payouts || [] }
}
