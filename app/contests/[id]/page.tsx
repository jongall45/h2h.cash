"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Trophy, Users, Clock, ChevronLeft, Share2, Copy, Check, Zap, Target, Loader2, Crown, Medal, X, TrendingUp, TrendingDown, Lock } from "lucide-react"
import { getContest, Contest, ContestEntry, calculatePayouts, subscribeToContest, EntryPick } from "../../lib/contests"
import { LivePickTracker } from "../../components/LivePickTracker"
import { TrackedPick } from "../../lib/resolution"
import { getCurrentUser } from "../../lib/auth"

export default function ContestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [contest, setContest] = useState<Contest | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'prizes' | 'entries'>('leaderboard')
  const [copied, setCopied] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<ContestEntry | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Get current user for pick visibility
  useEffect(() => {
    const loadCurrentUser = async () => {
      const { user } = await getCurrentUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    loadCurrentUser()
  }, [])

  useEffect(() => {
    const loadContest = async () => {
      if (params.id) {
        setLoading(true)
        const c = await getContest(params.id as string)
        setContest(c)
        setLoading(false)
      }
    }
    
    loadContest()
  }, [params.id])

  useEffect(() => {
    if (!params.id) return
    
    const unsubscribe = subscribeToContest(params.id as string, (updatedContest) => {
      setContest(updatedContest)
    })
    
    return () => unsubscribe()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#00FF00]" />
      </div>
    )
  }

  if (!contest) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 mb-4">Contest not found</p>
          <Link href="/contests" className="text-[#00FF00] hover:underline">
            Back to Contests
          </Link>
        </div>
      </div>
    )
  }

  const payouts = calculatePayouts(contest.prizePool, contest.currentEntries, contest.payoutStructure)
  const paidPositions = Math.ceil(contest.currentEntries * 0.25) || 1

  const formatPrizePool = (amount: number) => {
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`
    return `$${amount.toFixed(0)}`
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const copyInviteCode = () => {
    if (contest.inviteCode) {
      navigator.clipboard.writeText(contest.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleEnterContest = () => {
    router.push(`/contests/${contest.id}/enter`)
  }

  // Convert entry picks to TrackedPick format for live tracking
  const convertToTrackedPicks = (entry: ContestEntry): TrackedPick[] => {
    return entry.picks.map((pick, index) => ({
      id: `${entry.id}-pick-${index}`,
      playerName: pick.player,
      stat: pick.stat,
      line: pick.line,
      potentialPoints: pick.points,
      gameId: '', // We'll need to look this up or store it
      teamAbbr: ''
    }))
  }

  // Check if contest is live or completed (games have started)
  const isLive = contest.status === 'live'
  const isCompleted = contest.status === 'completed'
  const gamesStarted = new Date(contest.gameTime) <= new Date()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Background FX */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20" 
           style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(0,255,0,0.15), transparent 50%)' }}></div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/contests" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group">
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </Link>
          
          {contest.type === 'private' && contest.inviteCode && (
            <button
              onClick={copyInviteCode}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs transition-all active:scale-95"
            >
              {copied ? <Check size={12} className="text-[#00FF00]" /> : <Copy size={12} className="text-white/60" />}
              <span className="font-mono tracking-wider text-white/80">{contest.inviteCode}</span>
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        {/* Hero Card */}
        <div className="bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-3xl p-6 mb-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trophy size={120} className="text-white rotate-12" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-[#00FF00]/10 rounded-lg">
                    <Trophy size={20} className="text-[#00FF00]" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{contest.name}</h1>
                </div>
                <div className="flex items-center gap-4 text-sm text-white/50">
                  <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-full">
                    <Clock size={14} />
                    {formatTime(contest.gameTime)}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    contest.status === 'open' ? 'bg-[#00FF00]/20 text-[#00FF00]' :
                    contest.status === 'live' ? 'bg-red-500/20 text-red-500 animate-pulse' :
                    'bg-white/10 text-white/50'
                  }`}>
                    {contest.status === 'live' && <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse"></span>}
                    {contest.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-black/20 rounded-2xl p-4 text-center border border-white/5">
                <div className="text-2xl md:text-3xl font-bold text-[#00FF00] mb-1">${contest.entryFee}</div>
                <div className="text-[10px] md:text-xs text-white/40 uppercase tracking-wider font-medium">Entry</div>
              </div>
              <div className="bg-black/20 rounded-2xl p-4 text-center border border-white/5">
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{formatPrizePool(contest.prizePool)}</div>
                <div className="text-[10px] md:text-xs text-white/40 uppercase tracking-wider font-medium">Prizes</div>
              </div>
              <div className="bg-black/20 rounded-2xl p-4 text-center border border-white/5">
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{contest.currentEntries}</div>
                <div className="text-[10px] md:text-xs text-white/40 uppercase tracking-wider font-medium">Entries</div>
              </div>
              <div className="bg-black/20 rounded-2xl p-4 text-center border border-white/5">
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{paidPositions}</div>
                <div className="text-[10px] md:text-xs text-white/40 uppercase tracking-wider font-medium">Paid</div>
              </div>
            </div>

            {/* Progress & Action */}
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-full md:flex-1">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-white/40">{contest.maxEntries - contest.currentEntries} spots left</span>
                  <span className="text-[#00FF00]">{Math.round((contest.currentEntries / contest.maxEntries) * 100)}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#00FF00] shadow-[0_0_10px_#00FF00]"
                    style={{ width: `${Math.max((contest.currentEntries / contest.maxEntries) * 100, 2)}%` }}
                  />
                </div>
              </div>
              
              {contest.status === 'open' && contest.currentEntries < contest.maxEntries && (
                <button
                  onClick={handleEnterContest}
                  className="w-full md:w-auto px-8 py-3 bg-[#00FF00] hover:bg-[#00DD00] text-black font-bold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(0,255,0,0.3)]"
                >
                  Enter Contest
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Pre-Game Notice - picks are hidden */}
        {!gamesStarted && contest.status === 'open' && (
          <div className="mb-8 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-4">
            <Lock size={20} className="text-blue-400 shrink-0" />
            <div>
              <div className="font-bold text-blue-400">Picks Hidden Until Kickoff</div>
              <div className="text-sm text-white/50">Other players' picks and scores are hidden. All picks revealed once games start!</div>
            </div>
          </div>
        )}

        {/* Live Scoring Notice */}
        {gamesStarted && !isCompleted && (
          <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
            <div>
              <div className="font-bold text-red-400">Games In Progress</div>
              <div className="text-sm text-white/50">Scores update in real-time. Points are awarded when picks hit.</div>
            </div>
          </div>
        )}

        {/* Multiplier Scoring Banner */}
        <div className="mb-8 p-1 rounded-2xl bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20">
          <div className="bg-[#0a0a0a] rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-yellow-500/5 animate-pulse"></div>
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0 z-10">
              <Zap size={24} className="text-yellow-500 fill-yellow-500" />
            </div>
            <div className="z-10">
              <h3 className="font-bold text-lg text-yellow-500">Hits = Multiplier!</h3>
              <p className="text-sm text-white/60">Your multiplier equals your hits: <span className="text-white font-semibold">5x • 4x • 3x • 2x • 1x</span></p>
              <p className="text-xs text-white/40 mt-1">0 hits = 0 points. Every hit matters!</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-white/5 rounded-xl mb-6 backdrop-blur-sm w-fit">
          {(['leaderboard', 'prizes', 'entries'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab 
                  ? 'bg-white/10 text-white shadow-lg' 
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content Sections */}
        <div className="min-h-[400px]">
          {activeTab === 'leaderboard' && (
            <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm">
              <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/5 text-xs font-medium text-white/30 uppercase tracking-wider">
                <div className="col-span-1">#</div>
                <div className="col-span-6 md:col-span-7">Player</div>
                <div className="col-span-2 text-center">Hits</div>
                <div className="col-span-3 md:col-span-2 text-right">Points</div>
              </div>

              <div className="divide-y divide-white/5">
                {contest.entries.length > 0 ? (
                  contest.entries.slice(0, 50).map((entry, index) => {
                    const rank = entry.rank || index + 1
                    const isTop3 = rank <= 3
                    const isInMoney = rank <= paidPositions
                    const prize = isInMoney ? Math.floor(contest.prizePool / paidPositions) : 0
                    
                    // For pending games, show 0 points (potential points shown separately)
                    const displayPoints = gamesStarted ? entry.totalPoints : 0
                    
                    // Check if this is the current user's entry
                    const isOwnEntry = currentUserId && entry.oduserId === currentUserId
                    // Can view picks if: it's your own entry OR games have started
                    // Before games start: hide other players' picks to prevent copying
                    // Once games start: reveal all picks
                    const canViewPicks = isOwnEntry || gamesStarted
                    
                    return (
                      <div 
                        key={entry.id} 
                        onClick={() => canViewPicks ? setSelectedEntry(entry) : setSelectedEntry({ ...entry, _picksHidden: true } as any)}
                        className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors cursor-pointer hover:bg-white/[0.05] ${
                          entry.isPerfect ? 'bg-yellow-500/5' : ''
                        } ${isOwnEntry ? 'border-l-2 border-[#00FF00]' : ''}`}
                      >
                        <div className="col-span-1 font-medium text-white/50">
                          {isTop3 ? (
                            rank === 1 ? <Crown size={16} className="text-yellow-500 fill-yellow-500" /> :
                            rank === 2 ? <Medal size={16} className="text-gray-300" /> :
                            <Medal size={16} className="text-amber-600" />
                          ) : rank}
                        </div>
                        
                        <div className="col-span-6 md:col-span-7 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center text-xs font-bold text-white/70">
                            {entry.username.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white/90">{entry.username}</span>
                            {isInMoney && displayPoints > 0 && (
                              <span className="text-[10px] text-[#00FF00] font-medium md:hidden">Winning ${prize}</span>
                            )}
                          </div>
                          {gamesStarted && entry.hitsCount > 0 && (
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wide border ${
                              entry.hitsCount === 5 
                                ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20' 
                                : entry.hitsCount >= 3 
                                  ? 'bg-[#00FF00]/20 text-[#00FF00] border-[#00FF00]/20'
                                  : 'bg-white/10 text-white/60 border-white/10'
                            }`}>
                              {entry.hitsCount}X
                            </span>
                          )}
                        </div>

                        <div className="col-span-2 text-center">
                          <div className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-bold ${
                            entry.hitsCount === 5 ? 'bg-[#00FF00]/20 text-[#00FF00]' : 
                            entry.hitsCount > 0 ? 'bg-white/10 text-white/70' :
                            'bg-white/5 text-white/30'
                          }`}>
                            {gamesStarted ? `${entry.hitsCount}/5` : '0/5'}
                          </div>
                        </div>

                        <div className="col-span-3 md:col-span-2 text-right">
                          <div className={`text-lg font-bold ${
                            entry.isPerfect ? 'text-yellow-500' : 
                            displayPoints > 0 ? 'text-white' : 'text-white/30'
                          }`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {displayPoints.toFixed(2)}
                          </div>
                          {!gamesStarted && (
                            <div className="text-[10px] text-white/30">
                              {/* Only show potential points for your own entry before games start */}
                              {isOwnEntry ? `${entry.totalPoints.toFixed(2)} potential` : '— hidden'}
                            </div>
                          )}
                          {isInMoney && displayPoints > 0 && (
                            <div className="text-xs text-[#00FF00] font-medium hidden md:block">
                              Winning ${prize}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                      <Users size={32} className="text-white/20" />
                    </div>
                    <p className="text-white/40">No entries yet. Be the first!</p>
                  </div>
                )}
              </div>
              
              {/* Click hint */}
              {contest.entries.length > 0 && (
                <div className="px-6 py-3 border-t border-white/5 text-center">
                  <span className="text-xs text-white/30">
                    {gamesStarted 
                      ? 'Click on a player to view their picks'
                      : 'Click on your entry to view picks. Other picks revealed once games start.'}
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'prizes' && (
            <div className="bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Target size={20} className="text-[#00FF00]" />
                Prize Distribution
              </h3>
              <div className="space-y-3">
                {payouts.map((payout, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                        index === 1 ? 'bg-gray-300/20 text-gray-300' :
                        index === 2 ? 'bg-amber-700/20 text-amber-700' :
                        'bg-white/10 text-white/50'
                      }`}>
                        {index < 3 ? index + 1 : '#'}
                      </div>
                      <span className="font-medium text-white/80">{payout.place}</span>
                    </div>
                    <span className="text-xl font-bold text-[#00FF00]">${payout.amount}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 gap-6">
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Prize Pool</div>
                  <div className="text-2xl font-bold text-white">{formatPrizePool(contest.prizePool)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Platform Fee</div>
                  <div className="text-2xl font-bold text-white/60">{contest.rakePercent}%</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'entries' && (
            <div className="bg-white/5 border border-white/5 rounded-3xl p-8 text-center backdrop-blur-sm">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
                <Users size={40} className="text-white/20" />
              </div>
              <h3 className="text-xl font-bold mb-2">Your Entries</h3>
              <p className="text-white/40 mb-8 max-w-xs mx-auto">You haven't entered this contest yet. Draft your team to compete for cash prizes.</p>
              <button
                onClick={handleEnterContest}
                className="px-8 py-3 bg-[#00FF00] text-black font-bold rounded-xl hover:bg-[#00DD00] transition-all hover:scale-105 shadow-[0_0_20px_rgba(0,255,0,0.3)]"
              >
                Draft Lineup
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Entry Detail Modal */}
      {selectedEntry && (() => {
        const picksHidden = (selectedEntry as any)._picksHidden === true
        const isOwnEntry = currentUserId && selectedEntry.oduserId === currentUserId
        
        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedEntry(null)}
          >
            <div 
              className="w-full max-w-lg bg-[#111] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-transparent border flex items-center justify-center text-sm font-bold text-white/70 ${
                    isOwnEntry ? 'border-[#00FF00]' : 'border-white/10'
                  }`}>
                    {selectedEntry.username.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      {selectedEntry.username}
                      {isOwnEntry && <span className="text-[10px] text-[#00FF00] bg-[#00FF00]/10 px-1.5 py-0.5 rounded">YOU</span>}
                    </div>
                    <div className="text-xs text-white/40">
                      {picksHidden ? (
                        'Points hidden until kickoff'
                      ) : (
                        <>
                          {selectedEntry.hitsCount}/5 Hits • {selectedEntry.totalPoints.toFixed(2)} pts
                          {selectedEntry.hitsCount > 0 && gamesStarted && (
                            <span className="text-yellow-500 ml-1">({selectedEntry.hitsCount}x multiplier)</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedEntry(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} className="text-white/60" />
                </button>
              </div>

              {/* Picks List or Hidden Message */}
              {picksHidden ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                    <Lock size={32} className="text-white/30" />
                  </div>
                  <h3 className="text-lg font-semibold text-white/80 mb-2">Picks Hidden</h3>
                  <p className="text-sm text-white/40 max-w-xs mx-auto">
                    Other players' picks are hidden until games start. This prevents copying strategies before kickoff.
                  </p>
                </div>
              ) : (
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-3">
                    {isOwnEntry ? 'Your Lineup' : 'Lineup'}
                  </div>
                  <div className="space-y-3">
                    {selectedEntry.picks.map((pick, index) => (
                      <PickCard key={index} pick={pick} index={index + 1} gamesStarted={gamesStarted} />
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="p-4 border-t border-white/10 bg-black/20">
                {picksHidden ? (
                  <div className="text-center text-white/40 text-sm py-2">
                    Scores revealed once games start
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-white/40">Total Points</div>
                      <div className="text-2xl font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {gamesStarted ? selectedEntry.totalPoints.toFixed(2) : '0.00'}
                        {selectedEntry.hitsCount > 0 && gamesStarted && (
                          <span className="text-yellow-500 text-sm ml-2">({selectedEntry.hitsCount}x)</span>
                        )}
                      </div>
                    </div>
                    {!gamesStarted && (
                      <div className="text-right">
                        <div className="text-xs text-white/40">Base Score</div>
                        <div className="text-lg font-medium text-white/50" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {selectedEntry.totalPoints.toFixed(2)} pts
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// Individual pick card for the modal
function PickCard({ pick, index, gamesStarted }: { pick: EntryPick; index: number; gamesStarted: boolean }) {
  // For now, show pending status since we don't have live data in this context
  const status = gamesStarted ? (pick.hit === true ? 'hit' : pick.hit === false ? 'miss' : 'pending') : 'pending'
  
  const statusConfig = {
    pending: { color: '#888888', icon: '⏳', text: 'Pending' },
    hit: { color: '#00FF00', icon: '✅', text: 'HIT' },
    miss: { color: '#ef4444', icon: '❌', text: 'MISS' }
  }
  
  const config = statusConfig[status as keyof typeof statusConfig]
  
  return (
    <div 
      className="p-4 rounded-xl border transition-all"
      style={{
        backgroundColor: '#0a0a0a',
        borderColor: status === 'hit' ? 'rgba(0, 255, 0, 0.3)' : 
                     status === 'miss' ? 'rgba(239, 68, 68, 0.3)' : 
                     'rgba(255, 255, 255, 0.1)'
      }}
    >
      <div className="flex items-center gap-3">
        {/* Pick number */}
        <div 
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ 
            backgroundColor: `${config.color}20`,
            color: config.color
          }}
        >
          {index}
        </div>

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate">{pick.player}</div>
          <div className="text-xs text-white/40 uppercase tracking-wide">
            {pick.line}+ {pick.stat.replace(' Yards', '').replace('Passing', 'Pass').replace('Rushing', 'Rush').replace('Receiving', 'Rec')}
          </div>
        </div>

        {/* Status & Points */}
        <div className="text-right flex-shrink-0">
          <div 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-1"
            style={{ 
              backgroundColor: `${config.color}20`,
              color: config.color
            }}
          >
            <span>{config.icon}</span>
            <span>{config.text}</span>
          </div>
          <div 
            className="text-sm font-bold"
            style={{ 
              color: status === 'hit' ? '#00FF00' : status === 'miss' ? '#ef4444' : '#888',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {status === 'hit' ? `+${pick.points.toFixed(2)}` : status === 'miss' ? '0.00' : `${pick.points.toFixed(2)} pot.`}
          </div>
        </div>
      </div>
    </div>
  )
}
