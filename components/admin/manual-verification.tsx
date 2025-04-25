"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Search, Check, Eye, Upload } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { Textarea } from "@/components/ui/textarea"

export function ManualVerification() {
  const [registrations, setRegistrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false)
  const [manualPaymentData, setManualPaymentData] = useState({
    amount: "",
    notes: "",
  })
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchRegistrations()
  }, [searchQuery, statusFilter])

  async function fetchRegistrations() {
    try {
      setLoading(true)

      // Create a query to get registration data with participant information
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
          r.payment_notes,
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
          ${statusFilter !== "all" ? `AND r.status = '${statusFilter}'` : ""}
        ORDER BY 
          r.created_at DESC
      `

      const { data, error } = await supabase.rpc("execute_sql", { query_text: query })

      if (error) throw error

      // Ensure data is an array before setting it to state
      setRegistrations(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching registrations:", error)
      toast({
        title: "Error",
        description: "Failed to fetch registration data. Please try again.",
        variant: "destructive",
      })
      // Set registrations to empty array on error
      setRegistrations([])
    } finally {
      setLoading(false)
    }
  }

  async function verifyRegistration(registrationId: string, status: string) {
    try {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        toast({
          title: "Error",
          description: "You must be logged in to verify registrations.",
          variant: "destructive",
        })
        return
      }

      const { error } = await supabase
        .from("registrations")
        .update({
          status: status,
          payment_status: status === "paid",
          payment_verified_at: new Date().toISOString(),
          payment_verified_by: userData.user.id,
        })
        .eq("id", registrationId)

      if (error) throw error

      toast({
        title: "Success",
        description: `Registration ${status === "paid" ? "verified" : "updated"} successfully.`,
      })

      // Refresh the registrations list
      fetchRegistrations()
      setDetailsOpen(false)
    } catch (error) {
      console.error("Error verifying registration:", error)
      toast({
        title: "Error",
        description: "Failed to verify registration. Please try again.",
        variant: "destructive",
      })
    }
  }

  async function addManualPayment(registrationId: string) {
    try {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        toast({
          title: "Error",
          description: "You must be logged in to add manual payments.",
          variant: "destructive",
        })
        return
      }

      const amount = Number.parseFloat(manualPaymentData.amount)
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: "Error",
          description: "Please enter a valid payment amount.",
          variant: "destructive",
        })
        return
      }

      const { error } = await supabase
        .from("registrations")
        .update({
          payment_amount: amount,
          payment_date: new Date().toISOString(),
          payment_status: true,
          payment_verified_at: new Date().toISOString(),
          payment_verified_by: userData.user.id,
          payment_notes: manualPaymentData.notes || "Manual payment by admin",
          status: "paid",
        })
        .eq("id", registrationId)

      if (error) throw error

      toast({
        title: "Success",
        description: "Manual payment added successfully.",
      })

      // Reset form and close dialog
      setManualPaymentData({
        amount: "",
        notes: "",
      })
      setManualPaymentOpen(false)

      // Refresh the registrations list
      fetchRegistrations()
    } catch (error) {
      console.error("Error adding manual payment:", error)
      toast({
        title: "Error",
        description: "Failed to add manual payment. Please try again.",
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

  function formatCurrency(amount: number | null) {
    if (amount === null) return "-"
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  function getStatusBadge(status: string) {
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

  const viewDetails = (registration: any) => {
    setSelectedRegistration(registration)
    setDetailsOpen(true)
  }

  const openManualPayment = (registration: any) => {
    setSelectedRegistration(registration)
    setManualPaymentOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Verifikasi Manual</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Registrasi</CardTitle>
          <CardDescription>Verifikasi manual registrasi dan pembayaran peserta</CardDescription>
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
                  <SelectValue placeholder="Status Registrasi" />
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
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pembayaran</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="h-12 animate-pulse bg-muted"></TableCell>
                    </TableRow>
                  ))
                ) : !registrations || registrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Tidak ada data registrasi
                    </TableCell>
                  </TableRow>
                ) : (
                  registrations.map((registration) => (
                    <TableRow key={registration.registration_id}>
                      <TableCell className="font-medium">{registration.full_name}</TableCell>
                      <TableCell>{registration.email}</TableCell>
                      <TableCell>{getParticipantTypeLabel(registration.participant_type)}</TableCell>
                      <TableCell>{getStatusBadge(registration.registration_status)}</TableCell>
                      <TableCell>{formatCurrency(registration.payment_amount)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => viewDetails(registration)}
                            title="Lihat Detail"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {registration.registration_status === "awaiting_payment" && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openManualPayment(registration)}
                              title="Tambah Pembayaran Manual"
                            >
                              <Upload className="h-4 w-4" />
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

      {/* Registration Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Registrasi</DialogTitle>
            <DialogDescription>Informasi registrasi untuk {selectedRegistration?.full_name}</DialogDescription>
          </DialogHeader>
          {selectedRegistration && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nama</p>
                  <p>{selectedRegistration.full_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p>{selectedRegistration.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Telepon</p>
                  <p>{selectedRegistration.phone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tipe Peserta</p>
                  <p>{getParticipantTypeLabel(selectedRegistration.participant_type)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p>{getStatusBadge(selectedRegistration.registration_status)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Jumlah Pembayaran</p>
                  <p>{formatCurrency(selectedRegistration.payment_amount)}</p>
                </div>
                {selectedRegistration.payment_date && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tanggal Pembayaran</p>
                    <p>{formatDate(selectedRegistration.payment_date)}</p>
                  </div>
                )}
                {selectedRegistration.payment_verified_at && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tanggal Verifikasi</p>
                    <p>{formatDate(selectedRegistration.payment_verified_at)}</p>
                  </div>
                )}
                {selectedRegistration.payment_notes && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Catatan Pembayaran</p>
                    <p>{selectedRegistration.payment_notes}</p>
                  </div>
                )}
              </div>

              {selectedRegistration.payment_proof && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Bukti Pembayaran</p>
                  <div className="border rounded-md overflow-hidden">
                    <img
                      src={selectedRegistration.payment_proof || "/placeholder.svg"}
                      alt="Bukti Pembayaran"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              )}

              <DialogFooter className="flex justify-between sm:justify-between">
                <div className="flex gap-2">
                  {selectedRegistration.registration_status === "awaiting_payment" && (
                    <Button
                      variant="default"
                      onClick={() => verifyRegistration(selectedRegistration.registration_id, "paid")}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Verifikasi Pembayaran
                    </Button>
                  )}
                  {selectedRegistration.registration_status === "paid" && (
                    <Button
                      variant="default"
                      onClick={() => verifyRegistration(selectedRegistration.registration_id, "checked_in")}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Check-in Peserta
                    </Button>
                  )}
                </div>
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Payment Dialog */}
      <Dialog open={manualPaymentOpen} onOpenChange={setManualPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Pembayaran Manual</DialogTitle>
            <DialogDescription>Tambahkan pembayaran manual untuk {selectedRegistration?.full_name}</DialogDescription>
          </DialogHeader>
          {selectedRegistration && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Jumlah Pembayaran</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Masukkan jumlah pembayaran"
                  value={manualPaymentData.amount}
                  onChange={(e) => setManualPaymentData({ ...manualPaymentData, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Catatan</Label>
                <Textarea
                  id="notes"
                  placeholder="Masukkan catatan pembayaran (opsional)"
                  value={manualPaymentData.notes}
                  onChange={(e) => setManualPaymentData({ ...manualPaymentData, notes: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="default"
                  onClick={() => addManualPayment(selectedRegistration.registration_id)}
                  disabled={!manualPaymentData.amount}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Simpan Pembayaran
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Add missing Label component
function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
    >
      {children}
    </label>
  )
}
