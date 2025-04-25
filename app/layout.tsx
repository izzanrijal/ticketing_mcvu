import type React from "react"
import { Inter } from "next/font/google"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "MCVU 2025 Symposium",
  description: "Platform Pendaftaran Symposium MCVU 2025",
    generator: 'v0.dev'
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // We're not using Supabase client directly in the layout anymore
  // This avoids the cookie modification error

  return (
    <html lang="id" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
