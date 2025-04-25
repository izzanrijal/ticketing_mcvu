import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, CheckCircle, Download, ArrowLeft } from "lucide-react"
import { RegistrationSummary } from "@/components/registration-summary"
import { ParticipantTicket } from "@/components/participant-ticket"

export default async function RegistrationSimplePage({
  params,
}: {
  params: { id: string }
}) {
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

  console.log("Simple page: Attempting to find registration with ID:", params.id)

  // Try multiple approaches to find the registration
  let registration = null
  let registrationError = null

  // Approach 1: Direct ID lookup
  const directResult = await supabase.from("registrations").select("*").eq("id", params.id).maybeSingle()

  registrationError = directResult.error
  registration = directResult.data

  console.log("Direct lookup result:", registration ? "Found" : "Not found")

  // Approach 2: Try with lowercase ID
  if (!registration) {
    const lowercaseResult = await supabase
      .from("registrations")
      .select("*")
      .filter("id", "ilike", params.id)
      .maybeSingle()

    if (!lowercaseResult.error && lowercaseResult.data) {
      registration = lowercaseResult.data
      console.log("Found registration with case-insensitive lookup")
    }
  }

  // Approach 3: Try to find via payment
  if (!registration) {
    console.log("Trying to find via payment")
    const paymentResult = await supabase.from("payments").select("registration_id").eq("id", params.id).maybeSingle()

    if (!paymentResult.error && paymentResult.data && paymentResult.data.registration_id) {
      const regResult = await supabase
        .from("registrations")
        .select("*")
        .eq("id", paymentResult.data.registration_id)
        .maybeSingle()

      if (!regResult.error && regResult.data) {
        registration = regResult.data
        console.log("Found registration via payment")
      }
    }
  }

  // Approach 4: Try to find via participant
  if (!registration) {
    console.log("Trying to find via participant")
    const participantResult = await supabase
      .from("participants")
      .select("registration_id")
      .eq("id", params.id)
      .maybeSingle()

    if (!participantResult.error && participantResult.data && participantResult.data.registration_id) {
      const regResult = await supabase
        .from("registrations")
        .select("*")
        .eq("id", participantResult.data.registration_id)
        .maybeSingle()

      if (!regResult.error && regResult.data) {
        registration = regResult.data
        console.log("Found registration via participant")
      }
    }
  }

  // Get payment data if we found a registration
  let payment = null
  let paymentError = null

  if (registration) {
    const paymentResult = await supabase
      .from("payments")
      .select("*")
      .eq("registration_id", registration.id)
      .order("created_at", { ascending: false })
      .maybeSingle()

    paymentError = paymentResult.error
    payment = paymentResult.data
  }

  // Get participants data if we found a registration
  let participants = []
  let participantsError = null

  if (registration) {
    const participantsResult = await supabase.from("participants").select("*").eq("registration_id", registration.id)

    participantsError = participantsResult.error
    participants = participantsResult.data || []
  }

  const isVerified = payment && payment.status === "verified"

  // If no registration was found, show an error page instead of 404
  if (!registration) {
    return (
      <div className="container max-w-4xl py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Detail Pendaftaran</h1>
          <Button variant="outline" size="sm" asChild>
            <a href="/check-status">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </a>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pendaftaran Tidak Ditemukan</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Maaf, pendaftaran dengan ID {params.id} tidak ditemukan. Silakan periksa kembali nomor pendaftaran Anda
                atau hubungi panitia untuk bantuan.
              </AlertDescription>
            </Alert>
            <div className="mt-4">
              <Button asChild>
                <a href="/check-status">Kembali ke Cek Status</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Detail Pendaftaran</h1>
        <Button variant="outline" size="sm" asChild>
          <a href="/check-status">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </a>
        </Button>
      </div>

      {isVerified ? (
        <Alert variant="success" className="mb-6 border-green-200 bg-green-50 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Pembayaran Terverifikasi</AlertTitle>
          <AlertDescription>
            Pembayaran Anda telah kami terima dan verifikasi. Terima kasih atas partisipasi Anda!
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="warning" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Menunggu Pembayaran</AlertTitle>
          <AlertDescription>
            Kami belum menerima pembayaran Anda. Silakan lakukan pembayaran sesuai instruksi yang telah diberikan.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Pendaftaran</CardTitle>
            </CardHeader>
            <CardContent>
              <RegistrationSummary registration={registration} payment={payment} />
            </CardContent>
          </Card>

          {isVerified && (
            <Card>
              <CardHeader>
                <CardTitle>Unduh Tiket</CardTitle>
              </CardHeader>
              <CardContent>
                <Button className="w-full" asChild>
                  <a href={`/api/generate-ticket?registrationId=${registration.id}`} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Unduh Tiket
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Detail Peserta</CardTitle>
            </CardHeader>
            <CardContent>
              {participants && participants.length > 0 ? (
                <div className="space-y-6">
                  {participants.map((participant, index) => (
                    <div key={participant.id}>
                      {index > 0 && <Separator className="my-6" />}
                      <ParticipantTicket participant={participant} registration={registration} showQR={isVerified} />
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Tidak Ada Data Peserta</AlertTitle>
                  <AlertDescription>Tidak ada data peserta yang terkait dengan pendaftaran ini.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
