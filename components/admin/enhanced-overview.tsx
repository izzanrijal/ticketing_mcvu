"use client"

import { useEffect, useState } from "react"
import { CreditCard, DollarSign, Users, Calendar, CheckCircle } from "lucide-react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminRecentRegistrations } from "@/components/admin/recent-registrations"
import { RegistrationChart } from "@/components/admin/charts/registration-chart"
import { CheckinChart } from "@/components/admin/charts/checkin-chart"
import { ParticipantTypeChart } from "@/components/admin/charts/participant-type-chart"

export function EnhancedOverview() {
  const [stats, setStats] = useState({
    totalParticipants: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    completedPayments: 0,
    totalCheckins: 0,
    workshopRegistrations: 0,
    upcomingWorkshops: 0,
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

        // Get check-in stats
        let checkinsCount = 0
        try {
          const { count } = await supabase.from("check_ins").select("*", { count: "exact", head: true })
          checkinsCount = count || 0
        } catch (error) {
          console.error("Error fetching check-ins:", error)
        }

        // Set stats without workshop data since those tables don't exist
        setStats({
          totalParticipants: participantsCount || 0,
          totalRevenue,
          pendingPayments,
          completedPayments,
          totalCheckins: checkinsCount,
          workshopRegistrations: 0,
          upcomingWorkshops: 0,
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
      <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <CardTitle className="text-sm font-medium">Check-in</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.totalCheckins}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalParticipants > 0
                ? `${Math.round((stats.totalCheckins / stats.totalParticipants) * 100)}% dari total peserta`
                : "Belum ada check-in"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Pendaftaran Harian</CardTitle>
          </CardHeader>
          <CardContent>
            <RegistrationChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status Check-in</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <CheckinChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tipe Peserta</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ParticipantTypeChart />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="registrations">
        <TabsList>
          <TabsTrigger value="registrations">Pendaftaran Terbaru</TabsTrigger>
          <TabsTrigger value="payments">Pembayaran Terbaru</TabsTrigger>
        </TabsList>
        <TabsContent value="registrations" className="space-y-4">
          <AdminRecentRegistrations />
        </TabsContent>
        <TabsContent value="payments" className="space-y-4">
          <RecentPayments />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Placeholder component for upcoming workshops
function UpcomingWorkshops() {
  return (
    <div className="rounded-md border p-8 text-center">
      <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-medium">Belum ada workshop mendatang</h3>
      <p className="mt-2 text-sm text-muted-foreground">Workshop akan ditampilkan di sini saat tersedia.</p>
    </div>
  )
}

// Placeholder component for recent payments
function RecentPayments() {
  return (
    <div className="rounded-md border p-8 text-center">
      <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-medium">Belum ada pembayaran terbaru</h3>
      <p className="mt-2 text-sm text-muted-foreground">Pembayaran terbaru akan ditampilkan di sini.</p>
    </div>
  )
}
