"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Trophy, Users, Clock, ChevronLeft, Share2, Copy, Check, Zap, Target, Loader2, Crown, Medal, X, TrendingUp, TrendingDown, Lock, Radio, Eye, EyeOff } from "lucide-react"
import { getContest, Contest, ContestEntry, calculatePayouts, subscribeToContest, EntryPick } from "../../lib/contests"
import { LivePickTracker } from "../../components/LivePickTracker"
import { TrackedPick } from "../../lib/resolution"
import { getCurrentUser } from "../../lib/auth"
import { resolvePicks, getContestLiveStatus, PickResolutionResult } from "../../actions/getLiveScores"
import { updateContestScores, ScoreUpdateResult } from "../../actions/updateScores"

export default function ContestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [contest, setContest] = useState<Contest | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'prizes' | 'entries'>('leaderboard')
  const [copied, setCopied] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<ContestEntry | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Live scoring state
  const [liveStatus, setLiveStatus] = useState<{
    hasGamesStarted: boolean
    allGamesCompleted: boolean
    inProgressCount: number
  } | null>(null)
  const [livePickResults, setLivePickResults] = useState<Map<string, PickResolutionResult[]>>(new Map())
  const [liveScores, setLiveScores] = useState<Map<string, ScoreUpdateResult>>(new Map())
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

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

  // Poll for live scoring updates - NOW PERSISTS TO DATABASE
  const pollLiveScores = useCallback(async () => {
    if (!contest || isUpdating) return
    
    setIsUpdating(true)
    
    try {
      // Update all scores in the database AND get results back
      const result = await updateContestScores(contest.id)
      
      setLiveStatus(result.contestStatus)
      
      // Store live scores for display
      if (result.success && result.updatedEntries.length > 0) {
        const scoresMap = new Map<string, ScoreUpdateResult>()
        const resultsMap = new Map<string, PickResolutionResult[]>()
        
        for (const entry of result.updatedEntries) {
          scoresMap.set(entry.entryId, entry)
          resultsMap.set(entry.entryId, entry.pickResults)
        }
        
        setLiveScores(scoresMap)
        setLivePickResults(resultsMap)
        setLastUpdate(new Date())
        
        // Log for debugging
        console.log(`[Live Scoring] Updated ${result.updatedEntries.length} entries`)
        if (result.contestStatus.allGamesCompleted) {
          console.log('[Live Scoring] All games completed - contest finalized!')
        }
      }
    } catch (error) {
      console.error('Error polling live scores:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [contest, isUpdating])

  // Auto-detect game start and set contest to live
  const checkAndSetLive = useCallback(async () => {
    if (!contest || contest.status !== 'open') return
    
    try {
      const status = await getContestLiveStatus()
      
      if (status.hasGamesStarted) {
        console.log('[Auto-Live] Games have started! Setting contest to LIVE...')
        
        // Update contest status to 'live' in database
        const response = await fetch(`/api/admin/set-live?contestId=${contest.id}`)
        const result = await response.json()
        
        if (result.success) {
          console.log('[Auto-Live] Contest is now LIVE!')
          // Refetch contest to get updated status
          const updatedContest = await getContest(contest.id)
          if (updatedContest) {
            setContest(updatedContest)
          }
        }
      }
    } catch (error) {
      console.error('[Auto-Live] Error checking game status:', error)
    }
  }, [contest])

  // Check for game start every 30 seconds when contest is open
  useEffect(() => {
    if (!contest || contest.status !== 'open') return
    
    // Check immediately
    checkAndSetLive()
    
    // Then check every 30 seconds
    const interval = setInterval(checkAndSetLive, 30000)
    
    return () => clearInterval(interval)
  }, [contest?.id, contest?.status, checkAndSetLive])

  // Set up polling interval when contest is live
  useEffect(() => {
    if (!contest || contest.status !== 'live') return
    
    // Initial poll
    pollLiveScores()
    
    // Poll every 15 seconds during live games (faster updates!)
    const interval = setInterval(pollLiveScores, 15000)
    
    return () => clearInterval(interval)
  }, [contest?.status, pollLiveScores])

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
    
    // Subscribe to real-time updates - when entries change, refetch contest
    const unsubscribe = subscribeToContest(params.id as string, (updatedContest) => {
      console.log('[Real-time] Contest updated, refreshing leaderboard...')
      setContest(updatedContest)
      
      // Clear live scores to force recalculation with new data
      // This ensures leaderboard reflects database state
      if (updatedContest.status === 'completed') {
        setLiveScores(new Map())
        setLivePickResults(new Map())
      }
    })
    
    return () => unsubscribe()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#00C853]" />
      </div>
    )
  }

  if (!contest) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#888888] mb-4">Contest not found</p>
          <Link href="/contests" className="text-[#00C853] hover:underline">
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

  // Check contest status
  const isLive = contest.status === 'live'
  const isCompleted = contest.status === 'completed'
  
  // CRITICAL: Only consider games started if ESPN confirms it via liveStatus
  // Don't rely on comparing dates - use actual API response
  // If liveStatus is null (not yet fetched), default to false (hidden)
  const hasAnyGameStarted = liveStatus?.hasGamesStarted === true
  
  // NEW VISIBILITY LOGIC:
  // Pre-game: ALL picks hidden, 0 points, 0 hits for everyone
  // Once ESPN confirms ANY game has started: FULL transparency
  // Contest status 'live' or 'completed' also reveals data
  const canRevealAllData = hasAnyGameStarted || isLive || isCompleted

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Background FX */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20" 
           style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(0,255,0,0.15), transparent 50%)' }}></div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-[#2A2A2A]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/contests" className="flex items-center gap-2 text-[#888888] hover:text-white transition-colors group">
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </Link>
          
          {contest.type === 'private' && contest.inviteCode && (
            <button
              onClick={copyInviteCode}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#252525] border border-[#333333] rounded-full text-xs transition-all active:scale-95"
            >
              {copied ? <Check size={12} className="text-[#00C853]" /> : <Copy size={12} className="text-[#888888]" />}
              <span className="font-mono tracking-wider text-white/80">{contest.inviteCode}</span>
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        {/* Hero Card */}
        <div className="bg-gradient-to-br from-white/10 to-transparent border border-[#333333] rounded-2xl p-6 mb-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trophy size={120} className="text-white rotate-12" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-[#00C853]/10 rounded-lg">
                    <Trophy size={20} className="text-[#00C853]" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{contest.name}</h1>
                </div>
                <div className="flex items-center gap-4 text-sm text-[#888888]">
                  <span className="flex items-center gap-1.5 bg-[#1A1A1A] px-2.5 py-1 rounded-full">
                    <Clock size={14} />
                    {formatTime(contest.gameTime)}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    contest.status === 'open' ? 'bg-[#00C853]/20 text-[#00C853]' :
                    contest.status === 'live' ? 'bg-red-500/20 text-red-500 animate-pulse' :
                    'bg-[#252525] text-[#888888]'
                  }`}>
                    {contest.status === 'live' && <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse"></span>}
                    {contest.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-[#1A1A1A] rounded-2xl p-4 text-center border border-[#2A2A2A]">
                <div className="text-2xl md:text-3xl font-bold text-[#00C853] mb-1">${contest.entryFee}</div>
                <div className="text-[10px] md:text-xs text-[#888888] uppercase tracking-wider font-medium">Entry</div>
              </div>
              <div className="bg-[#1A1A1A] rounded-2xl p-4 text-center border border-[#2A2A2A]">
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{formatPrizePool(contest.prizePool)}</div>
                <div className="text-[10px] md:text-xs text-[#888888] uppercase tracking-wider font-medium">Prizes</div>
              </div>
              <div className="bg-[#1A1A1A] rounded-2xl p-4 text-center border border-[#2A2A2A]">
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{contest.currentEntries}</div>
                <div className="text-[10px] md:text-xs text-[#888888] uppercase tracking-wider font-medium">Entries</div>
              </div>
              <div className="bg-[#1A1A1A] rounded-2xl p-4 text-center border border-[#2A2A2A]">
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{paidPositions}</div>
                <div className="text-[10px] md:text-xs text-[#888888] uppercase tracking-wider font-medium">Paid</div>
              </div>
            </div>

            {/* Progress & Action - Only show when contest is open */}
            {contest.status === 'open' ? (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-full md:flex-1">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-[#888888]">{contest.maxEntries - contest.currentEntries} spots left</span>
                  <span className="text-[#00C853]">{Math.round((contest.currentEntries / contest.maxEntries) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-[#252525] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#00C853] "
                    style={{ width: `${Math.max((contest.currentEntries / contest.maxEntries) * 100, 2)}%` }}
                  />
                </div>
              </div>
              
                {contest.currentEntries < contest.maxEntries && (
                <button
                  onClick={handleEnterContest}
                  className="w-full md:w-auto px-8 py-3 bg-[#00C853] hover:bg-[#00E676] text-black font-semibold rounded-full transition-all hover:shadow-lg hover:shadow-[#00C853]/20"
                >
                  Enter Contest
                </button>
              )}
            </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2 px-4 bg-red-500/10 rounded-xl border border-red-500/20">
                <span className="text-[#FF5252] font-bold text-sm">🔒 ENTRIES CLOSED</span>
                <span className="text-[#888888] text-sm">• {contest.currentEntries} entries locked in</span>
              </div>
            )}
          </div>
        </div>

        {/* Pre-Game Notice - ALL picks hidden, 0 points until kickoff */}
        {!canRevealAllData && (
          <div className="mb-8 p-4 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center gap-4">
            <Lock size={20} className="text-[#448AFF] shrink-0" />
            <div>
              <div className="font-bold text-[#448AFF]">⏳ Waiting for Kickoff</div>
              <div className="text-sm text-[#888888]">
                All picks are locked and hidden. Everyone shows 0 points, 0/5 hits until games begin.
                Once ESPN detects kickoff, picks will be revealed with live scoring!
              </div>
            </div>
          </div>
        )}

        {/* Live Scoring Notice - Full transparency mode */}
        {canRevealAllData && !isCompleted && (
          <div className="mb-8 p-4 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center gap-4">
            <Radio size={20} className="text-[#FF5252] animate-pulse shrink-0" />
            <div className="flex-1">
              <div className="font-bold text-[#FF5252] flex items-center gap-2">
                🔴 LIVE - All Picks Revealed
                {liveStatus && liveStatus.inProgressCount > 0 && (
                  <span className="text-xs font-normal text-[#888888]">
                    ({liveStatus.inProgressCount} games in progress)
                  </span>
                )}
                {isUpdating && (
                  <Loader2 size={14} className="animate-spin text-[#888888]" />
                )}
              </div>
              <div className="text-sm text-[#888888]">
                Full transparency! Everyone's picks are visible. Points update in real-time as player stats change.
              </div>
              {lastUpdate && (
                <div className="text-xs text-[#555555] mt-1 flex items-center gap-2">
                  <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
                  <span className="text-[#00C853]">• Updates every 15s</span>
                  <button 
                    onClick={() => !isUpdating && pollLiveScores()}
                    disabled={isUpdating}
                    className="ml-2 px-2 py-0.5 bg-[#252525] hover:bg-white/20 rounded text-[#888888] hover:text-white transition-colors disabled:opacity-50"
                  >
                    {isUpdating ? '⏳' : '🔄'} Refresh
                  </button>
                </div>
              )}
            </div>
            <Eye size={16} className="text-[#00C853]" />
          </div>
        )}

        {/* Contest Complete */}
        {isCompleted && (
          <div className="mb-8 p-4 rounded-2xl bg-[#00C853]/10 border border-[#00C853]/20 flex items-center gap-4">
            <Trophy size={20} className="text-[#00C853] shrink-0" />
            <div>
              <div className="font-bold text-[#00C853]">Contest Complete - Final Results</div>
              <div className="text-sm text-[#888888]">All games have concluded. Final standings and prizes are locked in.</div>
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
              <h3 className="font-bold text-lg text-yellow-500">Leg Hits = Multiplier!</h3>
              <p className="text-sm text-[#888888]">Your multiplier equals your leg hits: <span className="text-white font-semibold">5x • 4x • 3x • 2x • 1x</span></p>
              <p className="text-xs text-[#888888] mt-1">0 leg hits = 0 points. Every leg counts!</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-[#1A1A1A] rounded-xl mb-6 backdrop-blur-sm w-fit">
          {(['leaderboard', 'prizes', 'entries'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeTab === tab 
                  ? 'bg-white text-black font-semibold' 
                  : 'text-[#888888] hover:text-[#AAAAAA]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content Sections */}
        <div className="min-h-[400px]">
          {activeTab === 'leaderboard' && (
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-[#2A2A2A] text-xs font-medium text-[#555555] uppercase tracking-wider">
                <div className="col-span-1">#</div>
                <div className="col-span-5 md:col-span-5">Player</div>
                <div className="col-span-2 text-center">Hits</div>
                <div className="col-span-2 text-right">Points</div>
                <div className="col-span-2 text-right">Prize</div>
              </div>

              <div className="divide-y divide-white/5">
                {contest.entries.length > 0 ? (
                  // SORT BY LIVE POINTS for real-time leaderboard fluctuation
                  [...contest.entries]
                    .map(entry => {
                      const liveScore = liveScores.get(entry.id)
                      return {
                        ...entry,
                        // Use live score if available, otherwise use stored value
                        displayPoints: canRevealAllData && liveScore ? liveScore.totalPoints : entry.totalPoints,
                        displayHits: canRevealAllData && liveScore ? liveScore.hitsCount : entry.hitsCount,
                        liveMultiplier: liveScore?.multiplier ?? 0
                      }
                    })
                    .sort((a, b) => {
                      // During live games, sort by live points (descending)
                      if (canRevealAllData) {
                        return b.displayPoints - a.displayPoints
                      }
                      // Pre-game: sort by potential points
                      return b.totalPoints - a.totalPoints
                    })
                    .slice(0, 50)
                    .map((entry, index) => {
                    // Check if this is the current user's entry
                    const isOwnEntry = currentUserId && entry.oduserId === currentUserId
                    
                    // Use pre-calculated display values from the sorted map
                    const displayPoints = entry.displayPoints
                    const displayHits = entry.displayHits
                    
                    // Calculate pending picks
                      const entryResults = livePickResults.get(entry.id)
                    const pending = entryResults 
                      ? entryResults.filter(r => r.hit === null).length 
                      : (canRevealAllData ? 0 : 5)
                    
                    // Rank: Only show during live/completed, otherwise "—"
                    const currentRank = canRevealAllData ? (index + 1) : '—'
                    const isTop3 = canRevealAllData && (index + 1) <= 3
                    const positionPrize = payouts[index]?.amount || 0
                    const isInMoney = positionPrize > 0
                    const prize = isInMoney ? Math.floor(contest.prizePool / paidPositions) : 0
                    
                    // Can view picks: YOUR OWN anytime, others only once games start
                    const canViewPicks = isOwnEntry || canRevealAllData
                    
                    return (
                      <div 
                        key={entry.id} 
                        onClick={() => canViewPicks ? setSelectedEntry(entry) : setSelectedEntry({ ...entry, _picksHidden: true } as any)}
                        className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors cursor-pointer hover:bg-[#1F1F1F] ${
                          canRevealAllData && entry.isPerfect ? 'bg-yellow-500/5' : ''
                        } ${isOwnEntry ? 'border-l-3 border-[#00C853] bg-[#00C853]/5 pl-[21px]' : ''}`}
                      >
                        <div className="col-span-1 font-medium text-[#888888]">
                          {canRevealAllData && isTop3 ? (
                            currentRank === 1 ? <Crown size={16} className="text-yellow-500 fill-yellow-500" /> :
                            currentRank === 2 ? <Medal size={16} className="text-gray-300" /> :
                            <Medal size={16} className="text-amber-600" />
                          ) : (
                            <span className={canRevealAllData ? 'text-[#888888]' : 'text-white/20'}>{currentRank}</span>
                          )}
                        </div>
                        
                        <div className="col-span-5 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-transparent border flex items-center justify-center text-xs font-bold ${
                            isOwnEntry ? 'border-[#00C853]/50 text-[#00C853]' : 'border-[#333333] text-[#AAAAAA]'
                          }`}>
                            {entry.username.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white/90 flex items-center gap-2">
                              {entry.username}
                              {isOwnEntry && <span className="text-[9px] bg-[#00C853]/20 text-[#00C853] px-1.5 py-0.5 rounded">YOU</span>}
                            </span>
                            {/* Show position in money only after complete */}
                            {isCompleted && isInMoney && (
                              <span className="text-[10px] text-[#00C853] font-medium md:hidden">Won ${prize}</span>
                            )}
                          </div>
                          {/* Show multiplier badge for everyone once games start */}
                          {canRevealAllData && entry.liveMultiplier > 0 && (
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wide border ${
                              entry.liveMultiplier === 5 
                                ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20' 
                                : entry.liveMultiplier >= 3 
                                  ? 'bg-[#00C853]/20 text-[#00C853] border-[#00C853]/20'
                                  : 'bg-[#252525] text-[#888888] border-[#333333]'
                            }`}>
                              {entry.liveMultiplier}X
                            </span>
                          )}
                          {/* Show pending indicator during live */}
                          {canRevealAllData && !isCompleted && pending > 0 && pending < 5 && (
                            <span className="text-[10px] text-[#555555] bg-[#1A1A1A] px-1.5 py-0.5 rounded">
                              {pending} left
                            </span>
                          )}
                        </div>

                        <div className="col-span-2 text-center">
                          {canRevealAllData ? (
                            <div className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-bold ${
                              displayHits === 5 ? 'bg-[#00C853]/20 text-[#00C853]' : 
                              displayHits > 0 ? 'bg-[#252525] text-[#AAAAAA]' :
                              'bg-[#1A1A1A] text-[#555555]'
                            }`}>
                              {displayHits}/5
                            </div>
                          ) : isOwnEntry ? (
                            // Show YOUR potential hits (0 pre-game since no games played)
                            <div className="inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-bold bg-[#00C853]/10 text-[#00C853]/70">
                              0/5
                            </div>
                          ) : (
                            // Hide opponents
                            <div className="inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-bold bg-[#1A1A1A] text-[#555555]">
                              <Lock size={10} className="mr-1" />
                              —
                            </div>
                          )}
                        </div>

                        <div className="col-span-2 text-right">
                          {canRevealAllData ? (
                            <>
                              <div className={`text-lg font-bold ${
                                entry.isPerfect ? 'text-yellow-500' : 
                                displayPoints > 0 ? 'text-white' : 'text-[#555555]'
                              }`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {displayPoints.toFixed(2)}
                              </div>
                              {isCompleted && isInMoney && (
                                <div className="text-xs text-[#00C853] font-medium hidden md:block">
                                  Won ${prize}
                                </div>
                              )}
                            </>
                          ) : isOwnEntry ? (
                            // Show YOUR potential points pre-game
                            <>
                              <div className="text-lg font-bold text-[#00C853]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {entry.totalPoints.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-[#00C853]/50">
                                potential
                              </div>
                            </>
                          ) : (
                            // Hide opponents
                            <div className="text-lg font-bold text-white/20" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              —
                            </div>
                          )}
                        </div>

                        {/* Prize Column */}
                        <div className="col-span-2 text-right">
                          {positionPrize > 0 ? (
                            <div className="text-lg font-bold text-[#00C853]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              ${positionPrize}
                            </div>
                          ) : (
                            <div className="text-lg font-bold text-white/20">
                              —
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1A1A1A] flex items-center justify-center">
                      <Users size={32} className="text-white/20" />
                    </div>
                    <p className="text-[#888888]">No entries yet. Be the first!</p>
                  </div>
                )}
              </div>
              
              {/* Click hint */}
              {contest.entries.length > 0 && (
                <div className="px-6 py-3 border-t border-[#2A2A2A] text-center">
                  <span className="text-xs text-[#555555]">
                    {canRevealAllData 
                      ? 'Click on any player to view their picks and live stats'
                      : 'All picks locked and hidden until games begin'}
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'prizes' && (
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-6 backdrop-blur-sm">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Target size={20} className="text-[#00C853]" />
                Prize Distribution
              </h3>
              <div className="space-y-3">
                {payouts.map((payout, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-[#1A1A1A] rounded-xl border border-[#2A2A2A]">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                        index === 1 ? 'bg-gray-300/20 text-gray-300' :
                        index === 2 ? 'bg-amber-700/20 text-amber-700' :
                        'bg-[#252525] text-[#888888]'
                      }`}>
                        {index < 3 ? index + 1 : '#'}
                      </div>
                      <span className="font-medium text-white/80">{payout.place}</span>
                    </div>
                    <span className="text-xl font-bold text-[#00C853]">${payout.amount}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-[#333333] grid grid-cols-2 gap-6">
                <div>
                  <div className="text-xs text-[#888888] uppercase tracking-wider mb-1">Total Prize Pool</div>
                  <div className="text-2xl font-bold text-white">{formatPrizePool(contest.prizePool)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#888888] uppercase tracking-wider mb-1">Platform Fee</div>
                  <div className="text-2xl font-bold text-[#888888]">{contest.rakePercent}%</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'entries' && (() => {
            // Find user's entries in this contest
            const myEntries = contest.entries.filter(e => currentUserId && e.oduserId === currentUserId)
            
            if (myEntries.length === 0) {
              return (
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-8 text-center backdrop-blur-sm">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#1A1A1A] flex items-center justify-center">
                    <Users size={40} className="text-white/20" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Your Entries</h3>
                  <p className="text-[#888888] mb-8 max-w-xs mx-auto">You haven't entered this contest yet. Draft your team to compete for cash prizes.</p>
                  {contest.status === 'open' && (
                    <button
                      onClick={handleEnterContest}
                      className="px-8 py-3 bg-[#00C853] text-black font-bold rounded-xl hover:bg-[#00DD00] transition-all hover:scale-105 shadow-md"
                    >
                      Draft Lineup
                    </button>
                  )}
                </div>
              )
            }
            
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Check size={20} className="text-[#00C853]" />
                    Your Entries ({myEntries.length})
                  </h3>
                </div>
                
                {myEntries.map((entry, idx) => {
                  // Get live data for this entry
                  const liveScore = liveScores.get(entry.id)
                  const entryResults = livePickResults.get(entry.id)
                  const hitsCount = entryResults ? entryResults.filter(r => r.hit === true).length : 0
                  const missCount = entryResults ? entryResults.filter(r => r.hit === false).length : 0
                  const pendingCount = entryResults ? entryResults.filter(r => r.hit === null).length : entry.picks.length
                  const actualPoints = liveScore?.totalPoints ?? 0
                  const multiplier = liveScore?.multiplier ?? 0
                  
                  // Find rank in leaderboard
                  const sortedEntries = [...(contest.entries || [])].sort((a, b) => {
                    const aScore = liveScores.get(a.id)?.totalPoints ?? 0
                    const bScore = liveScores.get(b.id)?.totalPoints ?? 0
                    return bScore - aScore
                  })
                  const rank = sortedEntries.findIndex(e => e.id === entry.id) + 1
                  const prizeAmount = rank > 0 && rank <= payouts.length ? payouts[rank - 1]?.amount : 0
                  
                  const isLive = canRevealAllData && pendingCount < entry.picks.length
                  const isComplete = isCompleted || pendingCount === 0
                  
                  return (
                  <div 
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 cursor-pointer hover:bg-[#222] transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#252525] border border-[#333] flex items-center justify-center text-sm font-bold text-[#888]">
                          {entry.username.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            Entry #{idx + 1}
                            {isLive && !isComplete && (
                              <span className="text-[9px] bg-[#FFB300]/20 text-[#FFB300] px-1.5 py-0.5 rounded flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-[#FF5252] rounded-full animate-pulse"></span>
                                LIVE
                              </span>
                            )}
                            {isComplete && (
                              <span className="text-[9px] bg-[#888]/20 text-[#888] px-1.5 py-0.5 rounded">FINAL</span>
                            )}
                            {!isLive && !isComplete && (
                              <span className="text-[9px] bg-[#00C853]/20 text-[#00C853] px-1.5 py-0.5 rounded">SUBMITTED</span>
                            )}
                          </div>
                          <div className="text-xs text-[#666] flex items-center gap-2">
                            <span>{hitsCount}/{entry.picks.length} Hits</span>
                            {multiplier > 0 && <span className="text-[#FFB300]">({multiplier}x)</span>}
                            {prizeAmount > 0 && <span className="text-[#00C853] font-semibold">• #{rank} • Won ${prizeAmount}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {isLive || isComplete ? (
                          <>
                            <div className="text-xl font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {actualPoints.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-[#666]">
                              / {entry.totalPoints.toFixed(2)} pot.
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-xl font-bold text-[#00C853]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {entry.totalPoints.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-[#666]">potential pts</div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Mini pick preview with hit status */}
                    <div className="flex flex-wrap gap-1.5">
                      {entry.picks.slice(0, 5).map((pick, i) => {
                        const pickResult = entryResults?.[i]
                        const isHit = pickResult?.hit === true
                        const isMiss = pickResult?.hit === false
                        const isPending = !pickResult || pickResult.hit === null
                        
                        return (
                          <div 
                            key={i}
                            className="text-[10px] rounded px-2 py-1 font-medium"
                            style={{
                              backgroundColor: isHit ? 'rgba(0, 200, 83, 0.15)' : 
                                             isMiss ? 'rgba(255, 82, 82, 0.15)' : 
                                             '#252525',
                              color: isHit ? '#00C853' : isMiss ? '#FF5252' : '#888',
                              border: `1px solid ${isHit ? 'rgba(0, 200, 83, 0.3)' : isMiss ? 'rgba(255, 82, 82, 0.3)' : '#333'}`
                            }}
                          >
                            {isHit && '✓ '}{isMiss && '✕ '}{pick.player.split(' ').pop()} {pick.line}+
                          </div>
                        )
                      })}
                    </div>
                    
                    <div className="mt-3 text-xs text-[#555] text-center">
                      Click to view full lineup →
                    </div>
                  </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </main>

      {/* Entry Detail Modal */}
      {selectedEntry && (() => {
        const isOwnEntry = currentUserId && selectedEntry.oduserId === currentUserId
        // Your own picks are NEVER hidden, opponents hidden until games start
        const picksHidden = !isOwnEntry && (selectedEntry as any)._picksHidden === true
        const entryResults = livePickResults.get(selectedEntry.id)
        
        // Calculate live hits from results (not from stored database value)
        const liveHitsCount = entryResults 
          ? entryResults.filter(r => r.hit === true).length 
          : 0
        const livePendingCount = entryResults
          ? entryResults.filter(r => r.hit === null).length
          : selectedEntry.picks.length
        const livePoints = liveScores.get(selectedEntry.id)?.totalPoints ?? 0
        
        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedEntry(null)}
          >
            <div 
              className="w-full max-w-lg bg-[#111] border border-[#333333] rounded-2xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#333333]">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-transparent border flex items-center justify-center text-sm font-bold text-[#AAAAAA] ${
                    isOwnEntry ? 'border-[#00C853]' : 'border-[#333333]'
                  }`}>
                    {selectedEntry.username.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      {selectedEntry.username}
                      {isOwnEntry && <span className="text-[10px] text-[#00C853] bg-[#00C853]/10 px-1.5 py-0.5 rounded">YOU</span>}
                    </div>
                    <div className="text-xs text-[#888888]">
                      {picksHidden ? (
                        'Picks hidden until games begin'
                      ) : canRevealAllData ? (
                        <>
                          {liveHitsCount}/5 Hits • {livePoints.toFixed(2)} pts
                          {livePendingCount > 0 && (
                            <span className="text-[#555555] ml-1">({livePendingCount} pending)</span>
                          )}
                          {liveHitsCount > 0 && (
                            <span className="text-yellow-500 ml-1">({liveHitsCount}x multiplier)</span>
                          )}
                        </>
                      ) : (
                        // Pre-game: show potential points for own entry
                        <span className="text-[#00C853]">
                          {selectedEntry.totalPoints.toFixed(2)} potential pts • Awaiting kickoff
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedEntry(null)}
                  className="p-2 hover:bg-[#252525] rounded-full transition-colors"
                >
                  <X size={20} className="text-[#888888]" />
                </button>
              </div>

              {/* Picks List or Hidden Message */}
              {picksHidden ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1A1A1A] flex items-center justify-center">
                    <Lock size={32} className="text-[#555555]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white/80 mb-2">Picks Locked</h3>
                  <p className="text-sm text-[#888888] max-w-xs mx-auto">
                    All picks are hidden until games begin. Once kickoff happens, everyone's picks will be revealed with live scoring!
                  </p>
                </div>
              ) : (
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                  <div className="text-xs text-[#888888] uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>{isOwnEntry ? 'Your Lineup' : 'Lineup'}</span>
                    {isLive && lastUpdate && (
                      <span className="text-[10px] text-[#555555] flex items-center gap-1">
                        <Radio size={10} className="animate-pulse text-[#FF5252]" />
                        Live
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {selectedEntry.picks.map((pick, index) => {
                      const liveResult = entryResults?.[index]
                      return (
                        <PickCard 
                          key={index} 
                          pick={pick} 
                          index={index + 1} 
                          isLive={canRevealAllData && !isCompleted}
                          liveResult={liveResult}
                          contestCompleted={isCompleted}
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#333333] bg-[#1A1A1A]">
                {picksHidden ? (
                  <div className="text-center text-[#888888] text-sm py-2">
                    Opponent picks revealed at kickoff with live scoring
                  </div>
                ) : !canRevealAllData && isOwnEntry ? (
                  // Pre-game: show potential points for own entry
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-[#00C853]/60">Potential Points</div>
                      <div className="text-2xl font-bold text-[#00C853]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {selectedEntry.totalPoints.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[#888888]">Status</div>
                      <div className="text-sm font-medium text-[#448AFF] flex items-center gap-1">
                        <Lock size={12} />
                        Awaiting Kickoff
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-[#888888]">
                        {isCompleted ? 'Final Points' : 'Live Points'}
                      </div>
                      <div className="text-2xl font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {livePoints.toFixed(2)}
                        {liveHitsCount > 0 && (
                          <span className="text-yellow-500 text-sm ml-2">({liveHitsCount}x)</span>
                        )}
                      </div>
                    </div>
                    {!isCompleted && (
                      <div className="text-right">
                        <div className="text-xs text-[#888888]">Status</div>
                        <div className="text-sm font-medium text-[#FF5252] flex items-center gap-1">
                          <Radio size={12} className="animate-pulse" />
                          Live Scoring
                        </div>
                      </div>
                    )}
                    {isCompleted && selectedEntry.prize && (
                      <div className="text-right">
                        <div className="text-xs text-[#888888]">Prize Won</div>
                        <div className="text-lg font-bold text-[#00C853]">
                          ${selectedEntry.prize}
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

// Individual pick card for the modal with live data support and progress bar
// Individual pick card for the modal with live data support and progress bar
function PickCard({ 
  pick, 
  index, 
  isLive,
  liveResult,
  contestCompleted
}: { 
  pick: EntryPick
  index: number
  isLive?: boolean
  liveResult?: PickResolutionResult
  contestCompleted?: boolean
}) {
  // Determine status from live data or stored pick data
  let status: 'pending' | 'live' | 'hit' | 'miss' = 'pending'
  let currentValue = 0
  let gameClock = ''
  let progressPercent = 0
  
  if (liveResult) {
    currentValue = liveResult.currentValue
    gameClock = liveResult.gameClock || ''
    progressPercent = Math.min((currentValue / pick.line) * 100, 100)
    
    if (liveResult.hit === true) {
      status = 'hit'
    } else if (liveResult.gameStatus === 'pre') {
      status = 'pending'
    } else if (liveResult.gameStatus === 'in') {
      status = 'live'
    } else if (liveResult.hit === false && liveResult.gameStatus === 'post') {
      status = 'miss'
    }
  } else if (contestCompleted) {
    status = pick.hit === true ? 'hit' : pick.hit === false ? 'miss' : 'pending'
    if (status === 'hit') progressPercent = 100
  }
  
  // Professional color scheme
  const statusConfig = {
    pending: { 
      color: '#888888', 
      text: 'Pending', 
      bgColor: '#1A1A1A',
      borderColor: '#2A2A2A'
    },
    live: { 
      color: '#FFB300', 
      text: gameClock || 'LIVE', 
      bgColor: 'rgba(255, 179, 0, 0.06)',
      borderColor: 'rgba(255, 179, 0, 0.25)'
    },
    hit: { 
      color: '#00C853', 
      text: 'HIT', 
      bgColor: 'rgba(0, 200, 83, 0.06)',
      borderColor: 'rgba(0, 200, 83, 0.25)'
    },
    miss: { 
      color: '#FF5252', 
      text: 'MISS', 
      bgColor: 'rgba(255, 82, 82, 0.06)',
      borderColor: 'rgba(255, 82, 82, 0.25)'
    }
  }
  
  const config = statusConfig[status]
  
  const progressColor = status === 'hit' ? '#00C853' : 
                        status === 'miss' ? '#FF5252' : 
                        progressPercent >= 80 ? '#00C853' :
                        progressPercent >= 50 ? '#FFB300' : '#555'
  
  // Get player headshot URL
  const playerId = liveResult?.playerId
  const headshotUrl = playerId 
    ? `https://a.espncdn.com/i/headshots/nfl/players/full/${playerId}.png`
    : null
  
  return (
    <div 
      className="p-4 rounded-xl border transition-all"
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.borderColor
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        {/* Player avatar/headshot */}
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
          style={{ 
            backgroundColor: '#252525',
            border: `2px solid ${config.borderColor}`
          }}
        >
          {headshotUrl ? (
            <img 
              src={headshotUrl}
              alt={pick.player}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to number if image fails
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <span 
            className={`text-sm font-semibold ${headshotUrl ? 'hidden' : ''}`}
            style={{ color: config.color }}
          >
            {index}
          </span>
        </div>

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate">{pick.player}</div>
          <div className="text-xs text-[#666] uppercase tracking-wide">
            {pick.line}+ {pick.stat.replace(' Yards', '').replace('Passing', 'PASS').replace('Rushing', 'RUSH').replace('Receiving', 'REC')}
          </div>
        </div>

        {/* Status & Points */}
        <div className="text-right flex-shrink-0">
          <div 
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mb-1 ${
              status === 'live' ? 'animate-pulse' : ''
            }`}
            style={{ 
              backgroundColor: status === 'pending' ? '#252525' : `${config.color}15`,
              color: config.color,
              border: `1px solid ${config.borderColor}`
            }}
          >
            {status === 'live' && <span className="w-1.5 h-1.5 bg-[#FF5252] rounded-full"></span>}
            {status === 'hit' && <span>✓</span>}
            {status === 'miss' && <span>✕</span>}
            {status === 'pending' && <span>⏳</span>}
            <span>{config.text}</span>
          </div>
          <div 
            className="text-sm font-bold"
            style={{ 
              color: config.color,
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {status === 'hit' ? `+${pick.points.toFixed(2)}` : 
             status === 'miss' ? '0.00' : 
             status === 'live' ? `${pick.points.toFixed(2)} if hit` :
             `${pick.points.toFixed(2)} pot.`}
          </div>
        </div>
      </div>

      {/* Progress bar - only show during live games */}
      {(status === 'live' || status === 'hit' || status === 'miss') && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] mb-1.5">
            <span style={{ color: progressColor }} className="font-medium">
              {currentValue} yds
            </span>
            <span className="text-[#666]">
              / {pick.line} needed
            </span>
          </div>
          <div className="h-1 bg-[#252525] rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${progressPercent}%`,
                backgroundColor: progressColor
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
