"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

import { AdminSidebar } from "@/components/admin/sidebar"
import { AdminHeader } from "@/components/admin/header"
import { AdminOverview } from "@/components/admin/overview"
import { AdminParticipants } from "@/components/admin/participants"
import { AdminPayments } from "@/components/admin/payments"
import { AdminCheckin } from "@/components/admin/checkin"
import { AdminSettings } from "@/components/admin/settings"

interface AdminDashboardProps {
  user: any
}

export function AdminDashboard({ user }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/admin/login")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex flex-1 flex-col">
        <AdminHeader user={user} onSignOut={handleSignOut} />
        <main className="flex-1 p-6">
          {activeTab === "overview" && <AdminOverview />}
          {activeTab === "participants" && <AdminParticipants />}
          {activeTab === "payments" && <AdminPayments />}
          {activeTab === "checkin" && <AdminCheckin />}
          {activeTab === "settings" && <AdminSettings />}
        </main>
      </div>
    </div>
  )
}
