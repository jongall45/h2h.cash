"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Mail, Phone, ArrowRight, Loader2, Eye, EyeOff, ChevronLeft, Check } from "lucide-react"
import { signUpWithEmail, signInWithEmail, signInWithPhone, verifyPhoneOTP } from "../lib/auth"

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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'signup') {
      const { user, error } = await signUpWithEmail(email, password, username)
      if (error) {
        setError(error)
      } else if (user) {
        // Store user locally as backup
        localStorage.setItem('h2h_user', JSON.stringify(user))
        router.push('/contests')
      }
    } else {
      const { user, error } = await signInWithEmail(email, password)
      if (error) {
        setError(error)
      } else if (user) {
        localStorage.setItem('h2h_user', JSON.stringify(user))
        router.push('/contests')
      }
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
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Choose a username"
                      required
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#00FF00]/50 transition-colors"
                    />
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
                  disabled={loading}
                  className="w-full py-4 bg-[#00FF00] text-black font-bold rounded-xl hover:bg-[#00DD00] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

            {/* Divider */}
            {(mode === 'signin' || mode === 'signup') && (
              <>
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-white/10"></div>
                  <span className="text-white/30 text-sm">or</span>
                  <div className="flex-1 h-px bg-white/10"></div>
                </div>

                {/* Phone Sign In Button */}
                <button
                  onClick={() => setMode('phone')}
                  className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-white/80 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Phone size={18} />
                  Continue with Phone
                </button>
              </>
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
            {mode === 'phone' && (
              <button
                onClick={() => setMode('signin')}
                className="w-full mt-4 py-3 text-white/50 hover:text-white transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Mail size={16} />
                Sign in with email instead
              </button>
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

