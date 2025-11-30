import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create client only if we have valid credentials
let supabase: SupabaseClient

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
  // Create a dummy client for build time - will be replaced at runtime
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key')
}

export { supabase }

// Database types
export interface DbContest {
  id: string
  name: string
  type: 'public' | 'private'
  entry_fee: number
  max_entries: number
  current_entries: number
  prize_pool: number
  rake_percent: number
  status: 'open' | 'live' | 'completed' | 'cancelled'
  game_time: string
  created_by: string | null
  invite_code: string | null
  payout_structure: PayoutTier[]
  created_at: string
}

export interface DbEntry {
  id: string
  contest_id: string
  user_id: string
  username: string
  picks: EntryPick[]
  total_points: number
  hits_count: number
  is_perfect: boolean
  rank: number | null
  prize: number | null
  created_at: string
}

export interface DbUser {
  id: string
  username: string
  email: string | null
  avatar_url: string | null
  balance: number
  created_at: string
}

export interface PayoutTier {
  place: string
  percent: number
}

export interface EntryPick {
  team?: string  // Team abbreviation for accurate player matching
  player: string
  stat: string
  line: number
  points: number
  hit?: boolean | null
  }

// Helper to generate invite codes
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Calculate prize pool after rake
export function calculatePrizePool(entryFee: number, entries: number, rakePercent: number): number {
  const totalCollected = entryFee * entries
  return totalCollected * (1 - rakePercent / 100)
}

// Standard payout structures
export const PAYOUT_STRUCTURES = {
  winnerTakesAll: [
    { place: '1st', percent: 100 }
  ],
  top3: [
    { place: '1st', percent: 50 },
    { place: '2nd', percent: 30 },
    { place: '3rd', percent: 20 }
  ],
  top25Percent: [
    { place: '1st', percent: 20 },
    { place: '2nd', percent: 12 },
    { place: '3rd', percent: 8 },
    { place: '4th-5th', percent: 10 },
    { place: '6th-10th', percent: 15 },
    { place: '11th-25%', percent: 35 }
  ]
}
