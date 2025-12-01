"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { getSchedule, getGameProps } from "./actions/getOdds"
import { getTeamAbbr, getPlayerId, getPlayerHeadshotUrl } from "./lib/espn"
import { saveDraft } from "./lib/drafts"

// Core Game Components
import { BettingCard } from "./components/BettingCard"
import { SlotMachineWheel } from "./components/SlotMachineWheel"
import { DoubleDown } from "./components/DoubleDown"
import { Header } from "./components/Header"
import { Timer } from "./components/Timer"
import { OpponentReveal } from "./components/OpponentReveal"

import { MatchupCard } from "./components/ui/SpotlightCard"
import { UserHeader } from "./components/UserHeader"

// How to Play Modal Component
function HowToPlayModal({ onClose }: { onClose: () => void }) {
  const [showStrategy, setShowStrategy] = useState(false)
  
  const steps = [
    { num: 1, title: "Enter a Tournament", desc: "Join a tournament and select from available NFL matchups" },
    { num: 2, title: "Draft 5 Props", desc: "Pick 5 player prop OVERs - passing yards, receiving yards, rushing, etc." },
    { num: 3, title: "Set Your Lines", desc: "Slide to adjust risk:", hasSlider: true },
    { num: 4, title: "Hits = Multiplier", desc: "Props that hit (player goes OVER) earn points. More hits = bigger multiplier.", hasTable: true },
    { num: 5, title: "Top Score Wins", desc: "Base points × multiplier = final score. Highest score takes the pot!" },
  ]
  
  const multipliers = [
    { hits: "5/5", mult: "5x", best: true },
    { hits: "4/5", mult: "4x" },
    { hits: "3/5", mult: "3x" },
    { hits: "2/5", mult: "2x" },
    { hits: "1/5", mult: "1x" },
    { hits: "0/5", mult: "0 pts", worst: true },
  ]

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#0a0a0a',
          border: '1px solid #222',
          borderRadius: '20px',
          maxWidth: '420px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          padding: '20px 24px', 
          borderBottom: '1px solid #1a1a1a',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              backgroundColor: 'rgba(0, 255, 0, 0.15)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <span style={{ fontSize: '16px' }}>🏈</span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: 0 }}>How to Play</h3>
          </div>
          <button 
            onClick={onClose} 
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: '8px',
              color: '#666',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          {/* Intro */}
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px', lineHeight: 1.5 }}>
            An NFL props tournament where you compete by drafting player prop overs. Set your lines, hit your picks, win the pot.
          </p>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {steps.map((step) => (
              <div key={step.num}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ 
                    width: '28px', 
                    height: '28px', 
                    borderRadius: '50%', 
                    backgroundColor: 'rgba(0, 255, 0, 0.15)', 
                    border: '1px solid rgba(0, 255, 0, 0.3)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    flexShrink: 0 
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#00FF00' }}>{step.num}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>{step.title}</div>
                    <div style={{ fontSize: '12px', color: '#777', lineHeight: 1.4 }}>{step.desc}</div>
                    
                    {/* Slider Visual for Step 3 */}
                    {step.hasSlider && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#22c55e' }}>SAFE</span>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#ef4444' }}>MAX</span>
                        </div>
                        <div style={{ 
                          height: '8px', 
                          borderRadius: '4px', 
                          background: 'linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)',
                          opacity: 0.8
                        }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ fontSize: '10px', color: '#666' }}>Easier to hit, fewer pts</span>
                          <span style={{ fontSize: '10px', color: '#666' }}>Harder to hit, more pts</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Multiplier Table for Step 4 */}
                {step.hasTable && (
                  <div style={{ 
                    marginTop: '12px', 
                    marginLeft: '40px',
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)', 
                    gap: '6px' 
                  }}>
                    {multipliers.map((m) => (
                      <div 
                        key={m.hits}
                        style={{ 
                          padding: '8px 6px',
                          borderRadius: '8px',
                          textAlign: 'center',
                          backgroundColor: m.best ? 'rgba(0, 255, 0, 0.1)' : m.worst ? 'rgba(239, 68, 68, 0.1)' : '#111',
                          border: m.best ? '1px solid rgba(0, 255, 0, 0.3)' : m.worst ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #1a1a1a'
                        }}
                      >
                        <div style={{ fontSize: '10px', color: m.best ? '#22c55e' : m.worst ? '#ef4444' : '#888', fontWeight: 500 }}>
                          {m.hits}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: m.best ? '#22c55e' : m.worst ? '#ef4444' : '#fff' }}>
                          {m.mult}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Warning Callout */}
          <div style={{
            marginTop: '20px',
            padding: '12px 14px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '12px'
          }}>
            <p style={{ fontSize: '11px', color: '#f87171', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>
              <strong>⚠️ Key Rule:</strong> Missed picks = 0 points. A 20-point MAX pick that misses is worth less than a 2-point SAFE pick that hits!
            </p>
          </div>

          {/* Strategy Section - Collapsible */}
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={() => setShowStrategy(!showStrategy)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                backgroundColor: '#111',
                border: '1px solid #222',
                borderRadius: '12px',
                cursor: 'pointer',
                color: '#fff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💡</span>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>Strategy Tips</span>
              </div>
              <svg 
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"
                style={{ transform: showStrategy ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            
            {showStrategy && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '12px', backgroundColor: '#111', borderRadius: '10px', border: '1px solid #1a1a1a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span>🛡️</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#22c55e' }}>Conservative</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0, lineHeight: 1.4 }}>
                    Pick safe lines on heavy favorites. Lower points but more likely to hit 5/5 for the 5x multiplier.
                  </p>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#111', borderRadius: '10px', border: '1px solid #1a1a1a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span>🔥</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444' }}>Aggressive</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0, lineHeight: 1.4 }}>
                    Push lines to MAX for huge point totals. Risk 0 points, but one big hit can win it all.
                  </p>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#111', borderRadius: '10px', border: '1px solid #1a1a1a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span>⚖️</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#eab308' }}>Balanced</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0, lineHeight: 1.4 }}>
                    Mix 2-3 safe picks with 2-3 aggressive ones. Guarantee some multiplier while chasing upside.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Button */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #1a1a1a', flexShrink: 0 }}>
          <button 
            onClick={onClose}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(90deg, #00FF00, #00DD00)',
              border: 'none',
              borderRadius: '12px',
              color: '#000',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  )
}

// All 32 NFL team abbreviations for logos
const NFL_TEAMS = [
  'ari', 'atl', 'bal', 'buf', 'car', 'chi', 'cin', 'cle',
  'dal', 'den', 'det', 'gb', 'hou', 'ind', 'jax', 'kc',
  'lv', 'lac', 'lar', 'mia', 'min', 'ne', 'no', 'nyg',
  'nyj', 'phi', 'pit', 'sf', 'sea', 'tb', 'ten', 'wsh'
]

// Animated Slider Underline - small, centered under logo
function AnimatedSlider() {
  return (
    <div style={{ 
      width: '200px', 
      margin: '0 auto',
      position: 'relative',
      height: '20px'
    }}>
      {/* Track */}
      <div style={{ 
        position: 'absolute',
        top: '8px',
        left: 0,
        right: 0,
        height: '4px', 
        backgroundColor: '#222', 
        borderRadius: '2px'
      }} />
      
      {/* Animated Handle */}
      <div 
        className="slider-handle-animate"
        style={{
          position: 'absolute',
          top: '0px',
          width: '32px',
          height: '20px',
          borderRadius: '10px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1px',
          boxShadow: '0 0 12px rgba(0, 255, 0, 0.3)'
        }}
      >
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
          <path d="M5 1L1 5L5 9" stroke="#00FF00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
          <path d="M1 1L5 5L1 9" stroke="#00FF00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      
      {/* Green trail that follows handle */}
      <div 
        className="slider-trail-animate"
        style={{
          position: 'absolute',
          top: '8px',
          left: '16px',
          height: '4px',
          backgroundColor: '#00FF00',
          borderRadius: '2px',
          boxShadow: '0 0 8px rgba(0, 255, 0, 0.5)'
        }}
      />
    </div>
  )
}

// NFL Team Logo Marquee Component
function NFLLogoMarquee() {
  // Double the logos for seamless infinite scroll
  const logos = [...NFL_TEAMS, ...NFL_TEAMS]

  return (
    <div className="w-full overflow-hidden py-12" style={{ 
      maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
      WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)'
    }}>
      <div 
        className="flex items-center gap-16"
        style={{
          animation: 'marquee 60s linear infinite',
          width: 'max-content'
        }}
      >
        {logos.map((team, i) => (
          <img
            key={`${team}-${i}`}
            src={`https://a.espncdn.com/i/teamlogos/nfl/500/${team}.png`}
            alt={team}
            className="opacity-30 hover:opacity-60 transition-opacity duration-300"
            style={{ 
              width: 64, 
              height: 64, 
              objectFit: 'contain',
              filter: 'grayscale(100%)'
            }}
          />
        ))}
      </div>
    </div>
  )
}

// Compact Summary Pick Row with yards line
function SummaryPickRow({ pick, isYou }: { pick: any; isYou: boolean }) {
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    if (pick.player && isYou) {
      getPlayerId(pick.player).then(id => {
        if (id) setHeadshotUrl(getPlayerHeadshotUrl(id))
      })
    }
  }, [pick.player, isYou])

  const points = pick.potentialPoints ?? pick.points ?? 5
  const line = pick.finalLine ?? pick.line ?? '—'
  const accentColor = isYou ? '#00FF00' : '#ff6b35'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px',
      borderRadius: '8px',
      backgroundColor: '#111',
      border: '1px solid #1a1a1a',
      marginBottom: '4px'
    }}>
      {/* Headshot */}
      <div style={{ 
        width: 28, 
        height: 28, 
        borderRadius: '50%', 
        overflow: 'hidden',
        backgroundColor: '#161616', 
        border: `1px solid ${accentColor}40`,
        flexShrink: 0
      }}>
        {isYou && headshotUrl && !imageError ? (
          <img 
            src={headshotUrl} 
            alt={pick.player}
            style={{ width: 28, height: 28, objectFit: 'cover' }}
            onError={() => setImageError(true)}
          />
        ) : (
          <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 10, fontWeight: 500 }}>
            {isYou ? (pick.player?.charAt(0) || '?') : '?'}
          </div>
        )}
      </div>
      
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', fontWeight: 500, color: isYou ? '#fff' : '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isYou ? pick.player : 'LOCKED'}
        </div>
        <div style={{ fontSize: '9px', color: '#666' }}>
          {isYou ? `${line}+ ${pick.stat?.replace(' Yards', '').replace('Passing', 'Pass').replace('Receiving', 'Rec').replace('Rushing', 'Rush')}` : 'Hidden until kickoff'}
        </div>
      </div>
      
      {/* Points */}
      <div style={{ 
        fontSize: '13px', 
        fontWeight: 600, 
        color: isYou ? (points > 2 ? '#00FF00' : points < 1.5 ? '#ef4444' : '#fff') : '#555',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums'
      }}>
        {isYou ? (typeof points === 'number' ? points.toFixed(2) : points) : '—'}
      </div>
    </div>
  )
}

