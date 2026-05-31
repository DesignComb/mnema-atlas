import { createContext, useContext } from 'react'

/**
 * Lets any screen's <PageHeader> open the mobile navigation drawer that lives
 * in <AppLayout>. On desktop (lg+) the sidebar is always visible and the
 * hamburger is hidden, so `openNav` is simply never called.
 */
export const MobileNavContext = createContext<{ openNav: () => void }>({ openNav: () => {} })

export function useMobileNav() {
  return useContext(MobileNavContext)
}
