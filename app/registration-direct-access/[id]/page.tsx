"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, CheckCircle, Download, ArrowLeft, Loader2 } from "lucide-react"
import { createClient } from "@supabase/supabase-js"

export default function RegistrationDirectAccessPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registration, setRegistration] = useState<any>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [payment, setPayment] = useState<any>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Create a Supabase client (client-side)
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

        // Try to get the registration directly
        const { data: regData, error: regError } = await supabase
          .from("registrations")
          .select("*")
          .eq("id", params.id)
          .maybeSingle()

        if (regError) {
          console.error("Error fetching registration:", regError)
          throw new Error("Gagal mengambil data registrasi")
        }

        if (!regData) {
          // Try to get from the special view if it's the problematic ID
          if (params.id === "aa880d3c-25fe-46e1-897d-ea1022c0fdea") {
            const { data: specialData, error: specialError } = await supabase
              .from("registration_aa880d3c")
              .select("*")
              .maybeSingle()

            if (specialError || !specialData) {
              throw new Error("Registrasi tidak ditemukan")
            }

            setRegistration(specialData)
          } else {
            throw new Error("Registrasi tidak ditemukan")
          }
        } else {
          setRegistration(regData)
        }

        // Get participants
        const { data: participantsData, error: participantsError } = await supabase
          .from("participants")
          .select("*")
          .eq("registration_id", params.id)

        if (participantsError) {
          console.error("Error fetching participants:", participantsError)
        } else {
          setParticipants(participantsData || [])
        }

        // Get payment
        const { data: paymentData, error: paymentError } = await supabase
          .from("payments")
          .select("*")
          .eq("registration_id", params.id)
          .order("created_at", { ascending: false })
          .maybeSingle()

        if (paymentError) {
          console.error("Error fetching payment:", paymentError)
        } else if (paymentData) {
          setPayment(paymentData)
        }
      } catch (err: any) {
        console.error("Error in data fetching:", err)
        setError(err.message || "Terjadi kesalahan saat mengambil data registrasi")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id])

  if (loading) {
    return (
      <div className="container max-w-4xl py-10">
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg">Memuat data registrasi...</p>
        </div>
      </div>
    )
  }

  if (error || !registration) {
    return (
      <div className="container max-w-4xl py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Detail Pendaftaran</h1>
          <Button variant="outline" size="sm" onClick={() => router.push("/check-status")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
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
                {error ||
                  "Maaf, pendaftaran dengan ID ini tidak ditemukan. Silakan periksa kembali nomor pendaftaran Anda."}
              </AlertDescription>
            </Alert>
            <div className="mt-4">
              <Button onClick={() => router.push("/check-status")}>Kembali ke Cek Status</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isVerified = payment && payment.status === "verified"

  // Format date for display
  const formattedDate = new Date(registration.created_at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="container max-w-4xl py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Detail Pendaftaran</h1>
        <Button variant="outline" size="sm" onClick={() => router.push("/check-status")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Informasi Registrasi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-sm font-medium">Nomor Registrasi:</div>
              <div>{registration.registration_number}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-sm font-medium">ID Registrasi:</div>
              <div className="text-xs text-muted-foreground break-all">{registration.id}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-sm font-medium">Tanggal Pendaftaran:</div>
              <div>{formattedDate}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-sm font-medium">Total Pembayaran:</div>
              <div>Rp {registration.final_amount?.toLocaleString("id-ID") || "0"}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-sm font-medium">Status Pembayaran:</div>
              <div className={isVerified ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                {isVerified ? "Terverifikasi" : "Belum Terverifikasi"}
              </div>
            </div>
          </div>

          {!isVerified && (
            <div className="mt-4">
              <Button asChild>
                <a href={`/payment/${registration.id}`}>Lihat Detail Pembayaran</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detail Peserta</CardTitle>
        </CardHeader>
        <CardContent>
          {participants && participants.length > 0 ? (
            <div className="space-y-6">
              {participants.map((participant: any, index: number) => (
                <div key={participant.id}>
                  {index > 0 && <Separator className="my-6" />}
                  <div className="space-y-4">
                    <div className="font-medium text-lg">Peserta {index + 1}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-sm font-medium">Nama:</div>
                      <div>{participant.full_name}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-sm font-medium">Email:</div>
                      <div>{participant.email}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-sm font-medium">Tipe Peserta:</div>
                      <div>
                        {participant.participant_type === "specialist_doctor"
                          ? "Dokter Spesialis"
                          : participant.participant_type === "general_doctor"
                            ? "Dokter Umum"
                            : participant.participant_type === "nurse"
                              ? "Perawat"
                              : participant.participant_type === "student"
                                ? "Mahasiswa"
                                : "Dokter Residen"}
                      </div>
                    </div>
                    {participant.institution && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm font-medium">Institusi:</div>
                        <div>{participant.institution}</div>
                      </div>
                    )}

                    {isVerified && (
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
                  </div>
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
  )
}
