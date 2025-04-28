import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

import { SponsorLetterTable } from "@/components/admin/sponsor-letter-table"

export const dynamic = "force-dynamic"

export default async function SponsorLettersPage() {
  const supabase = createServerComponentClient({ cookies })

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Sponsor Guarantee Letters</h3>
        <p className="text-sm text-muted-foreground">
          Review and download uploaded sponsor guarantee letters.
        </p>
      </div>
      <SponsorLetterTable />
    </div>
  );
}
