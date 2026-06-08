import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { App as CapApp } from '@capacitor/app'
import { supabase } from './supabase'

// Custom-scheme deep link the Capacitor shell registers (see AndroidManifest.xml)
// and that Supabase redirects to after Google sign-in. Must also be in Supabase
// Auth → URL Configuration → Redirect URLs.
const NATIVE_REDIRECT = 'tw.dco.mnema://login-callback'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      // TanStack Router's guards — the '/' landing redirect (router.tsx) and the
      // _app session gate — only run on navigation, not when auth state flips in
      // place. On web the OAuth round-trip is a full-page redirect, so the guards
      // re-run for free. In the Capacitor shell sign-in finishes via the in-app
      // exchangeCodeForSession with NO navigation, so without this kick the user
      // stays on the landing page despite being signed in (and stays on an app
      // page after sign-out). Invalidate re-runs the current route's beforeLoad,
      // which then redirects into — or out of — the app. Dynamic import avoids a
      // static auth↔router cycle (router eagerly imports screens that useAuth).
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        void import('@/router').then((m) => m.router.invalidate())
      }
    })

    // Native only: catch the OAuth deep-link redirect. The system browser sends
    // the user back to tw.dco.mnema://login-callback?code=…, which re-opens this
    // (singleTask) activity and fires appUrlOpen. Exchange the code for a session,
    // then close the in-app browser.
    let removeDeepLink: (() => void) | undefined
    if (Capacitor.isNativePlatform()) {
      const handle = CapApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url.startsWith(NATIVE_REDIRECT)) return
        try {
          const code = new URL(url).searchParams.get('code')
          if (code) await supabase.auth.exchangeCodeForSession(code)
        } catch (err) {
          console.error('[mnema] OAuth callback exchange failed', err)
        } finally {
          await Browser.close().catch(() => {})
        }
      })
      removeDeepLink = () => {
        handle.then((h) => h.remove()).catch(() => {})
      }
    }

    return () => {
      sub.subscription.unsubscribe()
      removeDeepLink?.()
    }
  }, [])

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    loading,
    async signInWithGoogle() {
      if (Capacitor.isNativePlatform()) {
        // Native: generate the PKCE URL but don't navigate the webview. Open it
        // in the system browser; the deep-link handler above finishes sign-in.
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: NATIVE_REDIRECT,
            skipBrowserRedirect: true,
            queryParams: { prompt: 'select_account' },
          },
        })
        if (error) throw error
        if (data?.url) await Browser.open({ url: data.url })
        return
      }
      // Web: full-page redirect to Google, then back to the app root with the
      // session in the URL — supabase.ts has detectSessionInUrl:true to pick it
      // up. redirectTo honours the GitHub Pages sub-path via BASE_URL, and must
      // be listed in Supabase Auth → URL Configuration → Redirect URLs.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (error) throw error
    },
    async signOut() {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
