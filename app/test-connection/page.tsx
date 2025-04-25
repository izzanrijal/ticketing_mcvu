import type { Metadata } from "next"
import { SupabaseConnectionTest } from "@/components/supabase-connection-test"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Tes Koneksi Supabase - MCVU 2025 Symposium",
  description: "Menguji koneksi ke database Supabase",
}

export default function TestConnectionPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold md:text-4xl">Tes Koneksi Supabase</h1>
              <p className="mt-2 text-muted-foreground">Verifikasi bahwa aplikasi Anda dapat terhubung ke Supabase</p>
            </div>
            <SupabaseConnectionTest />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
