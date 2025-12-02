import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // Check if MNF contest already exists
    const { data: existing } = await supabase
      .from('contests')
      .select('id')
      .ilike('name', '%MNF%Patriots%')
      .single()
    
    if (existing) {
      return NextResponse.json({ 
        message: 'MNF contest already exists', 
        contestId: existing.id 
      })
    }

    // Create MNF Showdown contest
    const { data, error } = await supabase
      .from('contests')
      .insert({
        name: '🏈 MNF Showdown: Patriots vs Giants',
        type: 'public',
        entry_fee: 10,
        max_entries: 25,
        current_entries: 0,
        prize_pool: 200,
        rake_percent: 10,
        status: 'open',
        game_time: '2024-12-02T20:15:00Z',
        payout_structure: [
          { place: '1st', percent: 50 },
          { place: '2nd', percent: 30 },
          { place: '3rd', percent: 20 }
        ]
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating contest:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'MNF Showdown contest created!',
      contest: data 
    })
  } catch (err) {
    console.error('Exception:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
