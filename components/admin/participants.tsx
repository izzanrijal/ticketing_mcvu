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
      setLoading(true)
      try {
        // Use the registration_summary view to get participants with their registration data
        let query = supabase
          .from('registration_summary')
          .select('*')
          .order('created_at', { ascending: false })
        
        // Apply filters if needed
        if (participantType !== "all") {
          query = query.eq('participant_type', participantType)
        }
        
        if (searchQuery) {
          query = query.or(
            `full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
          )
        }
        
        const { data, error } = await query
        
        if (error) {
          console.error("Error fetching participant data:", error)
          throw error
        }
        
        console.log("Participant data from view:", JSON.stringify(data, null, 2))
        
        // Transform the data to match the expected format
        // Filter out entries where participant_id is null
        const enrichedParticipants = (data || [])
          .filter(item => item.participant_id !== null)
          .map(item => ({
            id: item.participant_id,
            full_name: item.full_name,
            email: item.email || '',
            phone: item.phone || '',
            participant_type: item.participant_type || 'other',
            institution: item.institution || '',
            created_at: item.created_at,
            registration_id: item.registration_id,
            registration: {
              id: item.registration_id,
              registration_number: item.registration_number || "Belum Terdaftar"
            }
          }))
        
        console.log('Enriched participants:', enrichedParticipants)
        setParticipants(enrichedParticipants)
      } catch (error) {
        console.error("Error in fetchParticipants:", error)
        
        // Fallback to the original method if the view doesn't exist or there's an error
        try {
          console.log("Falling back to original method...")
          // Fetch participants directly
          let { data: participantsData, error: participantsError } = await supabase
            .from('participants')
            .select('*')
            .order('created_at', { ascending: false })
            
          if (participantsError) {
            console.error("Error fetching participants:", participantsError)
            throw participantsError
          }
          
          // Handle filtering
          let filteredParticipants = participantsData || []
          
          if (participantType !== "all") {
            filteredParticipants = filteredParticipants.filter(p => p.participant_type === participantType)
          }

          if (searchQuery) {
            filteredParticipants = filteredParticipants.filter(p => 
              p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
              p.email?.toLowerCase().includes(searchQuery.toLowerCase())
            )
          }
          
          // Set participants without registration data
          const simpleParticipants = filteredParticipants.map(participant => ({
            ...participant,
            registration: {
              id: null,
              registration_number: "Belum Terdaftar"
            }
          }))
          
          setParticipants(simpleParticipants)
        } catch (fallbackError) {
          console.error("Error in fallback method:", fallbackError)
          setParticipants([])
        }
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

      if (error) {
        console.error("Error resending email:", error instanceof Error ? error.message : String(error))
        alert(`Gagal mengirim ulang email: ${error instanceof Error ? error.message : String(error)}`)
      } else {
        // Show success toast or message
        alert(`Email berhasil dikirim ulang ke ${email}`)
      }
    } catch (error) {
      console.error("Error resending email:", error instanceof Error ? error.message : String(error))
      alert(`Gagal mengirim ulang email: ${error instanceof Error ? error.message : String(error)}`)
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
              <TableHead>Nomor Registrasi</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Institusi</TableHead>
              <TableHead>Tanggal Daftar</TableHead>
              <TableHead>Status Pembayaran</TableHead>
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
                // Access the registration data from our enriched object
                const registration = participant.registration || {}
                const registrationNumber = registration.registration_number || "N/A"
                
                // Use a dynamically determined status based on participant data
                // This is a placeholder until we can properly join with payments table
                let paymentStatus = participant.registration_id ? 'pending' as const : 'N/A' as const

                return (
                  <TableRow key={participant.id}>
                    <TableCell>{registrationNumber}</TableCell>
                    <TableCell className="font-medium">{participant.full_name}</TableCell>
                    <TableCell>{participant.email}</TableCell>
                    <TableCell>{participant.phone}</TableCell>
                    <TableCell>{getParticipantTypeLabel(participant.participant_type)}</TableCell>
                    <TableCell>{participant.institution}</TableCell>
                    <TableCell>{formatDate(participant.created_at)}</TableCell>
                    <TableCell>
                      {(() => {
                        // Using an IIFE to handle the payment status display
                        // This avoids TypeScript narrowing issues with the conditional rendering
                        if (paymentStatus === "pending") {
                          return (
                            <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                              Menunggu Pembayaran
                            </Badge>
                          );
                        } else if (paymentStatus === "N/A") {
                          return (
                            <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
                              Belum Terdaftar
                            </Badge>
                          );
                        } else {
                          // This branch should never be reached with current implementation
                          // But keeping it for future extension
                          return (
                            <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
                              {paymentStatus}
                            </Badge>
                          );
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      {/* Only show resend button for verified payments in the future */}
                      <span className="text-gray-400 text-sm">-</span>
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
