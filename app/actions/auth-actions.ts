"use server"

import { cookies } from "next/headers"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { redirect } from "next/navigation"

// Create a Supabase client for server actions
function createActionClient() {
  const cookieStore = cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Access cookies synchronously
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Set cookies synchronously
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          // Remove cookies synchronously
          cookieStore.set({ name, value: "", ...options })
        },
      },
    }
  )
}

// Get the current session
export async function getSession() {
  const supabase = createActionClient()
  return await supabase.auth.getSession()
}

// Get the current user
export async function getUser() {
  const supabase = createActionClient()
  return await supabase.auth.getUser()
}

// Check if user is admin
export async function checkAdminAccess() {
  const supabase = createActionClient()
  
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
  const supabase = createActionClient()
  await supabase.auth.signOut()
  redirect("/admin/login")
}

// Sign in with email and password
export async function signInWithEmail(email: string, password: string) {
  const supabase = createActionClient()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true, data }
}
