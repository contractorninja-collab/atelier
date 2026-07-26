'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_PREFS, PREFS_KEY, applyTheme, readPrefs, writePrefs,
  type Prefs,
} from '@/lib/prefs'

type Ctx = {
  prefs: Prefs
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  reset: () => void
  /** False until localStorage has been read, so nothing renders a wrong default. */
  ready: boolean
}

const PrefsContext = createContext<Ctx>({
  prefs: DEFAULT_PREFS,
  set: () => {},
  reset: () => {},
  ready: false,
})

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  // Start from the defaults on both server and client: reading localStorage
  // during the first render would make the markup differ from the server's.
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setPrefs(readPrefs())
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) applyTheme(prefs.theme)
  }, [prefs.theme, ready])

  // Follow the OS while the choice is "system" — without this, switching the OS
  // to dark leaves the app light until a reload.
  useEffect(() => {
    if (prefs.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [prefs.theme])

  // Two tabs open should not disagree about the theme.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFS_KEY) setPrefs(readPrefs())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const set = useCallback<Ctx['set']>((key, value) => {
    setPrefs((current) => {
      const next = { ...current, [key]: value }
      writePrefs(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setPrefs(DEFAULT_PREFS)
    writePrefs(DEFAULT_PREFS)
  }, [])

  const value = useMemo(() => ({ prefs, set, reset, ready }), [prefs, set, reset, ready])
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs() {
  return useContext(PrefsContext)
}
