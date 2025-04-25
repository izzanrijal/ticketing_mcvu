import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import { EnhancedOverview } from "@/components/admin/enhanced-overview"
import { AdminDashboardLayout } from "@/components/admin/dashboard-layout"

export default async function AdminPage() {
  // Create a Supabase client directly in the server component
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Get cookie value directly from the request
          const cookie = cookies().get(name)
          return cookie?.value
        },
        set(name: string, value: string, options: any) {
          // This won't be called in a server component
          // It's only used in server actions or route handlers
        },
        remove(name: string, options: any) {
          // This won't be called in a server component
          // It's only used in server actions or route handlers
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
    <AdminDashboardLayout user={user}>
      <EnhancedOverview />
    </AdminDashboardLayout>
  )
}
