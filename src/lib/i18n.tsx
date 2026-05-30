import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'zh'

function getInitial(): Lang {
  if (typeof window === 'undefined') return 'en'
  const saved = localStorage.getItem('lang')
  if (saved === 'en' || saved === 'zh') return saved
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

interface I18nState {
  lang: Lang
  setLang: (l: Lang) => void
  toggle: () => void
  /** Inline translator: t('English', '繁體中文') → the active language's text. */
  t: (en: string, zh: string) => string
}

const I18nContext = createContext<I18nState | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(getInitial)

  useEffect(() => {
    localStorage.setItem('lang', lang)
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en'
  }, [lang])

  const t = (en: string, zh: string) => (lang === 'zh' ? zh : en)

  return (
    <I18nContext.Provider value={{ lang, setLang, toggle: () => setLang((l) => (l === 'zh' ? 'en' : 'zh')), t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>')
  return ctx
}

/** Convenience: const t = useT(); then t('Save', '儲存'). */
export const useT = () => useI18n().t
