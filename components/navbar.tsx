"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">MCVU 2025</span>
          </Link>
        </div>
        <nav className="hidden md:flex md:gap-6">
          <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">
            Beranda
          </Link>
          <Link href="/register" className="text-sm font-medium transition-colors hover:text-primary">
            Pendaftaran
          </Link>
          <Link href="/check-status" className="text-sm font-medium transition-colors hover:text-primary">
            Cek Status
          </Link>
          <Link href="#info" className="text-sm font-medium transition-colors hover:text-primary">
            Tentang
          </Link>
          <Link href="#" className="text-sm font-medium transition-colors hover:text-primary">
            Jadwal
          </Link>
          <Link href="#" className="text-sm font-medium transition-colors hover:text-primary">
            Kontak
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button asChild className="hidden md:flex btn-primary">
            <Link href="/register">Daftar</Link>
          </Button>
          <Button asChild variant="outline" className="hidden md:flex btn-secondary">
            <Link href="/admin">Admin</Link>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {isMenuOpen && (
        <div className="container pb-4 md:hidden">
          <nav className="flex flex-col gap-4">
            <Link
              href="/"
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
            <Link
              href="#info"
              className="text-sm font-medium transition-colors hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              Tentang
            </Link>
            <Link
              href="#"
              className="text-sm font-medium transition-colors hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              Jadwal
            </Link>
            <Link
              href="#"
              className="text-sm font-medium transition-colors hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              Kontak
            </Link>
            <div className="flex flex-col gap-2 pt-2">
              <Button asChild className="btn-primary">
                <Link href="/register" onClick={() => setIsMenuOpen(false)}>
                  Daftar
                </Link>
              </Button>
              <Button asChild variant="outline" className="btn-secondary">
                <Link href="/admin" onClick={() => setIsMenuOpen(false)}>
                  Admin
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
