"use server"

import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { redirect } from "next/navigation"

// Create a server action to handle authentication
export async function signOut() {
  // Create a new supabase client for this server action
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Get cookie value
          return cookies().get(name)?.value
        },
        set(name: string, value: string, options: any) {
          // Set cookie value
          cookies().set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          // Remove cookie by setting empty value
          cookies().set({ name, value: "", ...options })
        },
      },
    }
  )
  
  await supabase.auth.signOut()
  redirect("/admin/login")
}

// Check if user is authenticated and has admin access
export async function checkAdminAccess() {
  // Create a new supabase client for this server action
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Get cookie value
          return cookies().get(name)?.value
        },
        set(name: string, value: string, options: any) {
          // Set cookie value
          cookies().set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          // Remove cookie by setting empty value
          cookies().set({ name, value: "", ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return { isAdmin: false, user: null }
  }
  
  // Check if user has admin profile
  const { data: adminProfile, error } = await supabase
    .from("admin_profiles")
    .select("*")
    .eq("id", session.user.id)
    .single()
    
  if (error || !adminProfile) {
    return { isAdmin: false, user: session.user }
  }
  
  return { isAdmin: true, user: session.user, adminProfile }
}
