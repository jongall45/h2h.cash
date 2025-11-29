"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Mail, Phone, ArrowRight, Loader2, Eye, EyeOff, ChevronLeft, Check, X } from "lucide-react"
import { signUpWithEmail, signInWithEmail, signInWithPhone, verifyPhoneOTP, checkUsernameAvailability } from "../lib/auth"

type AuthMode = 'signin' | 'signup' | 'phone' | 'verify'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  
  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  
  // Username availability
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)

  // Check username availability with debounce
  useEffect(() => {
    if (mode !== 'signup' || !username) {
      setUsernameAvailable(null)
      setUsernameError(null)
      return
    }

    // Validate username format first
    if (username.length < 3) {
      setUsernameAvailable(false)
      setUsernameError('Username must be at least 3 characters')
      return
    }

    if (username.length > 20) {
      setUsernameAvailable(false)
      setUsernameError('Username must be 20 characters or less')
      return
    }

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      setUsernameAvailable(false)
      setUsernameError('Username can only contain letters and numbers')
      return
    }

    // Debounce the availability check
    const timeoutId = setTimeout(async () => {
      setUsernameChecking(true)
      setUsernameError(null)
      
      const { available, error } = await checkUsernameAvailability(username)
      
      setUsernameChecking(false)
      setUsernameAvailable(available)
      
      if (error) {
        setUsernameError(error)
      } else if (!available) {
        setUsernameError('Username is already taken')
      }
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [username, mode])

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setLoading(false)
      setError('Request timed out. Please try again.')
    }, 15000)

    try {
      if (mode === 'signup') {
        const { user, error } = await signUpWithEmail(email, password, username)
        clearTimeout(timeout)
        if (error) {
          setError(error)
        } else if (user) {
          console.log('Signup successful, user:', user)
          // Store user locally as backup
          localStorage.setItem('h2h_user', JSON.stringify(user))
          
          // Give auth state a moment to propagate before redirecting
          await new Promise(resolve => setTimeout(resolve, 500))
          
          console.log('Redirecting to contests...')
          router.push('/contests')
          return // Don't set loading false, we're navigating
        }
      } else {
        const { user, error } = await signInWithEmail(email, password)
        clearTimeout(timeout)
        if (error) {
          setError(error)
        } else if (user) {
          console.log('Sign in successful, user:', user)
          localStorage.setItem('h2h_user', JSON.stringify(user))
          
          // Give auth state a moment to propagate before redirecting
          await new Promise(resolve => setTimeout(resolve, 500))
          
          console.log('Redirecting to contests...')
          router.push('/contests')
          return // Don't set loading false, we're navigating
        }
      }
    } catch (err) {
      clearTimeout(timeout)
      console.error('Auth error:', err)
      setError('An unexpected error occurred. Please try again.')
    }

    setLoading(false)
  }

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await signInWithPhone(phone)
    if (error) {
      setError(error)
    } else {
      setMode('verify')
    }

    setLoading(false)
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { user, error } = await verifyPhoneOTP(phone, otp)
    if (error) {
      setError(error)
    } else if (user) {
      localStorage.setItem('h2h_user', JSON.stringify(user))
      router.push('/contests')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30" 
           style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(0,255,0,0.15), transparent 50%)' }}></div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group w-fit">
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">
              <span className="text-white">h2h</span>
              <span className="text-[#00FF00]">.cash</span>
            </h1>
            <p className="text-white/50">
              {mode === 'signin' && 'Sign in to your account'}
              {mode === 'signup' && 'Create your account'}
              {mode === 'phone' && 'Sign in with phone'}
              {mode === 'verify' && 'Enter verification code'}
            </p>
          </div>

          {/* Auth Card */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
            
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Email/Password Form */}
            {(mode === 'signin' || mode === 'signup') && (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-white/60 text-sm mb-2">Username</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Choose a username"
                        required
                        className="w-full px-4 py-3 pr-12 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#00FF00]/50 transition-colors"
                      />
                      {username && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          {usernameChecking && (
                            <Loader2 size={18} className="animate-spin text-white/40" />
                          )}
                          {!usernameChecking && usernameAvailable === true && (
                            <Check size={18} className="text-[#00FF00]" />
                          )}
                          {!usernameChecking && usernameAvailable === false && (
                            <X size={18} className="text-red-400" />
                          )}
                        </div>
                      )}
                    </div>
                    {usernameError && username && (
                      <p className="mt-1 text-xs text-red-400">{usernameError}</p>
                    )}
                    {!usernameError && usernameAvailable && username && (
                      <p className="mt-1 text-xs text-[#00FF00]">Username is available!</p>
                    )}
                  </div>
                )}
                
                <div>
                  <label className="block text-white/60 text-sm mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#00FF00]/50 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-white/60 text-sm mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#00FF00]/50 transition-colors pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || (mode === 'signup' && (usernameChecking || usernameAvailable !== true))}
                  className="w-full py-4 bg-[#00FF00] text-black font-bold rounded-xl hover:bg-[#00DD00] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      {mode === 'signin' ? 'Sign In' : 'Create Account'}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Phone Form */}
            {mode === 'phone' && (
              <form onSubmit={handlePhoneSignIn} className="space-y-4">
                <div>
                  <label className="block text-white/60 text-sm mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    required
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#00FF00]/50 transition-colors"
                  />
                  <p className="text-white/40 text-xs mt-2">We'll send you a verification code</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-[#00FF00] text-black font-bold rounded-xl hover:bg-[#00DD00] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      Send Code
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* OTP Verification Form */}
            {mode === 'verify' && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label className="block text-white/60 text-sm mb-2">Verification Code</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    required
                    maxLength={6}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#00FF00]/50 transition-colors text-center text-2xl tracking-widest"
                  />
                  <p className="text-white/40 text-xs mt-2">Enter the 6-digit code sent to {phone}</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-[#00FF00] text-black font-bold rounded-xl hover:bg-[#00DD00] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      Verify
                      <Check size={18} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMode('phone')}
                  className="w-full py-3 text-white/50 hover:text-white transition-colors text-sm"
                >
                  Use a different number
                </button>
              </form>
            )}

            {/* Note about other sign-in methods */}
            {(mode === 'signin' || mode === 'signup') && (
              <div className="mt-6 p-3 bg-white/5 rounded-xl border border-white/10">
                <p className="text-white/40 text-xs text-center">
                  📧 Email sign-in is the fastest way to get started. Phone authentication coming soon!
                </p>
              </div>
            )}

            {/* Toggle Sign In / Sign Up */}
            {(mode === 'signin' || mode === 'signup') && (
              <div className="mt-6 text-center">
                <span className="text-white/40">
                  {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                </span>
                <button
                  onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                  className="text-[#00FF00] hover:underline font-medium"
                >
                  {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                </button>
              </div>
            )}

            {/* Back to Email from Phone */}
            {(mode === 'phone' || mode === 'verify') && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="text-yellow-500 text-xs text-center mb-2">
                  ⚠️ Phone authentication requires Twilio setup
                </p>
                <button
                  onClick={() => setMode('signin')}
                  className="w-full py-2 text-white/70 hover:text-white transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Mail size={16} />
                  Use email instead (recommended)
                </button>
              </div>
            )}
          </div>

          {/* Terms */}
          <p className="text-center text-white/30 text-xs mt-6">
            By continuing, you agree to our{' '}
            <a href="#" className="text-white/50 hover:text-white">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-white/50 hover:text-white">Privacy Policy</a>
          </p>
        </div>
      </main>
    </div>
  )
}

