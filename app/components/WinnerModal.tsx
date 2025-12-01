"use client"

import { useState, useEffect } from 'react'
import { X, Trophy, Star, TrendingUp, DollarSign, Check, XIcon } from 'lucide-react'
import { markNotificationRead } from '../actions/resolveContest'
import confetti from 'canvas-confetti'

interface WinnerNotification {
  id: string
  type: string
  title: string
  message: string
  data: {
    contestId: string
    entryId: string
    rank: number
    prizeAmount: number
    totalPoints: number
    hitsCount: number
    multiplier: number
    picks: {
      player: string
      stat: string
      line: number
      actualValue: number
      hit: boolean
      pointsEarned: number
    }[]
  }
}

export function WinnerModal({ 
  notification, 
  onClose 
}: { 
  notification: WinnerNotification
  onClose: () => void 
}) {
  const [isClosing, setIsClosing] = useState(false)
  const { data } = notification
  
  // Trigger confetti on mount
  useEffect(() => {
    const duration = 3000
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: ['#00C853', '#FFD700', '#FFFFFF']
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: ['#00C853', '#FFD700', '#FFFFFF']
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }
    frame()
  }, [])
  
  const handleClose = async () => {
    setIsClosing(true)
    await markNotificationRead(notification.id)
    setTimeout(onClose, 300)
  }
  
  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }
  
  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
    >
      <div 
        className={`relative w-full max-w-md bg-[#0A0A0A] border border-[#2A2A2A] rounded-2xl overflow-hidden transition-all duration-300 ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
        style={{ boxShadow: '0 0 60px rgba(0, 200, 83, 0.2)' }}
      >
        {/* Close button */}
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-[#1A1A1A] hover:bg-[#252525] transition-colors"
        >
          <X size={18} className="text-[#888]" />
        </button>
        
        {/* Header - Prize Amount */}
        <div className="relative pt-12 pb-8 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#00C853]/10 to-transparent" />
          
          <div className="relative z-10">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#00C853]/20 border-2 border-[#00C853] flex items-center justify-center">
              <Trophy size={40} className="text-[#00C853]" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-1">You Won!</h2>
            
            <div className="text-5xl font-bold text-[#00C853] mb-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
              ${data.prizeAmount}
            </div>
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A1A1A] border border-[#2A2A2A]">
              <span className="text-2xl">{getRankEmoji(data.rank)}</span>
              <span className="text-[#888] text-sm">Place Finish</span>
            </div>
          </div>
        </div>
        
        {/* Stats Summary */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-white">{data.totalPoints.toFixed(2)}</div>
              <div className="text-[10px] text-[#666] uppercase tracking-wide">Points</div>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-[#00C853]">{data.hitsCount}/5</div>
              <div className="text-[10px] text-[#666] uppercase tracking-wide">Hits</div>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-[#FFB300]">{data.multiplier}x</div>
              <div className="text-[10px] text-[#666] uppercase tracking-wide">Multi</div>
            </div>
          </div>
          
          {/* Picks Breakdown */}
          <div className="space-y-2 mb-6">
            <div className="text-xs text-[#666] uppercase tracking-wide mb-2">Your Lineup</div>
            {data.picks.map((pick, i) => (
              <div 
                key={i}
                className="flex items-center justify-between p-2.5 rounded-lg"
                style={{
                  backgroundColor: pick.hit ? 'rgba(0, 200, 83, 0.08)' : 'rgba(255, 82, 82, 0.08)',
                  border: `1px solid ${pick.hit ? 'rgba(0, 200, 83, 0.2)' : 'rgba(255, 82, 82, 0.2)'}`
                }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                    style={{ 
                      backgroundColor: pick.hit ? '#00C853' : '#FF5252',
                      color: '#000'
                    }}
                  >
                    {pick.hit ? '✓' : '✕'}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{pick.player}</div>
                    <div className="text-[10px] text-[#666]">
                      {pick.actualValue} / {pick.line}+ {pick.stat.replace(' Yards', '').replace('Passing', 'PASS').replace('Rushing', 'RUSH').replace('Receiving', 'REC')}
                    </div>
                  </div>
                </div>
                <div 
                  className="text-sm font-bold"
                  style={{ color: pick.hit ? '#00C853' : '#FF5252' }}
                >
                  {pick.hit ? `+${pick.pointsEarned.toFixed(2)}` : '0.00'}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleClose}
            className="w-full py-3 bg-[#00C853] hover:bg-[#00E676] text-black font-semibold rounded-full transition-all"
          >
            Claim Winnings
          </button>
          <p className="text-center text-[10px] text-[#555] mt-3">
            Winnings have been added to your balance
          </p>
        </div>
      </div>
    </div>
  )
}

// Notification check hook for use in layout
export function useWinnerNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<WinnerNotification[]>([])
  const [currentNotification, setCurrentNotification] = useState<WinnerNotification | null>(null)
  
  useEffect(() => {
    if (!userId) return
    
    const checkNotifications = async () => {
      try {
        const response = await fetch(`/api/notifications?userId=${userId}`)
        const data = await response.json()
        if (data.notifications?.length > 0) {
          const winnerNotifs = data.notifications.filter((n: any) => n.type === 'contest_won')
          setNotifications(winnerNotifs)
          if (winnerNotifs.length > 0 && !currentNotification) {
            setCurrentNotification(winnerNotifs[0])
          }
        }
      } catch (error) {
        console.error('Error checking notifications:', error)
      }
    }
    
    checkNotifications()
    const interval = setInterval(checkNotifications, 30000) // Check every 30s
    
    return () => clearInterval(interval)
  }, [userId, currentNotification])
  
  const dismissNotification = () => {
    setCurrentNotification(null)
    setNotifications(prev => prev.slice(1))
    // Show next notification if any
    setTimeout(() => {
      if (notifications.length > 1) {
        setCurrentNotification(notifications[1])
      }
    }, 500)
  }
  
  return { currentNotification, dismissNotification }
}
