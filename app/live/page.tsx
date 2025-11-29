"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, RefreshCw, Loader2 } from 'lucide-react'
import { LivePickTracker } from '../components/LivePickTracker'
import { TrackedPick } from '../lib/resolution'
import { getLiveGames, LiveGame } from '../lib/liveStats'

export default function LiveTrackingPage() {
  const [games, setGames] = useState<LiveGame[]>([])
  const [loading, setLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(false)

  // Demo picks for testing (replace with real picks from your entries)
  const demoPicks: TrackedPick[] = [
    {
      id: 'demo-1',
      playerName: 'Patrick Mahomes',
      stat: 'Passing Yards',
      line: 275.5,
      points: 2.15,
      gameId: games[0]?.id || 'demo'
    },
    {
      id: 'demo-2',
      playerName: 'Travis Kelce',
      stat: 'Receiving Yards',
      line: 65.5,
      points: 1.85,
      gameId: games[0]?.id || 'demo'
    },
    {
      id: 'demo-3',
      playerName: 'Josh Allen',
      stat: 'Passing Yards',
      line: 250.5,
      points: 2.45,
      gameId: games[1]?.id || 'demo'
    },
    {
      id: 'demo-4',
      playerName: 'Derrick Henry',
      stat: 'Rushing Yards',
      line: 85.5,
      points: 2.75,
      gameId: games[1]?.id || 'demo'
    },
    {
      id: 'demo-5',
      playerName: 'Ja\'Marr Chase',
      stat: 'Receiving Yards',
      line: 75.5,
      points: 3.10,
      gameId: games[2]?.id || 'demo'
    }
  ]

  useEffect(() => {
    loadGames()
  }, [])

  const loadGames = async () => {
    setLoading(true)
    const liveGames = await getLiveGames()
    setGames(liveGames)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group">
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </Link>
          
          <h1 className="text-lg font-bold">Live Tracking</h1>
          
          <button 
            onClick={loadGames}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Live Games Section */}
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            Live Games
          </h2>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-[#00FF00]" />
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-8 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-white/40">No live games right now</p>
              <p className="text-white/20 text-sm mt-1">Check back during game time!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {games.map(game => (
                <div 
                  key={game.id}
                  className="p-4 bg-white/5 rounded-xl border border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img 
                        src={game.awayTeam.logo} 
                        alt={game.awayTeam.name}
                        className="w-8 h-8 object-contain"
                      />
                      <span className="font-medium">{game.awayTeam.abbreviation}</span>
                      <span className="text-white/30">@</span>
                      <span className="font-medium">{game.homeTeam.abbreviation}</span>
                      <img 
                        src={game.homeTeam.logo} 
                        alt={game.homeTeam.name}
                        className="w-8 h-8 object-contain"
                      />
                    </div>
                    
                    <div className="text-right">
                      {game.status.type === 'in' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold">
                            {game.awayTeam.score} - {game.homeTeam.score}
                          </span>
                          <span className="text-xs text-red-500 font-medium">
                            Q{game.status.period} {game.status.clock}
                          </span>
                        </div>
                      ) : game.status.type === 'post' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold">
                            {game.awayTeam.score} - {game.homeTeam.score}
                          </span>
                          <span className="text-xs text-white/40 font-medium">
                            Final
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-white/40">
                          {new Date(game.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Demo Mode Toggle */}
        <div className="mb-6">
          <button
            onClick={() => setDemoMode(!demoMode)}
            className={`w-full py-3 rounded-xl font-medium transition-all ${
              demoMode 
                ? 'bg-[#00FF00] text-black' 
                : 'bg-white/5 text-white/60 border border-white/10'
            }`}
          >
            {demoMode ? '✓ Demo Mode Active' : 'Enable Demo Mode'}
          </button>
          <p className="text-xs text-white/30 text-center mt-2">
            Demo mode shows sample picks with live tracking
          </p>
        </div>

        {/* Live Pick Tracker */}
        {demoMode && games.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-4">Your Picks</h2>
            <LivePickTracker 
              picks={demoPicks}
              pollInterval={30000}
              showTotalScore={true}
            />
          </section>
        )}

        {demoMode && games.length === 0 && (
          <div className="text-center py-8 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-white/40">No games available for demo</p>
            <p className="text-white/20 text-sm mt-1">Live tracking works during NFL games</p>
          </div>
        )}
      </main>
    </div>
  )
}