export default function Home() {
  const [balance, setBalance] = useState(1000)
  const [step, setStep] = useState<'IDLE' | 'LOADING_SCHEDULE' | 'SPINNING' | 'LOADING_PROPS' | 'SELECTION' | 'DRAFTING' | 'REVEAL' | 'DOUBLEDOWN' | 'SUMMARY'>('IDLE')
  
  const [picks, setPicks] = useState<any[]>([])
  const [opponentPicks, setOpponentPicks] = useState<any[]>([])
  const [schedule, setSchedule] = useState<any[]>([])
  const [targetGame, setTargetGame] = useState<any>(null)
  const [availableProps, setAvailableProps] = useState<any[]>([])
  const [selectedProp, setSelectedProp] = useState<any>(null)
  const [isDoubledDown, setIsDoubledDown] = useState(false)
  const [showExplainer, setShowExplainer] = useState(false)
  
  // Use ref to store schedule so it's immediately available
  const scheduleRef = useRef<any[]>([])

  const findMatch = async (isRetry = false) => {
    if (step === 'IDLE' && !isRetry) {
      setBalance(b => b - 50)
      setPicks([])
      setOpponentPicks([])
      setIsDoubledDown(false)
    }

    let currentSchedule = scheduleRef.current
    if (currentSchedule.length === 0) {
      setStep('LOADING_SCHEDULE')
      currentSchedule = await getSchedule()
      scheduleRef.current = currentSchedule
      setSchedule(currentSchedule)
    }

    if (currentSchedule.length === 0) {
      alert("No games found! API might be empty.")
      setStep('IDLE')
      return
    }

    const randomGame = currentSchedule[Math.floor(Math.random() * currentSchedule.length)]
    setTargetGame(randomGame)
    setStep('SPINNING')
  }

  const handleSpinComplete = async (preloadedProps?: any[]) => {
    // If props were preloaded during countdown, use them directly
    if (preloadedProps && preloadedProps.length > 0) {
      setAvailableProps(preloadedProps)
      setStep('SELECTION')
      return
    }
    
    // Otherwise, load props now (fallback)
    setStep('LOADING_PROPS')
    const props = await getGameProps(targetGame.id)
    
    if (!props || props.length === 0) {
      console.log("No props found. Auto-spinning...")
      findMatch(true) 
      return
    }
    setAvailableProps(props)
    setStep('SELECTION')
  }

  const handleSelectProp = (prop: any) => {
    setSelectedProp(prop)
    setStep('DRAFTING')
  }

  const handleLockIn = (points: number, finalLine: number, riskLabel: string) => {
    const newPick = { ...selectedProp, potentialPoints: points, finalLine, riskLabel }
    setPicks([...picks, newPick])
    setStep('REVEAL')
  }

  const handleRevealComplete = (opponentPick: any) => {
    // Store opponent's pick
    setOpponentPicks(prev => [...prev, opponentPick])
    
    if (picks.length < 5) {
      findMatch(true)
    } else {
      setStep('DOUBLEDOWN')
    }
  }

  const handleDoubleDown = (doIt: boolean) => {
    const doubled = doIt
    if (doIt) {
      setBalance(b => b - 25)
      setIsDoubledDown(true)
    }
    
    // Save draft to history
    if (targetGame) {
      const userTotalPoints = picks.slice(0, 5).reduce((sum, p) => sum + (p.potentialPoints || 5), 0)
      const oppTotalPoints = opponentPicks.slice(0, 5).reduce((sum, p) => sum + (p.points || 5), 0)
      
      saveDraft({
        game: {
          homeTeam: targetGame.home_team,
          awayTeam: targetGame.away_team,
          gameTime: targetGame.commence_time
        },
        userPicks: picks.slice(0, 5).map(p => ({
          player: p.player,
          stat: p.stat,
          line: p.line,
          finalLine: p.finalLine || p.line,
          direction: 'over' as const,
          potentialPoints: p.potentialPoints || 5,
          riskLabel: p.riskLabel || 'BASE'
        })),
        opponentPicks: opponentPicks.slice(0, 5).map(p => ({
          player: p.player,
          stat: p.stat,
          line: p.line,
          points: p.points || 5,
          strategy: p.strategy || 'BASE'
        })),
        userTotalPoints,
        opponentTotalPoints: oppTotalPoints,
        isDoubledDown: doubled,
        potentialPayout: doubled ? 500 : 100,
        status: 'pending',
        entryFee: 50
      })
    }
    
    setStep('SUMMARY')
  }

  const getPlayersByTeam = () => {
    if (!targetGame || !availableProps.length) return { homePlayers: [], awayPlayers: [] }
    
    const homeAbbr = getTeamAbbr(targetGame.home_team)?.toUpperCase()
    const awayAbbr = getTeamAbbr(targetGame.away_team)?.toUpperCase()
    
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

  const potentialPoints = picks.reduce((acc, p) => acc + p.potentialPoints, 0)
  const potentialPayout = isDoubledDown ? 500 : 100
  
  // Use ref for immediate access, fall back to state
  const gamesForSpinner = scheduleRef.current.length > 0 ? scheduleRef.current : schedule

  // Track mouse position for grid hover effect
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  
  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }

  return (
    <div 
      className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden relative" 
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      onMouseMove={handleMouseMove}
    >
      {/* Grid that reveals on mouse hover with green glow */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          maskImage: `radial-gradient(circle 250px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)`,
          WebkitMaskImage: `radial-gradient(circle 250px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)`
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
          background: 'radial-gradient(circle, rgba(0,255,0,0.12) 0%, rgba(0,255,0,0.05) 40%, transparent 70%)',
          borderRadius: '50%'
        }}
      />

      {/* PHASE: IDLE - Landing Page */}
      {step === 'IDLE' && (
        <div className="min-h-screen relative z-10">
          {/* Header */}
          <header style={{ position: 'fixed', top: 0, right: 0, left: 'auto', zIndex: 50, padding: '16px 24px' }}>
            <UserHeader />
          </header>

          {/* Main content - centered */}
          <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
            
            {/* Logo - centered above headlines, MUCH LARGER */}
            <div style={{
              fontSize: '80px',
              fontWeight: 400,
              letterSpacing: '-0.03em',
              lineHeight: 1
            }}>
              <span style={{color: '#ffffff'}}>h2h.</span>
              <span style={{color: '#00FF00'}}>cash</span>
            </div>
            
            {/* Animated Slider Underline */}
            <AnimatedSlider />
            
            <h1 style={{
              fontSize: 'clamp(24px, 4vw, 36px)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              marginTop: '32px',
              marginBottom: '4px',
              lineHeight: 1.2,
              textAlign: 'center'
            }}>
              Beat opponents. Win cash
            </h1>
            
            <h2 style={{
              fontSize: 'clamp(20px, 3vw, 32px)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: '#00FF00',
              marginBottom: '4px',
              lineHeight: 1.2,
              textAlign: 'center'
            }}>
              Double down. Win more.
            </h2>
            
            <p style={{
              fontSize: 'clamp(16px, 2vw, 22px)',
              fontWeight: 300,
              color: 'rgba(255,255,255,0.6)',
              marginBottom: '32px',
              letterSpacing: '-0.01em',
              textAlign: 'center'
            }}>
              Draft smarter.
            </p>
            
            {/* Glass Pill Buttons */}
            <div className="flex flex-col items-center gap-4 mb-16">
              {/* Top Row - Main Actions */}
              <div className="flex flex-row items-center gap-4">
                {/* HOW TO PLAY */}
                <button 
                  onClick={() => setShowExplainer(true)}
                  className="psl-glass-btn"
                >
                  <span className="dot"></span>
                  <span className="btn-text">How to Play</span>
                  <span className="arrow">→</span>
                </button>
                
                {/* DRAFT NOW - Quick H2H */}
                <button 
                  onClick={() => findMatch(false)}
                  className="psl-glass-btn"
                >
                  <span className="dot"></span>
                  <span className="btn-text">Quick Draft</span>
                  <span className="arrow">→</span>
                </button>
              </div>
              
              {/* Tournament Mode Button */}
              <Link
                href="/contests"
                className="psl-glass-btn"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(0, 255, 0, 0.1) 0%, rgba(0, 200, 0, 0.05) 100%)',
                  borderColor: 'rgba(0, 255, 0, 0.3)'
                }}
              >
                <span className="dot" style={{ background: '#FFD700', boxShadow: '0 0 10px #FFD700' }}></span>
                <span className="btn-text">🏆 Tournaments</span>
                <span className="arrow">→</span>
              </Link>
            </div>

            {/* NFL Team Logos Marquee */}
            <div className="mt-12">
              <NFLLogoMarquee />
            </div>
          </div>

          {/* How to Play Modal */}
          {showExplainer && (
            <HowToPlayModal onClose={() => setShowExplainer(false)} />
          )}
        </div>
      )}

      {/* Non-IDLE states use Header component and centered container */}
      {step !== 'IDLE' && (
        <>
          <Header balance={balance} />
          <main className="w-full max-w-lg mx-auto flex-1 flex flex-col items-center justify-center p-4 pt-20 relative z-10 min-h-screen">
            
            {/* PHASE: LOADING SCHEDULE */}
            {step === 'LOADING_SCHEDULE' && (
              <div className="w-full h-[60vh] flex items-center justify-center">
                <div className="text-[#00FF00] text-sm tracking-[0.3em] font-medium animate-pulse">
                  LOADING NFL SCHEDULE...
                </div>
              </div>
            )}

            {/* PHASE: SPINNING */}
            {step === 'SPINNING' && gamesForSpinner.length > 0 && targetGame && (
              <div className="w-full h-[60vh] flex items-center justify-center relative">
                <div className="absolute w-[300px] h-[300px] bg-[#00FF00]/5 blur-[80px] rounded-full" />
                <SlotMachineWheel games={gamesForSpinner} targetGame={targetGame} onComplete={handleSpinComplete} />
              </div>
            )}

            {/* PHASE: LOADING */}
            {step === 'LOADING_PROPS' && (
              <div className="animate-pulse text-[#00FF00]/50 text-sm tracking-[0.3em] font-medium">
                ANALYZING MARKETS...
              </div>
            )}

            {/* PHASE: SELECTION */}
            {step === 'SELECTION' && (() => {
              const { homePlayers, awayPlayers } = getPlayersByTeam()
              const homeTeamName = targetGame?.home_team.split(' ').pop()
              const awayTeamName = targetGame?.away_team.split(' ').pop()
              
              return (
                <div className="w-full max-w-[360px] mx-auto">
                  <Timer key={`selection-${picks.length}`} onExpire={() => handleSelectProp(availableProps[0])} />
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

            {/* PHASE: DRAFTING */}
            {step === 'DRAFTING' && selectedProp && (
              <div className="w-full flex flex-col gap-2">
                <Timer key={`drafting-${picks.length}`} onExpire={() => handleLockIn(5, selectedProp.line, "BASE")} />
                <div className="text-[#555] text-[10px] font-medium tracking-[0.2em] text-center uppercase mb-2">
                  PICK {picks.length + 1} / 5
                </div>
                <BettingCard {...selectedProp} onLockIn={handleLockIn} />
                
                {/* Back Button */}
                <button
                  onClick={() => {
                    setSelectedProp(null)
                    setStep('SELECTION')
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '12px 20px',
                    backgroundColor: 'transparent',
                    border: '1px solid #333',
                    color: '#888',
                    fontWeight: 500,
                    fontSize: '12px',
                    letterSpacing: '0.05em',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  className="hover:border-[#00FF00] hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back to Props
                </button>
              </div>
            )}

            {/* PHASE: REVEAL */}
            {step === 'REVEAL' && (
              <OpponentReveal onComplete={handleRevealComplete} availableProps={availableProps} />
            )}

            {/* PHASE: DOUBLE DOWN */}
            {step === 'DOUBLEDOWN' && (
              <DoubleDown potentialPoints={potentialPoints} onDecide={handleDoubleDown} />
            )}

            {/* PHASE: SUMMARY */}
            {step === 'SUMMARY' && (() => {
              // Calculate totals - only use first 5 picks
              const yourPicks = picks.slice(0, 5)
              const theirPicks = opponentPicks.slice(0, 5)
              const yourTotal = yourPicks.reduce((sum, p) => sum + (p.potentialPoints || 5), 0)
              // Opponent total is hidden until games start
              
              return (
                <div className="w-full max-w-[420px] mx-auto">
                  {/* Main Card Container */}
                  <div style={{
                    borderRadius: '20px',
                    backgroundColor: '#111',
                    border: '1px solid #222',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                  }}>
                    
                    {/* Header */}
                    <div style={{ padding: '16px 16px 12px', textAlign: 'center', borderBottom: '1px solid #1a1a1a' }}>
                      <h1 style={{ fontSize: '20px', fontWeight: 300, color: '#fff', marginBottom: '4px' }}>
                        CONTEST <span style={{ color: '#FFD700', fontWeight: 600 }}>PENDING</span>
                      </h1>
                      <p style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>
                        Waiting for Live Data Feed
                      </p>
                      
                      {isDoubledDown && (
                        <div style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '8px',
                          padding: '4px 10px', 
                          borderRadius: '20px',
                          backgroundColor: 'rgba(0, 255, 0, 0.1)',
                          border: '1px solid rgba(0, 255, 0, 0.3)'
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#00FF00' }}></span>
                          <span style={{ fontSize: '9px', fontWeight: 600, color: '#00FF00', textTransform: 'uppercase', letterSpacing: '0.05em' }}>8x Active</span>
                        </div>
                      )}
                    </div>

                    {/* Payout & Score Summary - Opponent score hidden */}
                    <div style={{ 
                      margin: '12px 12px 0',
                      padding: '16px',
                      backgroundColor: '#0a0a0a',
                      borderRadius: '12px',
                      border: '1px solid #1a1a1a',
                      display: 'flex',
                      justifyContent: 'space-around',
                      alignItems: 'center'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 600, color: '#00FF00', fontVariantNumeric: 'tabular-nums' }}>{yourTotal.toFixed(2)}</div>
                        <div style={{ fontSize: '9px', color: '#00FF00', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Draft</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 300, color: '#FFD700' }}>${potentialPayout}</div>
                        <div style={{ fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Potential</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 600, color: '#555', fontVariantNumeric: 'tabular-nums' }}>—</div>
                        <div style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Opp (Hidden)</div>
                      </div>
                    </div>

                    {/* Side by Side Picks */}
                    <div style={{ 
                      margin: '12px',
                      backgroundColor: '#0a0a0a',
                      borderRadius: '12px',
                      border: '1px solid #1a1a1a',
                      overflow: 'hidden'
                    }}>
                      {/* Column Headers */}
                      <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a' }}>
                        <div style={{ flex: 1, padding: '10px 8px', borderRight: '1px solid #1a1a1a' }}>
                          <div style={{ fontSize: '9px', color: '#00FF00', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#00FF00' }}></span>
                            Your Picks
                          </div>
                        </div>
                        <div style={{ flex: 1, padding: '10px 8px' }}>
                          <div style={{ fontSize: '9px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            Opponent (Locked)
                          </div>
                        </div>
                      </div>

                      {/* Pick Rows - Side by Side */}
                      <div style={{ display: 'flex' }}>
                        {/* Your Picks Column */}
                        <div style={{ flex: 1, padding: '8px', borderRight: '1px solid #1a1a1a' }}>
                          {yourPicks.map((p, i) => (
                            <SummaryPickRow key={i} pick={p} isYou={true} />
                          ))}
                        </div>
                        
                        {/* Opponent Picks Column - All locked */}
                        <div style={{ flex: 1, padding: '8px' }}>
                          {theirPicks.map((p, i) => (
                            <SummaryPickRow key={i} pick={{...p, potentialPoints: p.points, finalLine: p.line}} isYou={false} />
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Pending Notice */}
                    <div style={{
                      margin: '0 12px 12px',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(255, 215, 0, 0.05)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 215, 0, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <div style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        backgroundColor: '#FFD700',
                        animation: 'pulse 2s infinite'
                      }}></div>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#FFD700' }}>Awaiting Kickoff</div>
                        <div style={{ fontSize: '10px', color: '#666' }}>Scoring begins when games start. All picks revealed at kickoff.</div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button 
                        onClick={() => { setStep('IDLE'); setPicks([]); setOpponentPicks([]); setIsDoubledDown(false); }}
                        style={{
                          width: '100%',
                          padding: '14px 20px',
                          background: 'linear-gradient(90deg, #00FF00, #00DD00)',
                          color: '#000',
                          fontWeight: 600,
                          fontSize: '13px',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          border: 'none',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        className="hover:opacity-90 active:scale-[0.98]"
                      >
                        New Draft
                      </button>
                      <Link 
                        href="/drafts"
                        style={{
                          width: '100%',
                          padding: '12px 20px',
                          backgroundColor: 'transparent',
                          border: '1px solid #333',
                          color: '#888',
                          fontWeight: 500,
                          fontSize: '12px',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          borderRadius: '12px',
                          textAlign: 'center',
                          textDecoration: 'none',
                          display: 'block',
                          transition: 'all 0.2s'
                        }}
                        className="hover:border-[#00FF00] hover:text-white"
                      >
                        View My Drafts
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })()}
          </main>
        </>
      )}
    </div>
  )
}// Build trigger Sun Nov 30 20:43:22 EST 2025
