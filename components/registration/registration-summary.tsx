"use client"

import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import type { RegistrationData } from "./registration-flow"

type RegistrationSummaryProps = {
  registrationData: RegistrationData
  onConfirm: () => void
  onBack: () => void
  loading: boolean
}

// Fungsi helper untuk menghitung harga
function calculatePrices(participants, ticketDetails, workshopDetails) {
  // Inisialisasi objek untuk menyimpan harga per peserta
  const participantPrices = {}
  let totalAmount = 0

  // Iterasi setiap peserta
  participants.forEach((participant) => {
    let participantTotal = 0

    // Hitung harga tiket jika menghadiri simposium
    if (participant.attendSymposium === true && ticketDetails && participant.participant_type) {
      const priceKey = `price_${participant.participant_type}`
      const ticketPrice = ticketDetails[priceKey] || 0
      participantTotal += ticketPrice
    }

    // Hitung harga workshop
    if (participant.workshops && participant.workshops.length > 0) {
      participant.workshops.forEach((workshopId) => {
        const workshop = workshopDetails.find((w) => w.id === workshopId)
        if (workshop) {
          participantTotal += workshop.price || 0
        }
      })
    }

    // Simpan total harga peserta
    participantPrices[participant.id] = participantTotal
    totalAmount += participantTotal
  })

  return { participantPrices, totalAmount }
}

