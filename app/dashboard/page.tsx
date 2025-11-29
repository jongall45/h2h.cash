"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Trophy, History, Wallet, Settings, LogOut, ChevronRight, Loader2, User, Medal, Target, Zap } from "lucide-react"
import { getCurrentUser, signOut, getUserEntryHistory, User as AuthUser } from "../lib/auth"

interface EntryWithContest {
  id: string
  contest_id: string
  picks: any[]
  total_points: number
  hits_count: number
  is_perfect: boolean
  rank: number | null
  prize: number | null
  created_at: string
  contests: {
    id: string
    name: string
    entry_fee: number
    prize_pool: number
    status: string
    game_time: string
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [entries, setEntries] = useState<EntryWithContest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'settings'>('overview')

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    setLoading(true)
    
    // Try to get user from Supabase auth
    const { user: currentUser, error } = await getCurrentUser()
    
    // Fallback to local storage if not authenticated
    let finalUser = currentUser
    if (!finalUser && typeof window !== 'undefined') {
      const stored = localStorage.getItem('h2h_user')
      if (stored) {
        finalUser = JSON.parse(stored)
      }
    }

    if (!finalUser) {
      router.push('/auth')
      return
    }

    setUser(finalUser)

    // Load entry history
    const history = await getUserEntryHistory(finalUser.id)
    setEntries(history as EntryWithContest[])
    
    setLoading(false)
  }

  const handleSignOut = async () => {
    await signOut()
    localStorage.removeItem('h2h_user')
    router.push('/')
  }

  // Calculate stats
  const totalEntries = entries.length
  const totalWinnings = entries.reduce((sum, e) => sum + (e.prize || 0), 0)
  const perfectLineups = entries.filter(e => e.is_perfect).length
  const avgPoints = totalEntries > 0 
    ? entries.reduce((sum, e) => sum + e.total_points, 0) / totalEntries 
    : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#00FF00]" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20" 
           style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(0,255,0,0.15), transparent 50%)' }}></div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            <span className="text-white">h2h</span>
            <span className="text-[#00FF00]">.cash</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/contests"
              className="px-4 py-2 bg-[#00FF00] text-black font-bold rounded-lg text-sm hover:bg-[#00DD00] transition-all"
            >
              Play Now
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        {/* Profile Header */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-6 backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00FF00]/20 to-[#00FF00]/5 border border-[#00FF00]/30 flex items-center justify-center">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} className="w-full h-full rounded-full object-cover" />
              ) : (
                <User size={28} className="text-[#00FF00]" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{user.username}</h1>
              <p className="text-white/40 text-sm">{user.email || user.phone}</p>
            </div>
          </div>

          {/* Balance Card */}
          <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/40 text-sm mb-1">Balance</div>
                <div className="text-3xl font-bold text-[#00FF00]">${user.balance.toFixed(2)}</div>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-white/10 rounded-lg text-sm font-medium hover:bg-white/20 transition-all">
                  Deposit
                </button>
                <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium hover:bg-white/10 transition-all">
                  Withdraw
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Trophy size={20} />} label="Total Entries" value={totalEntries.toString()} color="#00FF00" />
          <StatCard icon={<Wallet size={20} />} label="Winnings" value={`$${totalWinnings.toFixed(0)}`} color="#FFD700" />
          <StatCard icon={<Zap size={20} />} label="Perfect Lineups" value={perfectLineups.toString()} color="#ff6b35" />
          <StatCard icon={<Target size={20} />} label="Avg Points" value={avgPoints.toFixed(1)} color="#ffffff" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
            <Trophy size={16} /> Overview
          </TabButton>
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
            <History size={16} /> History
          </TabButton>
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
            <Settings size={16} /> Settings
          </TabButton>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-4">Recent Entries</h2>
            {entries.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <Trophy size={40} className="mx-auto mb-4 text-white/20" />
                <p className="text-white/40 mb-4">No entries yet</p>
                <Link 
                  href="/contests"
                  className="inline-block px-6 py-3 bg-[#00FF00] text-black font-bold rounded-xl hover:bg-[#00DD00] transition-all"
                >
                  Enter a Contest
                </Link>
              </div>
            ) : (
              entries.slice(0, 5).map(entry => (
                <EntryCard key={entry.id} entry={entry} />
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-4">Entry History</h2>
            {entries.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <History size={40} className="mx-auto mb-4 text-white/20" />
                <p className="text-white/40">No history yet</p>
              </div>
            ) : (
              entries.map(entry => (
                <EntryCard key={entry.id} entry={entry} />
              ))
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-4">Account Settings</h2>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <button className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/5">
                <div className="flex items-center gap-3">
                  <User size={20} className="text-white/40" />
                  <span>Edit Profile</span>
                </div>
                <ChevronRight size={20} className="text-white/20" />
              </button>
              
              <button className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/5">
                <div className="flex items-center gap-3">
                  <Wallet size={20} className="text-white/40" />
                  <span>Payment Methods</span>
                </div>
                <ChevronRight size={20} className="text-white/20" />
              </button>
              
              <button 
                onClick={handleSignOut}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors text-red-400"
              >
                <div className="flex items-center gap-3">
                  <LogOut size={20} />
                  <span>Sign Out</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div className="text-white/40 text-xs uppercase tracking-wider">{label}</div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${
        active 
          ? 'bg-white/10 text-white' 
          : 'text-white/40 hover:text-white hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  )
}

function EntryCard({ entry }: { entry: EntryWithContest }) {
  const contest = entry.contests
  const statusColor = contest?.status === 'completed' 
    ? (entry.prize && entry.prize > 0 ? '#00FF00' : '#ef4444')
    : '#FFD700'

  return (
    <Link 
      href={`/contests/${entry.contest_id}`}
      className="block bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/[0.07] transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold text-white">{contest?.name || 'Contest'}</div>
        <div 
          className="px-2 py-1 rounded text-xs font-bold uppercase"
          style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
        >
          {contest?.status || 'unknown'}
        </div>
      </div>
      
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-white/40 text-xs">Points</div>
            <div className="font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{entry.total_points.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-white/40 text-xs">Hits</div>
            <div className="font-bold">{entry.hits_count}/5</div>
          </div>
          {entry.rank && (
            <div>
              <div className="text-white/40 text-xs">Rank</div>
              <div className="font-bold flex items-center gap-1">
                {entry.rank <= 3 && <Medal size={14} className="text-yellow-500" />}
                #{entry.rank}
              </div>
            </div>
          )}
        </div>
        
        {entry.prize && entry.prize > 0 && (
          <div className="text-right">
            <div className="text-white/40 text-xs">Won</div>
            <div className="font-bold text-[#00FF00]">${entry.prize.toFixed(2)}</div>
          </div>
        )}
      </div>

      {entry.is_perfect && (
        <div className="mt-3 flex items-center gap-2 text-yellow-500 text-xs font-medium">
          <Zap size={14} />
          Perfect Lineup (2x Bonus)
        </div>
      )}
    </Link>
  )
}

