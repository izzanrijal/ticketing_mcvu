"use client"

import Link from "next/link"
import {
  BarChart3,
  CreditCard,
  QrCode,
  Settings,
  Users,
  Check,
  FileText,
  Percent,
  Search,
  PenToolIcon as Tool,
  AlertTriangle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface AdminSidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  isMobile?: boolean
}

export function AdminSidebar({ activeTab, setActiveTab, isMobile = false }: AdminSidebarProps) {
  // Update the menuItems array to include the new troubleshooter menu item
  const menuItems = [
    {
      id: "overview",
      label: "Dashboard",
      icon: <BarChart3 className="h-5 w-5" />,
      href: "/admin",
    },
    {
      id: "participants",
      label: "Peserta",
      icon: <Users className="h-5 w-5" />,
      href: "/admin/participants",
    },
    {
      id: "payments",
      label: "Pembayaran",
      icon: <CreditCard className="h-5 w-5" />,
      href: "/admin/payments",
    },
    {
      id: "promotions",
      label: "Promo",
      icon: <Percent className="h-5 w-5" />,
      href: "/admin/promotions",
    },
    {
      id: "manual-verification",
      label: "Verifikasi Manual",
      icon: <Check className="h-5 w-5" />,
      href: "/admin/manual-verification",
    },
    {
      id: "check-in",
      label: "Check-in",
      icon: <QrCode className="h-5 w-5" />,
      href: "/admin/check-in",
    },
    {
      id: "reports",
      label: "Laporan",
      icon: <FileText className="h-5 w-5" />,
      href: "/admin/reports",
    },
    {
      id: "registration-lookup",
      label: "Registration Lookup",
      icon: <Search className="h-5 w-5" />,
      href: "/admin/registration-lookup",
    },
    {
      id: "registration-troubleshooter",
      label: "Troubleshooter",
      icon: <Tool className="h-5 w-5" />,
      href: "/admin/registration-troubleshooter",
    },
    {
      id: "error-logs",
      label: "Error Logs",
      icon: <AlertTriangle className="h-5 w-5" />,
      href: "/admin/error-logs",
    },
    {
      id: "settings",
      label: "Pengaturan",
      icon: <Settings className="h-5 w-5" />,
      href: "/admin/settings",
    },
  ]

  return (
    <div className={`${isMobile ? 'flex' : 'hidden md:flex'} w-64 flex-col border-r bg-background`}>
      {!isMobile && (
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">MCVU 2025</span>
          </Link>
        </div>
      )}
      <div className="flex-1 overflow-auto py-2">
        <nav className="grid items-start px-2 text-sm font-medium">
          {menuItems.map((item) => (
            <Link 
              key={item.id} 
              href={item.href}
              onClick={() => setActiveTab(item.id)}
              className="w-full"
            >
              <Button
                variant={activeTab === item.id ? "secondary" : "ghost"}
                className={cn("flex h-10 w-full justify-start gap-2 px-4", activeTab === item.id && "bg-muted")}
              >
                {item.icon}
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
