"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { z } from "zod"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import type { Participant } from "./registration-flow"
import { Label } from "@/components/ui/label"

// NIK validation function
function validateNIK(nik: string) {
  // Basic validation: 16 digits
  return /^\d{16}$/.test(nik)
}

// Form schema for contact person
const contactPersonSchema = z.object({
  name: z.string().min(3, {
    message: "Nama lengkap harus minimal 3 karakter",
  }),
  email: z.string().email({
    message: "Email tidak valid",
  }),
  phone: z.string().min(10, {
    message: "Nomor telepon tidak valid",
  }),
})

// Form schema for a single participant
const participantSchema = z.object({
  full_name: z.string().min(3, {
    message: "Nama lengkap harus minimal 3 karakter",
  }),
  email: z.string().email({
    message: "Email tidak valid",
  }),
  phone: z.string().min(10, {
    message: "Nomor telepon tidak valid",
  }),
  nik: z.string().refine(validateNIK, {
    message: "NIK harus 16 digit angka",
  }),
  participant_type: z.string({
    required_error: "Pilih tipe peserta",
  }),
  institution: z.string().min(3, {
    message: "Institusi harus minimal 3 karakter",
  }),
  address: z.string().min(5, {
    message: "Alamat harus minimal 5 karakter",
  }),
  city: z.string().min(3, {
    message: "Kota harus minimal 3 karakter",
  }),
  province: z.string().min(3, {
    message: "Provinsi harus minimal 3 karakter",
  }),
  postal_code: z.string().min(5, {
    message: "Kode pos harus minimal 5 karakter",
  }),
  workshops: z.array(z.string()).optional(),
})

interface ParticipantDetailsProps {
  participants: Participant[]
  ticketId: string
  onNext: (participants: Participant[], contactPerson: any, ticketId?: string) => void
  onBack: () => void
}

