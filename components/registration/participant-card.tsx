"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import type { Participant } from "./registration-flow"
import { Badge } from "@/components/ui/badge"

interface ParticipantCardProps {
  participant: Participant
  index: number
  ticketId: string
  onUpdate: (participant: Participant) => void
}

export function ParticipantCard({ participant, index, ticketId, onUpdate }: ParticipantCardProps) {
  const [ticketDetails, setTicketDetails] = useState<any>(null)
  const [workshops, setWorkshops] = useState<any[]>([])
  const supabase = createClientComponentClient()
  const [participantData, setParticipantData] = useState<Participant>(participant)

  useEffect(() => {
    setParticipantData(participant)
  }, [participant])

  // Tambahkan logging lebih detail untuk memeriksa respons dari Supabase
  useEffect(() => {
    async function fetchData() {
      try {
        let resolvedTicketId = ticketId
        if (ticketId && ticketId !== "invalid-format") {
          console.log(`fetchData: Using provided ticketId: ${ticketId}`)
          // Valid ticketId provided
          const { data, error } = await supabase
            .from("tickets")
            .select("*") // Select all fields, not just id
            .eq("id", ticketId)
            .single()

          if (error) {
            console.error(`Error fetching ticket with ID ${ticketId}:`, error)
            // Log more details about the error
            console.log("Error code:", error.code)
            console.log("Error message:", error.message)
            console.log("Error details:", error.details)
          } else if (data) {
            console.log("Ticket data fetched successfully:", data)
            setTicketDetails(data)
          } else {
            console.log(`No ticket data found for ID: ${ticketId}`)
          }
        } else {
          // No valid ticketId provided, use default
          const defaultTicketId = "7a15592e-b7a1-4ff8-b289-512f213e5b77"
          resolvedTicketId = defaultTicketId
          console.log(`fetchData: No valid ticketId prop, using default: ${defaultTicketId}`)
          const { data, error } = await supabase
            .from("tickets")
            .select("*") // Select all fields, not just id
            .eq("id", defaultTicketId)
            .single()

          if (error) {
            console.error(`Error fetching default ticket with ID ${defaultTicketId}:`, error)
            // Log more details about the error
            console.log("Error code:", error.code)
            console.log("Error message:", error.message)
            console.log("Error details:", error.details)
          } else if (data) {
            console.log("Default ticket data fetched successfully:", data)
            setTicketDetails(data)
          }
        }

        // Fetch workshops
        const { data: workshopsData, error: workshopsError } = await supabase
          .from("workshops")
          .select("*")
          .order("sort_order", { ascending: true })

        if (workshopsError) {
          console.error("Error fetching workshops:", workshopsError)
          console.log("Error code:", workshopsError.code)
          console.log("Error message:", workshopsError.message)
          console.log("Error details:", workshopsError.details)
        } else {
          console.log("Workshops data fetched successfully:", workshopsData)
          setWorkshops(workshopsData || [])
        }
      } catch (error) {
        console.error("Error in fetchData:", error)
      }
    }

    fetchData()
  }, [supabase, ticketId])

  const handleChange = (e: any) => {
    const { name, value } = e.target
    setParticipantData((prev) => ({ ...prev, [name]: value }))
    onUpdate({
      ...participantData,
      [name]: value,
    })
  }

  const handleWorkshopToggle = (workshopId: string) => {
    const currentWorkshops = participantData.workshops || []
    const updatedWorkshops = currentWorkshops.includes(workshopId)
      ? currentWorkshops.filter((id) => id !== workshopId)
      : [...currentWorkshops, workshopId]

    // Update state
    const newParticipantData = {
      ...participantData,
      workshops: updatedWorkshops,
    }

    setParticipantData(newParticipantData)
    onUpdate(newParticipantData)
  }

  const handleSymposiumToggle = () => {
    const updatedParticipant = {
      ...participantData,
      attendSymposium: !participantData.attendSymposium,
    }
    setParticipantData(updatedParticipant)
    onUpdate(updatedParticipant)
  }

  function formatDate(dateString: string) {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  function formatTime(dateString: string) {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peserta {index + 1}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Personal Information */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`full-name-${index}`}>
              Nama Lengkap (Disertai Gelar) <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`full-name-${index}`}
              name="full_name"
              value={participantData.full_name}
              onChange={handleChange}
              placeholder="Masukkan nama lengkap disertai gelar"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`email-${index}`}>
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`email-${index}`}
              name="email"
              type="email"
              value={participantData.email}
              onChange={handleChange}
              placeholder="nama@email.com"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`phone-${index}`}>
              Nomor Telepon (Whatsapp) <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`phone-${index}`}
              name="phone"
              value={participantData.phone}
              onChange={handleChange}
              placeholder="08xxxxxxxxxx"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`nik-${index}`}>
              NIK (Untuk keperluan sertifikat) <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`nik-${index}`}
              name="nik"
              value={participantData.nik}
              onChange={handleChange}
              placeholder="16 digit NIK"
              required
            />
            <p className="text-xs text-muted-foreground">Masukkan 16 digit NIK tanpa spasi</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`participant-type-${index}`}>
            Kategori Peserta <span className="text-red-500">*</span>
          </Label>
          <Select
            name="participant_type"
            value={participantData.participant_type}
            onValueChange={(value) => handleChange({ target: { name: "participant_type", value } })}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih tipe peserta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="specialist_doctor">Dokter Spesialis</SelectItem>
              <SelectItem value="general_doctor">Dokter Umum</SelectItem>
              <SelectItem value="nurse">Perawat</SelectItem>
              <SelectItem value="student">Mahasiswa</SelectItem>
              <SelectItem value="other">Dokter Residen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`institution-${index}`}>
            Asal Institusi <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`institution-${index}`}
            name="institution"
            value={participantData.institution}
            onChange={handleChange}
            placeholder="Nama institusi"
            required
          />
        </div>

        <Separator />

        {/* Event Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Pilihan Acara</h3>
            <div className="text-sm text-red-500 font-medium">* Wajib pilih minimal satu acara</div>
          </div>

          {/* Symposium Option - PASTIKAN INI SELALU MUNCUL */}
          <div className="mb-4 border rounded-md p-4 hover:bg-slate-50">
            <div className="flex items-start space-x-3 space-y-0">
              <Checkbox
                id={`symposium-${index}`}
                checked={participantData.attendSymposium === true}
                onCheckedChange={handleSymposiumToggle}
              />
              <div className="space-y-1 leading-none w-full">
                <Label htmlFor={`symposium-${index}`} className="text-base font-medium cursor-pointer">
                  {ticketDetails?.name || "Simposium Utama"}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {ticketDetails?.description || "Memuat deskripsi simposium..."}
                </p>
                <div className="flex items-center mt-1">
                  {!participantData.participant_type ? (
                    <Badge variant="outline" className="text-amber-600">
                      Pilih tipe peserta untuk melihat harga
                    </Badge>
                  ) : !ticketDetails ? (
                    <Badge variant="outline">Memuat data tiket...</Badge>
                  ) : (
                    <Badge variant="outline">
                      Rp {(() => {
                        const priceKey = `price_${participantData.participant_type}`
                        const price = ticketDetails[priceKey]
                        
                        // Add detailed logging for debugging
                        console.log('Price calculation:', {
                          participantType: participantData.participant_type,
                          priceKey,
                          ticketDetails,
                          price
                        })

                        if (price !== undefined && price !== null) {
                          return price.toLocaleString("id-ID")
                        } else {
                          console.log(`Harga tidak ditemukan untuk ${priceKey} dalam:`, ticketDetails)
                          return "0"
                        }
                      })()}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Workshop Selection */}
          <div className="space-y-2">
            <h4 className="font-medium">Workshop (Opsional)</h4>
            <p className="text-sm text-muted-foreground">Pilih workshop yang ingin diikuti</p>

            <div className="space-y-3 mt-3">
              {workshops && workshops.length > 0 ? (
                workshops.map((workshop) => {
                  const isSelected = participantData.workshops?.includes(workshop.id) || false

                  return (
                    <div
                      key={workshop.id}
                      className="flex items-start space-x-3 space-y-0 border rounded-md p-4 hover:bg-slate-50"
                    >
                      <Checkbox
                        id={`workshop-${index}-${workshop.id}`}
                        checked={isSelected}
                        onCheckedChange={() => handleWorkshopToggle(workshop.id)}
                      />
                      <div className="space-y-1 leading-none">
                        <Label
                          htmlFor={`workshop-${index}-${workshop.id}`}
                          className="text-base font-medium cursor-pointer"
                        >
                          {workshop.title}
                        </Label>
                        <p className="text-sm text-muted-foreground">{workshop.description}</p>
                        <div className="flex items-center mt-1">
                          <Badge variant="outline">Rp {workshop.price?.toLocaleString("id-ID") || "0"}</Badge>
                        </div>
                        {workshop.location && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Lokasi: {workshop.location} - {formatDate(workshop.start_time)} (
                            {formatTime(workshop.start_time)} - {formatTime(workshop.end_time)})
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground italic">Tidak ada workshop tersedia</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
