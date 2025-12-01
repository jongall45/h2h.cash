"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Trophy, Users, Clock, ChevronRight, Plus, Lock, Globe, Loader2, Zap, History, Crown, Medal } from "lucide-react"
import { getContests, getAllContests, getCompletedContests, Contest } from "../lib/contests"
import { UserHeader } from "../components/UserHeader"

export default function ContestsPage() {
  const [activeContests, setActiveContests] = useState<Contest[]>([])
  const [completedContests, setCompletedContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active')
  const [joinCode, setJoinCode] = useState('')
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    loadContests()
  }, [])

  const loadContests = async () => {
    setLoading(true)
    const [active, completed] = await Promise.all([
      getContests(),
      getCompletedContests()
    ])
    setActiveContests(active)
    setCompletedContests(completed)
    setLoading(false)
  }

  const handleJoinByCode = async () => {
    setJoining(true)
    setJoinError('')
    
    // Import dynamically to avoid issues
    const { getContestByCode } = await import('../lib/contests')
    const contest = await getContestByCode(joinCode.toUpperCase())
    
    if (contest) {
      window.location.href = `/contests/${contest.id}`
    } else {
      setJoinError('Contest not found. Check your code.')
    }
    setJoining(false)
  }

  const formatPrizePool = (amount: number) => {
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`
    return `$${amount.toFixed(0)}`
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }

  const contests = activeTab === 'active' ? activeContests : completedContests
  const totalPrizes = activeContests.reduce((sum, c) => sum + c.prizePool, 0)
  const totalEntries = activeContests.reduce((sum, c) => sum + c.currentEntries, 0)

  return (
    <div 
      className="min-h-screen bg-[#0a0a0a] text-white relative"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      onMouseMove={handleMouseMove}
    >
      {/* Grid Background */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }}
      />
      
      {/* Green glow that follows mouse */}
      <div 
        className="fixed z-0 pointer-events-none"
        style={{
          left: mousePos.x - 200,
          top: mousePos.y - 200,
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(0,255,0,0.08) 0%, transparent 70%)',
          borderRadius: '50%'
        }}
      />

      <UserHeader />

      <main className="relative z-10 pt-24 px-4 sm:px-6 pb-20 max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">
            Compete for <span className="text-[#00FF00]">Cash</span>
          </h1>
          <p className="text-[#888] text-lg">Pick your props. Beat the field. Win prizes.</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6 text-center">
            <div className="text-3xl font-bold text-[#00FF00]">{activeContests.length}</div>
            <div className="text-xs text-[#666] uppercase tracking-wider mt-1">Active</div>
          </div>
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6 text-center">
            <div className="text-3xl font-bold">{formatPrizePool(totalPrizes)}</div>
            <div className="text-xs text-[#666] uppercase tracking-wider mt-1">In Prizes</div>
          </div>
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6 text-center">
            <div className="text-3xl font-bold">{totalEntries}</div>
            <div className="text-xs text-[#666] uppercase tracking-wider mt-1">Entries</div>
          </div>
        </div>

        {/* Multiplier Info */}
        <div className="bg-gradient-to-r from-[#1a1500] to-[#1a1a00] border border-[#FFB300]/30 rounded-2xl p-5 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#FFB300]/20 flex items-center justify-center">
            <Zap size={24} className="text-[#FFB300]" />
          </div>
          <div>
            <div className="text-[#FFB300] font-bold text-lg">Hits = Multiplier!</div>
            <div className="text-[#888]">Your multiplier equals your hits: <span className="text-white font-semibold">5x • 4x • 3x • 2x • 1x</span></div>
            <div className="text-[#666] text-sm">0 hits = 0 points. Every hit matters!</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-5 py-2.5 rounded-full font-medium transition-all ${
              activeTab === 'active'
                ? 'bg-[#00FF00] text-black'
                : 'bg-[#1A1A1A] text-[#888] hover:text-white border border-[#333]'
            }`}
          >
            <Trophy size={16} className="inline mr-2" />
            Active ({activeContests.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-5 py-2.5 rounded-full font-medium transition-all ${
              activeTab === 'completed'
                ? 'bg-[#00FF00] text-black'
                : 'bg-[#1A1A1A] text-[#888] hover:text-white border border-[#333]'
            }`}
          >
            <History size={16} className="inline mr-2" />
            Completed ({completedContests.length})
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="ml-auto px-5 py-2.5 rounded-full font-medium bg-[#1A1A1A] text-[#888] hover:text-white border border-[#333] transition-all"
          >
            Join Private
          </button>
        </div>

        {/* Contest List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[#00FF00]" />
          </div>
        ) : contests.length === 0 ? (
          <div className="text-center py-20">
            <Trophy size={48} className="mx-auto text-[#333] mb-4" />
            <h3 className="text-xl font-bold mb-2">
              {activeTab === 'active' ? 'No Active Contests' : 'No Completed Contests Yet'}
            </h3>
            <p className="text-[#666]">
              {activeTab === 'active' 
                ? 'Check back soon for new tournaments!'
                : 'Completed contests will appear here with their winners.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {contests.map(contest => (
              <Link
                key={contest.id}
                href={`/contests/${contest.id}`}
                className="block bg-[#111] border border-[#222] rounded-2xl p-5 hover:border-[#333] hover:bg-[#151515] transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {contest.type === 'private' && <Lock size={14} className="text-[#666]" />}
                      <Trophy size={18} className="text-[#00FF00]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-[#00FF00] transition-colors">
                        🏆 {contest.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-[#666]">
                        <Clock size={14} />
                        {formatTime(contest.gameTime)}
                        {contest.status === 'live' && (
                          <span className="px-2 py-0.5 bg-[#FF5252]/20 text-[#FF5252] text-xs rounded-full font-semibold animate-pulse">
                            LIVE
                          </span>
                        )}
                        {contest.status === 'completed' && (
                          <span className="px-2 py-0.5 bg-[#888]/20 text-[#888] text-xs rounded-full font-semibold">
                            COMPLETED
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-[#444] group-hover:text-[#00FF00] transition-colors" />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-[#0a0a0a] rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-[#00FF00]">${contest.entryFee}</div>
                    <div className="text-[10px] text-[#555] uppercase tracking-wider">Entry</div>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-xl p-3 text-center">
                    <div className="text-xl font-bold">{formatPrizePool(contest.prizePool)}</div>
                    <div className="text-[10px] text-[#555] uppercase tracking-wider">Prizes</div>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-xl p-3 text-center">
                    <div className="text-xl font-bold">{contest.currentEntries}<span className="text-[#555]">/{contest.maxEntries}</span></div>
                    <div className="text-[10px] text-[#555] uppercase tracking-wider">Entries</div>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-xl p-3 text-center">
                    <div className="text-xl font-bold">Top {Math.round((contest.payoutStructure.length / contest.maxEntries) * 100)}%</div>
                    <div className="text-[10px] text-[#555] uppercase tracking-wider">Paid</div>
                  </div>
                </div>

                {/* Progress bar for active contests */}
                {contest.status !== 'completed' && (
                  <div className="mt-4">
                    <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#00FF00] rounded-full transition-all"
                        style={{ width: `${(contest.currentEntries / contest.maxEntries) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-[#555]">
                      <span>{contest.maxEntries - contest.currentEntries} spots left</span>
                      <span className="text-[#00FF00]">{Math.round((contest.currentEntries / contest.maxEntries) * 100)}% full</span>
                    </div>
                  </div>
                )}

                {/* Winners preview for completed contests */}
                {contest.status === 'completed' && (
                  <div className="mt-4 pt-4 border-t border-[#222]">
                    <div className="flex items-center gap-2 text-sm text-[#888]">
                      <Crown size={14} className="text-[#FFD700]" />
                      <span>View results and winners →</span>
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Create Contest Button */}
        <Link
          href="/contests/create"
          className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3 bg-[#00FF00] text-black font-bold rounded-full shadow-lg hover:bg-[#00DD00] transition-all hover:scale-105"
        >
          <Plus size={20} />
          Create Contest
        </Link>
      </main>

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#111] border border-[#333] rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Join Private Contest</h3>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter contest code"
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] rounded-xl text-white mb-4 uppercase tracking-widest text-center text-lg"
              maxLength={8}
            />
            {joinError && <p className="text-red-500 text-sm mb-4">{joinError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 px-4 py-3 bg-[#222] rounded-xl text-[#888] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinByCode}
                disabled={joining || joinCode.length < 4}
                className="flex-1 px-4 py-3 bg-[#00FF00] text-black font-bold rounded-xl hover:bg-[#00DD00] disabled:opacity-50 transition-all"
              >
                {joining ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
