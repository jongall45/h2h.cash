"use client"

import { useState, useEffect, useRef } from "react"
import { getPlayerId, getPlayerHeadshotUrl } from "../lib/espn"

interface AlternateLine {
  line: number
  odds: number
  points: number
  riskLabel: string
}

interface BettingCardProps {
  player: string
  team: string
  opponent: string
  stat: string
  line: number
  odds?: number
  type: string
  alternateLines?: AlternateLine[]
  onLockIn: (points: number, finalLine: number, riskLabel: string) => void
}

export function BettingCard({ player, team, opponent, stat, line, odds, type, alternateLines = [], onLockIn }: BettingCardProps) {
  const [sliderValue, setSliderValue] = useState<number>(50)
  const [isDragging, setIsDragging] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const sliderRef = useRef<HTMLDivElement>(null)
  
  // Find and set the base line index on mount
  useEffect(() => {
    if (alternateLines.length > 0) {
      // Find the line closest to -110 odds (the "base" line)
      const baseIndex = alternateLines.findIndex(l => 
        l.odds >= -120 && l.odds <= -100
      )
      const initialIndex = baseIndex >= 0 ? baseIndex : Math.floor(alternateLines.length / 2)
      // Convert index to slider percentage
      const percentage = (initialIndex / (alternateLines.length - 1)) * 100
      setSliderValue(percentage)
    }
  }, [alternateLines])
  
  // Fetch player headshot
  useEffect(() => {
    if (!player) {
      setLoading(false)
      return
    }
    
    let mounted = true
    
    getPlayerId(player).then(id => {
      if (mounted) {
        setHeadshotUrl(getPlayerHeadshotUrl(id))
        setLoading(false)
      }
    })
    
    return () => { mounted = false }
  }, [player])

  // Convert slider value (0-100) to line index
  const getSelectedLineIndex = () => {
    if (alternateLines.length === 0) return 0
    const index = Math.round((sliderValue / 100) * (alternateLines.length - 1))
    return Math.max(0, Math.min(index, alternateLines.length - 1))
  }
  
  // Get the selected line data
  const hasAlternates = alternateLines.length > 0
  const selectedLineIndex = getSelectedLineIndex()
  const selectedLine = hasAlternates ? alternateLines[selectedLineIndex] : { 
    line, 
    odds: odds || -110, 
    points: 5, 
    riskLabel: 'BASE' 
  }
  
  const potentialPoints = selectedLine.points
  const targetYards = selectedLine.line
  const riskLabel = selectedLine.riskLabel

  // Format odds for display
  const formatOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : `${odds}`
  }

  // Get color based on risk
  const getRiskColor = (label: string) => {
    switch(label) {
      case 'SAFE': return '#00FF00'
      case 'BASE': return '#ffffff'
      case 'RISK': return '#ff6b35'
      case 'MAX': return '#ef4444'
      default: return '#ffffff'
    }
  }

  // Get gradient for slider track based on position
  const getSliderGradient = () => {
    return `linear-gradient(to right, 
      #00FF00 0%, 
      #00FF00 25%, 
      #ffffff 40%, 
      #ffffff 60%, 
      #ff6b35 75%, 
      #ef4444 100%
    )`
  }

  // Handle slider drag
  const handleSliderInteraction = (clientX: number) => {
    if (!sliderRef.current) return
    
    const rect = sliderRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderValue(percentage)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    handleSliderInteraction(e.clientX)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleSliderInteraction(e.clientX)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    handleSliderInteraction(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      handleSliderInteraction(e.touches[0].clientX)
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Add global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('touchend', handleGlobalMouseUp)
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('touchend', handleGlobalMouseUp)
    }
  }, [])

  return (
    <div className="w-full max-w-[340px] mx-auto relative z-10">
      {/* Outer card with rounded corners and subtle border */}
      <div style={{
        borderRadius: '20px',
        backgroundColor: '#111',
        border: '1px solid #222',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        
        {/* ===== HEADER ROW ===== */}
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Player Avatar */}
          <div style={{ 
            width: 44, 
            height: 44, 
            borderRadius: '50%', 
            overflow: 'hidden', 
            backgroundColor: '#1a1a1a', 
            border: '2px solid #333',
            flexShrink: 0 
          }}>
            {loading ? (
              <div style={{ width: 44, height: 44, backgroundColor: '#222' }} className="animate-pulse" />
            ) : headshotUrl && !imageError ? (
              <img 
                src={headshotUrl} 
                alt={player}
                style={{ width: 44, height: 44, objectFit: 'cover' }}
                onError={() => setImageError(true)}
              />
            ) : (
              <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 18, fontWeight: 600 }}>
                {player.charAt(0)}
              </div>
            )}
          </div>
          
          {/* Risk indicator badge */}
          <div style={{ 
            padding: '6px 14px', 
            borderRadius: '20px', 
            backgroundColor: `${getRiskColor(riskLabel)}15`,
            border: `1px solid ${getRiskColor(riskLabel)}40`,
            transition: 'all 0.2s'
          }}>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 700, 
              color: getRiskColor(riskLabel),
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              transition: 'color 0.2s'
            }}>
              {riskLabel}
            </span>
          </div>
        </div>

        {/* ===== PLAYER NAME & STAT ===== */}
        <div style={{ padding: '0 18px 16px' }}>
          <div style={{ color: '#ffffff', fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>{player}</div>
          <div style={{ color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat}</div>
        </div>

        {/* ===== MAIN CONTENT AREA ===== */}
        <div style={{ 
          margin: '0 12px 12px',
          padding: '24px 20px',
          backgroundColor: '#0a0a0a',
          borderRadius: '16px',
          border: '1px solid #1a1a1a'
        }}>
          
          {/* Target Yards - Large Display */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <div style={{ 
              fontSize: '56px', 
              fontWeight: 700, 
              color: '#ffffff',
              lineHeight: 1,
              marginBottom: '4px',
              transition: 'all 0.15s'
            }}>
              {targetYards}+
            </div>
            <div style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              {stat.replace(' Yards', '')} Yards
            </div>
          </div>

          {/* Odds & Points Row */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '24px',
            marginBottom: '24px',
            padding: '12px 0'
          }}>
            {/* Odds */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '22px', 
                fontWeight: 600, 
                color: selectedLine.odds > 0 ? '#00FF00' : '#888',
                transition: 'color 0.2s'
              }}>
                {formatOdds(selectedLine.odds)}
              </div>
              <div style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>
                Odds
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '36px', backgroundColor: '#222' }}></div>

            {/* Points */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '28px', 
                fontWeight: 700, 
                color: getRiskColor(riskLabel),
                transition: 'color 0.2s'
              }}>
                {potentialPoints}
              </div>
              <div style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>
                Points
              </div>
            </div>
          </div>

          {/* ===== SLIDER ===== */}
          {hasAlternates && alternateLines.length > 1 ? (
            <div style={{ marginBottom: '16px' }}>
              {/* Slider Labels */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '10px',
                padding: '0 4px'
              }}>
                <span style={{ fontSize: '10px', color: '#00FF00', fontWeight: 600 }}>SAFE</span>
                <span style={{ fontSize: '10px', color: '#666', fontWeight: 500 }}>DRAG TO ADJUST</span>
                <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600 }}>MAX</span>
              </div>

              {/* Slider Track */}
              <div 
                ref={sliderRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ 
                  position: 'relative',
                  height: '48px',
                  cursor: 'pointer',
                  touchAction: 'none',
                  userSelect: 'none'
                }}
              >
                {/* Background Track */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: '8px',
                  transform: 'translateY(-50%)',
                  background: getSliderGradient(),
                  borderRadius: '4px',
                  opacity: 0.3
                }}></div>

                {/* Active Track (filled portion) */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  width: `${sliderValue}%`,
                  height: '8px',
                  transform: 'translateY(-50%)',
                  background: getSliderGradient(),
                  borderRadius: '4px',
                  transition: isDragging ? 'none' : 'width 0.1s'
                }}></div>

                {/* Slider Handle */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: `${sliderValue}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: getRiskColor(riskLabel),
                  border: '3px solid #0a0a0a',
                  boxShadow: `0 0 20px ${getRiskColor(riskLabel)}60, 0 2px 8px rgba(0,0,0,0.5)`,
                  transition: isDragging ? 'none' : 'left 0.1s, background-color 0.2s, box-shadow 0.2s',
                  cursor: 'grab'
                }}>
                  {/* Inner glow */}
                  <div style={{
                    position: 'absolute',
                    inset: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.3)'
                  }}></div>
                </div>

                {/* Tick marks */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: '16px',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0 2px',
                  pointerEvents: 'none'
                }}>
                  {alternateLines.filter((_, i) => i % Math.ceil(alternateLines.length / 7) === 0).map((_, i) => (
                    <div key={i} style={{
                      width: '2px',
                      height: '16px',
                      backgroundColor: '#333',
                      borderRadius: '1px'
                    }}></div>
                  ))}
                </div>
              </div>

              {/* Line Range Indicator */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginTop: '8px',
                padding: '0 4px'
              }}>
                <span style={{ fontSize: '11px', color: '#444' }}>
                  {alternateLines[0]?.line}+
                </span>
                <span style={{ fontSize: '11px', color: '#444' }}>
                  {alternateLines[alternateLines.length - 1]?.line}+
                </span>
              </div>
            </div>
          ) : (
            /* Fallback: No alternates available */
            <div style={{ 
              textAlign: 'center', 
              padding: '16px',
              backgroundColor: '#111',
              borderRadius: '12px',
              border: '1px solid #1a1a1a',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Standard line only
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '20px',
            paddingTop: '12px',
            borderTop: '1px solid #1a1a1a'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#00FF00' }}></div>
              <span style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2-3 pts</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ffffff' }}></div>
              <span style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>4-5 pts</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ff6b35' }}></div>
              <span style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>6-7 pts</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
              <span style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>8 pts</span>
            </div>
          </div>
        </div>
        
        {/* ===== LOCK IN BUTTON ===== */}
        <div style={{ padding: '0 12px 12px' }}>
          <button 
            onClick={() => onLockIn(potentialPoints, targetYards, riskLabel)}
            style={{
              width: '100%',
              padding: '16px 20px',
              background: `linear-gradient(135deg, ${getRiskColor(riskLabel)}, ${getRiskColor(riskLabel)}dd)`,
              color: riskLabel === 'BASE' ? '#000' : '#000',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              border: 'none',
              borderRadius: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: `0 4px 20px ${getRiskColor(riskLabel)}40`
            }}
            className="hover:opacity-90 active:scale-[0.98]"
          >
            Lock In • {potentialPoints} Points
          </button>
        </div>
      </div>
    </div>
  )
}
