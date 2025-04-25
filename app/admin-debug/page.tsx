"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminDebugPage() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [adminProfile, setAdminProfile] = useState<any>(null)
  const [adminProfileError, setAdminProfileError] = useState<any>(null)
  const [tableExists, setTableExists] = useState<boolean | null>(null)
  const [tableError, setTableError] = useState<any>(null)

  const supabase = createClientComponentClient()

  useEffect(() => {
    async function checkAuth() {
      try {
        // Check session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        setSession(sessionData.session)

        if (sessionData.session) {
          try {
            // Check if table exists by trying to query it
            const { error: tableCheckError } = await supabase.from("admin_profiles").select("id").limit(1).single()

            if (tableCheckError) {
              if (tableCheckError.message.includes("relation") && tableCheckError.message.includes("does not exist")) {
                setTableExists(false)
                setTableError(tableCheckError)
              } else {
                setTableExists(true)
                // Try to get admin profile
                try {
                  const { data: profileData, error: profileError } = await supabase
                    .from("admin_profiles")
                    .select("*")
                    .eq("id", sessionData.session.user.id)
                    .single()

                  if (profileError) {
                    setAdminProfileError(profileError)
                  } else {
                    setAdminProfile(profileData)
                  }
                } catch (e) {
                  setAdminProfileError(e)
                }
              }
            } else {
              setTableExists(true)
            }
          } catch (e) {
            setTableError(e)
          }
        }
      } catch (e) {
        console.error("Debug error:", e)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [supabase])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Admin Debug Information</CardTitle>
          <CardDescription>Detailed information about your authentication state</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading debug information...</span>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-md border p-4">
                <h3 className="mb-2 text-lg font-medium">Authentication Status</h3>
                {session ? (
                  <div>
                    <p className="text-green-600 font-medium">✓ Authenticated</p>
                    <pre className="mt-2 max-h-60 overflow-auto rounded bg-slate-950 p-2 text-xs text-white">
                      {JSON.stringify(session, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-red-600 font-medium">✗ Not authenticated</p>
                )}
              </div>

              <div className="rounded-md border p-4">
                <h3 className="mb-2 text-lg font-medium">Database Status</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">admin_profiles Table</h4>
                    {tableExists === null ? (
                      <p>Unknown</p>
                    ) : tableExists ? (
                      <p className="text-green-600 font-medium">✓ Table exists</p>
                    ) : (
                      <div>
                        <p className="text-red-600 font-medium">✗ Table does not exist</p>
                        {tableError && (
                          <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-950 p-2 text-xs text-white">
                            {JSON.stringify(tableError, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>

                  {tableExists && (
                    <div>
                      <h4 className="font-medium">Admin Profile</h4>
                      {adminProfile ? (
                        <div>
                          <p className="text-green-600 font-medium">✓ Admin profile found</p>
                          <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-950 p-2 text-xs text-white">
                            {JSON.stringify(adminProfile, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <div>
                          <p className="text-red-600 font-medium">✗ No admin profile found</p>
                          {adminProfileError && (
                            <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-950 p-2 text-xs text-white">
                              {JSON.stringify(adminProfileError, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-md border p-4">
                <h3 className="mb-2 text-lg font-medium">Next Steps</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {!session && <li>Log in to your account</li>}
                  {!tableExists && <li>Create the admin_profiles table using the SQL query or diagnostic tool</li>}
                  {session && tableExists && !adminProfile && <li>Create an admin profile for your user account</li>}
                  {session && adminProfile && <li>You should be able to access the admin dashboard</li>}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/">Home</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/admin/login">Admin Login</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/admin-diagnostic">Diagnostic Tool</a>
          </Button>
          <Button asChild>
            <a href="/admin?debug=true">Admin Dashboard (Debug Mode)</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
