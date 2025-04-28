import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-auth"

// Import the component that displays the workshop participant data
import { AdminWsParticipants } from "@/components/admin/ws-participants" 
import { AdminDashboardLayout } from "@/components/admin/dashboard-layout"

// Default export for the page component
export default async function WsParticipantsPage() { 
  const supabase = await createServerSupabaseClient()

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
    // Render the layout, passing the user and specifying the active tab
    <AdminDashboardLayout user={user} activeTab="ws-participants"> 
      {/* Render the component that shows the workshop participants */}
      <AdminWsParticipants /> 
    </AdminDashboardLayout>
  )
}
