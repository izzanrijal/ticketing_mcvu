import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { CheckCircle, Mail, AlertCircle, Download } from "lucide-react"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = {
  title: "Detail Peserta - MCVU XXIII 2025",
  description: "Informasi peserta dan tiket untuk MCVU XXIII 2025",
}

async function getRegistrationWithParticipants(id: string) {
  console.log("Server: Fetching registration with ID:", id)

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options })
        },
      },
    },
  )

  try {
    // First, try to get the registration by ID
    console.log("Server: Attempting to find registration by ID directly...")
    const { data: registrationData, error: registrationError } = await supabase
      .from("registrations")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (registrationError) {
      console.error("Server: Error fetching registration by ID:", registrationError)
      // Continue to try alternative methods
    }

    // If we found the registration by ID, use it
    if (registrationData) {
      console.log("Server: Found registration by ID:", registrationData.id)
      return await getFullRegistrationData(supabase, registrationData)
    }

    console.log("Server: No registration found with ID:", id)

    // Try to find the registration by payment ID instead
    console.log("Server: Trying to find registration through payment ID...")
    const { data: paymentData, error: paymentError } = await supabase
      .from("payments")
      .select("registration_id")
      .eq("id", id)
      .maybeSingle()

    if (paymentError) {
      console.error("Server: Error finding payment:", paymentError)
    }

    if (paymentData && paymentData.registration_id) {
      console.log("Server: Found payment with registration_id:", paymentData.registration_id)

      // Now get the registration using the registration_id from the payment
      const { data: registrationFromPayment, error: registrationFromPaymentError } = await supabase
        .from("registrations")
        .select("*")
        .eq("id", paymentData.registration_id)
        .maybeSingle()

      if (registrationFromPaymentError) {
        console.error("Server: Error fetching registration from payment:", registrationFromPaymentError)
      } else if (registrationFromPayment) {
        console.log("Server: Found registration through payment:", registrationFromPayment.id)
        // Use this registration data instead
        return await getFullRegistrationData(supabase, registrationFromPayment)
      }
    }

    // If we still don't have a registration, try to find it by registration number
    if (id.startsWith("MCVU-") || /^[A-Za-z0-9-]+$/.test(id)) {
      console.log("Server: Trying to find registration by registration number...")
      const { data: registrationByNumber, error: registrationByNumberError } = await supabase
        .from("registrations")
        .select("*")
        .eq("registration_number", id)
        .maybeSingle()

      if (registrationByNumberError) {
        console.error("Server: Error finding registration by number:", registrationByNumberError)
      } else if (registrationByNumber) {
        console.log("Server: Found registration by registration number:", registrationByNumber.id)
        return await getFullRegistrationData(supabase, registrationByNumber)
      }
    }

    // Try a more flexible search for the registration ID
    console.log("Server: Trying a more flexible search for registration ID...")
    const { data: allRegistrations, error: allRegistrationsError } = await supabase
      .from("registrations")
      .select("id")
      .limit(100)

    if (allRegistrationsError) {
      console.error("Server: Error fetching all registrations:", allRegistrationsError)
    } else if (allRegistrations && allRegistrations.length > 0) {
      console.log("Server: Found", allRegistrations.length, "registrations to check")

      // Check if any registration ID matches (case-insensitive)
      const matchingRegistration = allRegistrations.find((reg) => reg.id.toLowerCase() === id.toLowerCase())

      if (matchingRegistration) {
        console.log("Server: Found registration with case-insensitive match:", matchingRegistration.id)

        // Get the full registration data
        const { data: fullRegistration, error: fullRegistrationError } = await supabase
          .from("registrations")
          .select("*")
          .eq("id", matchingRegistration.id)
          .maybeSingle()

        if (fullRegistrationError) {
          console.error("Server: Error fetching full registration:", fullRegistrationError)
        } else if (fullRegistration) {
          return await getFullRegistrationData(supabase, fullRegistration)
        }
      }
    }

    // If we still don't have a registration, try to find it by payment registration_id
    console.log("Server: Trying to find registration through payments table...")
    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .select("registration_id")
      .limit(100)

    if (paymentsError) {
      console.error("Server: Error fetching payments:", paymentsError)
    } else if (paymentsData && paymentsData.length > 0) {
      console.log("Server: Found", paymentsData.length, "payments to check")

      // Check if any payment registration_id matches (case-insensitive)
      const matchingPayment = paymentsData.find(
        (payment) => payment.registration_id && payment.registration_id.toLowerCase() === id.toLowerCase(),
      )

      if (matchingPayment) {
        console.log("Server: Found payment with matching registration_id:", matchingPayment.registration_id)

        // Get the full registration data
        const { data: fullRegistration, error: fullRegistrationError } = await supabase
          .from("registrations")
          .select("*")
          .eq("id", matchingPayment.registration_id)
          .maybeSingle()

        if (fullRegistrationError) {
          console.error("Server: Error fetching full registration:", fullRegistrationError)
        } else if (fullRegistration) {
          return await getFullRegistrationData(supabase, fullRegistration)
        }
      }
    }

    // If we still don't have a registration, return null
    console.log("Server: Could not find registration with any method for ID:", id)
    return null
  } catch (error) {
    console.error("Server: Error in getRegistrationWithParticipants:", error)
    return null
  }
}

