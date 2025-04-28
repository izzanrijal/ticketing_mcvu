import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createServerSupabaseClient } from "@/lib/supabase-auth"

import { EnhancedOverview } from "@/components/admin/enhanced-overview"
import { AdminDashboardLayout } from "@/components/admin/dashboard-layout"

export default async function AdminPage() {
  // Create Supabase client
  const supabase = await createServerSupabaseClient()

  // Get the current user using getUser()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  // If no user, redirect to login
  if (userError || !user) {
    redirect("/admin/login")
  }

  // Fetch admin profile
  const { data: adminProfile, error: profileError } = await supabase
    .from("admin_profiles")
    .select("*")
    .eq("id", user.id) // Use user.id
    .single()

  // If no admin profile or error fetching, redirect to login with error
  if (profileError || !adminProfile) {
    // Log the error for debugging
    console.error("Admin profile error:", profileError)
    redirect("/admin/login?error=profile_not_found")
  }

  return (
    <AdminDashboardLayout user={user}>
      <EnhancedOverview />
    </AdminDashboardLayout>
  )
}
