"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Redirect /profile to /dashboard
export default function ProfilePage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/dashboard')
  }, [router])
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-[#00FF00]">Redirecting...</div>
    </div>
  )
}
