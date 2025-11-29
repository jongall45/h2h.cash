"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Trophy, Users, Clock, ChevronRight, Plus, Lock, Globe, Loader2, Zap } from "lucide-react"
import { getContests, Contest, getContestByCode } from "../lib/contests"

export default function ContestsPage() {
  const [contests, setContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)
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
    const data = await getContests()
    setContests(data)
    setLoading(false)
  }

  const handleJoinByCode = async () => {
    setJoining(true)
    setJoinError('')
    
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

  const totalPrizes = contests.reduce((sum, c) => sum + c.prizePool, 0)
  const totalEntries = contests.reduce((sum, c) => sum + c.currentEntries, 0)

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
          background: 'radial-gradient(circle, rgba(0,255,0,0.08) 0%, rgba(0,255,0,0.03) 40%, transparent 70%)',
          borderRadius: '50%'
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span style={{ fontSize: '24px', fontWeight: 500 }}>
              <span className="text-white">h2h</span>
              <span className="text-[#00FF00]">.cash</span>
            </span>
          </Link>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors border border-white/10 rounded-full hover:border-white/20"
            >
              Join Private
            </button>
            <Link
              href="/contests/create"
              className="flex items-center gap-2 px-5 py-2.5 bg-[#00FF00] text-black rounded-full text-sm font-semibold hover:bg-[#00DD00] transition-all hover:scale-105"
            >
              <Plus size={16} strokeWidth={2.5} />
              Create
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#00FF00]/10 border border-[#00FF00]/20 rounded-full mb-4">
            <Trophy size={14} className="text-[#00FF00]" />
            <span className="text-xs font-medium text-[#00FF00] uppercase tracking-wider">Tournaments</span>
          </div>
          <h1 className="text-4xl font-semibold mb-3 tracking-tight">
            Compete for <span className="text-[#00FF00]">Cash</span>
          </h1>
          <p className="text-white/40 text-lg">Pick your props. Beat the field. Win prizes.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-5 text-center backdrop-blur-sm">
            <div className="text-3xl font-bold text-[#00FF00] mb-1">{contests.length}</div>
            <div className="text-xs text-white/40 uppercase tracking-wider font-medium">Active</div>
          </div>
          <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-5 text-center backdrop-blur-sm">
            <div className="text-3xl font-bold mb-1">{formatPrizePool(totalPrizes)}</div>
            <div className="text-xs text-white/40 uppercase tracking-wider font-medium">In Prizes</div>
          </div>
          <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-5 text-center backdrop-blur-sm">
            <div className="text-3xl font-bold mb-1">{totalEntries}</div>
            <div className="text-xs text-white/40 uppercase tracking-wider font-medium">Entries</div>
          </div>
        </div>

        {/* 2x Bonus Banner */}
        <div className="mb-6 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <Zap size={20} className="text-yellow-500" />
          </div>
          <div>
            <div className="font-semibold text-yellow-500">Perfect Lineup Bonus</div>
            <div className="text-sm text-white/50">Hit all 5 picks = 2x your points</div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[#00FF00] mb-4" />
            <p className="text-white/40 text-sm">Loading contests...</p>
          </div>
        )}

        {/* Contest List */}
        {!loading && (
          <div className="space-y-4">
            {contests.map((contest, index) => (
              <Link
                key={contest.id}
                href={`/contests/${contest.id}`}
                className="block group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-5 hover:border-[#00FF00]/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,255,0,0.1)] relative overflow-hidden">
                  {/* Hover glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#00FF00]/0 via-[#00FF00]/5 to-[#00FF00]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative z-10">
                    {/* Contest Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {contest.type === 'private' ? (
                            <Lock size={14} className="text-white/30" />
                          ) : (
                            <Trophy size={16} className="text-[#00FF00]" />
                          )}
                          <h3 className="text-lg font-semibold group-hover:text-[#00FF00] transition-colors">{contest.name}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/40">
                          <Clock size={14} />
                          <span>{formatTime(contest.gameTime)}</span>
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            contest.status === 'open' ? 'bg-[#00FF00]/15 text-[#00FF00]' :
                            contest.status === 'live' ? 'bg-yellow-500/15 text-yellow-500' :
                            'bg-white/10 text-white/50'
                          }`}>
                            {contest.status}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-white/20 group-hover:text-[#00FF00] group-hover:translate-x-1 transition-all" />
                    </div>

                    {/* Contest Stats */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-black/30 rounded-xl p-3 text-center">
                        <div className="text-lg font-bold text-[#00FF00]">${contest.entryFee}</div>
                        <div className="text-[10px] text-white/30 uppercase tracking-wider">Entry</div>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3 text-center">
                        <div className="text-lg font-bold">{formatPrizePool(contest.prizePool)}</div>
                        <div className="text-[10px] text-white/30 uppercase tracking-wider">Prizes</div>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3 text-center">
                        <div className="text-lg font-bold">{contest.currentEntries}<span className="text-white/30">/{contest.maxEntries}</span></div>
                        <div className="text-[10px] text-white/30 uppercase tracking-wider">Entries</div>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3 text-center">
                        <div className="text-lg font-bold">Top {contest.payoutStructure.length > 3 ? '25%' : '3'}</div>
                        <div className="text-[10px] text-white/30 uppercase tracking-wider">Paid</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#00FF00] to-[#00DD00] rounded-full transition-all duration-500"
                          style={{ width: `${Math.max((contest.currentEntries / contest.maxEntries) * 100, 2)}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 text-xs">
                        <span className="text-white/30">{contest.maxEntries - contest.currentEntries} spots left</span>
                        <span className="text-[#00FF00]/70">{Math.round((contest.currentEntries / contest.maxEntries) * 100)}% full</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && contests.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
              <Trophy size={32} className="text-white/20" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Active Contests</h3>
            <p className="text-white/40 mb-6">Be the first to create one!</p>
            <Link
              href="/contests/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#00FF00] text-black rounded-full font-semibold hover:bg-[#00DD00] transition-all hover:scale-105"
            >
              <Plus size={18} />
              Create Contest
            </Link>
          </div>
        )}
      </main>

      {/* Join Private Modal */}
      {showJoinModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setShowJoinModal(false)}
        >
          <div 
            className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#00FF00]/10 flex items-center justify-center">
                <Lock size={24} className="text-[#00FF00]" />
              </div>
              <h3 className="text-xl font-semibold mb-1">Join Private Contest</h3>
              <p className="text-sm text-white/40">Enter the 6-character invite code</p>
            </div>
            
            <input
              type="text"
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
              placeholder="XXXXXX"
              maxLength={6}
              className="w-full px-4 py-4 bg-black/50 border border-white/10 rounded-xl text-center text-2xl font-mono tracking-[0.3em] uppercase focus:outline-none focus:border-[#00FF00]/50 transition-colors placeholder:text-white/20"
              autoFocus
            />
            
            {joinError && (
              <p className="text-red-500 text-sm mt-3 text-center">{joinError}</p>
            )}
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 px-4 py-3 bg-white/5 text-white/60 rounded-xl font-medium hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinByCode}
                disabled={joinCode.length !== 6 || joining}
                className="flex-1 px-4 py-3 bg-[#00FF00] text-black rounded-xl font-semibold hover:bg-[#00DD00] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {joining && <Loader2 size={16} className="animate-spin" />}
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
