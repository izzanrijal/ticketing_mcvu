"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { CategorySelection } from "@/components/registration/category-selection"
import { RegistrationSummary } from "@/components/registration/registration-summary"
import { PaymentInstructions } from "@/components/registration/payment-instructions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ParticipantCard } from "@/components/registration/participant-card"

export type Participant = {
  id: string
  full_name: string
  email: string
  phone: string
  nik: string
  participant_type: string
  institution: string
  workshops: string[]
  attendSymposium?: boolean // Ini hanya digunakan di UI, tidak disimpan langsung ke database
}

export type RegistrationData = {
  participants: Participant[]
  ticket_id: string
  payment_type: "self" | "sponsor"
  sponsor_letter?: File
  promo_code?: string
  contact_person: {
    name: string
    email: string
    phone: string
  }
}

export function RegistrationFlow() {
  const [step, setStep] = useState(1)
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    participants: [],
    ticket_id: "",
    payment_type: "self",
    contact_person: {
      name: "",
      email: "",
      phone: "",
    },
    promo_code: "",
  })
  const [registrationId, setRegistrationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientComponentClient()
  const toastRef = useRef({ toast })

  useEffect(() => {
    toastRef.current = { toast }
  }, [toast])

  const handleCategorySelection = (data: {
    ticket_id?: string
    participant_count: number
    payment_type: "self" | "sponsor"
    sponsor_letter?: File
  }) => {
    // Create empty participants based on count
    const participants = Array(data.participant_count)
      .fill(null)
      .map((_, index) => ({
        id: `participant-${Date.now()}-${index}`,
        full_name: "",
        email: "",
        phone: "",
        nik: "",
        participant_type: "",
        institution: "",
        workshops: [],
        attendSymposium: false, // Default ke false agar user harus memilih secara eksplisit
      }))

    setRegistrationData({
      ...registrationData,
      ticket_id: data.ticket_id || "",
      payment_type: data.payment_type,
      sponsor_letter: data.sponsor_letter,
      participants,
    })

    setStep(2)
  }

  const handleParticipantDetails = (participants: Participant[], contactPerson: any, ticketId?: string) => {
    setRegistrationData({
      ...registrationData,
      participants,
      contact_person: contactPerson,
      ticket_id: ticketId || registrationData.ticket_id,
    })
    setStep(3)
  }

  const handleConfirmRegistration = async () => {
    setLoading(true)
    let totalAmount = 0 // Declare totalAmount here
    try {
      // Generate a unique registration number
      const registrationNumber = `MCVU-${Date.now().toString().slice(-8)}`

      // Calculate total amount based on ticket and workshops
      let workshopAmount = 0

      // Get ticket details
      const { data: ticketData } = await supabase
        .from("tickets")
        .select("*")
        .eq("id", registrationData.ticket_id)
        .single()

      if (!ticketData) {
        throw new Error("Ticket not found")
      }

      // Calculate ticket amount for all participants
      for (const participant of registrationData.participants) {
        // Only add ticket price if attending symposium
        if (participant.attendSymposium === true) {
          const participantType = participant.participant_type
          totalAmount += ticketData[`price_${participantType}`] || 0
        }

        // Add workshop prices if any
        if (participant.workshops && participant.workshops.length > 0) {
          // Use Promise.all to wait for all workshop price calculations
          const workshopPromises = participant.workshops.map(async (workshopId) => {
            const { data: workshop } = await supabase.from("workshops").select("price").eq("id", workshopId).single()
            return workshop?.price || 0
          })

          const workshopPrices = await Promise.all(workshopPromises)
          workshopAmount += workshopPrices.reduce((sum, price) => sum + price, 0)
        }
      }

      totalAmount += workshopAmount

      // Langsung gunakan metode API untuk menghindari masalah RLS
      try {
        toastRef.current.toast({
          title: "Memproses pendaftaran...",
          description: "Mohon tunggu sebentar",
        })

        // Handle file upload separately if sponsor payment with letter
        let formData;
        let response;
        
        if (registrationData.payment_type === "sponsor" && registrationData.sponsor_letter) {
          // Use FormData for file upload
          formData = new FormData();
          formData.append('registrationData', JSON.stringify(registrationData));
          formData.append('registrationNumber', registrationNumber);
          formData.append('totalAmount', totalAmount.toString());
          formData.append('sponsor_letter', registrationData.sponsor_letter);
          
          response = await fetch("/api/register", {
            method: "POST",
            body: formData,
          });
        } else {
          // Regular JSON request for non-file uploads
          response = await fetch("/api/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              registrationData,
              registrationNumber,
              totalAmount,
            }),
          });
        }

        if (!response.ok) {
          const errorData = await response.json()
          console.error("API registration error details:", errorData)
          throw new Error(errorData.error || "API registration failed")
        }

        const result = await response.json()

        // Store the registration ID and redirect to payment page
        if (result.registrationId) {
          setRegistrationId(result.registrationId)

          // Log the ID for debugging
          console.log("Registration successful, ID:", result.registrationId)

          // Set a cookie with the registration ID for backup
          document.cookie = `last_registration_id=${result.registrationId}; path=/; max-age=86400`

          setStep(4)

          toastRef.current.toast({
            title: "Pendaftaran Berhasil",
            description: "Silakan lanjutkan ke pembayaran",
            variant: "default",
          })
        } else {
          throw new Error("No registration ID returned from server")
        }

        return
      } catch (apiError) {
        console.error("API registration failed:", apiError)
        throw new Error(`API registration failed: ${apiError.message}`)
      }
    } catch (error) {
      console.error("Registration error:", error)
      toastRef.current.toast({
        title: "Pendaftaran Gagal",
        description: `Terjadi kesalahan saat mendaftar: ${error.message}. Silakan coba lagi atau hubungi administrator.`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Add this after the other useEffect hooks
  useEffect(() => {
    // Reset error highlights when changing steps
    document.querySelectorAll(".ring-destructive").forEach((el) => {
      el.classList.remove("ring-2", "ring-destructive")
    })
  }, [step])

  return (
    <Card className="overflow-hidden">
      <Tabs value={`step-${step}`} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="step-1" disabled={step !== 1}>
            Pilih Kategori
          </TabsTrigger>
          <TabsTrigger value="step-2" disabled={step !== 2}>
            Detail Peserta
          </TabsTrigger>
          <TabsTrigger value="step-3" disabled={step !== 3}>
            Konfirmasi
          </TabsTrigger>
          <TabsTrigger value="step-4" disabled={step !== 4}>
            Pembayaran
          </TabsTrigger>
        </TabsList>

        <TabsContent value="step-1" className="p-6">
          <CategorySelection onNext={handleCategorySelection} />
        </TabsContent>

        <TabsContent value="step-2" className="p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Detail Peserta</h2>
              <p className="text-muted-foreground">Lengkapi informasi untuk setiap peserta</p>
            </div>

            {/* Contact Person Information */}
            <ContactPersonForm
              id="contact-person-form"
              onSubmit={(contactPerson) => {
                setRegistrationData({
                  ...registrationData,
                  contact_person: contactPerson,
                })
              }}
              defaultValues={registrationData.contact_person}
            />

            {/* Participant List - Vertical Layout */}
            <div className="space-y-6">
              {registrationData.participants.map((participant, index) => (
                <ParticipantCard
                  key={participant.id}
                  participant={participant}
                  index={index}
                  id={`participant-card-${participant.id}`}
                  ticketId={registrationData.ticket_id || "3d271769-9e63-4eab-aa6a-6d56c28d556f"} // Gunakan ID default jika tidak ada
                  onUpdate={(updatedParticipant) => {
                    const updatedParticipants = [...registrationData.participants]
                    updatedParticipants[index] = updatedParticipant
                    setRegistrationData({
                      ...registrationData,
                      participants: updatedParticipants,
                    })
                  }}
                />
              ))}
            </div>

            {/* Promo Code and Payment Summary */}
            <PaymentSummary
              participants={registrationData.participants}
              ticketId={registrationData.ticket_id}
              promoCode={registrationData.promo_code}
              onPromoCodeChange={(code) => {
                setRegistrationData({
                  ...registrationData,
                  promo_code: code,
                })
              }}
              setRegistrationData={setRegistrationData}
              registrationData={registrationData}
            />

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep(1)}>
                Kembali
              </Button>
              <Button
                onClick={() => {
                  // Add form-validated class to the parent form
                  document.querySelectorAll("form").forEach((form) => {
                    form.classList.add("form-validated")
                  })

                  // Rest of the validation code remains the same
                  // Validasi semua data peserta
                  let isValid = true
                  let errorMessage = ""
                  let firstInvalidField = null

                  // Validasi data kontak terlebih dahulu
                  if (
                    !registrationData.contact_person.name ||
                    !registrationData.contact_person.email ||
                    !registrationData.contact_person.phone
                  ) {
                    isValid = false
                    errorMessage = "Harap lengkapi data kontak terlebih dahulu"
                    // Scroll to contact form
                    document.querySelector('div[id="contact-person-form"]')?.scrollIntoView({ behavior: "smooth" })
                    toastRef.current.toast({
                      title: "Data kontak belum lengkap",
                      description: "Harap lengkapi nama, email, dan nomor telepon kontak",
                      variant: "destructive",
                    })
                    return
                  }

                  for (let i = 0; i < registrationData.participants.length; i++) {
                    const participant = registrationData.participants[i]
                    const participantElement = document.getElementById(`participant-card-${participant.id}`)

                    // Cek NIK - harus tepat 16 digit
                    if (!participant.nik || participant.nik.length !== 16 || !/^\d{16}$/.test(participant.nik)) {
                      isValid = false
                      errorMessage = `NIK peserta ${i + 1} harus tepat 16 digit angka`
                      if (!firstInvalidField) {
                        firstInvalidField = document.getElementById(`nik-${i}`)
                        // Highlight the participant card with the error
                        participantElement?.classList.add("ring-2", "ring-destructive")
                        // Scroll to the participant card
                        participantElement?.scrollIntoView({ behavior: "smooth" })
                      }
                      toastRef.current.toast({
                        title: `Error pada peserta ${i + 1}`,
                        description: `NIK harus tepat 16 digit angka`,
                        variant: "destructive",
                      })
                      continue
                    }

                    // Cek apakah data wajib sudah diisi
                    if (
                      !participant.full_name ||
                      !participant.email ||
                      !participant.phone ||
                      !participant.participant_type ||
                      !participant.institution
                    ) {
                      isValid = false
                      errorMessage = "Harap lengkapi semua data peserta yang bertanda bintang (*)"
                      if (!firstInvalidField) {
                        // Find the first empty required field
                        if (!participant.full_name) firstInvalidField = document.getElementById(`name-${i}`)
                        else if (!participant.email) firstInvalidField = document.getElementById(`email-${i}`)
                        else if (!participant.phone) firstInvalidField = document.getElementById(`phone-${i}`)
                        else if (!participant.participant_type) firstInvalidField = document.getElementById(`type-${i}`)
                        else if (!participant.institution)
                          firstInvalidField = document.getElementById(`institution-${i}`)

                        // Highlight the participant card with the error
                        participantElement?.classList.add("ring-2", "ring-destructive")
                        // Scroll to the participant card
                        participantElement?.scrollIntoView({ behavior: "smooth" })
                      }
                      toastRef.current.toast({
                        title: `Data peserta ${i + 1} belum lengkap`,
                        description: "Harap lengkapi semua field yang bertanda bintang (*)",
                        variant: "destructive",
                      })
                      continue
                    }

                    // Cek apakah peserta memilih minimal satu acara (simposium atau workshop)
                    if (
                      !participant.attendSymposium &&
                      (!participant.workshops || participant.workshops.length === 0)
                    ) {
                      isValid = false
                      errorMessage = "Setiap peserta harus memilih minimal satu acara (Simposium atau Workshop)"
                      if (!firstInvalidField) {
                        firstInvalidField = document.getElementById(`event-selection-${participant.id}`)
                        // Highlight the participant card with the error
                        participantElement?.classList.add("ring-2", "ring-destructive")
                        // Scroll to the participant card
                        participantElement?.scrollIntoView({ behavior: "smooth" })
                      }
                      toastRef.current.toast({
                        title: `Peserta ${i + 1} belum memilih acara`,
                        description: "Setiap peserta harus memilih minimal satu acara (Simposium atau Workshop)",
                        variant: "destructive",
                      })
                      continue
                    }

                    // Remove highlight if this participant is valid
                    participantElement?.classList.remove("ring-2", "ring-destructive")
                  }

                  if (isValid) {
                    // Reset all highlights
                    document.querySelectorAll(".ring-destructive").forEach((el) => {
                      el.classList.remove("ring-2", "ring-destructive")
                    })

                    handleParticipantDetails(
                      registrationData.participants,
                      registrationData.contact_person,
                      registrationData.ticket_id,
                    )
                  } else if (firstInvalidField) {
                    // Focus on the first invalid field
                    firstInvalidField.focus()
                  }
                }}
              >
                Lanjut ke Konfirmasi
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="step-3" className="p-6">
          <RegistrationSummary
            registrationData={registrationData}
            onConfirm={handleConfirmRegistration}
            onBack={() => setStep(2)}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="step-4" className="p-6">
          {registrationId && <PaymentInstructions registrationId={registrationId} />}
        </TabsContent>
      </Tabs>
    </Card>
  )
}

// Contact Person Form Component
function ContactPersonForm({ onSubmit, defaultValues = { name: "", email: "", phone: "" }, id }) {
  const [formData, setFormData] = useState(defaultValues)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    onSubmit({
      ...formData,
      [name]: value,
    })
  }

  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>Informasi Kontak</CardTitle>
        <CardDescription>Informasi kontak utama untuk pendaftaran ini</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="contact-name">
              Nama Kontak <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contact-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Masukkan nama kontak"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">
              Email Kontak <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contact-email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="nama@email.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone">
              Nomor Telepon Kontak <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contact-phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="08xxxxxxxxxx"
              required
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Payment Summary Component
const PaymentSummary = ({
  participants,
  ticketId,
  promoCode: initialPromoCode,
  onPromoCodeChange,
  setRegistrationData,
  registrationData,
}) => {
  const [ticketDetails, setTicketDetails] = useState(null)
  const [workshops, setWorkshops] = useState([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [promoCodeInput, setPromoCodeInput] = useState(initialPromoCode || "")
  const [promoCodeStatus, setPromoCodeStatus] = useState(null)
  const [isApplyingPromo, setIsApplyingPromo] = useState(false)
  const supabase = createClientComponentClient()
  const toastRef = useRef(null)

  // Add a state for promo code
  const [promoCode, setPromoCode] = useState(initialPromoCode || "")
  const [promoError, setPromoError] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<any>(null)
  const [finalAmount, setFinalAmount] = useState(totalAmount)
  const { toast } = useToast()

  useEffect(() => {
    toastRef.current = toast
  }, [toast])

  // Add this useEffect to calculate the final amount after discount
  useEffect(() => {
    let final = totalAmount

    // Apply promo discount if available
    if (appliedPromo) {
      if (appliedPromo.discount_type === "percentage") {
        const discountAmount = totalAmount * (appliedPromo.discount_value / 100)
        final = totalAmount - discountAmount
        setDiscount(discountAmount)
      } else {
        final = totalAmount - appliedPromo.discount_value
        setDiscount(appliedPromo.discount_value)
      }
    } else {
      setDiscount(0)
    }

    setFinalAmount(Math.max(0, final))
  }, [totalAmount, appliedPromo])

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch workshops
        const { data: workshopsData } = await supabase.from("workshops").select("*")

        setWorkshops(workshopsData || [])

        // Fetch ticket details
        if (ticketId) {
          const { data: ticketData } = await supabase.from("tickets").select("*").eq("id", ticketId).single()

          setTicketDetails(ticketData)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }

    fetchData()
  }, [supabase, ticketId])

  useEffect(() => {
    // Calculate total amount
    let total = 0

    participants.forEach((participant) => {
      // Add ticket price ONLY if symposium is selected
      if (participant.attendSymposium && participant.participant_type && ticketDetails) {
        total += ticketDetails[`price_${participant.participant_type}`] || 0
      }

      // Add workshop prices
      if (participant.workshops && participant.workshops.length > 0) {
        participant.workshops.forEach((workshopId) => {
          const workshop = workshops.find((w) => w.id === workshopId)
          if (workshop) {
            total += workshop.price
          }
        })
      }
    })

    setTotalAmount(total)
  }, [participants, ticketDetails, workshops])

  // Add a function to validate and apply promo code
  async function applyPromoCode() {
    if (!promoCode) {
      setPromoError("Masukkan kode promo")
      return
    }

    setPromoLoading(true)
    setPromoError("")

    try {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", promoCode.toUpperCase())
        .eq("is_active", true)
        .single()

      if (error) throw error

      if (!data) {
        setPromoError("Kode promo tidak valid")
        return
      }

      // Check if promo is expired
      const now = new Date()
      if (data.valid_until && new Date(data.valid_until) < now) {
        setPromoError("Kode promo sudah berakhir")
        return
      }

      // Check if promo has reached max usage
      if (data.max_uses && data.used_count >= data.max_uses) {
        setPromoError("Kode promo sudah mencapai batas penggunaan")
        return
      }

      // Check participant type restriction if any
      if (data.participant_type) {
        // Check if any participant matches the required type
        const hasMatchingParticipant = participants.some((p) => p.participant_type === data.participant_type)
        if (!hasMatchingParticipant) {
          setPromoError(`Kode promo hanya berlaku untuk peserta tipe ${data.participant_type}`)
          return
        }
      }

      setAppliedPromo(data)
      toast({
        title: "Promo berhasil diterapkan",
        description: `${data.discount_type === "percentage" ? data.discount_value + "%" : "Rp " + data.discount_value.toLocaleString("id-ID")} diskon`,
      })

      // Store the promo code in registration data
      setRegistrationData({
        ...registrationData,
        promo_code: promoCode.toUpperCase(),
      })
    } catch (error) {
      console.error("Error applying promo code:", error)
      setPromoError("Kode promo tidak valid")
    } finally {
      setPromoLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ringkasan Pembayaran</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {participants.map((participant, index) => (
          <div key={participant.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                Peserta {index + 1}: {participant.full_name || "Belum mengisi data"}
              </h3>
              {!participant.attendSymposium && (!participant.workshops || participant.workshops.length === 0) && (
                <Badge variant="destructive">Belum memilih acara</Badge>
              )}
            </div>
            <div className="space-y-1 pl-4 text-sm">
              {participant.attendSymposium && participant.participant_type && ticketDetails && (
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

              {!participant.full_name ||
              (!participant.attendSymposium && (!participant.workshops || participant.workshops.length === 0)) ? (
                <div className="text-amber-600 text-xs mt-1">
                  {!participant.full_name
                    ? "Silahkan lengkapi data peserta"
                    : "Peserta harus memilih minimal satu acara"}
                </div>
              ) : (
                <div className="flex justify-between font-medium mt-1">
                  <span>Subtotal Peserta {index + 1}</span>
                  <span>
                    Rp {(() => {
                      let total = 0
                      if (participant.attendSymposium && participant.participant_type && ticketDetails) {
                        total += ticketDetails[`price_${participant.participant_type}`] || 0
                      }
                      if (participant.workshops && participant.workshops.length > 0) {
                        participant.workshops.forEach((workshopId) => {
                          const workshop = workshops.find((w) => w.id === workshopId)
                          if (workshop) total += workshop.price
                        })
                      }
                      return total.toLocaleString("id-ID")
                    })()}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        <Separator />

        {/* Promo code section */}
        <div className="space-y-2 mt-4">
          <Label htmlFor="promo-code">Kode Promo (Opsional)</Label>
          <div className="flex space-x-2">
            <Input
              id="promo-code"
              placeholder="MCVU2025"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="uppercase"
              disabled={!!appliedPromo}
            />
            <Button
              type="button"
              onClick={applyPromoCode}
              disabled={promoLoading || !!appliedPromo}
              variant={appliedPromo ? "outline" : "default"}
            >
              {promoLoading ? "Memeriksa..." : appliedPromo ? "Diterapkan" : "Terapkan"}
            </Button>
          </div>
          {promoError && <p className="text-sm text-destructive">{promoError}</p>}
          {appliedPromo && (
            <div className="flex items-center justify-between text-sm">
              <span>Promo: {appliedPromo.code}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAppliedPromo(null)
                  setPromoCode("")
                  setRegistrationData({
                    ...registrationData,
                    promo_code: "",
                  })
                }}
                className="h-auto p-0 text-destructive"
              >
                Hapus
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>Rp {totalAmount.toLocaleString("id-ID")}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Diskon</span>
              <span>- Rp {discount.toLocaleString("id-ID")}</span>
            </div>
          )}

          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            {appliedPromo ? (
              <div className="text-right">
                <div className="text-sm line-through text-muted-foreground">
                  Rp {totalAmount.toLocaleString("id-ID")}
                </div>
                <div className="text-green-600">Rp {finalAmount.toLocaleString("id-ID")}</div>
              </div>
            ) : (
              <span>Rp {totalAmount.toLocaleString("id-ID")}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
