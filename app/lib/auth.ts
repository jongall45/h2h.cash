import { supabase } from './supabase'

export interface User {
  id: string
  email?: string
  phone?: string
  username: string
  avatarUrl?: string
  balance: number
  createdAt: string
}

// Sign up with email
export async function signUpWithEmail(email: string, password: string, username: string): Promise<{ user: User | null; error: string | null; needsConfirmation?: boolean }> {
  try {
    console.log('Starting signup for:', email, 'with username:', username)
    
    // First create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username
        }
      }
    })

    if (authError) {
      console.error('Signup auth error:', authError)
      return { user: null, error: authError.message }
    }

    if (!authData.user) {
      return { user: null, error: 'Failed to create account' }
    }

    console.log('Auth user created:', authData.user.id)
    console.log('Session exists:', !!authData.session)

    // Create user profile in our users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        username,
        balance: 0
      })
      .select()
      .single()

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Check if this is a duplicate user error
      if (profileError.code === '23505') {
        return { user: null, error: 'An account with this email already exists. Please sign in instead.' }
      }
      // For other errors, continue - the auth user was still created
    } else {
      console.log('User profile created successfully')
    }

    // Check if email confirmation is required (for when you turn it back on)
    if (!authData.session) {
      console.log('No session - email confirmation required')
      return { 
        user: null, 
        error: 'Please check your email and click the confirmation link to complete your registration.',
        needsConfirmation: true
      }
    }

    console.log('Signup successful with active session')
    
    // Session exists - user is logged in and ready to go
    return {
      user: {
        id: authData.user.id,
        email,
        username,
        balance: profile?.balance || 0,
        createdAt: profile?.created_at || new Date().toISOString()
      },
      error: null
    }
  } catch (err) {
    console.error('Sign up error:', err)
    return { user: null, error: 'An unexpected error occurred. Please try again.' }
  }
}

// Sign in with email - direct fetch, no SDK
export async function signInWithEmail(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return { user: null, error: 'Auth not configured' }
    }

    // Direct API call - completely bypasses Supabase SDK
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ email, password })
    })

    const data = await response.json()

    if (!response.ok) {
      return { user: null, error: data.error_description || data.msg || 'Invalid email or password' }
    }

    if (!data.user || !data.access_token) {
      return { user: null, error: 'Sign in failed' }
    }

    // Store session in localStorage manually (bypass SDK)
    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      user: data.user
    }
    
    // Store for Supabase SDK to pick up
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
    localStorage.setItem(storageKey, JSON.stringify(session))

    const user: User = {
      id: data.user.id,
      email: data.user.email,
      username: data.user.email?.split('@')[0] || 'User',
      balance: 0,
      createdAt: data.user.created_at
    }

    return { user, error: null }
  } catch (err) {
    console.error('Sign in error:', err)
    return { user: null, error: 'Connection error. Please try again.' }
  }
}

// Sign in with phone (OTP)
export async function signInWithPhone(phone: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        channel: 'sms'
      }
    })

    if (error) {
      return { error: error.message }
    }

    return { error: null }
  } catch (err) {
    console.error('Phone sign in error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

// Verify phone OTP
export async function verifyPhoneOTP(phone: string, token: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms'
    })

    if (error) {
      return { user: null, error: error.message }
    }

    if (!data.user) {
      return { user: null, error: 'Failed to verify code' }
    }

    // Check if user profile exists, create if not
    let { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (!profile) {
      const username = 'User_' + phone.slice(-4)
      const { data: newProfile } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          phone,
          username,
          balance: 0
        })
        .select()
        .single()
      profile = newProfile
    }

    return {
      user: {
        id: data.user.id,
        phone: data.user.phone,
        username: profile?.username || 'User',
        avatarUrl: profile?.avatar_url,
        balance: profile?.balance || 0,
        createdAt: profile?.created_at || data.user.created_at
      },
      error: null
    }
  } catch (err) {
    console.error('Verify OTP error:', err)
    return { user: null, error: 'An unexpected error occurred' }
  }
}

// Sign out
export async function signOut(): Promise<void> {
  // Clear localStorage first
  if (typeof window !== 'undefined') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
      localStorage.removeItem(storageKey)
    }
    localStorage.removeItem('h2h_user')
  }
  // Then try SDK signout (don't await in case it hangs)
  supabase.auth.signOut().catch(() => {})
}

// Get current session - read from localStorage first to avoid SDK issues
export async function getCurrentUser(): Promise<{ user: User | null; error: string | null }> {
  try {
    // First try to read from localStorage directly (our manual session)
    if (typeof window !== 'undefined') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (supabaseUrl) {
        const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
        const stored = localStorage.getItem(storageKey)
        
        if (stored) {
          try {
            const session = JSON.parse(stored)
            if (session?.user && session?.access_token) {
              // Check if session is expired
              const now = Math.floor(Date.now() / 1000)
              if (session.expires_at && session.expires_at > now) {
                return {
                  user: {
                    id: session.user.id,
                    email: session.user.email,
                    phone: session.user.phone,
                    username: session.user.email?.split('@')[0] || 'User',
                    balance: 0,
                    createdAt: session.user.created_at
                  },
                  error: null
                }
              }
            }
          } catch (e) {
            // Invalid JSON, continue to SDK fallback
          }
        }
      }
    }

    // Fallback to SDK with timeout
    const timeoutPromise = new Promise<{ user: null; error: null }>((resolve) => {
      setTimeout(() => resolve({ user: null, error: null }), 3000)
    })
    
    const sessionPromise = (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        return { user: null, error: null }
      }

      return {
        user: {
          id: session.user.id,
          email: session.user.email,
          phone: session.user.phone,
          username: session.user.email?.split('@')[0] || 'User',
          balance: 0,
          createdAt: session.user.created_at
        } as User,
        error: null
      }
    })()

    return await Promise.race([sessionPromise, timeoutPromise])
  } catch (err) {
    console.error('Get current user error:', err)
    return { user: null, error: null }
  }
}

// Check if username is available
export async function checkUsernameAvailability(username: string): Promise<{ available: boolean; error: string | null }> {
  try {
    if (!username || username.length < 3) {
      return { available: false, error: 'Username must be at least 3 characters' }
    }

    const { data, error } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .maybeSingle()

    if (error) {
      console.error('Error checking username:', error)
      return { available: false, error: 'Could not check username availability' }
    }

    return { available: !data, error: null }
  } catch (err) {
    console.error('Username check error:', err)
    return { available: false, error: 'An unexpected error occurred' }
  }
}

// Update user profile
export async function updateProfile(userId: string, updates: { username?: string; avatarUrl?: string }): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        username: updates.username,
        avatar_url: updates.avatarUrl
      })
      .eq('id', userId)

    if (error) {
      return { error: error.message }
    }

    return { error: null }
  } catch (err) {
    console.error('Update profile error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

// Get user's entry history
export async function getUserEntryHistory(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('entries')
      .select(`
        *,
        contests (
          id,
          name,
          entry_fee,
          prize_pool,
          status,
          game_time
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching entry history:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Get entry history error:', err)
    return []
  }
}

// Listen to auth state changes
export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const { user } = await getCurrentUser()
      callback(user)
    } else {
      callback(null)
    }
  })
}

