"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function createSupabaseServerClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          // Using the synchronous API
          const cookieStore = cookies()
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          try {
            // Using the synchronous API
            const cookieStore = cookies()
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle errors when cookies can't be set
            console.error("Error setting cookie:", error)
          }
        },
        remove(name, options) {
          try {
            // Using the synchronous API
            const cookieStore = cookies()
            cookieStore.set({ name, value: "", ...options })
          } catch (error) {
            // Handle errors when cookies can't be removed
            console.error("Error removing cookie:", error)
          }
        },
      },
    }
  )
}

// Check if user is authenticated and has admin access
export async function checkAdminAccess() {
  const supabase = await createSupabaseServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { isAdmin: false, user: null }
  }
  
  // Check if user has admin profile
  const { data: adminProfile, error } = await supabase
    .from("admin_profiles")
    .select("*")
    .eq("id", user.id)
    .single()
    
  if (error || !adminProfile) {
    return { isAdmin: false, user }
  }
  
  return { isAdmin: true, user, adminProfile }
}

// Sign out action
export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/admin/login")
}
