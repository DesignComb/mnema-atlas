import { useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { startFcm } from '@/lib/fcm'

/** Registers the native app for FCM push once signed in. Renders nothing; no-op on web. */
export function FcmRegister() {
  const { session } = useAuth()
  useEffect(() => {
    if (session) void startFcm()
  }, [session])
  return null
}
