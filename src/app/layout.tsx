import type { Metadata, Viewport } from 'next'
import ThemeProvider from '@/components/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'FoodCoach AI',
  description: 'Seu coach de alimentação com IA',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#0d1117',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-white antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
