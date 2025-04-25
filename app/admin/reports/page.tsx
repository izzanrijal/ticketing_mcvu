"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Download, FileText, Search, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminDashboardLayout } from "@/components/admin/dashboard-layout"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export default function ReportsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUser()
  }, [supabase])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <div>Please log in to access this page.</div>
  }

  return (
    <AdminDashboardLayout user={user} activeTab="reports">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Laporan</h2>
        </div>

        <Tabs defaultValue="participants">
          <TabsList>
            <TabsTrigger value="participants">Peserta</TabsTrigger>
            <TabsTrigger value="payments">Pembayaran</TabsTrigger>
            <TabsTrigger value="checkins">Check-in</TabsTrigger>
            <TabsTrigger value="workshops">Workshop</TabsTrigger>
          </TabsList>
          <TabsContent value="participants" className="space-y-4">
            <ParticipantsReport />
          </TabsContent>
          <TabsContent value="payments" className="space-y-4">
            <PaymentsReport />
          </TabsContent>
          <TabsContent value="checkins" className="space-y-4">
            <CheckinsReport />
          </TabsContent>
          <TabsContent value="workshops" className="space-y-4">
            <WorkshopsReport />
          </TabsContent>
        </Tabs>
      </div>
    </AdminDashboardLayout>
  )
}

