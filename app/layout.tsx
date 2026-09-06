import '@hanzogui/core/reset.css'

import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Hanzo Social',
  description: 'Compose, schedule and publish your content across networks — per org.',
}

export const viewport: Viewport = { themeColor: '#000000', viewportFit: 'cover' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="t_dark" style={{ backgroundColor: '#000000', colorScheme: 'dark' }} suppressHydrationWarning>
      <body style={{ margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
