// Manual score update endpoint for testing
// GET /api/update-scores?contestId=xxx
// Or GET /api/update-scores to update all live contests

import { NextRequest, NextResponse } from 'next/server'
import { updateContestScores, updateAllLiveContests } from '../../actions/updateScores'

export async function GET(request: NextRequest) {
  const contestId = request.nextUrl.searchParams.get('contestId')

  try {
    if (contestId) {
      // Update specific contest
      console.log(`[API] Updating scores for contest: ${contestId}`)
      const result = await updateContestScores(contestId)

      return NextResponse.json({
        success: result.success,
        contestId,
        entriesUpdated: result.updatedEntries.length,
        contestStatus: result.contestStatus,
        entries: result.updatedEntries.map(e => ({
          entryId: e.entryId,
          points: e.totalPoints,
          hits: e.hitsCount,
          multiplier: e.multiplier,
          isPerfect: e.isPerfect
        }))
      })
    } else {
      // Update all live contests
      console.log('[API] Updating all live contests')
      const result = await updateAllLiveContests()

      return NextResponse.json({
        success: result.errors.length === 0,
        updatedContests: result.updatedContests,
        errors: result.errors
      })
    }
  } catch (error) {
    console.error('[API] Error updating scores:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST endpoint for cron jobs / webhooks
export async function POST(request: NextRequest) {
  // Same as GET but for programmatic access
  return GET(request)
}

