"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function AdminDiagnosticPage() {
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [adminProfilesTable, setAdminProfilesTable] = useState<{ exists: boolean; error?: string }>({
    exists: false,
  })
  const [adminProfile, setAdminProfile] = useState<{ exists: boolean; data?: any; error?: string }>({
    exists: false,
  })
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [creatingTable, setCreatingTable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const supabase = createClientComponentClient()

  useEffect(() => {
    async function checkSetup() {
      setLoading(true)
      try {
        // Check current user
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        setCurrentUser(userData.user)

        // Check if admin_profiles table exists by trying to query it
        try {
          const { error: tableError } = await supabase.from("admin_profiles").select("id").limit(1).single()

          // If we get a "relation does not exist" error, the table doesn't exist
          if (tableError && tableError.message.includes("relation") && tableError.message.includes("does not exist")) {
            setAdminProfilesTable({ exists: false, error: "Table doesn't exist" })
          } else {
            // Table exists (even if empty)
            setAdminProfilesTable({ exists: true })

            // If table exists and user is logged in, check for admin profile
            if (userData.user) {
              const { data: profileData, error: profileError } = await supabase
                .from("admin_profiles")
                .select("*")
                .eq("id", userData.user.id)

              if (profileError) {
                setAdminProfile({ exists: false, error: profileError.message })
              } else if (profileData && profileData.length > 0) {
                setAdminProfile({ exists: true, data: profileData[0] })
              } else {
                setAdminProfile({ exists: false })
              }
            }
          }
        } catch (e) {
          setAdminProfilesTable({ exists: false, error: e.message })
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    checkSetup()
  }, [supabase])

  const createAdminProfilesTable = async () => {
    setCreatingTable(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/admin/create-table", {
        method: "POST",
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create admin_profiles table")
      }

      setSuccess("Admin profiles table created successfully. Refreshing...")
      setTimeout(() => window.location.reload(), 2000)
    } catch (e) {
      setError(e.message)
    } finally {
      setCreatingTable(false)
    }
  }

  const createAdminProfile = async () => {
    if (!currentUser) return

    setCreatingProfile(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/admin/create-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUser.id,
          email: currentUser.email,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create admin profile")
      }

      setSuccess("Admin profile created successfully. Refreshing...")
      setTimeout(() => window.location.reload(), 2000)
    } catch (e) {
      setError(e.message)
    } finally {
      setCreatingProfile(false)
    }
  }

  // Create a direct SQL function to create the table
  const createTableDirectly = async () => {
    setCreatingTable(true)
    setError(null)
    setSuccess(null)

    try {
      // Create a temporary admin profile with a placeholder ID
      const { error: insertError } = await supabase.from("admin_profiles").insert({
        id: "00000000-0000-0000-0000-000000000000",
        email: "temp@example.com",
        full_name: "Temporary Admin",
        role: "admin",
      })

      // If the error is not about the table already existing, it's a real error
      if (insertError && !insertError.message.includes("already exists")) {
        throw new Error("Failed to create table: " + insertError.message)
      }

      // Delete the temporary record if it was created
      await supabase.from("admin_profiles").delete().eq("id", "00000000-0000-0000-0000-000000000000")

      setSuccess("Admin profiles table created successfully. Refreshing...")
      setTimeout(() => window.location.reload(), 2000)
    } catch (e) {
      setError(e.message)
    } finally {
      setCreatingTable(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Admin Diagnostic Tool</CardTitle>
          <CardDescription>Check and fix admin setup issues</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Checking setup...</span>
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

              <div className="rounded-md border p-4">
                <h3 className="mb-2 text-lg font-medium">Authentication Status</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    {currentUser ? (
                      <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="mr-2 h-5 w-5 text-red-500" />
                    )}
                    <span>User authenticated</span>
                  </div>
                  {currentUser && (
                    <div className="ml-7 text-sm text-muted-foreground">
                      <div>
                        <strong>User ID:</strong> {currentUser.id}
                      </div>
                      <div>
                        <strong>Email:</strong> {currentUser.email}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-md border p-4">
                <h3 className="mb-2 text-lg font-medium">Database Setup</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    {adminProfilesTable.exists ? (
                      <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="mr-2 h-5 w-5 text-red-500" />
                    )}
                    <span>admin_profiles table exists</span>
                  </div>
                  {!adminProfilesTable.exists && adminProfilesTable.error && (
                    <div className="ml-7 text-sm text-red-500">{adminProfilesTable.error}</div>
                  )}

                  {adminProfilesTable.exists && (
                    <div className="flex items-center">
                      {adminProfile.exists ? (
                        <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="mr-2 h-5 w-5 text-red-500" />
                      )}
                      <span>Admin profile for current user</span>
                    </div>
                  )}
                  {adminProfilesTable.exists && !adminProfile.exists && adminProfile.error && (
                    <div className="ml-7 text-sm text-red-500">{adminProfile.error}</div>
                  )}
                </div>
              </div>

              {currentUser && adminProfilesTable.exists && !adminProfile.exists && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                  <h3 className="mb-2 text-lg font-medium text-amber-800">Admin Profile Missing</h3>
                  <p className="mb-4 text-amber-700">
                    You are logged in but don't have an admin profile. Create one to access the admin dashboard.
                  </p>
                  <Button onClick={createAdminProfile} disabled={creatingProfile}>
                    {creatingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Admin Profile"
                    )}
                  </Button>
                </div>
              )}

              {!adminProfilesTable.exists && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                  <h3 className="mb-2 text-lg font-medium text-amber-800">Missing Table</h3>
                  <p className="mb-4 text-amber-700">
                    The admin_profiles table doesn't exist. Create it to enable admin functionality.
                  </p>
                  <div className="space-y-2">
                    <Button onClick={createTableDirectly} disabled={creatingTable} className="w-full">
                      {creatingTable ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Table Directly"
                      )}
                    </Button>
                    <p className="text-xs text-amber-700">
                      This method creates the table by inserting a temporary record.
                    </p>
                  </div>
                </div>
              )}

              {!currentUser && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                  <h3 className="mb-2 text-lg font-medium text-amber-800">Not Logged In</h3>
                  <p className="mb-4 text-amber-700">
                    You need to be logged in to check your admin profile or create one.
                  </p>
                  <Button asChild>
                    <a href="/admin/login">Go to Login</a>
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
          <Button asChild>
            <a href="/admin/login">Go to Admin Login</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
