import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  // Get all contests
  const { data: contests, error } = await supabase
    .from('contests')
    .select('id, name, status, game_time')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Force update MNF to open
  const { error: updateError } = await supabase
    .from('contests')
    .update({ status: 'open' })
    .ilike('name', '%MNF%')

  const mnfContest = contests?.find(c => c.name.includes('MNF'))
  
  return NextResponse.json({
    allContests: contests,
    mnfContest,
    updateError: updateError?.message,
    directEntryUrl: mnfContest ? `https://h2h.cash/contests/${mnfContest.id}/enter` : null,
    message: 'MNF status set to open. Use the directEntryUrl to enter!'
  })
}