export function RegistrationSummary({ registrationData, onConfirm, onBack, loading }: RegistrationSummaryProps) {
  // State untuk data
  const [ticketDetails, setTicketDetails] = useState(null)
  const [workshopDetails, setWorkshopDetails] = useState([])
  const [promoDetails, setPromoDetails] = useState(null)

  // State untuk harga
  const [prices, setPrices] = useState({
    participantPrices: {},
    totalAmount: 0,
    discountAmount: 0,
    finalAmount: 0,
  })

  const supabase = createClientComponentClient()

  // Fungsi untuk memuat data
  useEffect(() => {
    async function loadData() {
      try {
        // 1. Muat data tiket
        let ticket = null
        if (registrationData.ticket_id) {
          const { data } = await supabase.from("tickets").select("*").eq("id", registrationData.ticket_id).single()
          ticket = data
          setTicketDetails(data)
        }

        // 2. Muat data workshop
        let workshops = []
        const allWorkshopIds = registrationData.participants.flatMap((p) => p.workshops || [])
        if (allWorkshopIds.length > 0) {
          const { data } = await supabase.from("workshops").select("*").in("id", allWorkshopIds)
          workshops = data || []
          setWorkshopDetails(data || [])
        }

        // 3. Muat data promo
        let promo = null
        if (registrationData.promo_code) {
          const { data } = await supabase
            .from("promo_codes")
            .select("*")
            .eq("code", registrationData.promo_code)
            .eq("is_active", true)
            .single()
          promo = data
          setPromoDetails(data)
        }

        // 4. Hitung harga
        const { participantPrices, totalAmount } = calculatePrices(registrationData.participants, ticket, workshops)

        // 5. Hitung diskon
        let discountAmount = 0
        if (promo) {
          if (promo.discount_type === "percentage") {
            discountAmount = Math.round(totalAmount * (promo.discount_value / 100))
          } else {
            discountAmount = Math.min(promo.discount_value, totalAmount)
          }
        }

        // 6. Hitung total akhir
        const finalAmount = Math.max(0, totalAmount - discountAmount)

        // 7. Simpan semua harga
        setPrices({
          participantPrices,
          totalAmount,
          discountAmount,
          finalAmount,
        })

        // 8. Log untuk debugging
        console.log("Data loaded successfully")
        console.log("Ticket:", ticket)
        console.log("Workshops:", workshops)
        console.log("Promo:", promo)
        console.log("Participant prices:", participantPrices)
        console.log("Total amount:", totalAmount)
        console.log("Discount amount:", discountAmount)
        console.log("Final amount:", finalAmount)
      } catch (error) {
        console.error("Error loading data:", error)
      }
    }

    loadData()
  }, [registrationData, supabase])

  function getParticipantTypeLabel(type) {
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

  function getWorkshopTitle(workshopId) {
    const workshop = workshopDetails.find((w) => w.id === workshopId)
    return workshop ? workshop.title : "Workshop"
  }

  function getWorkshopPrice(workshopId) {
    const workshop = workshopDetails.find((w) => w.id === workshopId)
    return workshop ? workshop.price : 0
  }

  // Render komponen
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Konfirmasi Pendaftaran</h2>
        <p className="text-muted-foreground">Periksa kembali detail pendaftaran Anda sebelum melanjutkan pembayaran</p>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>Informasi Penting</AlertTitle>
        <AlertDescription>
          Setelah konfirmasi, Anda akan diarahkan ke halaman instruksi pembayaran. Pastikan semua data sudah benar.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Informasi Kontak</CardTitle>
          <CardDescription>Informasi kontak utama untuk pendaftaran ini</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm font-medium">Nama Kontak</div>
            <div>{registrationData.contact_person.name}</div>
            <div className="text-sm font-medium">Email Kontak</div>
            <div>{registrationData.contact_person.email}</div>
            <div className="text-sm font-medium">Telepon Kontak</div>
            <div>{registrationData.contact_person.phone}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detail Peserta</CardTitle>
          <CardDescription>Informasi peserta yang didaftarkan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {registrationData.participants.map((participant, index) => (
            <div key={participant.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Peserta {index + 1}: {participant.full_name}
                </h3>
                <Badge>{getParticipantTypeLabel(participant.participant_type)}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Email</div>
                <div>{participant.email}</div>
                <div className="text-muted-foreground">Telepon</div>
                <div>{participant.phone}</div>
                <div className="text-muted-foreground">NIK</div>
                <div>{participant.nik}</div>
                <div className="text-muted-foreground">Institusi</div>
                <div>{participant.institution}</div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Acara yang Dipilih</h4>
                <ul className="space-y-1">
                  {participant.attendSymposium === true && ticketDetails && (
                    <li className="flex justify-between">
                      <span>Simposium: {ticketDetails.name}</span>
                      <span>
                        Rp{" "}
                        {ticketDetails[`price_${participant.participant_type}`]
                          ? ticketDetails[`price_${participant.participant_type}`].toLocaleString("id-ID")
                          : "0"}
                      </span>
                    </li>
                  )}

                  {participant.workshops &&
                    participant.workshops.length > 0 &&
                    participant.workshops.map((workshopId) => (
                      <li key={workshopId} className="flex justify-between">
                        <span>Workshop: {getWorkshopTitle(workshopId)}</span>
                        <span>Rp {getWorkshopPrice(workshopId).toLocaleString("id-ID")}</span>
                      </li>
                    ))}
                </ul>
              </div>

              {index < registrationData.participants.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Pembayaran</CardTitle>
          <CardDescription>Detail biaya pendaftaran</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {registrationData.participants.map((participant, index) => {
              // Ambil harga peserta dari state prices
              const participantTotal = prices.participantPrices[participant.id] || 0

              return (
                <div key={participant.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                      Peserta {index + 1}: {participant.full_name}
                    </h3>
                    <Badge variant="outline">{getParticipantTypeLabel(participant.participant_type)}</Badge>
                  </div>
                  <div className="space-y-1 pl-4 text-sm">
                    {participant.attendSymposium === true && ticketDetails && (
                      <div className="flex justify-between">
                        <span>Simposium: {ticketDetails.name}</span>
                        <span>
                          Rp{" "}
                          {ticketDetails[`price_${participant.participant_type}`]
                            ? ticketDetails[`price_${participant.participant_type}`].toLocaleString("id-ID")
                            : "0"}
                        </span>
                      </div>
                    )}

                    {participant.workshops && participant.workshops.length > 0 && (
                      <div className="space-y-1">
                        {participant.workshops.map((workshopId) => {
                          const workshop = workshopDetails.find((w) => w.id === workshopId)
                          if (!workshop) return null
                          return (
                            <div key={workshopId} className="flex justify-between">
                              <span className="truncate">{workshop.title}</span>
                              <span>Rp {workshop.price.toLocaleString("id-ID")}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="flex justify-between font-medium">
                      <span>Subtotal</span>
                      <span>Rp {participantTotal.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                </div>
              )
            })}

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between font-medium">
                <span>Total Biaya</span>
                <span>Rp {prices.totalAmount.toLocaleString("id-ID")}</span>
              </div>

              {prices.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>
                    Diskon {promoDetails?.code ? `(${promoDetails.code})` : ""}{" "}
                    {promoDetails?.discount_type === "percentage" ? `(${promoDetails.discount_value}%)` : ""}
                  </span>
                  <span>- Rp {prices.discountAmount.toLocaleString("id-ID")}</span>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold">
                <span>Total Pembayaran</span>
                <span>Rp {prices.finalAmount.toLocaleString("id-ID")}</span>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Metode Pembayaran: {registrationData.payment_type === "self" ? "Bayar Sendiri" : "Sponsor/Institusi"}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Kembali
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? "Memproses..." : "Konfirmasi & Bayar"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
