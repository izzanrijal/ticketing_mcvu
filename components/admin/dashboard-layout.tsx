"use client"

import type React from "react"
import { useState } from "react"

import { AdminSidebar } from "@/components/admin/sidebar"
import { AdminHeader } from "@/components/admin/header"

interface AdminDashboardLayoutProps {
  children: React.ReactNode
  user: any
}

export function AdminDashboardLayout({ children, user }: AdminDashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState("overview")

  const handleSignOut = () => {
    // Implement sign out logic here
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex flex-1 flex-col">
        <AdminHeader user={user} onSignOut={handleSignOut} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