function ParticipantsReport() {
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [participantType, setParticipantType] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchParticipants() {
      try {
        // Create a more complex query to get participant data with registration and payment status
        const query = `
          SELECT 
            p.id, 
            p.full_name, 
            p.email, 
            p.phone, 
            p.participant_type, 
            p.institution, 
            p.city, 
            p.province, 
            p.postal_code, 
            p.address,
            p.created_at,
            r.status as registration_status,
            CASE 
              WHEN r.payment_status = true THEN true 
              ELSE false 
            END as is_paid
          FROM 
            participants p
          LEFT JOIN 
            registrations r ON p.id = r.participant_id
          WHERE 
            1=1
            ${participantType !== "all" ? `AND p.participant_type = '${participantType}'` : ""}
            ${searchQuery ? `AND (p.full_name ILIKE '%${searchQuery}%' OR p.email ILIKE '%${searchQuery}%')` : ""}
            ${statusFilter !== "all" ? `AND r.status = '${statusFilter}'` : ""}
          ORDER BY 
            p.created_at DESC
          LIMIT 100
        `

        const { data, error } = await supabase.rpc("execute_sql", { query_text: query })

        if (error) throw error
        setParticipants(data || [])
      } catch (error) {
        console.error("Error fetching participants:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchParticipants()
  }, [supabase, searchQuery, participantType, statusFilter])

  function getParticipantTypeLabel(type: string) {
    switch (type) {
      case "specialist_doctor":
        return "Dokter Spesialis"
      case "general_doctor":
        return "Dokter Umum"
      case "nurse":
        return "Perawat"
      case "student":
        return "Mahasiswa"
      default:
        return "Lainnya"
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  function getStatusBadge(status: string | null, isPaid: boolean) {
    if (!status) return <Badge variant="outline">Belum Terdaftar</Badge>

    switch (status) {
      case "awaiting_payment":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            Menunggu Pembayaran
          </Badge>
        )
      case "paid":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
            Dibayar
          </Badge>
        )
      case "checked_in":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            Check-in
          </Badge>
        )
      case "entried":
        return (
          <Badge variant="outline" className="bg-purple-100 text-purple-800 hover:bg-purple-100">
            Masuk
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const exportToCSV = () => {
    if (participants.length === 0) return

    // Create CSV content with additional columns for payment and status
    const headers = [
      "Nama",
      "Email",
      "Telepon",
      "Tipe Peserta",
      "Institusi",
      "Alamat",
      "Kota",
      "Provinsi",
      "Kode Pos",
      "Status Pembayaran",
      "Status Peserta",
      "Tanggal Daftar",
    ]

    const csvContent = [
      headers.join(","),
      ...participants.map((p) =>
        [
          `"${p.full_name}"`,
          `"${p.email}"`,
          `"${p.phone}"`,
          `"${getParticipantTypeLabel(p.participant_type)}"`,
          `"${p.institution}"`,
          `"${p.address}"`,
          `"${p.city}"`,
          `"${p.province}"`,
          `"${p.postal_code}"`,
          `"${p.is_paid ? "Sudah Dibayar" : "Belum Dibayar"}"`,
          `"${p.registration_status || "Belum Terdaftar"}"`,
          `"${formatDate(p.created_at)}"`,
        ].join(","),
      ),
    ].join("\n")

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `peserta-mcvu-2025-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Laporan Peserta</CardTitle>
        <CardDescription>Daftar semua peserta yang terdaftar dalam acara</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari peserta..."
                className="w-full pl-8 md:w-[250px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={participantType} onValueChange={setParticipantType}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Tipe Peserta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="specialist_doctor">Dokter Spesialis</SelectItem>
                <SelectItem value="general_doctor">Dokter Umum</SelectItem>
                <SelectItem value="nurse">Perawat</SelectItem>
                <SelectItem value="student">Mahasiswa</SelectItem>
                <SelectItem value="other">Lainnya</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status Peserta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="awaiting_payment">Menunggu Pembayaran</SelectItem>
                <SelectItem value="paid">Dibayar</SelectItem>
                <SelectItem value="checked_in">Check-in</SelectItem>
                <SelectItem value="entried">Masuk</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={exportToCSV} disabled={participants.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Institusi</TableHead>
                <TableHead>Kota</TableHead>
                <TableHead>Status Pembayaran</TableHead>
                <TableHead>Status Peserta</TableHead>
                <TableHead>Tanggal Daftar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9} className="h-12 animate-pulse bg-muted"></TableCell>
                  </TableRow>
                ))
              ) : participants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    Tidak ada data peserta
                  </TableCell>
                </TableRow>
              ) : (
                participants.map((participant) => (
                  <TableRow key={participant.id}>
                    <TableCell className="font-medium">{participant.full_name}</TableCell>
                    <TableCell>{participant.email}</TableCell>
                    <TableCell>{participant.phone}</TableCell>
                    <TableCell>{getParticipantTypeLabel(participant.participant_type)}</TableCell>
                    <TableCell>{participant.institution}</TableCell>
                    <TableCell>{participant.city}</TableCell>
                    <TableCell>
                      {participant.is_paid ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                          Sudah Dibayar
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">
                          Belum Dibayar
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(participant.registration_status, participant.is_paid)}</TableCell>
                    <TableCell>{formatDate(participant.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function PaymentsReport() {
  // Placeholder for payments report
  return (
    <Card>
      <CardHeader>
        <CardTitle>Laporan Pembayaran</CardTitle>
        <CardDescription>Daftar semua pembayaran yang telah dilakukan</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-10">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Laporan Pembayaran</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          Laporan ini akan menampilkan semua pembayaran yang telah dilakukan oleh peserta, termasuk status verifikasi
          dan detail transaksi.
        </p>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Laporan Pembayaran
        </Button>
      </CardContent>
    </Card>
  )
}

function CheckinsReport() {
  // Placeholder for check-ins report
  return (
    <Card>
      <CardHeader>
        <CardTitle>Laporan Check-in</CardTitle>
        <CardDescription>Daftar semua check-in peserta pada acara</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-10">
        <Users className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Laporan Check-in</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          Laporan ini akan menampilkan semua check-in peserta pada acara symposium dan workshop.
        </p>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Laporan Check-in
        </Button>
      </CardContent>
    </Card>
  )
}

function WorkshopsReport() {
  // Placeholder for workshops report
  return (
    <Card>
      <CardHeader>
        <CardTitle>Laporan Workshop</CardTitle>
        <CardDescription>Daftar semua workshop dan peserta yang terdaftar</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-10">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Laporan Workshop</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          Laporan ini akan menampilkan semua workshop dan peserta yang terdaftar pada masing-masing workshop.
        </p>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Laporan Workshop
        </Button>
      </CardContent>
    </Card>
  )
}
