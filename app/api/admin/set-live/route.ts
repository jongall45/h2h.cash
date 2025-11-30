// Admin endpoint to set contest status to live
// GET /api/admin/set-live?contestId=xxx
// Or GET /api/admin/set-live to set all open contests to live

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET(request: NextRequest) {
  const contestId = request.nextUrl.searchParams.get('contestId')

  try {
    if (contestId) {
      // Update specific contest
      const { data, error } = await supabase
        .from('contests')
        .update({ status: 'live' })
        .eq('id', contestId)
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Contest ${contestId} set to LIVE`,
        contest: data
      })
    } else {
      // Update all open contests to live
      const { data, error } = await supabase
        .from('contests')
        .update({ status: 'live' })
        .eq('status', 'open')
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `${data?.length || 0} contests set to LIVE`,
        contests: data
      })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

