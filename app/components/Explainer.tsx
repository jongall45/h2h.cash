"use client"

interface ExplainerProps {
  onClose: () => void
}

export function Explainer({ onClose }: ExplainerProps) {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-[#111] border border-[#333] rounded-xl p-6 max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">How to Play</h3>
          <button 
            onClick={onClose}
            className="text-[#666] hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - compact list */}
        <ul className="space-y-3 text-[#999] text-sm">
          <li className="flex items-start gap-2">
            <span className="text-[#00FF00] mt-0.5">•</span>
            <span><span className="text-white">Head-to-head matchups.</span> You vs. one opponent.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#00FF00] mt-0.5">•</span>
            <span><span className="text-white">Randomized game.</span> A matchup is picked for you.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#00FF00] mt-0.5">•</span>
            <span><span className="text-white">Adjust props.</span> Go aggressive or conservative.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#00FF00] mt-0.5">•</span>
            <span><span className="text-white">Earn points.</span> You don't need to hit every leg.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#00FF00] mt-0.5">•</span>
            <span><span className="text-white">Double down.</span> Risk half entry for 8x payout.</span>
          </li>
        </ul>
        
        {/* Close button */}
        <button 
          onClick={onClose}
          className="mt-6 w-full py-2.5 rounded-full bg-[#1a1a1a] border border-[#333] hover:border-[#00FF00] text-white text-sm font-medium uppercase tracking-widest transition-all"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
