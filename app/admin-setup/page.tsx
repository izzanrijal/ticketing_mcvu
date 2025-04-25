"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AdminSetupPage() {
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [creatingAccount, setCreatingAccount] = useState(false)

  const supabase = createClientComponentClient()

  useEffect(() => {
    async function checkAuth() {
      const { data, error } = await supabase.auth.getUser()
      if (!error && data.user) {
        setCurrentUser(data.user)
      }
      setLoading(false)
    }
    checkAuth()
  }, [supabase])

  const createAdminAccount = async () => {
    if (!email || !password) {
      setError("Email and password are required")
      return
    }

    setCreatingAccount(true)
    setError(null)
    setSuccess(null)

    try {
      // 1. Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error("Failed to create user account")
      }

      // 2. Create admin profile by inserting directly
      const { error: profileError } = await supabase.from("admin_profiles").insert({
        id: authData.user.id,
        email: authData.user.email,
        full_name: email.split("@")[0],
        role: "admin",
      })

      if (profileError) {
        // If the error is about the table not existing, try to create it first
        if (profileError.message.includes("relation") && profileError.message.includes("does not exist")) {
          // Try to create the table by inserting a temporary record
          const { error: tempError } = await supabase.from("admin_profiles").insert({
            id: "00000000-0000-0000-0000-000000000000",
            email: "temp@example.com",
            full_name: "Temporary Admin",
            role: "admin",
          })

          if (tempError && !tempError.message.includes("already exists")) {
            throw new Error("Failed to create admin_profiles table: " + tempError.message)
          }

          // Delete the temporary record
          await supabase.from("admin_profiles").delete().eq("id", "00000000-0000-0000-0000-000000000000")

          // Try again to insert the actual admin profile
          const { error: retryError } = await supabase.from("admin_profiles").insert({
            id: authData.user.id,
            email: authData.user.email,
            full_name: email.split("@")[0],
            role: "admin",
          })

          if (retryError) {
            throw new Error("Failed to create admin profile: " + retryError.message)
          }
        } else {
          throw new Error("Failed to create admin profile: " + profileError.message)
        }
      }

      setSuccess("Admin account created successfully! You can now log in.")
      setEmail("")
      setPassword("")
    } catch (e) {
      setError(e.message)
    } finally {
      setCreatingAccount(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Setup</CardTitle>
          <CardDescription>Create an admin account for your application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading...</span>
            </div>
          ) : (
            <>
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Success</AlertTitle>
                  <AlertDescription className="text-green-700">{success}</AlertDescription>
                </Alert>
              )}

              {currentUser ? (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>You are logged in</AlertTitle>
                    <AlertDescription>
                      You are currently logged in as {currentUser.email}. You can use the diagnostic tool to check your
                      admin status.
                    </AlertDescription>
                  </Alert>
                  <div className="flex justify-center space-x-4">
                    <Button asChild variant="outline">
                      <a href="/admin-diagnostic">Diagnostic Tool</a>
                    </Button>
                    <Button asChild>
                      <a href="/admin/login">Admin Login</a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="********"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Password must be at least 6 characters</p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={createAdminAccount}
                    disabled={creatingAccount || !email || !password}
                  >
                    {creatingAccount ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Admin Account"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <a href="/">Back to Home</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
