import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // Force MNF contest to open
    const { data, error } = await supabase
      .from('contests')
      .update({ status: 'open' })
      .ilike('name', '%MNF%')
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No MNF contest found' }, { status: 404 })
    }

    const contest = data[0]
    
    return NextResponse.json({ 
      success: true,
      message: 'Contest forced to OPEN!',
      contestId: contest.id,
      enterUrl: `/contests/${contest.id}/enter`,
      status: contest.status
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
