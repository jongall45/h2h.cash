"use client"

import { useAuth } from './AuthProvider'
import { WinnerNotificationProvider } from './WinnerModal'

export function NotificationWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  
  return (
    <WinnerNotificationProvider userId={user?.id || null}>
      {children}
    </WinnerNotificationProvider>
  )
}
