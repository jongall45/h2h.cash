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
  await supabase.auth.signOut()
  // Clear local storage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('h2h_user')
  }
}

// Get current session
export async function getCurrentUser(): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      return { user: null, error: null }
    }

    // Try to get user profile from our users table
    let { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    // If profile doesn't exist, create it
    if (profileError && profileError.code === 'PGRST116') {
      const username = session.user.email?.split('@')[0] || session.user.phone?.slice(-4) || 'User'
      const { data: newProfile, error: insertError } = await supabase
        .from('users')
        .insert({
          id: session.user.id,
          email: session.user.email,
          phone: session.user.phone,
          username,
          balance: 0
        })
        .select()
        .single()
      
      if (insertError) {
        console.error('Error creating user profile:', insertError)
      } else {
        profile = newProfile
      }
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        phone: session.user.phone,
        username: profile?.username || session.user.email?.split('@')[0] || 'User',
        avatarUrl: profile?.avatar_url,
        balance: profile?.balance || 0,
        createdAt: profile?.created_at || session.user.created_at
      },
      error: null
    }
  } catch (err) {
    console.error('Get current user error:', err)
    return { user: null, error: 'An unexpected error occurred' }
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

