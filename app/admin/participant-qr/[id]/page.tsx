import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"

import { ParticipantQr } from "@/components/admin/participant-qr"
import { AdminDashboardLayout } from "@/components/admin/dashboard-layout"

export default async function ParticipantQrPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
    <AdminDashboardLayout user={user}>
      <ParticipantQr registrationItemId={params.id} />
    </AdminDashboardLayout>
  )
}
