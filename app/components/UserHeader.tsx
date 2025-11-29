"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, LogOut, Settings, Trophy, ChevronDown, Loader2 } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { signOut } from '../lib/auth'

export function UserHeader() {
  const { user, loading } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    setShowDropdown(false)
    router.push('/')
    router.refresh()
  }

  // Don't show loading spinner - just show Sign In button while checking auth
  // This prevents the page from appearing stuck

  if (!user) {
    return (
      <Link 
        href="/auth"
        className="psl-glass-btn"
        style={{ 
          padding: '10px 20px',
          fontSize: '13px'
        }}
      >
        <span className="dot"></span>
        <span className="btn-text">Sign In</span>
        <span className="arrow">→</span>
      </Link>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all"
      >
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00FF00]/20 to-transparent border border-[#00FF00]/30 flex items-center justify-center text-xs font-bold text-[#00FF00]">
          {user.username.charAt(0).toUpperCase()}
        </div>
        
        {/* Username */}
        <span className="text-sm font-medium text-white/90 max-w-[100px] truncate">
          {user.username}
        </span>
        
        {/* Dropdown arrow */}
        <ChevronDown 
          size={14} 
          className={`text-white/40 transition-transform ${showDropdown ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 w-56 bg-[#111] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* User info header */}
            <div className="px-4 py-3 border-b border-white/5">
              <div className="font-medium text-white">{user.username}</div>
              <div className="text-xs text-white/40 truncate">{user.email || user.phone}</div>
            </div>
            
            {/* Menu items */}
            <div className="py-2">
              <Link
                href="/dashboard"
                onClick={() => setShowDropdown(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                <User size={16} />
                Dashboard
              </Link>
              
              <Link
                href="/contests"
                onClick={() => setShowDropdown(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Trophy size={16} />
                My Contests
              </Link>
              
              <div className="my-2 border-t border-white/5" />
              
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                {signingOut ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <LogOut size={16} />
                )}
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

