import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-auth"
import { AdminLoginForm } from "@/components/admin/login-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "Admin Login - MCVU 2025 Symposium",
  description: "Login admin untuk MCVU 2025 Symposium",
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const supabase = await createServerSupabaseClient()

  // Check if user is already logged in
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    // Check if user is admin before redirecting
    const { data: adminProfile, error: profileError } = await supabase
      .from("admin_profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()

    if (!profileError && adminProfile) {
      // If user is admin, redirect to admin dashboard
      return redirect("/admin")
    }
  }

  // Get error message from URL parameter
  const errorType = searchParams.error as string | undefined
  let errorMessage: string | null = null

  if (errorType) {
    switch (errorType) {
      case "session":
        errorMessage = "Sesi Anda telah berakhir. Silakan login kembali."
        break
      case "not_admin":
        errorMessage = "Akun Anda tidak memiliki akses admin."
        break
      case "unknown":
        errorMessage = "Terjadi kesalahan. Silakan coba lagi."
        break
      default:
        errorMessage = null
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Admin Login</h1>
          <p className="text-sm text-muted-foreground">Masuk ke dashboard admin MCVU 2025 Symposium</p>
        </div>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Login Gagal</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <AdminLoginForm />
      </div>
    </div>
  )
}
