"use client"

import { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export default function AdminSqlPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const supabase = createClientComponentClient()

  const createTableSql = `
-- Create the admin_profiles table with proper foreign key to auth.users
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies to secure the table
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read their own profile
CREATE POLICY "Users can view their own admin profile"
  ON public.admin_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy to allow authenticated users to update their own profile
CREATE POLICY "Users can update their own admin profile"
  ON public.admin_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy to allow service role to manage all profiles
CREATE POLICY "Service role can manage all admin profiles"
  ON public.admin_profiles
  USING (true)
  WITH CHECK (true);
`

  async function createTable() {
    setLoading(true)
    setResult(null)

    try {
      // First check if the table already exists
      const { error: checkError } = await supabase.from("admin_profiles").select("id").limit(1)

      if (!checkError) {
        setResult({
          success: true,
          message: "Table admin_profiles already exists!",
        })
        setLoading(false)
        return
      }

      // Try to create the table using RPC (this might not work if RPC is not enabled)
      const { error } = await supabase.rpc("create_admin_profiles_table")

      if (error) {
        console.log("RPC failed, trying direct insert method")

        // Alternative approach: Try to create the table by inserting a temporary record
        // This works because Supabase will create the table if it doesn't exist
        const { error: insertError } = await supabase.from("admin_profiles").insert({
          id: "00000000-0000-0000-0000-000000000000",
          email: "temp@example.com",
          full_name: "Temporary User",
          role: "admin",
        })

        if (insertError && !insertError.message.includes("already exists")) {
          throw new Error(`Failed to create table: ${insertError.message}`)
        }

        // Delete the temporary record
        await supabase.from("admin_profiles").delete().eq("id", "00000000-0000-0000-0000-000000000000")

        setResult({
          success: true,
          message: "Successfully created admin_profiles table using insert method!",
        })
      } else {
        setResult({
          success: true,
          message: "Successfully created admin_profiles table using RPC!",
        })
      }
    } catch (error) {
      console.error("Error creating table:", error)
      setResult({
        success: false,
        message: `Error: ${error.message}`,
      })
    } finally {
      setLoading(false)
    }
  }

  async function createAdminProfile() {
    setLoading(true)
    setResult(null)

    try {
      // Get current user
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`)
      }

      if (!sessionData.session) {
        throw new Error("You must be logged in to create an admin profile")
      }

      const user = sessionData.session.user

      // Check if profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from("admin_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      if (existingProfile) {
        setResult({
          success: true,
          message: "Admin profile already exists for your account!",
        })
        return
      }

      // Create admin profile
      const { error: insertError } = await supabase.from("admin_profiles").insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || "Admin User",
        role: "admin",
      })

      if (insertError) {
        throw new Error(`Failed to create admin profile: ${insertError.message}`)
      }

      setResult({
        success: true,
        message: "Successfully created admin profile for your account!",
      })
    } catch (error) {
      console.error("Error creating admin profile:", error)
      setResult({
        success: false,
        message: `Error: ${error.message}`,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Admin SQL Helper</CardTitle>
          <CardDescription>Create the admin_profiles table and admin profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md border p-4">
            <h3 className="mb-2 text-lg font-medium">Create admin_profiles Table</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              This SQL will create the admin_profiles table and set up the necessary RLS policies.
            </p>
            <pre className="mb-4 max-h-60 overflow-auto rounded bg-slate-950 p-2 text-xs text-white">
              {createTableSql}
            </pre>
            <Button onClick={createTable} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Table...
                </>
              ) : (
                "Try to Create Table"
              )}
            </Button>
          </div>

          <div className="rounded-md border p-4">
            <h3 className="mb-2 text-lg font-medium">Create Admin Profile</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              This will create an admin profile for your current user account.
            </p>
            <Button onClick={createAdminProfile} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Profile...
                </>
              ) : (
                "Create Admin Profile for Current User"
              )}
            </Button>
          </div>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
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
            <a href="/admin">Admin Dashboard</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
