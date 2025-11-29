"use client"

import { useEffect, useState } from "react"
import { User, Lock, Check } from "lucide-react"

interface OpponentRevealProps {
  onComplete: (opponentPick: any) => void
  availableProps: any[] // We accept the list of players now
}

export function OpponentReveal({ onComplete, availableProps }: OpponentRevealProps) {
  const [step, setStep] = useState(0)
  
  // Bot Logic: Pick a random player and a random line from their alternates
  // This data is stored but NOT revealed to the user
  const [opponentPick] = useState(() => {
    const randomProp = availableProps[Math.floor(Math.random() * availableProps.length)] || { player: "Opponent", stat: "Props" }
    
    // If this prop has alternate lines, pick one randomly (weighted towards risky plays)
    let selectedLine = { line: randomProp.line, points: 5, riskLabel: 'BASE' }
    
    if (randomProp.alternateLines && randomProp.alternateLines.length > 0) {
      // Weight towards higher risk (higher index = higher line = more points)
      const weights = randomProp.alternateLines.map((_: any, i: number) => i + 1)
      const totalWeight = weights.reduce((a: number, b: number) => a + b, 0)
      let random = Math.random() * totalWeight
      
      let selectedIndex = 0
      for (let i = 0; i < weights.length; i++) {
        random -= weights[i]
        if (random <= 0) {
          selectedIndex = i
          break
        }
      }
      
      selectedLine = randomProp.alternateLines[selectedIndex]
    }
    
    return {
      ...randomProp,
      line: selectedLine.line,
      points: selectedLine.points,
      strategy: selectedLine.riskLabel || 'BASE',
      isAggressive: selectedLine.points >= 6
    }
  })

  useEffect(() => {
    // Show "locking" animation
    setTimeout(() => setStep(1), 1200)
    // Show "locked" confirmation
    setTimeout(() => setStep(2), 2400)
    // Complete and move on - pick data is passed but NOT displayed
    setTimeout(() => onComplete(opponentPick), 3500)
  }, [onComplete, opponentPick])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl">
      <div className="w-full max-w-[340px] mx-auto p-4">
        
        {/* Main Card Container */}
        <div style={{
          borderRadius: '20px',
          backgroundColor: '#111',
          border: '1px solid #222',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}>
          
          {/* Header */}
          <div style={{ padding: '28px 20px', textAlign: 'center' }}>
            {/* Animated Lock Icon */}
            <div style={{ 
              width: 64, 
              height: 64, 
              margin: '0 auto 16px',
              borderRadius: '50%',
              backgroundColor: step >= 2 ? 'rgba(0, 255, 0, 0.1)' : '#1a1a1a',
              border: step >= 2 ? '2px solid rgba(0, 255, 0, 0.3)' : '2px solid #333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease'
            }}>
              {step >= 2 ? (
                <Check style={{ width: 28, height: 28, color: '#00FF00' }} />
              ) : (
                <Lock 
                  style={{ 
                    width: 28, 
                    height: 28, 
                    color: step >= 1 ? '#ff6b35' : '#555',
                    transition: 'color 0.3s ease'
                  }} 
                  className={step === 1 ? 'animate-pulse' : ''}
                />
              )}
            </div>
            
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: 700, 
              color: '#fff', 
              marginBottom: '8px',
              letterSpacing: '-0.02em'
            }}>
              {step === 0 && 'OPPONENT SELECTING...'}
              {step === 1 && 'LOCKING IN PICK...'}
              {step === 2 && 'OPPONENT LOCKED'}
            </h2>
            
            <p style={{ 
              fontSize: '11px', 
              color: step >= 2 ? '#00FF00' : '#666', 
              textTransform: 'uppercase', 
              letterSpacing: '0.12em',
              transition: 'color 0.3s ease'
            }}>
              {step >= 2 ? 'Pick secured • Hidden until kickoff' : 'Analyzing matchups...'}
            </p>
          </div>

          {/* Hidden Pick Indicator */}
          <div style={{ 
            margin: '0 16px 16px',
            backgroundColor: '#0a0a0a',
            borderRadius: '12px',
            border: '1px solid #1a1a1a',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <Lock size={14} style={{ color: '#ff6b35' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ff6b35', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Pick Hidden
              </span>
            </div>
            <p style={{ fontSize: '11px', color: '#555', lineHeight: 1.5 }}>
              Opponent's selection is locked and hidden to ensure fair play. 
              All picks revealed when games start.
            </p>
          </div>

          {/* Progress Dots */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '8px', 
            paddingBottom: '20px' 
          }}>
            {[0, 1, 2].map((i) => (
              <div 
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: step >= i ? (step === 2 ? '#00FF00' : '#ff6b35') : '#333',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
