"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Download, Search, Check, X, Eye } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"

export function AdminPayments() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false)
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchPayments()
  }, [searchQuery, statusFilter])

  async function fetchPayments() {
    try {
      setLoading(true)

      // Create a query to get payment data with participant information
      const query = `
        SELECT 
          r.id as registration_id,
          r.payment_proof,
          r.payment_amount,
          r.payment_date,
          r.payment_status,
          r.payment_verified_at,
          r.payment_verified_by,
          r.status as registration_status,
          p.id as participant_id,
          p.full_name,
          p.email,
          p.phone,
          p.participant_type
        FROM 
          registrations r
        JOIN 
          participants p ON r.participant_id = p.id
        WHERE 
          1=1
          ${searchQuery ? `AND (p.full_name ILIKE '%${searchQuery}%' OR p.email ILIKE '%${searchQuery}%')` : ""}
          ${
            statusFilter !== "all"
              ? statusFilter === "verified"
                ? `AND r.payment_status = true`
                : statusFilter === "unverified"
                  ? `AND r.payment_status = false AND r.payment_proof IS NOT NULL`
                  : `AND r.payment_proof IS NULL`
              : ""
          }
        ORDER BY 
          r.payment_date DESC NULLS LAST,
          r.created_at DESC
      `

      const { data, error } = await supabase.rpc("execute_sql", { query_text: query })

      if (error) throw error
      setPayments(data || [])
    } catch (error) {
      console.error("Error fetching payments:", error)
      toast({
        title: "Error",
        description: "Failed to fetch payment data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function verifyPayment(registrationId: string, verified: boolean) {
    try {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        toast({
          title: "Error",
          description: "You must be logged in to verify payments.",
          variant: "destructive",
        })
        return
      }

      const { error } = await supabase
        .from("registrations")
        .update({
          payment_status: verified,
          payment_verified_at: new Date().toISOString(),
          payment_verified_by: userData.user.id,
          status: verified ? "paid" : "awaiting_payment",
        })
        .eq("id", registrationId)

      if (error) throw error

      toast({
        title: "Success",
        description: `Payment ${verified ? "verified" : "rejected"} successfully.`,
      })

      // Refresh the payments list
      fetchPayments()
    } catch (error) {
      console.error("Error verifying payment:", error)
      toast({
        title: "Error",
        description: "Failed to verify payment. Please try again.",
        variant: "destructive",
      })
    }
  }

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

  function formatDate(dateString: string | null) {
    if (!dateString) return "-"
    return format(new Date(dateString), "dd MMM yyyy, HH:mm")
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  function getPaymentStatusBadge(payment: any) {
    if (!payment.payment_proof) {
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-gray-100">
          Belum Upload Bukti
        </Badge>
      )
    }

    if (payment.payment_status) {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
          Terverifikasi
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
        Menunggu Verifikasi
      </Badge>
    )
  }

  const exportToCSV = () => {
    if (payments.length === 0) return

    // Create CSV content
    const headers = [
      "Nama",
      "Email",
      "Telepon",
      "Tipe Peserta",
      "Jumlah Pembayaran",
      "Tanggal Pembayaran",
      "Status Pembayaran",
      "Tanggal Verifikasi",
    ]

    const csvContent = [
      headers.join(","),
      ...payments.map((p) =>
        [
          `"${p.full_name}"`,
          `"${p.email}"`,
          `"${p.phone}"`,
          `"${getParticipantTypeLabel(p.participant_type)}"`,
          `"${formatCurrency(p.payment_amount || 0)}"`,
          `"${formatDate(p.payment_date)}"`,
          `"${p.payment_status ? "Terverifikasi" : p.payment_proof ? "Menunggu Verifikasi" : "Belum Upload Bukti"}"`,
          `"${formatDate(p.payment_verified_at)}"`,
        ].join(","),
      ),
    ].join("\n")

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `pembayaran-mcvu-2025-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const viewPaymentDetails = (payment: any) => {
    setSelectedPayment(payment)
    setPaymentDetailsOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Pembayaran</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Pembayaran</CardTitle>
          <CardDescription>Kelola dan verifikasi pembayaran peserta</CardDescription>
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status Pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="verified">Terverifikasi</SelectItem>
                  <SelectItem value="unverified">Menunggu Verifikasi</SelectItem>
                  <SelectItem value="no_proof">Belum Upload Bukti</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={exportToCSV} disabled={payments.length === 0}>
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
                  <TableHead>Tipe</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="h-12 animate-pulse bg-muted"></TableCell>
                    </TableRow>
                  ))
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Tidak ada data pembayaran
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.registration_id}>
                      <TableCell className="font-medium">{payment.full_name}</TableCell>
                      <TableCell>{payment.email}</TableCell>
                      <TableCell>{getParticipantTypeLabel(payment.participant_type)}</TableCell>
                      <TableCell>{formatCurrency(payment.payment_amount || 0)}</TableCell>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell>{getPaymentStatusBadge(payment)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {payment.payment_proof && !payment.payment_status && (
                            <>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => verifyPayment(payment.registration_id, true)}
                                title="Verifikasi Pembayaran"
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => verifyPayment(payment.registration_id, false)}
                                title="Tolak Pembayaran"
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                          {payment.payment_proof && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => viewPaymentDetails(payment)}
                              title="Lihat Detail"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Details Dialog */}
      <Dialog open={paymentDetailsOpen} onOpenChange={setPaymentDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Pembayaran</DialogTitle>
            <DialogDescription>Informasi pembayaran untuk {selectedPayment?.full_name}</DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nama</p>
                  <p>{selectedPayment.full_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p>{selectedPayment.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Jumlah</p>
                  <p>{formatCurrency(selectedPayment.payment_amount || 0)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tanggal</p>
                  <p>{formatDate(selectedPayment.payment_date)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p>{selectedPayment.payment_status ? "Terverifikasi" : "Menunggu Verifikasi"}</p>
                </div>
                {selectedPayment.payment_verified_at && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tanggal Verifikasi</p>
                    <p>{formatDate(selectedPayment.payment_verified_at)}</p>
                  </div>
                )}
              </div>

              {selectedPayment.payment_proof && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Bukti Pembayaran</p>
                  <div className="border rounded-md overflow-hidden">
                    <img
                      src={selectedPayment.payment_proof || "/placeholder.svg"}
                      alt="Bukti Pembayaran"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              )}

              {!selectedPayment.payment_status && selectedPayment.payment_proof && (
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      verifyPayment(selectedPayment.registration_id, true)
                      setPaymentDetailsOpen(false)
                    }}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Verifikasi
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      verifyPayment(selectedPayment.registration_id, false)
                      setPaymentDetailsOpen(false)
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Tolak
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
