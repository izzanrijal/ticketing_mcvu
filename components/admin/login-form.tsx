"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Loader2, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function AdminLoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // This effect will handle the redirect after successful login
  useEffect(() => {
    if (redirecting) {
      // Use a timeout to ensure the session is properly set before redirecting
      const timer = setTimeout(() => {
        window.location.href = "/admin"
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [redirecting])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      console.log("Attempting login with email:", email)

      // Sign in with email and password
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.error("Sign in error:", signInError)
        throw new Error(signInError.message)
      }

      if (!authData.user) {
        throw new Error("No user returned from authentication")
      }

      console.log("Authentication successful, checking admin profile")

      // Check if user is admin
      const { data: adminProfile, error: profileError } = await supabase
        .from("admin_profiles")
        .select("*")
        .eq("id", authData.user.id)
        .single()

      if (profileError) {
        console.error("Error fetching admin profile:", profileError)

        if (profileError.message.includes("JSON object requested, multiple (or no) rows returned")) {
          throw new Error("Akun Anda tidak memiliki akses admin. Kunjungi /admin-diagnostic untuk memperbaiki.")
        }

        throw new Error(`Error fetching admin profile: ${profileError.message}`)
      }

      if (!adminProfile) {
        throw new Error("Akun Anda tidak memiliki akses admin")
      }

      console.log("Admin profile found, redirecting to dashboard")

      // Set redirecting state to trigger the useEffect
      setRedirecting(true)

      // Show redirect message
      setError("Login successful! Redirecting to dashboard...")
    } catch (error: any) {
      console.error("Login error:", error)
      setError(error.message || "An unknown error occurred")
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      {error && (
        <Alert variant={redirecting ? "default" : "destructive"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{redirecting ? "Success" : "Login Gagal"}</AlertTitle>
          <AlertDescription>
            {error}
            {!redirecting && error.includes("admin-diagnostic") && (
              <div className="mt-2">
                <Button asChild variant="outline" size="sm" className="btn-secondary">
                  <a href="/admin-diagnostic">Buka Diagnostic Tool</a>
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email" className="text-primary">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading || redirecting}
              className="input-primary"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password" className="text-primary">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading || redirecting}
              className="input-primary"
            />
          </div>

          <Button type="submit" disabled={loading || redirecting} className="btn-primary">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : redirecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting...
              </>
            ) : (
              "Login"
            )}
          </Button>
        </div>
      </form>
      <div className="text-center text-sm">
        <a href="/admin-diagnostic" className="text-primary hover:underline">
          Having trouble logging in? Use the diagnostic tool
        </a>
      </div>
    </div>
  )
}
