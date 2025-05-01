import type { Metadata } from "next"
import { RegistrationFlow } from "@/components/registration/registration-flow"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Pendaftaran - MCVU XXIII 2025",
  description: "Formulir pendaftaran untuk MCVU XXIII 2025",
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold md:text-4xl text-primary">Registrasi Symposium dan Workshop MCVU XXIII 2025</h1>
              <p className="mt-2 text-muted-foreground">Lengkapi formulir di bawah ini untuk mendaftar</p>
            </div>
            <RegistrationFlow />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
