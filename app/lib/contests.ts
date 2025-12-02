// Contest Types and Supabase Integration
import { supabase, DbContest, DbEntry, PayoutTier, EntryPick, generateInviteCode, calculatePrizePool, PAYOUT_STRUCTURES } from './supabase'

// Re-export for convenience
export { generateInviteCode, calculatePrizePool, PAYOUT_STRUCTURES }
export type { PayoutTier, EntryPick }

// Frontend-friendly types
export interface Contest {
  id: string
  name: string
  type: 'public' | 'private'
  entryFee: number
  maxEntries: number
  currentEntries: number
  prizePool: number
  rakePercent: number
  status: 'open' | 'live' | 'completed' | 'cancelled'
  gameTime: string
  createdBy: string | null
  inviteCode: string | null
  payoutStructure: PayoutTier[]
  entries: ContestEntry[]
}

export interface ContestEntry {
  id: string
  oduserId: string
  username: string
  odavatarUrl?: string
  picks: EntryPick[]
  totalPoints: number
  hitsCount: number
  isPerfect: boolean
  rank: number | null
  prize: number | null
  submittedAt: string
}

// Transform DB contest to frontend format
function transformContest(db: DbContest, entries: DbEntry[] = []): Contest {
  return {
    id: db.id,
    name: db.name,
    type: db.type,
    entryFee: db.entry_fee,
    maxEntries: db.max_entries,
    currentEntries: db.current_entries,
    prizePool: db.prize_pool,
    rakePercent: db.rake_percent,
    status: db.status,
    gameTime: db.game_time,
    createdBy: db.created_by,
    inviteCode: db.invite_code,
    payoutStructure: db.payout_structure,
    entries: entries.map(transformEntry)
  }
}

// Transform DB entry to frontend format
function transformEntry(db: DbEntry): ContestEntry {
  return {
    id: db.id,
    oduserId: db.user_id,
    username: db.username,
    picks: db.picks,
    totalPoints: db.total_points,
    hitsCount: db.hits_count,
    isPerfect: db.is_perfect,
    rank: db.rank,
    prize: db.prize,
    submittedAt: db.created_at
  }
}

// =============================================
// CONTEST FUNCTIONS
// =============================================

