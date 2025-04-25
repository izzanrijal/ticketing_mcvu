"use client"

import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Download, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// Import the Badge component at the top of the file
import { Badge } from "@/components/ui/badge"

export function AdminParticipants() {
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [participantType, setParticipantType] = useState("all")
  const [resendingEmail, setResendingEmail] = useState<{ [key: string]: boolean }>({})
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchParticipants() {
      try {
        let query = supabase.from("participants").select(`
          *,
          registrations:registration_id (
            id,
            payments (
              status
            )
          )
        `)

        if (participantType !== "all") {
          query = query.eq("participant_type", participantType)
        }

        if (searchQuery) {
          query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        }

        const { data, error } = await query.order("created_at", {
          ascending: false,
        })

        if (error) throw error
        setParticipants(data || [])
      } catch (error) {
        console.error("Error fetching participants:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchParticipants()
  }, [supabase, searchQuery, participantType])

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

  const exportToCSV = () => {
    if (participants.length === 0) return

    // Create CSV content
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

  async function handleResendEmail(participantId: string, email: string) {
    try {
      setResendingEmail((prev) => ({ ...prev, [participantId]: true }))

      const { error } = await supabase.functions.invoke("resend-participant-email", {
        body: { participantId, email },
      })

      if (error) throw error

      // Show success toast or message
      alert(`Email berhasil dikirim ulang ke ${email}`)
    } catch (error) {
      console.error("Error resending email:", error)
      alert(`Gagal mengirim ulang email: ${error.message}`)
    } finally {
      setResendingEmail((prev) => ({ ...prev, [participantId]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Daftar Peserta</h2>
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
          <Button variant="outline" size="icon" onClick={exportToCSV} disabled={participants.length === 0}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
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
              <TableHead>Tanggal Daftar</TableHead>
              <TableHead>Status Kepesertaan</TableHead>
              <TableHead>Aksi</TableHead>
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
              participants.map((participant) => {
                // Get payment status
                const registration = participant.registrations || {}
                const payments = registration.payments || []
                const latestPayment = payments.length > 0 ? payments[0] : null
                const paymentStatus = latestPayment?.status || "N/A"

                // Determine participation status
                const participationStatus = paymentStatus === "verified" ? "Terverifikasi" : "N/A"

                return (
                  <TableRow key={participant.id}>
                    <TableCell className="font-medium">{participant.full_name}</TableCell>
                    <TableCell>{participant.email}</TableCell>
                    <TableCell>{participant.phone}</TableCell>
                    <TableCell>{getParticipantTypeLabel(participant.participant_type)}</TableCell>
                    <TableCell>{participant.institution}</TableCell>
                    <TableCell>{participant.city}</TableCell>
                    <TableCell>{formatDate(participant.created_at)}</TableCell>
                    <TableCell>
                      {paymentStatus === "verified" ? (
                        <Badge variant="success" className="bg-green-100 text-green-800 hover:bg-green-100">
                          Terverifikasi
                        </Badge>
                      ) : paymentStatus === "pending" ? (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                          Menunggu Pembayaran
                        </Badge>
                      ) : paymentStatus === "failed" ? (
                        <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">
                          Gagal
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-gray-100">
                          N/A
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {paymentStatus === "verified" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResendEmail(participant.id, participant.email)}
                          disabled={resendingEmail[participant.id]}
                        >
                          {resendingEmail[participant.id] ? "Mengirim..." : "Kirim Ulang Email"}
                        </Button>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
