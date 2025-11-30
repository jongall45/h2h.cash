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

    // Create user profile in our users table - MUST use the same ID as auth user
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,  // Critical: Must match auth.users ID
        email,
        username,
        balance: 0
      })
      .select()
      .single()

    if (profileError) {
      // Check if this is a duplicate user error
      if (profileError.code === '23505') {
        return { user: null, error: 'An account with this email already exists. Please sign in instead.' }
      }
      // For other errors, continue - profile can be created later
    }

    // Check if email confirmation is required
    if (!authData.session) {
      return { 
        user: null, 
        error: 'Please check your email and click the confirmation link to complete your registration.',
        needsConfirmation: true
      }
    }
    
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
    console.error('Signup error:', err)
    return { user: null, error: 'An unexpected error occurred. Please try again.' }
  }
}

// Sign in with email - using proper Supabase SDK
export async function signInWithEmail(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    // Use Supabase's built-in signInWithPassword - handles all session management
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError) {
      return { user: null, error: authError.message }
    }

    if (!authData.user || !authData.session) {
      return { user: null, error: 'Sign in failed' }
    }

    // Fetch the actual user profile from database to get real username and balance
    let timeoutId: NodeJS.Timeout | null = null
    const profilePromise = supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle()

    const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve({ 
          data: null, 
          error: { message: 'Database timeout', code: 'TIMEOUT' } 
        })
      }, 3000)
    })

    const result = await Promise.race([
      profilePromise.then(res => { if (timeoutId) clearTimeout(timeoutId); return res; }),
      timeoutPromise
    ]) as any

    const { data: profile, error: profileError } = result

    if (profileError || !profile) {
      // Fall back to user metadata from auth
      const user: User = {
        id: authData.user.id,
        email: authData.user.email,
        username: authData.user.user_metadata?.username || authData.user.email?.split('@')[0] || 'User',
        balance: 0,
        createdAt: authData.user.created_at || new Date().toISOString()
      }
      return { user, error: null }
    }
    
    const user: User = {
      id: authData.user.id,
      email: profile.email || authData.user.email,
      phone: profile.phone,
      username: profile.username,
      avatarUrl: profile.avatar_url,
      balance: profile.balance || 0,
      createdAt: profile.created_at || authData.user.created_at
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

// Sign out - using proper Supabase SDK
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

// Get current user - using proper Supabase SDK with timeout protection
export async function getCurrentUser(): Promise<{ user: User | null; error: string | null }> {
  try {
    // Add timeout wrapper for the entire operation
    let operationTimeoutId: NodeJS.Timeout | null = null
    const timeoutPromise = new Promise<{ user: null; error: string }>((resolve) => {
      operationTimeoutId = setTimeout(() => {
        resolve({ user: null, error: 'Request timed out' })
      }, 5000)
    })

    const getUserPromise = (async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        return { user: null, error: sessionError.message }
      }

      if (!session?.user) {
        return { user: null, error: null }
      }

      // Fetch the actual user profile from the database
      let profileTimeoutId: NodeJS.Timeout | null = null
      const profilePromise = supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      const profileTimeout = new Promise<{ data: null; error: any }>((resolve) => {
        profileTimeoutId = setTimeout(() => {
          resolve({ 
            data: null, 
            error: { message: 'Database query timed out', code: 'TIMEOUT' } 
          })
        }, 3000)
      })

      const profileResult = await Promise.race([
        profilePromise.then(res => { if (profileTimeoutId) clearTimeout(profileTimeoutId); return res; }),
        profileTimeout
      ]) as any

      const { data: profile, error: profileError } = profileResult

      if (profileError || !profile) {
        // Return basic user info from session
        return {
          user: {
            id: session.user.id,
            email: session.user.email,
            phone: session.user.phone,
            username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
            balance: 0,
            createdAt: session.user.created_at || new Date().toISOString()
          },
          error: null
        }
      }
      
      const user: User = {
        id: profile.id,
        email: profile.email,
        phone: profile.phone,
        username: profile.username,
        avatarUrl: profile.avatar_url,
        balance: profile.balance || 0,
        createdAt: profile.created_at
      }

      return { user, error: null }
    })()

    const finalResult = await Promise.race([
      getUserPromise.then(res => { if (operationTimeoutId) clearTimeout(operationTimeoutId); return res; }),
      timeoutPromise
    ]) as { user: User | null; error: string | null }
    
    return finalResult
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

