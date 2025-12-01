"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Trophy, DollarSign, TrendingUp, Award, ChevronRight } from 'lucide-react'
import { getUserProfile, updateUsername, updateBio, clearUserProfile, type UserProfile } from "../lib/user"
import { getDraftStats } from "../lib/drafts"
import { getUserWinnings } from "../actions/resolveContest"
import { useAuth } from "../components/AuthProvider"

interface WinningsData {
  totalWinnings: number
  contestsWon: number
  payouts: Array<{
    id: string
    amount: number
    rank: number
    created_at: string
    contests?: { name: string }
  }>
}

export default function ProfilePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [winnings, setWinnings] = useState<WinningsData>({ totalWinnings: 0, contestsWon: 0, payouts: [] })
  const [isEditing, setIsEditing] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editBio, setEditBio] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const userProfile = getUserProfile()
    if (!userProfile) {
      router.push('/login')
      return
    }

    // Update stats from drafts
    const stats = getDraftStats()
    userProfile.stats = stats
    setProfile(userProfile)
    setEditUsername(userProfile.username)
    setEditBio(userProfile.bio)
  }, [router])

  // Fetch winnings data
  useEffect(() => {
    if (user?.id) {
      getUserWinnings(user.id).then(data => {
        setWinnings(data)
      })
    }
  }, [user?.id])

  const handleSave = () => {
    setError('')

    if (!/^[a-zA-Z0-9]{3,20}$/.test(editUsername)) {
      setError('Username must be 3-20 alphanumeric characters')
      return
    }

    updateUsername(editUsername)
    updateBio(editBio)

    setProfile(prev => prev ? { ...prev, username: editUsername, bio: editBio } : null)
    setIsEditing(false)
  }

  const handleSignOut = () => {
    clearUserProfile()
    router.push('/')
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div style={{ color: '#00C853' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen bg-[#0a0a0a] text-white"
      style={{ fontFamily: "'Inter', sans-serif" }}
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
    >
      {/* Subtle background effect */}
      <div 
        className="fixed z-0 pointer-events-none"
        style={{
          left: mousePos.x - 300,
          top: mousePos.y - 300,
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(0,200,83,0.06) 0%, transparent 70%)',
          borderRadius: '50%'
        }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#1A1A1A]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.02em' }}>
              <span style={{ color: '#fff' }}>h2h.</span>
              <span style={{ color: '#00C853' }}>cash</span>
            </div>
          </Link>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link 
              href="/contests"
              className="px-4 py-2 bg-transparent border border-[#2A2A2A] rounded-full text-[#888] text-sm hover:border-[#3A3A3A] hover:text-white transition-all"
              style={{ textDecoration: 'none' }}
            >
              Contests
            </Link>
            <Link 
              href="/contests"
              className="px-4 py-2 bg-[#00C853] hover:bg-[#00E676] text-black font-semibold text-sm rounded-full transition-all"
              style={{ textDecoration: 'none' }}
            >
              Enter Contest
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 pt-24 px-6 pb-12">
        <div className="max-w-2xl mx-auto">
          
          {/* Balance Card - Hero Section */}
          <div 
            className="mb-6 p-6 rounded-2xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(0,200,83,0.15) 0%, rgba(0,200,83,0.05) 100%)',
              border: '1px solid rgba(0,200,83,0.2)'
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[#888] text-sm mb-1">Available Balance</div>
                <div className="text-4xl font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  ${winnings.totalWinnings.toLocaleString()}
                </div>
              </div>
              <div className="w-14 h-14 rounded-full bg-[#00C853]/20 flex items-center justify-center">
                <DollarSign size={28} className="text-[#00C853]" />
              </div>
            </div>
            {winnings.contestsWon > 0 && (
              <div className="mt-4 pt-4 border-t border-[rgba(0,200,83,0.2)] flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-[#FFB300]" />
                  <span className="text-sm text-[#888]">{winnings.contestsWon} contest{winnings.contestsWon !== 1 ? 's' : ''} won</span>
                </div>
              </div>
            )}
          </div>

          {/* Profile Card */}
          <div className="bg-[#111] border border-[#1A1A1A] rounded-2xl overflow-hidden mb-6">
            {/* Profile Header */}
            <div className="p-6 border-b border-[#1A1A1A] flex items-start gap-5">
              {/* Avatar */}
              <div 
                className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0"
                style={{ border: '3px solid #00C853' }}
              >
                {profile.image ? (
                  <img 
                    src={profile.image} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#1A1A1A] flex items-center justify-center text-2xl text-[#555]">
                    {profile.name?.charAt(0) || '?'}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                {isEditing ? (
                  <div>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                      maxLength={20}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2A2A2A] rounded-lg text-white text-lg font-medium mb-3"
                    />
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      maxLength={150}
                      rows={2}
                      placeholder="Add a bio..."
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2A2A2A] rounded-lg text-white text-sm resize-none"
                    />
                    {error && (
                      <div className="text-[#FF5252] text-xs mt-2">{error}</div>
                    )}
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-semibold text-white mb-1">{profile.username}</h1>
                    <p className="text-xs text-[#555] mb-2">{profile.email}</p>
                    {profile.bio && (
                      <p className="text-sm text-[#888] leading-relaxed">{profile.bio}</p>
                    )}
                  </>
                )}
              </div>

              {/* Edit Button */}
              <div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsEditing(false)
                        setEditUsername(profile.username)
                        setEditBio(profile.bio)
                        setError('')
                      }}
                      className="px-3 py-1.5 bg-transparent border border-[#2A2A2A] rounded-lg text-[#888] text-xs hover:border-[#3A3A3A]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-3 py-1.5 bg-[#00C853] rounded-lg text-black text-xs font-semibold hover:bg-[#00E676]"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 bg-transparent border border-[#2A2A2A] rounded-lg text-[#888] text-xs hover:border-[#3A3A3A] hover:text-white transition-all"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 border-b border-[#1A1A1A]">
              <div className="p-4 text-center border-r border-[#1A1A1A]">
                <div className="text-2xl font-bold text-white">{profile.stats.totalDrafts}</div>
                <div className="text-[10px] text-[#555] uppercase tracking-wider mt-1">Entries</div>
              </div>
              <div className="p-4 text-center border-r border-[#1A1A1A]">
                <div className="text-2xl font-bold text-[#00C853]">{winnings.contestsWon}</div>
                <div className="text-[10px] text-[#555] uppercase tracking-wider mt-1">Wins</div>
              </div>
              <div className="p-4 text-center border-r border-[#1A1A1A]">
                <div className="text-2xl font-bold text-[#FFB300]">
                  {profile.stats.totalDrafts > 0 
                    ? Math.round((winnings.contestsWon / profile.stats.totalDrafts) * 100) 
                    : 0}%
                </div>
                <div className="text-[10px] text-[#555] uppercase tracking-wider mt-1">Win Rate</div>
              </div>
              <div className="p-4 text-center">
                <div className={`text-2xl font-bold ${winnings.totalWinnings >= 0 ? 'text-[#00C853]' : 'text-[#FF5252]'}`}>
                  ${winnings.totalWinnings}
                </div>
                <div className="text-[10px] text-[#555] uppercase tracking-wider mt-1">Winnings</div>
              </div>
            </div>

            {/* Member Info & Sign Out */}
            <div className="px-6 py-4 flex justify-between items-center">
              <div className="text-xs text-[#555]">
                Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 bg-transparent border border-[#2A2A2A] rounded-lg text-[#FF5252] text-xs hover:border-[#FF5252]/30 transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Recent Payouts */}
          {winnings.payouts.length > 0 && (
            <div className="bg-[#111] border border-[#1A1A1A] rounded-2xl overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-[#1A1A1A] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Recent Winnings</h2>
                <Trophy size={16} className="text-[#FFB300]" />
              </div>
              <div className="divide-y divide-[#1A1A1A]">
                {winnings.payouts.slice(0, 5).map((payout) => (
                  <div key={payout.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#151515] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#00C853]/10 flex items-center justify-center">
                        <Award size={18} className="text-[#00C853]" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {payout.contests?.name || 'Contest'}
                        </div>
                        <div className="text-xs text-[#555]">
                          #{payout.rank} place • {new Date(payout.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-lg font-bold text-[#00C853]">
                      +${payout.amount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <Link 
              href="/contests"
              className="p-5 bg-[#111] border border-[#1A1A1A] rounded-xl text-center hover:border-[#2A2A2A] transition-all group"
              style={{ textDecoration: 'none' }}
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#00C853]/10 flex items-center justify-center group-hover:bg-[#00C853]/20 transition-colors">
                <TrendingUp size={24} className="text-[#00C853]" />
              </div>
              <div className="text-sm font-medium text-white mb-1">Browse Contests</div>
              <div className="text-xs text-[#555]">Find your next win</div>
            </Link>
            <Link 
              href="/drafts"
              className="p-5 bg-[#111] border border-[#1A1A1A] rounded-xl text-center hover:border-[#2A2A2A] transition-all group"
              style={{ textDecoration: 'none' }}
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#FFB300]/10 flex items-center justify-center group-hover:bg-[#FFB300]/20 transition-colors">
                <Trophy size={24} className="text-[#FFB300]" />
              </div>
              <div className="text-sm font-medium text-white mb-1">My Entries</div>
              <div className="text-xs text-[#555]">{profile.stats.totalDrafts} total entries</div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
