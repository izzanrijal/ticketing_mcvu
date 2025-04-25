"use client"

import { useEffect, useState } from "react"
import { BarChart3, CreditCard, DollarSign, Users } from "lucide-react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminRecentRegistrations } from "@/components/admin/recent-registrations"
import { AdminStats } from "@/components/admin/stats"

export function AdminOverview() {
  const [stats, setStats] = useState({
    totalParticipants: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    completedPayments: 0,
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchStats() {
      try {
        // Get total participants
        const { count: participantsCount } = await supabase
          .from("participants")
          .select("*", { count: "exact", head: true })

        // Get total revenue
        const { data: payments } = await supabase.from("payments").select("amount, status")

        const totalRevenue = payments?.filter((p) => p.status === "verified").reduce((sum, p) => sum + p.amount, 0) || 0

        const pendingPayments = payments?.filter((p) => p.status === "pending").length || 0

        const completedPayments = payments?.filter((p) => p.status === "verified").length || 0

        setStats({
          totalParticipants: participantsCount || 0,
          totalRevenue,
          pendingPayments,
          completedPayments,
        })
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [supabase])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Peserta</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.totalParticipants}</div>
            <p className="text-xs text-muted-foreground">Peserta terdaftar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : `Rp ${stats.totalRevenue.toLocaleString("id-ID")}`}
            </div>
            <p className="text-xs text-muted-foreground">Dari pembayaran terverifikasi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pembayaran Tertunda</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.pendingPayments}</div>
            <p className="text-xs text-muted-foreground">Menunggu verifikasi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pembayaran Selesai</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.completedPayments}</div>
            <p className="text-xs text-muted-foreground">Pembayaran terverifikasi</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="registrations">
        <TabsList>
          <TabsTrigger value="registrations">Pendaftaran Terbaru</TabsTrigger>
          <TabsTrigger value="stats">Statistik</TabsTrigger>
        </TabsList>
        <TabsContent value="registrations" className="space-y-4">
          <AdminRecentRegistrations />
        </TabsContent>
        <TabsContent value="stats" className="space-y-4">
          <AdminStats />
        </TabsContent>
      </Tabs>
    </div>
  )
}
