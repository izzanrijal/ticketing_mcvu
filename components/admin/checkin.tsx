"use client"

import { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { QrCode, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

export function AdminCheckin() {
  const [searchQuery, setSearchQuery] = useState("")
  const [scanning, setScanning] = useState(false)
  const [participant, setParticipant] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  async function handleSearch() {
    if (!searchQuery) return

    setLoading(true)
    try {
      // Search by registration number or participant name/email
      const { data, error } = await supabase
        .from("registrations")
        .select(`
          *,
          registration_items (
            *,
            participant:participants (*),
            ticket:tickets (*)
          ),
          payments (*)
        `)
        .or(
          `registration_number.ilike.%${searchQuery}%,registration_items.participant.full_name.ilike.%${searchQuery}%,registration_items.participant.email.ilike.%${searchQuery}%`,
        )
        .eq("status", "paid")
        .single()

      if (error) throw error

      if (data) {
        setParticipant({
          registration: data,
          participant: data.registration_items[0]?.participant,
          ticket: data.registration_items[0]?.ticket,
        })
      } else {
        toast({
          title: "Tidak Ditemukan",
          description: "Peserta tidak ditemukan atau belum melakukan pembayaran",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error searching participant:", error)
      toast({
        title: "Gagal",
        description: "Terjadi kesalahan saat mencari peserta",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckin() {
    if (!participant) return

    setLoading(true)
    try {
      // Check if already checked in
      const { data: existingCheckin } = await supabase
        .from("check_ins")
        .select("*")
        .eq("registration_item_id", participant.registration.registration_items[0].id)
        .is("workshop_id", null)

      if (existingCheckin && existingCheckin.length > 0) {
        toast({
          title: "Sudah Check-in",
          description: "Peserta ini sudah melakukan check-in sebelumnya",
          variant: "default",
        })
        setParticipant(null)
        setSearchQuery("")
        return
      }

      // Create check-in record
      const { error } = await supabase.from("check_ins").insert({
        registration_item_id: participant.registration.registration_items[0].id,
        checked_in_by: "00000000-0000-0000-0000-000000000000", // Replace with actual admin ID
      })

      if (error) throw error

      toast({
        title: "Check-in Berhasil",
        description: `${participant.participant.full_name} telah berhasil check-in`,
      })

      setParticipant(null)
      setSearchQuery("")
    } catch (error) {
      console.error("Error checking in:", error)
      toast({
        title: "Gagal",
        description: "Terjadi kesalahan saat melakukan check-in",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Check-in Peserta</h2>
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex w-full gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari dengan nomor registrasi atau nama..."
                className="w-full pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch()
                  }
                }}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading || !searchQuery}>
              Cari
            </Button>
          </div>
          <Dialog open={scanning} onOpenChange={setScanning}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <QrCode className="mr-2 h-4 w-4" />
                Scan QR
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Scan QR Code</DialogTitle>
                <DialogDescription>Arahkan kamera ke QR code peserta untuk melakukan check-in</DialogDescription>
              </DialogHeader>
              <div className="flex h-64 items-center justify-center rounded-md bg-muted">
                <p className="text-center text-muted-foreground">Fitur QR scanner akan diimplementasikan di sini</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setScanning(false)}>
                  Batal
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {participant && (
        <Card>
          <CardHeader>
            <CardTitle>Detail Peserta</CardTitle>
            <CardDescription>No. Registrasi: {participant.registration.registration_number}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium">Informasi Peserta</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Nama</div>
                  <div>{participant.participant.full_name}</div>
                  <div className="text-muted-foreground">Email</div>
                  <div>{participant.participant.email}</div>
                  <div className="text-muted-foreground">Telepon</div>
                  <div>{participant.participant.phone}</div>
                  <div className="text-muted-foreground">Tipe</div>
                  <div>{getParticipantTypeLabel(participant.participant.participant_type)}</div>
                  <div className="text-muted-foreground">Institusi</div>
                  <div>{participant.participant.institution}</div>
                </div>
              </div>
              <div>
                <h3 className="font-medium">Informasi Tiket</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Paket</div>
                  <div>{participant.ticket.name}</div>
                  <div className="text-muted-foreground">Deskripsi</div>
                  <div>{participant.ticket.description}</div>
                  <div className="text-muted-foreground">Jumlah</div>
                  <div>Rp {participant.registration.final_amount.toLocaleString("id-ID")}</div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleCheckin} disabled={loading}>
              {loading ? "Memproses..." : "Check-in Peserta"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {!participant && (
        <Card>
          <CardHeader>
            <CardTitle>Check-in Peserta</CardTitle>
            <CardDescription>
              Cari peserta dengan nomor registrasi, nama, atau email, atau scan QR code untuk melakukan check-in
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-64 items-center justify-center">
            <p className="text-center text-muted-foreground">Hasil pencarian akan ditampilkan di sini</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
