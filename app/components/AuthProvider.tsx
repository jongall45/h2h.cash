"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, getCurrentUser, onAuthStateChange } from '../lib/auth'

interface AuthContextType {
  user: User | null
  loading: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {}
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    const { user: currentUser } = await getCurrentUser()
    setUser(currentUser)
  }

  useEffect(() => {
    // Initial load
    const initAuth = async () => {
      setLoading(true)
      await refreshUser()
      setLoading(false)
    }
    
    initAuth()

    // Listen for auth state changes
    const { data: { subscription } } = onAuthStateChange((user) => {
      setUser(user)
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

