import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { SponsorLetterTable } from "@/components/admin/sponsor-letter-table"
import { AdminDashboardLayout } from "@/components/admin/dashboard-layout"

export const dynamic = "force-dynamic"

export default async function SponsorLettersPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        // set and remove might be needed if you perform auth actions here, but not for getSession
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <AdminDashboardLayout user={session.user} activeTab="sponsor-letters">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Sponsor Guarantee Letters</h3>
          <p className="text-sm text-muted-foreground">
            Review and download uploaded sponsor guarantee letters.
          </p>
        </div>
        <SponsorLetterTable />
      </div>
    </AdminDashboardLayout>
  );
}
