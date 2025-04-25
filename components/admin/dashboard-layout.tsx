"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"

import { AdminSidebar } from "@/components/admin/sidebar"
import { AdminHeader } from "@/components/admin/header"

interface AdminDashboardLayoutProps {
  children: React.ReactNode
  user: any
}

export function AdminDashboardLayout({ children, user }: AdminDashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const pathname = usePathname()

  // Update active tab based on current path
  useEffect(() => {
    // Default to overview for the main admin page
    if (pathname === "/admin") {
      setActiveTab("overview")
      return
    }

    // Extract the section from the path (e.g., /admin/participants -> participants)
    const section = pathname.split("/").slice(2)[0]
    
    if (section) {
      // Handle special cases where URL doesn't match the tab ID exactly
      if (section === "registration-troubleshooter") {
        setActiveTab("registration-troubleshooter")
      } else if (section === "registration-lookup") {
        setActiveTab("registration-lookup")
      } else if (section === "error-logs") {
        setActiveTab("error-logs")
      } else if (section === "manual-verification") {
        setActiveTab("manual-verification")
      } else if (section === "check-in") {
        setActiveTab("check-in")
      } else {
        // For other sections, use the section name directly
        setActiveTab(section)
      }
    }
  }, [pathname])

  const handleSignOut = () => {
    // Implement sign out logic here
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex flex-1 flex-col">
        <AdminHeader user={user} onSignOut={handleSignOut} activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
