'use client'

/**
 * Root providers: the Hanzo GUI theme on the SHARED scale (@hanzo/ui/gui-config — the
 * same type/radius/space ladder the console renders at, so the two products are one
 * design), plus SSR-safe dark/light. Dark is the default.
 */
import type { ReactNode } from 'react'
import { GuiProvider } from '@hanzo/gui'
import { NextThemeProvider, useRootTheme } from '@hanzogui/next-theme'
import config from '@hanzo/ui/gui-config'

export function Providers({ children }: { children: ReactNode }) {
  // `dark` fallback so the server render and the client's initial state agree
  // (the html element ships `class="t_dark"`), avoiding a hydration mismatch.
  const [theme, setTheme] = useRootTheme({ fallback: 'dark' })
  return (
    <NextThemeProvider defaultTheme="dark" onChangeTheme={(name) => setTheme(name === 'light' ? 'light' : 'dark')}>
      <GuiProvider config={config} defaultTheme={theme || 'dark'}>
        {children}
      </GuiProvider>
    </NextThemeProvider>
  )
}