async function getFullRegistrationData(supabase, registrationData) {
  const registrationId = registrationData.id

  // Step 2: Fetch participants
  const { data: participantsData, error: participantsError } = await supabase
    .from("participants")
    .select("*")
    .eq("registration_id", registrationId)

  if (participantsError) {
    console.error("Server: Error fetching participants:", participantsError)
    return { ...registrationData, participants: [] }
  }

  // Step 3: Fetch payment to verify status
  const { data: paymentData, error: paymentError } = await supabase
    .from("payments")
    .select("*")
    .eq("registration_id", registrationId)
    .order("created_at", { ascending: false })
    .limit(1)

  if (paymentError) {
    console.error("Server: Error fetching payment:", paymentError)
    // Continue with null payment data
  }

  // Check if any payment is verified
  const verifiedPayment = paymentData?.find((payment) => payment.status === "verified")
  const hasVerifiedPayment = !!verifiedPayment
  console.log("Server: Verified payment status:", hasVerifiedPayment)

  // Step 4: Fetch tickets for participants
  const { data: registrationItems, error: itemsError } = await supabase
    .from("registration_items")
    .select("*, ticket:tickets(*)")
    .or(`parent_registration_id.eq.${registrationId},registration_id.eq.${registrationId}`)

  if (itemsError) {
    console.error("Server: Error fetching registration items:", itemsError)
  }

  // Combine all data
  return {
    ...registrationData,
    participants: participantsData || [],
    payment: verifiedPayment || (paymentData && paymentData.length > 0 ? paymentData[0] : null),
    items: registrationItems || [],
    hasVerifiedPayment: hasVerifiedPayment,
  }
}

