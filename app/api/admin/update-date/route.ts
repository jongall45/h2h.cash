// Admin endpoint to update contest date
// GET /api/admin/update-date - Updates the live contest to today's date

import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET() {
  try {
    // Update the live contest to today's date at 1:00 PM EST (18:00 UTC)
    const today = new Date()
    const gameTime = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
      18, // 1:00 PM EST = 18:00 UTC
      0,
      0
    ))

    const { data, error } = await supabase
      .from('contests')
      .update({ game_time: gameTime.toISOString() })
      .eq('status', 'live')
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Updated contest date to ${gameTime.toISOString()}`,
      localTime: gameTime.toLocaleString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York'
      }),
      contests: data
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

