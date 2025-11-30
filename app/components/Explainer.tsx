"use client"

import { useState } from "react"

interface ExplainerProps {
  onClose: () => void
}

const howToPlaySteps = [
  {
    number: 1,
    title: "Enter a Tournament",
    description: "Join a tournament and select from available NFL matchups"
  },
  {
    number: 2,
    title: "Draft 5 Props",
    description: "Pick 5 player prop OVERs - passing yards, receiving yards, rushing, etc."
  },
  {
    number: 3,
    title: "Set Your Lines",
    description: "Slide to adjust risk:",
    highlight: true,
    subItems: [
      { label: "SAFE", color: "text-green-400", detail: "Lower line, easier to hit, fewer points" },
      { label: "MAX", color: "text-red-400", detail: "Higher line, harder to hit, more points" }
    ]
  },
  {
    number: 4,
    title: "Hits = Multiplier",
    description: "Props that hit (player goes OVER) earn points. More hits = bigger multiplier.",
    multiplierTable: [
      { hits: "5/5", multiplier: "5x", highlight: true },
      { hits: "4/5", multiplier: "4x", highlight: false },
      { hits: "3/5", multiplier: "3x", highlight: false },
      { hits: "2/5", multiplier: "2x", highlight: false },
      { hits: "1/5", multiplier: "1x", highlight: false },
      { hits: "0/5", multiplier: "0 pts", highlight: false },
    ]
  },
  {
    number: 5,
    title: "Top Score Wins",
    description: "Base points × multiplier = final score. Highest score takes the pot!"
  }
]

const strategyTips = [
  {
    name: "Conservative",
    emoji: "🛡️",
    tip: "Pick safe lines on heavy favorites. Lower points but more likely to hit 5/5 for the 5x multiplier."
  },
  {
    name: "Aggressive",
    emoji: "🔥",
    tip: "Push lines to MAX for huge point totals. Risk missing and getting 0, but one big hit can win it all."
  },
  {
    name: "Balanced",
    emoji: "⚖️",
    tip: "Mix 2-3 safe picks with 2-3 aggressive picks to guarantee some multiplier while chasing upside."
  }
]

export function Explainer({ onClose }: ExplainerProps) {
  const [showStrategy, setShowStrategy] = useState(false)

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#0a0a0a] border border-[#252525] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0a0a0a] border-b border-[#252525] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white">How to Play</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-[#666] hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Intro */}
        <div className="px-6 pt-5 pb-2">
          <p className="text-[#888] text-sm leading-relaxed">
            An NFL props tournament where you compete against others by drafting player prop overs.
          </p>
        </div>
        
        {/* Steps */}
        <div className="px-6 py-4 space-y-4">
          {howToPlaySteps.map((step) => (
            <div 
              key={step.number} 
              className={`flex gap-4 ${step.multiplierTable ? 'flex-col' : ''}`}
            >
              <div className="flex gap-4">
                {/* Step number circle */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                  <span className="text-green-400 font-bold text-sm">{step.number}</span>
                </div>
                
                {/* Step content */}
                <div className="flex-1 pt-0.5">
                  <h4 className="text-white font-medium mb-1">{step.title}</h4>
                  <p className="text-[#888] text-sm leading-relaxed">{step.description}</p>
                  
                  {/* Risk slider visual for step 3 */}
                  {step.highlight && step.subItems && (
                    <div className="mt-3 space-y-2">
                      {step.subItems.map((item) => (
                        <div key={item.label} className="flex items-center gap-2 text-sm">
                          <span className={`font-semibold ${item.color}`}>{item.label}</span>
                          <span className="text-[#666]">→</span>
                          <span className="text-[#888]">{item.detail}</span>
                        </div>
                      ))}
                      {/* Mini slider visual */}
                      <div className="mt-2 h-2 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 opacity-60" />
                    </div>
                  )}
                </div>
              </div>

              {/* Multiplier table for step 4 */}
              {step.multiplierTable && (
                <div className="ml-12 mt-2">
                  <div className="bg-[#111] border border-[#252525] rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
                    {step.multiplierTable.map((row) => (
                      <div 
                        key={row.hits} 
                        className={`py-2 px-3 rounded-lg ${
                          row.highlight 
                            ? 'bg-green-500/20 border border-green-500/40' 
                            : row.multiplier === '0 pts' 
                              ? 'bg-red-500/10 border border-red-500/20' 
                              : 'bg-[#1a1a1a]'
                        }`}
                      >
                        <div className={`text-xs font-medium ${row.highlight ? 'text-green-400' : row.multiplier === '0 pts' ? 'text-red-400' : 'text-[#888]'}`}>
                          {row.hits} hits
                        </div>
                        <div className={`text-sm font-bold ${row.highlight ? 'text-green-400' : row.multiplier === '0 pts' ? 'text-red-400' : 'text-white'}`}>
                          {row.multiplier}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Critical rule callout */}
        <div className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-300 text-center">
            <span className="font-semibold">⚠️ Remember:</span> A missed leg = 0 points for that pick. A 20-point MAX pick that misses is worth less than a 2-point SAFE pick that hits!
          </p>
        </div>

        {/* Strategy Section - Collapsible */}
        <div className="mx-6 mb-4">
          <button
            onClick={() => setShowStrategy(!showStrategy)}
            className="w-full flex items-center justify-between py-3 px-4 bg-[#111] border border-[#252525] rounded-xl hover:border-green-500/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">💡</span>
              <span className="text-white font-medium text-sm">Strategy Tips</span>
            </div>
            <svg 
              className={`w-4 h-4 text-[#666] transition-transform ${showStrategy ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showStrategy && (
            <div className="mt-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
              {strategyTips.map((strategy) => (
                <div 
                  key={strategy.name}
                  className="p-3 bg-[#111] border border-[#252525] rounded-xl"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{strategy.emoji}</span>
                    <span className="text-white font-medium text-sm">{strategy.name}</span>
                  </div>
                  <p className="text-[#888] text-xs leading-relaxed">{strategy.tip}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Close button */}
        <div className="sticky bottom-0 bg-[#0a0a0a] border-t border-[#252525] px-6 py-4">
          <button 
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-semibold text-sm uppercase tracking-wider transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