export default async function RegistrationDetailsPage({
  params,
}: {
  params: { id: string }
}) {
  const registration = await getRegistrationWithParticipants(params.id)

  if (!registration) {
    notFound()
  }

  // Format date for display
  const formattedDate = new Date(registration.created_at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  // In the RegistrationDetailsPage component, add this check:
  const paymentStatus = registration.hasVerifiedPayment ? "Terverifikasi" : "Belum Terverifikasi"
  const paymentStatusColor = registration.hasVerifiedPayment ? "text-green-600" : "text-amber-600"
  const headerBgClass = registration.hasVerifiedPayment
    ? "bg-green-50 border-green-100"
    : "bg-amber-50 border-amber-100"
  const headerTextClass = registration.hasVerifiedPayment ? "text-green-700" : "text-amber-700"

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold md:text-4xl">Detail Peserta</h1>
              <p className="mt-2 text-muted-foreground">Informasi peserta dan tiket untuk MCVU XXIII 2025</p>
            </div>

            {registration.hasVerifiedPayment ? (
              <Alert className="mb-6 bg-green-50 border-green-100 text-green-800">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle>Pembayaran Terverifikasi</AlertTitle>
                <AlertDescription>
                  Tiket untuk setiap peserta telah dikirim ke alamat email masing-masing. Silakan periksa kotak masuk
                  atau folder spam email Anda.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="mb-6 bg-amber-50 border-amber-100 text-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle>Pembayaran Belum Terverifikasi</AlertTitle>
                <AlertDescription>
                  Pembayaran Anda belum terverifikasi. Tiket akan dikirim setelah pembayaran terverifikasi.
                </AlertDescription>
              </Alert>
            )}

            <Card className="mb-6">
              <CardHeader className={headerBgClass + " border-b"}>
                <div className={`flex items-center gap-2 ${headerTextClass}`}>
                  {registration.hasVerifiedPayment ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                  <CardTitle>
                    {registration.hasVerifiedPayment ? "Pembayaran Terverifikasi" : "Pembayaran Belum Terverifikasi"}
                  </CardTitle>
                </div>
                <CardDescription>
                  Nomor Registrasi: <span className="font-medium">{registration.registration_number}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {registration.hasVerifiedPayment && (
                  <Alert className="mb-6 bg-blue-50 border-blue-100 text-blue-800">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <AlertTitle>Tiket Telah Dikirim</AlertTitle>
                    <AlertDescription>
                      Tiket untuk setiap peserta telah dikirim ke alamat email masing-masing. Silakan periksa kotak
                      masuk atau folder spam email Anda.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2 mb-4">
                  <h3 className="font-medium">Informasi Registrasi</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Tanggal Pendaftaran</div>
                    <div>{formattedDate}</div>
                    <div className="text-muted-foreground">Total Pembayaran</div>
                    <div className="font-medium">Rp {registration.final_amount?.toLocaleString("id-ID") || "0"}</div>
                    <div className="text-muted-foreground">Status</div>
                    <div className={paymentStatusColor + " font-medium"}>{paymentStatus}</div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                  <h3 className="font-medium">Daftar Peserta</h3>
                  <p className="text-sm text-muted-foreground">
                    Berikut adalah daftar peserta yang terdaftar dengan nomor registrasi ini:
                  </p>

                  {registration.participants.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Tidak Ada Peserta</AlertTitle>
                      <AlertDescription>
                        Tidak ada peserta yang terdaftar dengan nomor registrasi ini.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-4">
                      {registration.participants.map((participant: any, index: number) => {
                        // Find the registration item for this participant
                        const item = registration.items?.find((item: any) => item.participant_id === participant.id)
                        const ticketName = item?.ticket?.name || "Tiket Umum"

                        return (
                          <Card key={participant.id} className="overflow-hidden">
                            <CardHeader className="bg-muted py-3 px-4">
                              <div className="flex justify-between items-center">
                                <CardTitle className="text-base">Peserta {index + 1}</CardTitle>
                                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                                  {ticketName}
                                </span>
                              </div>
                            </CardHeader>
                            <CardContent className="p-4">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="text-muted-foreground">Nama</div>
                                <div className="font-medium">{participant.full_name}</div>

                                <div className="text-muted-foreground">Email</div>
                                <div>{participant.email}</div>

                                <div className="text-muted-foreground">Tipe Peserta</div>
                                <div>
                                  {participant.participant_type === "specialist_doctor"
                                    ? "Dokter Spesialis"
                                    : participant.participant_type === "general_doctor"
                                      ? "Dokter Umum"
                                      : participant.participant_type === "nurse"
                                        ? "Perawat"
                                        : participant.participant_type === "student"
                                          ? "Mahasiswa"
                                          : participant.participant_type === "resident_doctor"
                                            ? "Dokter Residen"
                                            : "Dokter Residen"}
                                </div>

                                {participant.institution && (
                                  <>
                                    <div className="text-muted-foreground">Institusi</div>
                                    <div>{participant.institution}</div>
                                  </>
                                )}
                              </div>

                              {registration.hasVerifiedPayment && (
                                <div className="mt-4 pt-3 border-t flex justify-between items-center">
                                  <div className="text-sm text-green-600 flex items-center gap-1">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>Tiket dikirim ke email</span>
                                  </div>
                                  <Button size="sm" variant="outline" className="h-8">
                                    <Download className="h-3.5 w-3.5 mr-1" />
                                    Unduh Tiket
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4 bg-muted/20">
                {registration.hasVerifiedPayment ? (
                  <Alert className="bg-amber-50 border-amber-100 text-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertTitle>Penting</AlertTitle>
                    <AlertDescription>
                      Jika Anda belum menerima tiket, silakan periksa folder spam email Anda atau hubungi panitia di
                      panitia.mcvu@perkimakassar.com
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-blue-50 border-blue-100 text-blue-800">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <AlertTitle>Informasi Pembayaran</AlertTitle>
                    <AlertDescription>
                      Silakan lakukan pembayaran sesuai dengan instruksi yang telah diberikan. Tiket akan dikirim
                      setelah pembayaran terverifikasi.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex justify-between w-full">
                  <Button variant="outline" asChild>
                    <a href="/check-status">Kembali</a>
                  </Button>
                  {!registration.hasVerifiedPayment && (
                    <Button asChild>
                      <a href={`/payment/${registration.id}`}>Lihat Detail Pembayaran</a>
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
