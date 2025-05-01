"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

// NIK validation function
function validateNIK(nik: string) {
  // Basic validation: 16 digits
  return /^\d{16}$/.test(nik)
}

// Form schema
const formSchema = z.object({
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
  ticket_id: z.string({
    required_error: "Pilih paket tiket",
  }),
  workshops: z.array(z.string()).optional(),
  promo_code: z.string().optional(),
  payment_type: z.enum(["self", "sponsor"], {
    required_error: "Pilih tipe pembayaran",
  }),
  sponsor_letter: z.any().optional(),
  terms: z.boolean().refine((val) => val === true, {
    message: "Anda harus menyetujui syarat dan ketentuan",
  }),
})

type FormValues = z.infer<typeof formSchema>

export function RegistrationForm() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [tickets, setTickets] = useState<any[]>([])
  const [workshops, setWorkshops] = useState<any[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const supabase = createClientComponentClient()

  // Get ticket_id from URL if available
  const ticketId = searchParams.get("ticket")

  // Default form values
  const defaultValues: Partial<FormValues> = {
    participant_type: "",
    ticket_id: ticketId || "",
    workshops: [],
    payment_type: "self",
    terms: false,
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  // Watch for changes to calculate total
  const watchedFields = form.watch(["ticket_id", "participant_type", "workshops", "promo_code"])

  // Handle form submission
  async function onSubmit(data: FormValues) {
    setLoading(true)
    try {
      // Step 1: Create participant
      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .insert({
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          participant_type: data.participant_type,
          institution: data.institution,
          address: data.address,
          city: data.city,
          province: data.province,
          postal_code: data.postal_code,
        })
        .select()
        .single()

      if (participantError) throw participantError

      // Step 2: Create registration
      // Initial insert without sponsor letter URL
      const { data: registration, error: registrationError } = await supabase
        .from("registrations")
        .insert({
          participant_id: participant.id,
          ticket_id: data.ticket_id,
          status: "pending", // Default status
          payment_type: data.payment_type,
          // sponsor_letter_url will be updated later if needed
        })
        .select()
        .single()

      if (registrationError) throw registrationError

      // Step 3: Upload sponsor letter if applicable
      let sponsorLetterUrl: string | null = null
      if (data.payment_type === "sponsor" && data.sponsor_letter) {
        const file = data.sponsor_letter as File
        const fileExt = file.name.split('.').pop()
        const filePath = `sponsor_letters/${registration.id}.${fileExt}` // Use registration UUID for unique filename

        const { error: uploadError } = await supabase.storage
          .from("sponsor-letters") // Ensure this bucket exists and has appropriate policies
          .upload(filePath, file)

        if (uploadError) {
          // Handle upload error (e.g., show toast, maybe rollback?)
          console.error("Sponsor letter upload failed:", uploadError)
          toast({
            title: "Upload Gagal",
            description: "Gagal mengunggah surat jaminan sponsor.",
            variant: "destructive",
          })
          // Optionally, consider deleting the created participant/registration records for consistency
          // await supabase.from('registrations').delete().match({ id: registration.id })
          // await supabase.from('participants').delete().match({ id: participant.id })
          throw uploadError // Stop further processing
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("sponsor-letters")
          .getPublicUrl(filePath)

        sponsorLetterUrl = urlData?.publicUrl || null

        // Update registration record with the URL
        const { error: updateError } = await supabase
          .from("registrations")
          .update({ sponsor_letter_url: sponsorLetterUrl })
          .match({ id: registration.id })

        if (updateError) {
          console.error("Failed to update registration with sponsor letter URL:", updateError)
          // Handle update error if needed
        }
      }

      // Step 4: Create registration workshops
      if (data.workshops && data.workshops.length > 0) {
        const workshopData = data.workshops.map((wsId) => ({
          registration_id: registration.id,
          workshop_id: wsId,
        }))
        const { error: workshopError } = await supabase.from("registration_workshops").insert(workshopData)

        if (workshopError) throw workshopError
      }

      // Step 5: Create payment record
      const { error: paymentError } = await supabase.from("payments").insert({
        registration_id: registration.id,
        payment_method: "bank_transfer",
        amount: totalAmount,
        status: "pending",
      })

      if (paymentError) throw paymentError

      // Success! Redirect to payment page
      router.push(`/payment/${registration.id}`)
    } catch (error) {
      console.error("Registration error:", error)
      toast({
        title: "Pendaftaran Gagal",
        description: "Terjadi kesalahan saat mendaftar. Silakan coba lagi.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Next step handler
  function handleNextStep() {
    const fieldsToValidate =
      step === 1
        ? [
            "full_name",
            "email",
            "phone",
            "nik",
            "participant_type",
            "institution",
            "address",
            "city",
            "province",
            "postal_code",
          ]
        : ["ticket_id", "payment_type", "terms"]

    form.trigger(fieldsToValidate as any).then((isValid) => {
      if (isValid) {
        setStep(step + 1)
      }
    })
  }

  // Previous step handler
  function handlePrevStep() {
    setStep(step - 1)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formulir Pendaftaran</CardTitle>
        <CardDescription>Lengkapi informasi di bawah ini untuk mendaftar sebagai peserta Symposium maupun Workshop MCVU XXIII 2025</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Lengkap</FormLabel>
                      <FormControl>
                        <Input placeholder="Masukkan nama lengkap" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="nama@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor Telepon</FormLabel>
                      <FormControl>
                        <Input placeholder="08xxxxxxxxxx" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nik"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NIK (Nomor Induk Kependudukan)</FormLabel>
                      <FormControl>
                        <Input placeholder="16 digit NIK" {...field} />
                      </FormControl>
                      <FormDescription>Masukkan 16 digit NIK tanpa spasi</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="participant_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipe Peserta</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih tipe peserta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="specialist_doctor">Dokter Spesialis</SelectItem>
                          <SelectItem value="general_doctor">Dokter Umum</SelectItem>
                          <SelectItem value="nurse">Perawat</SelectItem>
                          <SelectItem value="student">Mahasiswa</SelectItem>
                          <SelectItem value="other">Dokter Residen</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="institution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Institusi</FormLabel>
                      <FormControl>
                        <Input placeholder="Nama institusi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alamat</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Alamat lengkap" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kota</FormLabel>
                        <FormControl>
                          <Input placeholder="Kota" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provinsi</FormLabel>
                        <FormControl>
                          <Input placeholder="Provinsi" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kode Pos</FormLabel>
                        <FormControl>
                          <Input placeholder="Kode pos" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <Tabs defaultValue="ticket" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="ticket">Pilih Tiket</TabsTrigger>
                    <TabsTrigger value="workshop">Pilih Workshop</TabsTrigger>
                  </TabsList>
                  <TabsContent value="ticket" className="space-y-4 pt-4">
                    <FormField
                      control={form.control}
                      name="ticket_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Paket Tiket</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih paket tiket" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {tickets.map((ticket) => (
                                <SelectItem key={ticket.id} value={ticket.id}>
                                  {ticket.name} - Rp{" "}
                                  {ticket[`price_${form.getValues("participant_type")}`]?.toLocaleString("id-ID")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                  <TabsContent value="workshop" className="space-y-4 pt-4">
                    <FormField
                      control={form.control}
                      name="workshops"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">Workshop</FormLabel>
                            <FormDescription>Pilih workshop yang ingin diikuti (opsional)</FormDescription>
                          </div>
                          {workshops.map((workshop) => (
                            <FormField
                              key={workshop.id}
                              control={form.control}
                              name="workshops"
                              render={({ field }) => {
                                return (
                                  <FormItem key={workshop.id} className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(workshop.id)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...(field.value || []), workshop.id])
                                            : field.onChange(field.value?.filter((value) => value !== workshop.id))
                                        }}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel className="text-sm font-normal">
                                        {workshop.title} - Rp {workshop.price.toLocaleString("id-ID")}
                                      </FormLabel>
                                      <FormDescription>{workshop.description}</FormDescription>
                                    </div>
                                  </FormItem>
                                )
                              }}
                            />
                          ))}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </Tabs>

                <FormField
                  control={form.control}
                  name="promo_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kode Promo (opsional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Masukkan kode promo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipe Pembayaran</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih tipe pembayaran" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="self">Bayar Sendiri</SelectItem>
                          <SelectItem value="sponsor">Sponsor/Institusi</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("payment_type") === "sponsor" && (
                  <FormField
                    control={form.control}
                    name="sponsor_letter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Surat Jaminan Sponsor</FormLabel>
                        <FormControl>
                          <Input type="file" accept=".pdf" onChange={(e) => field.onChange(e.target.files?.[0])} />
                        </FormControl>
                        <FormDescription>Upload surat jaminan dari sponsor/institusi (format PDF)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="rounded-lg border p-4">
                  <h3 className="mb-2 font-semibold">Ringkasan Pembayaran</h3>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Biaya Pendaftaran</span>
                      <span>Rp {totalAmount.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Diskon</span>
                      <span>Rp 0</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>Rp {totalAmount.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="terms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Saya menyetujui syarat dan ketentuan yang berlaku</FormLabel>
                        <FormDescription>
                          Dengan mendaftar, Anda menyetujui untuk mematuhi peraturan acara
                        </FormDescription>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-between">
        {step > 1 && (
          <Button variant="outline" onClick={handlePrevStep} disabled={loading}>
            Kembali
          </Button>
        )}
        {step < 2 ? (
          <Button onClick={handleNextStep} disabled={loading}>
            Lanjut
          </Button>
        ) : (
          <Button onClick={form.handleSubmit(onSubmit)} disabled={loading}>
            {loading ? "Memproses..." : "Daftar Sekarang"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
