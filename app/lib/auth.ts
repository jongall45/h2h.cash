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
export async function signUpWithEmail(email: string, password: string, username: string): Promise<{ user: User | null; error: string | null }> {
  try {
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
      return { user: null, error: authError.message }
    }

    if (!authData.user) {
      return { user: null, error: 'Failed to create account' }
    }

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
      // Still return success since auth user was created
    }

    return {
      user: {
        id: authData.user.id,
        email,
        username,
        balance: 0,
        createdAt: new Date().toISOString()
      },
      error: null
    }
  } catch (err) {
    console.error('Sign up error:', err)
    return { user: null, error: 'An unexpected error occurred' }
  }
}

// Sign in with email
export async function signInWithEmail(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return { user: null, error: error.message }
    }

    if (!data.user) {
      return { user: null, error: 'Failed to sign in' }
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        username: profile?.username || data.user.email?.split('@')[0] || 'User',
        avatarUrl: profile?.avatar_url,
        balance: profile?.balance || 0,
        createdAt: profile?.created_at || data.user.created_at
      },
      error: null
    }
  } catch (err) {
    console.error('Sign in error:', err)
    return { user: null, error: 'An unexpected error occurred' }
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
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      return null
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    return {
      id: session.user.id,
      email: session.user.email,
      phone: session.user.phone,
      username: profile?.username || session.user.email?.split('@')[0] || 'User',
      avatarUrl: profile?.avatar_url,
      balance: profile?.balance || 0,
      createdAt: profile?.created_at || session.user.created_at
    }
  } catch (err) {
    console.error('Get current user error:', err)
    return null
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
      const user = await getCurrentUser()
      callback(user)
    } else {
      callback(null)
    }
  })
}

