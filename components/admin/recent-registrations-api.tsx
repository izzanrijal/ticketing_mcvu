"use client"

import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function AdminRecentRegistrationsApi() {
  const [registrations, setRegistrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRegistrations() {
      try {
        const response = await fetch("/api/admin/recent-registrations")

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to fetch registrations")
        }

        const data = await response.json()
        setRegistrations(data)
      } catch (err: any) {
        console.error("Error fetching registrations:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchRegistrations()

    // Set up polling for updates every 30 seconds
    const intervalId = setInterval(fetchRegistrations, 30000)

    return () => clearInterval(intervalId)
  }, [])

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
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
      case "other":
        return "Dokter Residen"
      default:
        return "Dokter Residen"
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Menunggu</Badge>
      case "verified":
        return <Badge variant="success">Terverifikasi</Badge>
      case "rejected":
        return <Badge variant="destructive">Ditolak</Badge>
      default:
        return <Badge variant="outline">Menunggu</Badge>
    }
  }

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Registrasi</TableHead>
              <TableHead>Peserta</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7} className="h-12 animate-pulse bg-muted"></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border p-4 bg-red-50 text-red-800">
        <p className="font-medium">Error loading registrations</p>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>No. Registrasi</TableHead>
            <TableHead>Peserta</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead>Jumlah</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {registrations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                Belum ada pendaftaran
              </TableCell>
            </TableRow>
          ) : (
            registrations.map((registration) => {
              return (
                <TableRow key={registration.id}>
                  <TableCell className="font-medium">{registration.registration_number}</TableCell>
                  <TableCell>
                    {registration.participant?.full_name || "N/A"}
                    <div className="text-xs text-muted-foreground">{registration.participant?.email || "N/A"}</div>
                  </TableCell>
                  <TableCell>
                    {registration.participant
                      ? getParticipantTypeLabel(registration.participant.participant_type)
                      : "N/A"}
                  </TableCell>
                  <TableCell>Rp {registration.final_amount.toLocaleString("id-ID")}</TableCell>
                  <TableCell>{getStatusBadge(registration.payment_status)}</TableCell>
                  <TableCell>{formatDate(registration.created_at)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      Detail
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