export function ParticipantDetails({ participants, ticketId, onNext, onBack }: ParticipantDetailsProps) {
  const [activeTab, setActiveTab] = useState("contact")
  const [contactPerson, setContactPerson] = useState({
    name: "",
    email: "",
    phone: "",
  })
  const [participantForms, setParticipantForms] = useState<Participant[]>(participants)
  const [ticketDetails, setTicketDetails] = useState<any>(null)
  const [workshops, setWorkshops] = useState<any[]>([])
  const [selectedWorkshops, setSelectedWorkshops] = useState<Record<string, string[]>>({})
  const [totalPrice, setTotalPrice] = useState(0)
  const [workshopPrices, setWorkshopPrices] = useState<Record<string, number>>({})
  const [ticketPrices, setTicketPrices] = useState<Record<string, number>>({})
  const [attendSymposium, setAttendSymposium] = useState<Record<string, boolean>>({})
  const supabase = createClientComponentClient()

  // Initialize state for each participant
  useEffect(() => {
    const initialSelectedWorkshops: Record<string, string[]> = {}
    const initialAttendSymposium: Record<string, boolean> = {}

    participants.forEach((participant) => {
      initialSelectedWorkshops[participant.id] = participant.workshops || []
      initialAttendSymposium[participant.id] =
        participant.attendSymposium !== undefined ? participant.attendSymposium : true
    })

    setSelectedWorkshops(initialSelectedWorkshops)
    setAttendSymposium(initialAttendSymposium)
    setParticipantForms(participants)
  }, [participants])

  // Fetch ticket details and workshops
  useEffect(() => {
    async function fetchData() {
      if (ticketId) {
        const { data: ticket } = await supabase.from("tickets").select("*").eq("id", ticketId).single()

        setTicketDetails(ticket)

        // Set ticket prices for each participant type
        if (ticket) {
          setTicketPrices({
            specialist_doctor: ticket.price_specialist_doctor || 0,
            general_doctor: ticket.price_general_doctor || 0,
            nurse: ticket.price_nurse || 0,
            student: ticket.price_student || 0,
            other: ticket.price_other || 0,
          })
        }
      }

      const { data: workshopsData } = await supabase
        .from("workshops")
        .select("*")
        .order("sort_order", { ascending: true })

      if (workshopsData) {
        setWorkshops(workshopsData)

        // Set workshop prices
        const prices: Record<string, number> = {}
        workshopsData.forEach((workshop) => {
          prices[workshop.id] = workshop.price || 0
        })
        setWorkshopPrices(prices)
      }
    }

    fetchData()
  }, [supabase, ticketId])

  // Calculate total price
  useEffect(() => {
    let total = 0

    participantForms.forEach((participant) => {
      // Add ticket price only if attending symposium
      if (
        attendSymposium[participant.id] &&
        participant.participant_type &&
        ticketPrices[participant.participant_type]
      ) {
        total += ticketPrices[participant.participant_type]
      }

      // Add workshop prices
      const participantWorkshops = selectedWorkshops[participant.id] || []
      participantWorkshops.forEach((workshopId) => {
        total += workshopPrices[workshopId] || 0
      })
    })

    setTotalPrice(total)
  }, [participantForms, selectedWorkshops, attendSymposium, ticketPrices, workshopPrices])

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setContactPerson((prev) => ({ ...prev, [name]: value }))
  }

  const handleParticipantChange = (index: number, field: string, value: string) => {
    const updatedForms = [...participantForms]
    updatedForms[index] = { ...updatedForms[index], [field]: value }
    setParticipantForms(updatedForms)
  }

  const handleWorkshopToggle = (participantId: string, workshopId: string) => {
    setSelectedWorkshops((prev) => {
      const current = prev[participantId] || []
      const updated = current.includes(workshopId)
        ? current.filter((id) => id !== workshopId)
        : [...current, workshopId]

      // Don't allow deselecting if this is the only selection and symposium is not selected
      if (updated.length === 0 && !attendSymposium[participantId]) {
        return prev
      }

      return { ...prev, [participantId]: updated }
    })
  }

  const handleSymposiumToggle = (participantId: string) => {
    setAttendSymposium((prev) => {
      const isCurrentlyAttending = prev[participantId] || false

      // Don't allow deselecting if no workshops are selected
      if (
        isCurrentlyAttending &&
        (selectedWorkshops[participantId]?.length === 0 || !selectedWorkshops[participantId])
      ) {
        return prev
      }

      return { ...prev, [participantId]: !isCurrentlyAttending }
    })
  }

  const handleSubmit = () => {
    // Validate all required fields
    const isContactValid = contactPerson.name && contactPerson.email && contactPerson.phone

    const areParticipantsValid = participantForms.every(
      (p) => p.full_name && p.email && p.phone && p.nik && p.participant_type && p.institution,
    )

    // Check if each participant has selected at least one option (symposium or workshop)
    const hasSelections = participantForms.every(
      (p) => attendSymposium[p.id] || (selectedWorkshops[p.id] && selectedWorkshops[p.id].length > 0),
    )

    if (!isContactValid || !areParticipantsValid || !hasSelections) {
      alert("Harap lengkapi semua data yang diperlukan dan pilih minimal satu acara untuk setiap peserta.")
      return
    }

    // Prepare final participant data with workshop selections
    const finalParticipants = participantForms.map((p) => ({
      ...p,
      workshops: selectedWorkshops[p.id] || [],
      attendSymposium: attendSymposium[p.id] || false,
    }))

    onNext(finalParticipants, contactPerson, ticketId)
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
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
      default:
        return "Dokter Residen"
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Detail Peserta</h2>
        <p className="text-muted-foreground">Lengkapi informasi untuk setiap peserta</p>
      </div>

      {/* Contact Person Information */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi Kontak</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="contact-name">
                Nama Kontak <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contact-name"
                name="name"
                value={contactPerson.name}
                onChange={handleContactChange}
                placeholder="Masukkan nama kontak"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">
                Email Kontak <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contact-email"
                name="email"
                type="email"
                value={contactPerson.email}
                onChange={handleContactChange}
                placeholder="nama@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">
                Nomor Telepon Kontak <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contact-phone"
                name="phone"
                value={contactPerson.phone}
                onChange={handleContactChange}
                placeholder="08xxxxxxxxxx"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participant Details */}
      {participantForms.map((participant, index) => (
        <Card key={participant.id} className="overflow-hidden">
          <CardHeader>
            <CardTitle>Peserta {index + 1}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Personal Information */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`name-${index}`}>
                  Nama Lengkap <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`name-${index}`}
                  value={participant.full_name}
                  onChange={(e) => handleParticipantChange(index, "full_name", e.target.value)}
                  placeholder="Masukkan nama lengkap"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`email-${index}`}>
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`email-${index}`}
                  type="email"
                  value={participant.email}
                  onChange={(e) => handleParticipantChange(index, "email", e.target.value)}
                  placeholder="nama@email.com"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`phone-${index}`}>
                  Nomor Telepon <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`phone-${index}`}
                  value={participant.phone}
                  onChange={(e) => handleParticipantChange(index, "phone", e.target.value)}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`nik-${index}`}>
                  NIK <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`nik-${index}`}
                  value={participant.nik}
                  onChange={(e) => handleParticipantChange(index, "nik", e.target.value)}
                  placeholder="16 digit NIK"
                />
                <p className="text-xs text-muted-foreground">Masukkan 16 digit NIK tanpa spasi</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`type-${index}`}>
                  Tipe Peserta <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={participant.participant_type}
                  onValueChange={(value) => handleParticipantChange(index, "participant_type", value)}
                >
                  <SelectTrigger id={`type-${index}`}>
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
                  Institusi <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`institution-${index}`}
                  value={participant.institution}
                  onChange={(e) => handleParticipantChange(index, "institution", e.target.value)}
                  placeholder="Nama institusi"
                />
              </div>
            </div>

            <Separator />

            {/* Event Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Pilihan Acara</h3>
                <div className="text-sm text-red-500 font-medium">* Wajib pilih minimal satu acara</div>
              </div>

              {/* Symposium Option */}
              {ticketDetails && (
                <div className="mb-6">
                  <Card
                    className={`cursor-pointer transition-all hover:opacity-90 ${
                      attendSymposium[participant.id] ? "ring-2 ring-primary" : "border border-muted"
                    }`}
                    onClick={() => handleSymposiumToggle(participant.id)}
                  >
                    <div className="flex items-start p-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-base font-semibold">Simposium Utama</h3>
                            <p className="text-sm text-muted-foreground">{ticketDetails.name}</p>
                          </div>
                          <Badge variant="outline">
                            Rp{" "}
                            {participant.participant_type && ticketPrices[participant.participant_type]
                              ? ticketPrices[participant.participant_type].toLocaleString("id-ID")
                              : "0"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{ticketDetails.description}</p>
                        {ticketDetails.location && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <span>Lokasi: {ticketDetails.location}</span>
                            {ticketDetails.start_date && ticketDetails.end_date && (
                              <span className="ml-2">
                                {new Date(ticketDetails.start_date).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}{" "}
                                -{" "}
                                {new Date(ticketDetails.end_date).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex h-full items-center">
                        <div
                          className={`h-5 w-5 rounded-sm border ${
                            attendSymposium[participant.id] ? "bg-primary border-primary" : "border-input"
                          }`}
                        >
                          {attendSymposium[participant.id] && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4 text-primary-foreground"
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Workshop Selection */}
              <div className="space-y-2">
                <h4 className="font-medium">Workshop (Opsional)</h4>
                <p className="text-sm text-muted-foreground">Pilih workshop yang ingin diikuti</p>

                <div className="space-y-3 mt-3">
                  {workshops && workshops.length > 0 ? (
                    workshops.map((workshop) => {
                      const isSelected = selectedWorkshops[participant.id]?.includes(workshop.id) || false
                      const isDisabled =
                        !attendSymposium[participant.id] &&
                        selectedWorkshops[participant.id]?.length === 1 &&
                        isSelected

                      return (
                        <Card
                          key={workshop.id}
                          className={`cursor-pointer transition-all hover:opacity-90 ${
                            isSelected ? "ring-2 ring-primary" : ""
                          } ${workshop.alreadyPurchased ? "opacity-50" : ""} ${isDisabled ? "opacity-50" : ""}`}
                          onClick={() => {
                            if (workshop.alreadyPurchased || isDisabled) return
                            handleWorkshopToggle(participant.id, workshop.id)
                          }}
                        >
                          <div className="flex items-start p-4">
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base font-semibold">{workshop.title}</h3>
                                  {workshop.alreadyPurchased && <Badge variant="secondary">Sudah Terdaftar</Badge>}
                                  {isDisabled && !workshop.alreadyPurchased && isSelected && (
                                    <Badge variant="outline" className="text-amber-600 border-amber-600">
                                      Wajib Pilih Minimal Satu Acara
                                    </Badge>
                                  )}
                                </div>
                                <Badge variant="outline">Rp {workshop.price?.toLocaleString("id-ID") || "0"}</Badge>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">{workshop.description}</p>
                              {workshop.location && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  <span>Lokasi: {workshop.location}</span>
                                  {workshop.start_time && workshop.end_time && (
                                    <span className="ml-2">
                                      {new Date(workshop.start_time).toLocaleDateString("id-ID", {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                      })}{" "}
                                      (
                                      {new Date(workshop.start_time).toLocaleTimeString("id-ID", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}{" "}
                                      -{" "}
                                      {new Date(workshop.end_time).toLocaleTimeString("id-ID", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                      )
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="ml-4 flex h-full items-center">
                              <div
                                className={`h-5 w-5 rounded-sm border ${
                                  isSelected ? "bg-primary border-primary" : "border-input"
                                } ${workshop.alreadyPurchased || isDisabled ? "opacity-50" : ""}`}
                              >
                                {isSelected && (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4 text-primary-foreground"
                                  >
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
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
      ))}

      {/* Price Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Biaya</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {participantForms.map((participant, index) => (
              <div key={participant.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    Peserta {index + 1}: {participant.full_name || `Peserta ${index + 1}`}
                  </h3>
                  {!attendSymposium[participant.id] &&
                    (!selectedWorkshops[participant.id] || selectedWorkshops[participant.id].length === 0) && (
                      <Badge variant="destructive">Belum memilih acara</Badge>
                    )}
                </div>
                <div className="space-y-1 pl-4 text-sm">
                  {attendSymposium[participant.id] &&
                    participant.participant_type &&
                    ticketPrices[participant.participant_type] && (
                      <div className="flex justify-between">
                        <span>Simposium Utama</span>
                        <span>Rp {ticketPrices[participant.participant_type].toLocaleString("id-ID")}</span>
                      </div>
                    )}

                  {selectedWorkshops[participant.id] && selectedWorkshops[participant.id].length > 0 && (
                    <div className="space-y-1">
                      {selectedWorkshops[participant.id].map((workshopId) => {
                        const workshop = workshops.find((w) => w.id === workshopId)
                        if (!workshop) return null
                        return (
                          <div key={workshopId} className="flex justify-between">
                            <span>Workshop: {workshop.title}</span>
                            <span>Rp {workshop.price?.toLocaleString("id-ID") || "0"}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <Separator />

            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>Rp {totalPrice.toLocaleString("id-ID")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Kembali
        </Button>
        <Button onClick={handleSubmit}>Lanjut ke Konfirmasi</Button>
      </div>
    </div>
  )
}
