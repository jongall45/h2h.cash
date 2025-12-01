import { NextRequest, NextResponse } from 'next/server'
import { checkContestResolution, finalizeContest } from '../../actions/resolveContest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// This endpoint can be called by a cron job or manually
export async function POST(request: NextRequest) {
  try {
    // Get all live contests
    const { data: liveContests, error } = await supabase
      .from('contests')
      .select('id, name, status')
      .in('status', ['live', 'resolving'])
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    const results = []
    
    for (const contest of liveContests || []) {
      // Check if this contest should be resolved
      const resolution = await checkContestResolution(contest.id)
      
      if (resolution.shouldResolve) {
        // Finalize the contest
        const result = await finalizeContest(contest.id)
        results.push({
          contestId: contest.id,
          contestName: contest.name,
          action: 'finalized',
          winners: result?.winners.length || 0
        })
      } else if (resolution.allGamesComplete && !resolution.shouldResolve) {
        // In resolution period (10 min wait)
        results.push({
          contestId: contest.id,
          contestName: contest.name,
          action: 'in_resolution',
          resolutionStartTime: resolution.resolutionStartTime
        })
      } else {
        results.push({
          contestId: contest.id,
          contestName: contest.name,
          action: 'waiting',
          reason: 'Games still in progress'
        })
      }
    }
    
    return NextResponse.json({ 
      success: true,
      contestsProcessed: results.length,
      results
    })
  } catch (error) {
    console.error('Error in resolution:', error)
    return NextResponse.json({ 
      error: String(error) 
    }, { status: 500 })
  }
}

// GET endpoint to check resolution status
export async function GET(request: NextRequest) {
  const contestId = request.nextUrl.searchParams.get('contestId')
  
  if (!contestId) {
    return NextResponse.json({ error: 'Missing contestId' }, { status: 400 })
  }
  
  const resolution = await checkContestResolution(contestId)
  
  return NextResponse.json(resolution)
}
