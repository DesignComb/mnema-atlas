import { createContext, useContext } from 'react'

/**
 * Lets any screen's <PageHeader> reach the app-shell actions that live in
 * <AppLayout> — opening the account/settings sheet and the ⌘K command palette.
 * (The old left nav drawer is gone: space switching is the bottom bar + Spaces
 * sheet, within-space nav is the SubNav strip.) On desktop (lg+) the sidebar
 * carries these, so the header's mobile buttons are hidden and never call these.
 */
export type ShellApi = {
  openProfile: () => void
  openCommand: () => void
}

export const ShellContext = createContext<ShellApi>({
  openProfile: () => {},
  openCommand: () => {},
})

export function useShell() {
  return useContext(ShellContext)
}
