"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, getCurrentUser } from '../lib/auth'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false, // Default to false to prevent infinite loading
  refreshUser: async () => {}
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const { user: currentUser } = await getCurrentUser()
      setUser(currentUser)
    } catch (err) {
      console.error('Error refreshing user:', err)
      setUser(null)
    }
  }

  useEffect(() => {
    // Initial load
    const initAuth = async () => {
      try {
        await refreshUser()
      } catch (err) {
        console.error('Auth init error:', err)
      } finally {
        setLoading(false)
      }
    }
    
    initAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await refreshUser()
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
