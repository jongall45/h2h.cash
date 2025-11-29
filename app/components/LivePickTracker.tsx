"use client"

import { useState, useEffect, useCallback } from 'react'
import { Loader2, TrendingUp, TrendingDown, Check, X, Clock, Zap } from 'lucide-react'
import { TrackedPick, PickResolution, resolvePick, getStatusDisplay, formatGameClock, calculateFinalPoints } from '../lib/resolution'
import { getPlayerId, getPlayerHeadshotUrl } from '../lib/espn'

interface LivePickTrackerProps {
  picks: TrackedPick[]
  onUpdate?: (resolutions: Map<string, PickResolution>) => void
  pollInterval?: number // in milliseconds, default 30000 (30 seconds)
  showTotalScore?: boolean
}

export function LivePickTracker({ 
  picks, 
  onUpdate, 
  pollInterval = 30000,
  showTotalScore = true 
}: LivePickTrackerProps) {
  const [resolutions, setResolutions] = useState<Map<string, PickResolution>>(new Map())
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Fetch resolutions for all picks
  const fetchResolutions = useCallback(async () => {
    try {
      const newResolutions = new Map<string, PickResolution>()
      
      // Resolve each pick
      for (const pick of picks) {
        const resolution = await resolvePick(pick)
        newResolutions.set(pick.id, resolution)
      }
      
      setResolutions(newResolutions)
      setLastUpdate(new Date())
      onUpdate?.(newResolutions)
    } catch (err) {
      console.error('Error fetching resolutions:', err)
    } finally {
      setLoading(false)
    }
  }, [picks, onUpdate])

  // Initial fetch
  useEffect(() => {
    fetchResolutions()
  }, [fetchResolutions])

  // Poll for updates
  useEffect(() => {
    // Only poll if there are pending/live picks
    const hasActivePicks = Array.from(resolutions.values()).some(
      r => r.status === 'pending' || r.status === 'live_winning' || r.status === 'live_losing'
    )

    if (!hasActivePicks) return

    const interval = setInterval(fetchResolutions, pollInterval)
    return () => clearInterval(interval)
  }, [resolutions, pollInterval, fetchResolutions])

  // Calculate totals
  const { totalPoints, hits, misses, pending, isPerfect } = calculateFinalPoints(picks, resolutions)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-[#00FF00]" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header with total score */}
      {showTotalScore && (
        <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-white/40 uppercase tracking-wider">Live Score</div>
            {lastUpdate && (
              <div className="text-xs text-white/30">
                Updated {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-4xl font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {totalPoints.toFixed(2)}
              {isPerfect && (
                <span className="ml-2 text-yellow-500 text-lg">🔥 2x</span>
              )}
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-[#00FF00]">
                <Check size={16} />
                <span>{hits}</span>
              </div>
              <div className="flex items-center gap-1 text-red-500">
                <X size={16} />
                <span>{misses}</span>
              </div>
              <div className="flex items-center gap-1 text-white/40">
                <Clock size={16} />
                <span>{pending}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual picks */}
      <div className="space-y-3">
        {picks.map((pick, index) => (
          <LivePickCard 
            key={pick.id} 
            pick={pick} 
            resolution={resolutions.get(pick.id)}
            index={index + 1}
          />
        ))}
      </div>
    </div>
  )
}

// Individual pick card component
function LivePickCard({ 
  pick, 
  resolution,
  index 
}: { 
  pick: TrackedPick
  resolution?: PickResolution
  index: number
}) {
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null)

  // Fetch player headshot
  useEffect(() => {
    if (pick.playerName) {
      getPlayerId(pick.playerName).then(id => {
        if (id) setHeadshotUrl(getPlayerHeadshotUrl(id))
      })
    }
  }, [pick.playerName])

  const status = resolution?.status || 'pending'
  const { text: statusText, color: statusColor, icon: statusIcon } = getStatusDisplay(status)
  const currentValue = resolution?.currentValue || 0
  const percentComplete = resolution?.percentComplete || 0
  const projectedValue = resolution?.projectedValue || 0
  const gameClockText = formatGameClock(resolution?.gameStatus || null)

  // Determine progress bar color
  const getProgressColor = () => {
    if (status === 'hit' || status === 'live_winning') return '#00FF00'
    if (status === 'miss') return '#ef4444'
    if (status === 'live_losing') return '#ff6b35'
    return '#555555'
  }

  // Determine if we should show projected value
  const showProjection = status === 'live_winning' || status === 'live_losing'

  return (
    <div 
      className="relative overflow-hidden rounded-2xl border transition-all duration-300"
      style={{
        backgroundColor: '#111',
        borderColor: status === 'hit' ? 'rgba(0, 255, 0, 0.3)' : 
                     status === 'miss' ? 'rgba(239, 68, 68, 0.3)' : 
                     'rgba(255, 255, 255, 0.1)'
      }}
    >
      {/* Progress bar background */}
      <div 
        className="absolute inset-0 transition-all duration-500 ease-out"
        style={{
          width: `${Math.min(100, percentComplete)}%`,
          background: `linear-gradient(90deg, ${getProgressColor()}15, ${getProgressColor()}05)`,
          borderRight: percentComplete > 0 && percentComplete < 100 ? `2px solid ${getProgressColor()}40` : 'none'
        }}
      />

      {/* Content */}
      <div className="relative p-4">
        <div className="flex items-center gap-3">
          {/* Pick number */}
          <div 
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ 
              backgroundColor: `${statusColor}20`,
              color: statusColor
            }}
          >
            {index}
          </div>

          {/* Player avatar */}
          <div className="w-10 h-10 rounded-full bg-black/40 overflow-hidden border border-white/10 flex-shrink-0">
            {headshotUrl ? (
              <img src={headshotUrl} alt={pick.playerName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30 text-sm font-bold">
                {pick.playerName.charAt(0)}
              </div>
            )}
          </div>

          {/* Player info */}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white truncate">{pick.playerName}</div>
            <div className="text-xs text-white/40 uppercase tracking-wide">
              {pick.line}+ {pick.stat.replace(' Yards', '').replace('Passing', 'Pass').replace('Rushing', 'Rush').replace('Receiving', 'Rec')}
            </div>
          </div>

          {/* Stats & Status */}
          <div className="text-right flex-shrink-0">
            {/* Current value vs line */}
            <div className="flex items-center gap-2 justify-end">
              <span 
                className="text-xl font-bold"
                style={{ 
                  color: currentValue >= pick.line ? '#00FF00' : 
                         status === 'pending' ? '#888' : '#fff',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {currentValue}
              </span>
              <span className="text-white/30">/</span>
              <span className="text-white/50" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {pick.line}
              </span>
            </div>

            {/* Status badge */}
            <div 
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1"
              style={{ 
                backgroundColor: `${statusColor}20`,
                color: statusColor
              }}
            >
              <span>{statusIcon}</span>
              <span>{statusText}</span>
            </div>
          </div>
        </div>

        {/* Bottom row - game clock and projection */}
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
          <div className="text-xs text-white/40 flex items-center gap-1">
            <Clock size={12} />
            {gameClockText || 'Scheduled'}
          </div>

          {showProjection && (
            <div className="flex items-center gap-1 text-xs">
              {status === 'live_winning' ? (
                <TrendingUp size={12} className="text-[#00FF00]" />
              ) : (
                <TrendingDown size={12} className="text-[#ff6b35]" />
              )}
              <span className="text-white/50">Pace:</span>
              <span 
                className="font-medium"
                style={{ 
                  color: projectedValue >= pick.line ? '#00FF00' : '#ff6b35',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {projectedValue}
              </span>
            </div>
          )}

          {/* Points badge */}
          <div 
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{ 
              backgroundColor: status === 'hit' || status === 'live_winning' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              color: status === 'hit' || status === 'live_winning' ? '#00FF00' : '#888'
            }}
          >
            {pick.points.toFixed(2)} pts
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact version for use in leaderboards
export function LivePickTrackerCompact({ 
  picks,
  resolutions
}: { 
  picks: TrackedPick[]
  resolutions: Map<string, PickResolution>
}) {
  const { totalPoints, hits, misses, pending, isPerfect } = calculateFinalPoints(picks, resolutions)

  return (
    <div className="flex items-center gap-3">
      <div className="text-lg font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {totalPoints.toFixed(2)}
        {isPerfect && <Zap size={14} className="inline ml-1 text-yellow-500" />}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[#00FF00]">{hits}✓</span>
        <span className="text-red-500">{misses}✗</span>
        {pending > 0 && <span className="text-white/40">{pending}⏳</span>}
      </div>
    </div>
  )
}

