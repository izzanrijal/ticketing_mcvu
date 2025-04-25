import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import { AdminParticipants } from "@/components/admin/participants"
import { AdminDashboardLayout } from "@/components/admin/dashboard-layout"

export default async function ParticipantsPage() {
  // Create a Supabase client using the same approach as the main admin page
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookies().get(name)?.value
        },
        set(name, value, options) {
          // Not used in server component
        },
        remove(name, options) {
          // Not used in server component
        },
      },
    }
  )

  // Get the current user
  const { data: { user } } = await supabase.auth.getUser()

  // If no user, redirect to login
  if (!user) {
    redirect("/admin/login")
  }

  // Check if the user has an admin profile
  const { data: adminProfile, error: profileError } = await supabase
    .from("admin_profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  // If no admin profile, redirect to login with error
  if (profileError || !adminProfile) {
    redirect("/admin/login?error=not_admin")
  }

  return (
    <AdminDashboardLayout user={user} activeTab="participants">
      <AdminParticipants />
    </AdminDashboardLayout>
  )
}
