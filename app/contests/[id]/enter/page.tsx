"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Check, Zap, Loader2, Trophy, ArrowRight, X, ArrowLeft } from "lucide-react"
import { getContest, Contest, submitEntry, EntryPick } from "../../../lib/contests"
import { getSchedule, getGameProps } from "../../../actions/getOdds"
import { getTeamAbbr, getPlayerId, getPlayerHeadshotUrl } from "../../../lib/espn"
import { getCurrentUser } from "../../../lib/auth"
import { BettingCard } from "../../../components/BettingCard"
import { MatchupCard } from "../../../components/ui/SpotlightCard"

interface Pick {
  player: string
  stat: string
  line: number
  points: number
  riskLabel: string
  playerTeam?: string
  gameId?: string // Track which game this pick is from
}

export default function ContestEntryPage() {
  const params = useParams()
  const router = useRouter()
  const [contest, setContest] = useState<Contest | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingProps, setLoadingProps] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<'loading' | 'select_game' | 'select_prop' | 'adjust_line' | 'review' | 'submitted'>('loading')
  
  const [schedule, setSchedule] = useState<any[]>([])
  const [selectedGame, setSelectedGame] = useState<any>(null)
  const [availableProps, setAvailableProps] = useState<any[]>([])
  const [selectedProp, setSelectedProp] = useState<any>(null)
  const [picks, setPicks] = useState<Pick[]>([])

  // Cache props for games we've already loaded
  const [propsCache, setPropsCache] = useState<Record<string, any[]>>({})

  useEffect(() => {
    const loadData = async () => {
      if (params.id) {
        setLoading(true)
        const c = await getContest(params.id as string)
        setContest(c)
        
        const games = await getSchedule()
        setSchedule(games)
        setStep('select_game')
        setLoading(false)
      }
    }
    loadData()
  }, [params.id])

  const handleSelectGame = async (game: any) => {
    setSelectedGame(game)
    
    // Check if we already have props cached for this game
    if (propsCache[game.id]) {
      setAvailableProps(propsCache[game.id])
      setStep('select_prop')
      return
    }
    
    setLoadingProps(true)
    const props = await getGameProps(game.id)
    
    if (props && props.length > 0) {
      // Cache the props
      setPropsCache(prev => ({ ...prev, [game.id]: props }))
      setAvailableProps(props)
      setStep('select_prop')
    } else {
      alert('No props available for this game')
      setStep('select_game')
    }
    setLoadingProps(false)
  }

  const handleSelectProp = (prop: any) => {
    setSelectedProp(prop)
    setStep('adjust_line')
  }

  const handleLockIn = (points: number, finalLine: number, riskLabel: string) => {
    // Don't allow more than 5 picks
    if (picks.length >= 5) {
      setStep('review')
      return
    }
    
    const newPick: Pick = {
      player: selectedProp.player,
      stat: selectedProp.stat,
      line: finalLine,
      points,
      riskLabel,
      playerTeam: selectedProp.playerTeam,
      gameId: selectedGame?.id
    }
    
    const updatedPicks = [...picks, newPick]
    setPicks(updatedPicks)
    
    // Clear selection
    setSelectedProp(null)
    setSelectedGame(null)
    setAvailableProps([])
    
    // If we now have 5 picks, go to review automatically
    if (updatedPicks.length >= 5) {
      setStep('review')
    } else {
      // Otherwise return to matchup selection
      setStep('select_game')
    }
  }

  // Go back to matchup selection from props
  const handleBackToMatchups = () => {
    setSelectedProp(null)
    setSelectedGame(null)
    setAvailableProps([])
    setStep('select_game')
  }

  // Go back to props from line adjustment
  const handleBackToProps = () => {
    setSelectedProp(null)
    setStep('select_prop')
  }

  // Remove a pick
  const handleRemovePick = (index: number) => {
    setPicks(prev => prev.filter((_, i) => i !== index))
  }

  // Go to review screen
  const handleGoToReview = () => {
    if (picks.length > 0) {
      setStep('review')
    }
  }

  const handleSubmitEntry = async () => {
    if (!contest || picks.length === 0) return
    
    setSubmitting(true)
    
    // Get the authenticated Supabase user
    const { user: authUser, error: authError } = await getCurrentUser()
    
    if (authError || !authUser) {
      // User not logged in - redirect to auth page
      alert('Please sign in to submit an entry.')
      router.push('/auth')
      setSubmitting(false)
      return
    }
    
    const entryPicks: EntryPick[] = picks.map(p => ({
      player: p.player,
      stat: p.stat,
      line: p.line,
      points: p.points
    }))
    
    const entry = await submitEntry(contest.id, {
      userId: authUser.id,
      username: authUser.username,
      picks: entryPicks
    })
    
    if (entry) {
      setStep('submitted')
    } else {
      alert('Error submitting entry. Please try again.')
    }
    
    setSubmitting(false)
  }

  // Calculate total with decimal precision
  const totalPoints = picks.reduce((sum, p) => sum + p.points, 0)
  const potentialPerfectPoints = totalPoints * 2

  // Format points with 2 decimal places
  const formatPoints = (pts: number) => pts.toFixed(2)

  const getPlayersByTeam = () => {
    if (!selectedGame || !availableProps.length) return { homePlayers: [], awayPlayers: [] }
    
    const homeAbbr = getTeamAbbr(selectedGame.home_team)?.toUpperCase()
    const awayAbbr = getTeamAbbr(selectedGame.away_team)?.toUpperCase()
    
    const homePlayers = availableProps.filter(prop => {
      const playerTeam = prop.playerTeam?.toUpperCase()
      return playerTeam === homeAbbr || 
             (playerTeam && homeAbbr && (playerTeam.includes(homeAbbr) || homeAbbr.includes(playerTeam)))
    })
    
    const awayPlayers = availableProps.filter(prop => {
      const playerTeam = prop.playerTeam?.toUpperCase()
      return playerTeam === awayAbbr || 
             (playerTeam && awayAbbr && (playerTeam.includes(awayAbbr) || awayAbbr.includes(playerTeam)))
    })
    
    if (homePlayers.length === 0 && awayPlayers.length === 0) {
      const half = Math.ceil(availableProps.length / 2)
      return {
        homePlayers: availableProps.slice(0, half),
        awayPlayers: availableProps.slice(half)
      }
    }
    
    return { homePlayers, awayPlayers }
  }

  if (loading || !contest) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#00FF00]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30" 
           style={{ backgroundImage: 'radial-gradient(circle at 50% 100%, rgba(0,255,0,0.1), transparent 60%)' }}></div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/contests/${contest.id}`} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group">
            <X size={20} />
            <span className="text-sm font-medium">Exit</span>
          </Link>
          
          <div className="flex flex-col items-center">
            <div className="text-xs text-white/40 uppercase tracking-wider">Tournament</div>
            <div className="text-sm font-bold">{contest.name}</div>
          </div>
          
          <div className="bg-[#00FF00]/10 px-2 py-1 rounded text-xs font-bold text-[#00FF00]">
            ${contest.entryFee}
          </div>
        </div>
        
        {/* Progress Bar */}
        {step !== 'submitted' && (
          <div className="w-full h-1 bg-white/5">
            <div 
              className="h-full bg-[#00FF00] transition-all duration-500 ease-out"
              style={{ width: `${(picks.length / 5) * 100}%` }}
            />
          </div>
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 relative z-10">
        
        {/* Loading Props */}
        {loadingProps && (
          <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center">
            <Loader2 size={32} className="animate-spin text-[#00FF00] mb-4" />
            <p className="text-white/40 text-sm">Loading props...</p>
          </div>
        )}

        {/* Current Picks Summary - Always visible when not in review/submitted */}
        {step !== 'review' && step !== 'submitted' && step !== 'loading' && picks.length > 0 && (
          <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-white">Your Picks ({picks.length}/5)</div>
              <div className="text-sm font-bold text-[#00FF00]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatPoints(totalPoints)} pts
              </div>
            </div>
            <div className="space-y-2">
              {picks.map((pick, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-black/20 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs">{i + 1}.</span>
                    <span className="text-white/80">{pick.player}</span>
                    <span className="text-white/40 text-xs">{pick.line}+ {pick.stat.replace(' Yards', '')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#00FF00] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{pick.points.toFixed(2)}</span>
                    <button 
                      onClick={() => handleRemovePick(i)}
                      className="text-white/30 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Lineup Full Message */}
            {picks.length >= 5 && (
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-center">
                <span className="text-yellow-500 text-sm font-medium">🎯 Lineup Full! Ready to submit.</span>
              </div>
            )}
            
            {/* Submit Button - visible when we have picks */}
            {picks.length >= 1 && (
              <button
                onClick={handleGoToReview}
                className="w-full mt-4 py-3 bg-[#00FF00] text-black font-bold rounded-xl hover:bg-[#00DD00] transition-all flex items-center justify-center gap-2"
              >
                {picks.length >= 5 ? 'Review & Submit Lineup' : `Review ${picks.length} Pick${picks.length > 1 ? 's' : ''}`}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}

        {/* Select Game */}
        {step === 'select_game' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Trophy size={20} className="text-[#00FF00]" />
              Select Matchup
            </h2>
            <p className="text-white/40 text-sm mb-6">
              {picks.length >= 5 
                ? "Lineup full! Review and submit your picks above." 
                : `Pick props from any game. ${5 - picks.length} pick${5 - picks.length !== 1 ? 's' : ''} remaining.`}
            </p>
            
            {/* If lineup is full, don't show games - prompt to review */}
            {picks.length >= 5 ? (
              <div className="text-center py-8 bg-white/5 rounded-2xl border border-white/10">
                <div className="text-4xl mb-3">🎯</div>
                <p className="text-white/60 mb-4">Your lineup is complete!</p>
                <button
                  onClick={handleGoToReview}
                  className="px-6 py-3 bg-[#00FF00] text-black font-bold rounded-xl hover:bg-[#00DD00] transition-all"
                >
                  Review & Submit Lineup
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {schedule.map(game => (
                  <button
                    key={game.id}
                    onClick={() => handleSelectGame(game)}
                    className="w-full group bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl p-4 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center -space-x-2">
                          <img 
                            src={`https://a.espncdn.com/i/teamlogos/nfl/500/${game.away_abbr?.toLowerCase()}.png`}
                            alt={game.away_team}
                            className="w-10 h-10 object-contain relative z-10"
                          />
                          <img 
                            src={`https://a.espncdn.com/i/teamlogos/nfl/500/${game.home_abbr?.toLowerCase()}.png`}
                            alt={game.home_team}
                            className="w-10 h-10 object-contain"
                          />
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-white group-hover:text-[#00FF00] transition-colors">
                            {game.away_team.split(' ').pop()} @ {game.home_team.split(' ').pop()}
                          </div>
                          <div className="text-xs text-white/40">Tap to view props</div>
                        </div>
                      </div>
                      <ArrowRight size={20} className="text-white/20 group-hover:text-[#00FF00] group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                ))}
                
                {schedule.length === 0 && (
                  <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-white/40">No games available right now.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Select Prop - NO TIMER */}
        {step === 'select_prop' && selectedGame && (() => {
          const { homePlayers, awayPlayers } = getPlayersByTeam()
          const homeTeamName = selectedGame.home_team.split(' ').pop()
          const awayTeamName = selectedGame.away_team.split(' ').pop()
          
          return (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              {/* Back to Matchups Button */}
              <button
                onClick={handleBackToMatchups}
                className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4 group"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-medium">Back to Matchups</span>
              </button>
              
              <div className="mb-6">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-1">
                  {selectedGame.away_team.split(' ').pop()} @ {selectedGame.home_team.split(' ').pop()}
                </div>
                <h2 className="text-xl font-bold">Select Player Prop</h2>
              </div>
              
              <MatchupCard 
                homeTeam={homeTeamName}
                awayTeam={awayTeamName}
                homePlayers={homePlayers}
                awayPlayers={awayPlayers}
                onSelectProp={handleSelectProp}
              />
            </div>
          )
        })()}

        {/* Adjust Line - NO TIMER */}
        {step === 'adjust_line' && selectedProp && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-300">
            {/* Back to Props Button */}
            <button
              onClick={handleBackToProps}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4 group"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Back to Props</span>
            </button>
            
            <div className="mb-6">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Pick {picks.length + 1}</div>
              <h2 className="text-xl font-bold">Set Your Line</h2>
            </div>

            <BettingCard {...selectedProp} onLockIn={handleLockIn} />
            
            <button
              onClick={handleBackToMatchups}
              className="w-full mt-4 py-3 bg-white/5 border border-white/10 text-white/60 rounded-xl font-medium hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <X size={16} />
              Cancel & Back to Matchups
            </button>
          </div>
        )}

        {/* Review */}
        {step === 'review' && (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <button
              onClick={() => setStep('select_game')}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4 group"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Add More Picks</span>
            </button>
            
            <h2 className="text-2xl font-bold mb-6 text-center">Confirm Lineup</h2>
            
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl mb-6">
              <div className="divide-y divide-white/5">
                {picks.map((pick, index) => (
                  <PickRow key={index} pick={pick} index={index} onRemove={() => handleRemovePick(index)} />
                ))}
              </div>

              <div className="bg-black/20 p-4 border-t border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white/50">Total Points</span>
                  <span className="font-bold text-xl" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPoints(totalPoints)}</span>
                </div>
                {picks.length === 5 && (
                  <div className="flex justify-between items-center p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                    <div className="flex items-center gap-2 text-yellow-500 font-medium">
                      <Zap size={16} />
                      Perfect Lineup Bonus (2x)
                    </div>
                    <span className="font-bold text-yellow-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPoints(potentialPerfectPoints)} pts</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSubmitEntry}
              disabled={submitting || picks.length === 0}
              className="w-full py-4 bg-[#00FF00] text-black font-bold text-lg rounded-xl hover:bg-[#00DD00] transition-all hover:scale-105 shadow-[0_0_30px_rgba(0,255,0,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
            >
              {submitting ? <Loader2 size={20} className="animate-spin" /> : `Submit ${picks.length} Pick${picks.length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* Submitted */}
        {step === 'submitted' && (
          <div className="text-center py-12 animate-in fade-in zoom-in-95 duration-700">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[#00FF00]/10 border border-[#00FF00]/20 flex items-center justify-center shadow-[0_0_50px_rgba(0,255,0,0.2)]">
              <Check size={48} className="text-[#00FF00]" />
            </div>
            <h2 className="text-3xl font-bold mb-2">Lineup Locked!</h2>
            <p className="text-white/40 mb-8 max-w-xs mx-auto">Your entry is live. Watch the leaderboard as games play out.</p>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 backdrop-blur-xl">
              <div className="text-sm text-white/40 uppercase tracking-wider mb-1">Potential Score</div>
              <div className="text-4xl font-bold text-white mb-2" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPoints(totalPoints)}</div>
              {picks.length === 5 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-sm font-medium border border-yellow-500/20">
                  <Zap size={12} />
                  {formatPoints(potentialPerfectPoints)} pts max (2x bonus)
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <Link
                href={`/contests/${contest.id}`}
                className="w-full py-4 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all border border-white/5"
              >
                View Leaderboard
              </Link>
              <Link
                href="/contests"
                className="w-full py-4 text-white/40 hover:text-white transition-colors text-sm font-medium"
              >
                Return to Lobby
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// Pick Row Component with remove button
function PickRow({ pick, index, onRemove }: { pick: Pick; index: number; onRemove?: () => void }) {
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null)

  useEffect(() => {
    if (pick.player) {
      getPlayerId(pick.player).then(id => {
        if (id) setHeadshotUrl(getPlayerHeadshotUrl(id))
      })
    }
  }, [pick.player])

  const getRiskColor = (label: string) => {
    switch(label) {
      case 'SAFE': return '#00FF00'
      case 'BASE': return '#ffffff'
      case 'RISK': return '#ff6b35'
      case 'MAX': return '#ef4444'
      default: return '#ffffff'
    }
  }

  return (
    <div className="p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
      <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-white/30">
        {index + 1}
      </div>
      
      <div className="w-10 h-10 rounded-full bg-black/40 overflow-hidden border border-white/10">
        {headshotUrl ? (
          <img src={headshotUrl} alt={pick.player} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30 text-xs font-bold">
            {pick.player.charAt(0)}
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-bold text-white/90 truncate text-sm">{pick.player}</div>
        <div className="text-xs text-white/40 uppercase tracking-wide">{pick.line}+ {pick.stat.replace(' Yards', '')}</div>
      </div>
      
      <div className="text-right flex items-center gap-3">
        <div>
          <div className="text-lg font-bold" style={{ color: getRiskColor(pick.riskLabel), fontVariantNumeric: 'tabular-nums' }}>
            {pick.points.toFixed(2)}
          </div>
          <div className="text-[9px] font-bold tracking-wider uppercase opacity-60" style={{ color: getRiskColor(pick.riskLabel) }}>{pick.riskLabel}</div>
        </div>
        {onRemove && (
          <button 
            onClick={onRemove}
            className="text-white/30 hover:text-red-500 transition-colors p-1"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
