"use server"

import { supabase } from '../lib/supabase'
import { resolvePicks, getContestLiveStatus, PickResolutionResult } from './getLiveScores'
import { EntryPick } from '../lib/supabase'

// Result type for score updates
export interface ScoreUpdateResult {
  entryId: string
  totalPoints: number
  hitsCount: number
  isPerfect: boolean
  multiplier: number
  pickResults: PickResolutionResult[]
}

// Calculate points with multiplier system
// Multiplier = number of hits (5/5 = 5x, 4/5 = 4x, etc.)
function calculatePointsWithMultiplier(
  picks: EntryPick[],
  results: PickResolutionResult[]
): { totalPoints: number; hitsCount: number; isPerfect: boolean; multiplier: number } {
  let hitsCount = 0
  let basePoints = 0

  results.forEach((result, index) => {
    if (result.hit === true) {
      hitsCount++
      basePoints += picks[index]?.points ?? 0
    }
  })

  const multiplier = hitsCount
  const isPerfect = hitsCount === 5
  const totalPoints = hitsCount === 0 ? 0 : basePoints * multiplier

  return { totalPoints, hitsCount, isPerfect, multiplier }
}

// Update a single entry's score in the database
export async function updateEntryScore(
  entryId: string,
  picks: EntryPick[]
): Promise<ScoreUpdateResult | null> {
  try {
    // Resolve picks against ESPN live data
    const pickData = picks.map(p => ({
      player: p.player,
      stat: p.stat,
      line: p.line,
      points: p.points
    }))

    const results = await resolvePicks(pickData)
    
    // Calculate score with multiplier
    const { totalPoints, hitsCount, isPerfect, multiplier } = calculatePointsWithMultiplier(picks, results)

    // Update the entry in Supabase
    const { error } = await supabase
      .from('entries')
      .update({
        total_points: totalPoints,
        hits_count: hitsCount,
        is_perfect: isPerfect
      })
      .eq('id', entryId)

    if (error) {
      console.error('Error updating entry score:', error)
      // Don't fail - return calculated values even if DB update fails
    }

    return {
      entryId,
      totalPoints,
      hitsCount,
      isPerfect,
      multiplier,
      pickResults: results
    }
  } catch (error) {
    console.error('Error in updateEntryScore:', error)
    return null
  }
}

// Update all entry scores for a contest
export async function updateContestScores(contestId: string): Promise<{
  success: boolean
  updatedEntries: ScoreUpdateResult[]
  contestStatus: {
    hasGamesStarted: boolean
    allGamesCompleted: boolean
    inProgressCount: number
  }
}> {
  try {
    // Get contest status from ESPN
    const liveStatus = await getContestLiveStatus()

    // If no games have started, return early
    if (!liveStatus.hasGamesStarted) {
      return {
        success: true,
        updatedEntries: [],
        contestStatus: liveStatus
      }
    }

    // Fetch all entries for this contest
    const { data: entries, error: fetchError } = await supabase
      .from('entries')
      .select('id, picks')
      .eq('contest_id', contestId)

    if (fetchError || !entries) {
      console.error('Error fetching entries:', fetchError)
      return {
        success: false,
        updatedEntries: [],
        contestStatus: liveStatus
      }
    }

    // Update each entry's score
    const updatePromises = entries.map(entry => 
      updateEntryScore(entry.id, entry.picks as EntryPick[])
    )

    const results = await Promise.all(updatePromises)
    const updatedEntries = results.filter((r): r is ScoreUpdateResult => r !== null)

    // If all games are completed, finalize the contest
    if (liveStatus.allGamesCompleted) {
      await finalizeContest(contestId, updatedEntries)
    }

    return {
      success: true,
      updatedEntries,
      contestStatus: liveStatus
    }
  } catch (error) {
    console.error('Error updating contest scores:', error)
    return {
      success: false,
      updatedEntries: [],
      contestStatus: {
        hasGamesStarted: false,
        allGamesCompleted: false,
        inProgressCount: 0
      }
    }
  }
}

// Finalize contest - set rankings and prizes
async function finalizeContest(contestId: string, entries: ScoreUpdateResult[]): Promise<void> {
  try {
    // Sort entries by points (descending)
    const sorted = [...entries].sort((a, b) => b.totalPoints - a.totalPoints)

    // Get contest payout structure
    const { data: contest } = await supabase
      .from('contests')
      .select('prize_pool, payout_structure')
      .eq('id', contestId)
      .single()

    if (!contest) return

    const prizePool = contest.prize_pool
    const payoutStructure = contest.payout_structure as { place: string; percent: number }[]

    // Update each entry with rank and prize
    for (let i = 0; i < sorted.length; i++) {
      const rank = i + 1
      const entry = sorted[i]

      // Calculate prize based on payout structure
      let prize = 0
      for (const tier of payoutStructure) {
        const tierRanks = parsePlaceString(tier.place)
        if (tierRanks.includes(rank)) {
          // Split prize equally among tied positions in this tier
          const playersInTier = tierRanks.filter(r => r <= sorted.length).length
          prize = Math.floor((prizePool * tier.percent / 100) / playersInTier)
          break
        }
      }

      await supabase
        .from('entries')
        .update({
          rank,
          prize: prize > 0 ? prize : null
        })
        .eq('id', entry.entryId)
    }

    // Update contest status to completed
    await supabase
      .from('contests')
      .update({
        status: 'completed'
      })
      .eq('id', contestId)

    console.log(`Contest ${contestId} finalized with ${sorted.length} entries`)
  } catch (error) {
    console.error('Error finalizing contest:', error)
  }
}

// Parse place strings like "1st", "2nd-3rd", "4th-10th"
function parsePlaceString(place: string): number[] {
  const ranks: number[] = []
  
  // Handle "1st", "2nd", etc.
  const singleMatch = place.match(/^(\d+)(?:st|nd|rd|th)$/i)
  if (singleMatch) {
    return [parseInt(singleMatch[1])]
  }

  // Handle "2nd-3rd", "4th-10th", etc.
  const rangeMatch = place.match(/^(\d+)(?:st|nd|rd|th)-(\d+)(?:st|nd|rd|th)$/i)
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1])
    const end = parseInt(rangeMatch[2])
    for (let i = start; i <= end; i++) {
      ranks.push(i)
    }
    return ranks
  }

  return ranks
}

// Batch update for multiple contests (useful for cron jobs)
export async function updateAllLiveContests(): Promise<{
  updatedContests: string[]
  errors: string[]
}> {
  const updatedContests: string[] = []
  const errors: string[] = []

  try {
    // Get all live contests
    const { data: contests, error } = await supabase
      .from('contests')
      .select('id')
      .eq('status', 'live')

    if (error || !contests) {
      return { updatedContests, errors: ['Failed to fetch live contests'] }
    }

    // Update each contest
    for (const contest of contests) {
      const result = await updateContestScores(contest.id)
      if (result.success) {
        updatedContests.push(contest.id)
      } else {
        errors.push(`Failed to update contest ${contest.id}`)
      }
    }
  } catch (error) {
    errors.push(`Unexpected error: ${error}`)
  }

  return { updatedContests, errors }
}

