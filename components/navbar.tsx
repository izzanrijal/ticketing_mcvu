"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Menu, X } from "lucide-react"

import { Button } from "@/components/ui/button"

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-5xl flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link href="/register" className="flex items-center gap-2">
            <Image 
              src="/assets/bw_logo.png" 
              alt="MCVU 2025 Logo" 
              width={140}
              height={140}
              style={{ maxWidth: '140px', height: 'auto', width: 'auto' }}
              className="h-auto w-auto max-w-[140px]"
            />
          </Link>
        </div>
        <nav className="hidden md:flex md:gap-6">
          <Link href="/register" className="text-sm font-medium transition-colors hover:text-primary">
            Beranda
          </Link>
          <Link href="/register" className="text-sm font-medium transition-colors hover:text-primary">
            Pendaftaran
          </Link>
          <Link href="/check-status" className="text-sm font-medium transition-colors hover:text-primary">
            Cek Status
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild className="hidden md:flex btn-primary">
            <Link href="/register">Daftar</Link>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {isMenuOpen && (
        <div className="mx-auto max-w-5xl pb-4 md:hidden px-4 md:px-6">
          <nav className="flex flex-col gap-4">
            <Link
              href="/register"
              className="text-sm font-medium transition-colors hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              Beranda
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium transition-colors hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              Pendaftaran
            </Link>
            <Link
              href="/check-status"
              className="text-sm font-medium transition-colors hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              Cek Status
            </Link>
            <div className="flex flex-col gap-2 pt-2">
              <Button asChild className="btn-primary">
                <Link href="/register" onClick={() => setIsMenuOpen(false)}>
                  Daftar
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