// Get all public contests
export async function getContests(): Promise<Contest[]> {
  const { data: contests, error } = await supabase
    .from('contests')
    .select('*')
    .eq('type', 'public')
    .in('status', ['open', 'live'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching contests:', error)
    return []
  }

  return (contests || []).map(c => transformContest(c as DbContest))
}

// Get single contest with entries
export async function getContest(id: string): Promise<Contest | null> {
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('*')
    .eq('id', id)
    .single()

  if (contestError || !contest) {
    console.error('Error fetching contest:', contestError)
    return null
  }

  // Get entries for leaderboard
  const { data: entries, error: entriesError } = await supabase
    .from('entries')
    .select('*')
    .eq('contest_id', id)
    .order('total_points', { ascending: false })
    .limit(100)

  if (entriesError) {
    console.error('Error fetching entries:', entriesError)
  }

  return transformContest(contest as DbContest, (entries || []) as DbEntry[])
}

// Get contest by invite code
export async function getContestByCode(code: string): Promise<Contest | null> {
  const { data: contest, error } = await supabase
    .from('contests')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .single()

  if (error || !contest) {
    return null
  }

  return transformContest(contest as DbContest)
}

// Create new contest
export async function createContest(params: {
  name: string
  type: 'public' | 'private'
  entryFee: number
  maxEntries: number
  gameTime: string
  createdBy?: string
  payoutStructure: PayoutTier[]
}): Promise<Contest | null> {
  const inviteCode = params.type === 'private' ? generateInviteCode() : null

  const { data, error } = await supabase
    .from('contests')
    .insert({
      name: params.name,
      type: params.type,
      entry_fee: params.entryFee,
      max_entries: params.maxEntries,
      game_time: params.gameTime,
      created_by: params.createdBy || null,
      invite_code: inviteCode,
      payout_structure: params.payoutStructure,
      rake_percent: 10,
      status: 'open'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating contest:', error)
    return null
  }

  return transformContest(data as DbContest)
}

// =============================================
// ENTRY FUNCTIONS
// =============================================

// Submit entry to contest
export async function submitEntry(
  contestId: string, 
  entry: {
    userId: string
    username: string
    picks: EntryPick[]
  }
): Promise<ContestEntry | null> {
  const totalPoints = entry.picks.reduce((sum, p) => sum + p.points, 0)
  
  const { data, error } = await supabase
    .from('entries')
    .insert({
      contest_id: contestId,
      user_id: entry.userId,
      username: entry.username,
      picks: entry.picks,
      total_points: totalPoints,
      hits_count: 0,
      is_perfect: false
    })
    .select()
    .single()

  if (error) {
    console.error('Entry save failed:', error)
    throw new Error(`Failed to save entry: ${error.message}`)
  }

  return transformEntry(data as DbEntry)
}

// Get user's entries for a contest
export async function getUserEntries(contestId: string, oduserId: string): Promise<ContestEntry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('contest_id', contestId)
    .eq('user_id', oduserId)

  if (error) {
    console.error('Error fetching user entries:', error)
    return []
  }

  return (data || []).map(e => transformEntry(e as DbEntry))
}

// Get all entries for a user across all contests
export async function getMyEntries(oduserId: string): Promise<{ odcontestId: string; entryId: string }[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('id, contest_id')
    .eq('user_id', oduserId)

  if (error) {
    console.error('Error fetching my entries:', error)
    return []
  }

  return (data || []).map(e => ({
    odcontestId: e.contest_id,
    entryId: e.id
  }))
}

// =============================================
// REAL-TIME SUBSCRIPTIONS
// =============================================

// Subscribe to contest updates
export function subscribeToContest(contestId: string, callback: (contest: Contest) => void) {
  const channel = supabase
    .channel(`contest-${contestId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'contests',
        filter: `id=eq.${contestId}`
      },
      async () => {
        const contest = await getContest(contestId)
        if (contest) callback(contest)
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'entries',
        filter: `contest_id=eq.${contestId}`
      },
      async () => {
        const contest = await getContest(contestId)
        if (contest) callback(contest)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// =============================================
// USER FUNCTIONS
// =============================================

// Get or create user
export async function getOrCreateUser(username: string, email?: string): Promise<{ id: string; username: string } | null> {
  try {
    // Try to find existing user
    const { data: existing } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username)
      .single()

    if (existing) {
      return existing
    }

    // Create new user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        username,
        email: email || null,
        balance: 0
      })
      .select('id, username')
      .single()

    if (error) {
      console.error('Error creating user:', error.message)
      // Return a mock user for demo purposes
      return {
        id: 'local-user-' + Date.now(),
        username: username
      }
    }

    return newUser
  } catch (err) {
    console.error('Exception in getOrCreateUser:', err)
    // Return a mock user for demo purposes
    return {
      id: 'local-user-' + Date.now(),
      username: username
    }
  }
}

// Calculate payouts based on structure
export function calculatePayouts(prizePool: number, entries: number, structure: PayoutTier[]): { place: string; amount: number }[] {
  return structure.map(tier => ({
    place: tier.place,
    amount: Math.floor(prizePool * (tier.percent / 100))
  }))
}

// Calculate total points with NEW MULTIPLIER SYSTEM
// Multiplier = number of hits
// 5/5 = 5x, 4/5 = 4x, 3/5 = 3x, 2/5 = 2x, 1/5 = 1x, 0/5 = 0 points
export function calculateTotalPoints(picks: EntryPick[]): { total: number; hits: number; isPerfect: boolean; multiplier: number } {
  const hits = picks.filter(p => p.hit === true).length
  const basePoints = picks.reduce((sum, p) => sum + (p.hit === true ? p.points : 0), 0)
  const isPerfect = hits === 5
  
  // NEW: Multiplier equals number of hits
  // If 0 hits, total is 0
  const multiplier = hits
  const total = hits === 0 ? 0 : basePoints * multiplier
  
  return { total, hits, isPerfect, multiplier }
}

// Get all contests including completed (for history/browse)
export async function getAllContests(): Promise<Contest[]> {
  const { data: contests, error } = await supabase
    .from('contests')
    .select('*')
    .eq('type', 'public')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching all contests:', error)
    return []
  }

  return (contests || []).map(c => transformContest(c as DbContest))
}

// Get completed contests with winners
export async function getCompletedContests(): Promise<Contest[]> {
  const { data: contests, error } = await supabase
    .from('contests')
    .select('*')
    .eq('type', 'public')
    .eq('status', 'completed')
    .order('finalized_at', { ascending: false })

  if (error) {
    console.error('Error fetching completed contests:', error)
    return []
  }

  return (contests || []).map(c => transformContest(c as DbContest))
}

// Get contest winners (top 3)
export async function getContestWinners(contestId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*, users(username)')
    .eq('contest_id', contestId)
    .not('rank', 'is', null)
    .order('rank', { ascending: true })
    .limit(10)

  if (error) {
    console.error('Error fetching winners:', error)
    return []
  }

  return data || []
}
