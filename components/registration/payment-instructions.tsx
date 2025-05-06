"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon, Copy, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface PaymentInstructionsProps {
  registrationId: string
}

export function PaymentInstructions({ registrationId }: PaymentInstructionsProps) {
  const [registration, setRegistration] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>({})
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    async function fetchRegistration() {
      setLoading(true)
      setError(null)

      // Simpan informasi debug
      const debugData: any = {
        recentRegistrations: [],
        searchedId: registrationId,
        triedFormats: [],
        directQueryFailed: false,
      }

      try {
        // Coba beberapa format ID untuk memastikan kita mendapatkan data
        const formatsToTry = [
          registrationId, // Format asli
          registrationId.replace(/-/g, ""), // Tanpa tanda hubung
        ]

        debugData.triedFormats = formatsToTry

        // Coba setiap format
        let registrationData = null

        // APPROACH 1: Use raw SQL query to avoid the relationship issue
        try {
          const query = `
            SELECT 
              r.*,
              COALESCE(json_agg(p.*) FILTER (WHERE p.id IS NOT NULL), '[]') as payments
            FROM 
              registrations r
            LEFT JOIN 
              payments p ON p.registration_id = r.id
            WHERE 
              r.id = '${registrationId}'
            GROUP BY 
              r.id
          `

          const { data, error } = await supabase.rpc("execute_sql", { query_text: query })

          if (error) {
            console.error("SQL query error:", error)
            debugData.sqlQueryError = error.message
          } else if (data && data.length > 0) {
            registrationData = data[0]
            console.log("Found registration using SQL query")
          }
        } catch (sqlErr) {
          console.error("SQL query execution error:", sqlErr)
          debugData.sqlExecutionError = sqlErr.message
        }

        // APPROACH 2: If SQL query fails, try direct query with separate queries
        if (!registrationData) {
          try {
            // First get the registration
            const { data: regData, error: regError } = await supabase
              .from("registrations")
              .select("*")
              .eq("id", registrationId)
              .single()

            if (regError) {
              console.error("Direct registration query error:", regError)
              debugData.directQueryFailed = true
              debugData.registrationQueryError = regError.message
            } else if (regData) {
              // Then get the payments separately
              const { data: paymentData, error: paymentError } = await supabase
                .from("payments")
                .select("*")
                .eq("registration_id", registrationId)

              if (paymentError) {
                console.error("Payment query error:", paymentError)
                debugData.paymentQueryError = paymentError.message
              }

              // Combine the data
              registrationData = {
                ...regData,
                payments: paymentData || [],
              }

              console.log("Found registration using separate queries")
            }
          } catch (directErr) {
            console.error("Direct query execution error:", directErr)
            debugData.directExecutionError = directErr.message
          }
        }

        // APPROACH 3: Try alternative column name if it exists
        if (!registrationData) {
          try {
            const { data: paymentData, error: paymentError } = await supabase
              .from("payments")
              .select("*")
              .eq("parent_registration_id", registrationId)

            if (!paymentError && paymentData && paymentData.length > 0) {
              // We found payments with parent_registration_id, now get the registration
              const { data: regData, error: regError } = await supabase
                .from("registrations")
                .select("*")
                .eq("id", registrationId)
                .single()

              if (!regError && regData) {
                registrationData = {
                  ...regData,
                  payments: paymentData,
                }
                console.log("Found registration using parent_registration_id")
              }
            }
          } catch (altErr) {
            console.error("Alternative column query error:", altErr)
            debugData.alternativeColumnError = altErr.message
          }
        }

        // Ambil beberapa registrasi terbaru untuk debugging
        try {
          const { data: recentData } = await supabase
            .from("registrations")
            .select("id, created_at")
            .order("created_at", { ascending: false })
            .limit(5)

          if (recentData) {
            debugData.recentRegistrations = recentData
          }
        } catch (recentErr) {
          console.error("Error fetching recent registrations:", recentErr)
        }

        if (registrationData) {
          setRegistration(registrationData)
        } else {
          setError(`Registrasi dengan ID ${registrationId} tidak ditemukan. Pastikan ID registrasi benar.`)
          setDebugInfo(debugData)
        }
      } catch (error) {
        console.error("Error fetching registration:", error)
        setError(`Terjadi kesalahan saat mengambil data registrasi: ${error.message}`)
        setDebugInfo(debugData)
      } finally {
        setLoading(false)
      }
    }

    if (registrationId) {
      fetchRegistration()
    }
  }, [registrationId, supabase])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast({
      title: "Disalin!",
      description: "Informasi telah disalin ke clipboard",
    })
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Memuat instruksi pembayaran...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Informasi Debug</CardTitle>
            <CardDescription>Informasi ini dapat membantu administrator menyelesaikan masalah</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">ID Registrasi:</span> {registrationId}
              </div>
              <div>
                <span className="font-medium">Waktu:</span> {new Date().toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Halaman:</span> Payment Instructions
              </div>
              <div>
                <span className="font-medium">Kode Error:</span> CUSTOM_ERROR
              </div>
              <pre className="mt-2 rounded bg-slate-100 p-2 text-xs overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Coba Lagi
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (!registration) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <p className="text-muted-foreground">Data registrasi tidak ditemukan</p>
      </div>
    )
  }

  // Ambil informasi pembayaran
  const paymentInfo =
    registration.payments && registration.payments.length > 0
      ? registration.payments[0]
      : registration.payment_status !== undefined
        ? registration
        : null

  const paymentAmount = paymentInfo?.amount || registration.final_amount || 0
  const paymentStatus = paymentInfo?.status || paymentInfo?.payment_status || "pending"
  const paymentMethod = paymentInfo?.payment_method || "bank_transfer"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Instruksi Pembayaran</h2>
        <p className="text-muted-foreground">Silakan selesaikan pembayaran Anda sesuai dengan instruksi di bawah ini</p>
      </div>

      <Alert className="mb-4">
        <AlertTitle className="flex items-center">
          <InfoIcon className="mr-2 h-4 w-4" />
          Penting
        </AlertTitle>
        <AlertDescription>
          <p>
            Harap <strong>screenshot halaman ini</strong> atau <strong>catat nomor pendaftaran Anda</strong> untuk
            referensi di masa mendatang.
          </p>
          <p className="mt-2">Pembayaran akan diverifikasi dalam 3-5 hari kerja setelah transfer dilakukan.</p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Detail Pembayaran</CardTitle>
          <CardDescription>Informasi pembayaran untuk pendaftaran Anda</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm font-medium">Nomor Registrasi</div>
            <div className="flex items-center">
              {registration.registration_number || "N/A"}
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 h-6 w-6"
                onClick={() => copyToClipboard(registration.registration_number)}
              >
                {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="text-sm font-medium">Status Pembayaran</div>
            <div>
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                  paymentStatus === "paid" || paymentStatus === "verified"
                    ? "bg-green-100 text-green-800"
                    : paymentStatus === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {paymentStatus === "paid" || paymentStatus === "verified"
                  ? "Dibayar"
                  : paymentStatus === "pending"
                    ? "Menunggu Pembayaran"
                    : "Belum Dibayar"}
              </span>
            </div>
            <div className="text-sm font-medium">Jumlah Pembayaran</div>
            <div className="font-bold">Rp {paymentAmount.toLocaleString("id-ID")}</div>
            <div className="text-sm font-medium">Metode Pembayaran</div>
            <div>
              {paymentMethod === "bank_transfer"
                ? "Transfer Bank"
                : paymentMethod === "sponsor"
                  ? "Sponsor/Institusi"
                  : paymentMethod}
            </div>
          </div>

          <Separator />

          {paymentMethod === "bank_transfer" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Instruksi Transfer Bank</h3>
                <div className="rounded-md border p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-sm font-medium">Bank</div>
                    <div>Bank BTN</div>
                    <div className="text-sm font-medium">Nomor Rekening</div>
                    <div className="flex items-center">
                      00077-01-30-000120-6
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 h-6 w-6"
                        onClick={() => copyToClipboard("00077-01-30-000120-6")}
                      >
                        {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="text-sm font-medium">Atas Nama</div>
                    <div>PERKI CABANG MAKASSAR</div>
                    <div className="text-sm font-medium">Jumlah Transfer</div>
                    <div className="flex items-center font-bold">
                      Rp {paymentAmount.toLocaleString("id-ID")}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 h-6 w-6"
                        onClick={() => copyToClipboard(paymentAmount.toString())}
                      >
                        {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Update unique code information to show addition instead of subtraction */}
                  <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                    <h4 className="text-sm font-medium text-blue-800 mb-1">Informasi Kode Unik</h4>
                    <p className="text-xs text-blue-700">
                      Total pembayaran Anda sudah ditambahkan dengan kode unik sebesar{" "}
                      <span className="font-semibold">
                        Rp{" "}
                        {(
                          registration.uniqueAddition ||
                          registration.unique_code ||
                          registration.notes?.match(/Unique Code: \+(\d+)/)?.[1] ||
                          0
                        ).toLocaleString("id-ID")}
                      </span>{" "}
                      dari total asli{" "}
                      <span className="font-semibold">
                        Rp{" "}
                        {(
                          paymentAmount -
                          (registration.uniqueAddition ||
                            registration.unique_code ||
                            Number.parseInt(registration.notes?.match(/Unique Code: \+(\d+)/)?.[1] || "0"))
                        ).toLocaleString("id-ID")}
                      </span>
                      . Mohon transfer dengan jumlah yang tepat untuk memudahkan verifikasi otomatis.
                    </p>
                  </div>
                </div>
              </div>

              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-800" />
                <AlertTitle className="text-yellow-800">Penting</AlertTitle>
                <AlertDescription className="text-yellow-800">
                  <p>
                    Mohon transfer <strong>tepat</strong> sejumlah Rp {paymentAmount.toLocaleString("id-ID")} untuk
                    memudahkan verifikasi otomatis.
                  </p>
                  <p className="mt-1">
                    Sertakan nomor registrasi <strong>{registration.registration_number}</strong> pada keterangan
                    transfer.
                  </p>
                </AlertDescription>
              </Alert>

              <div>
                <h3 className="font-medium mb-2">Langkah-langkah Pembayaran</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Transfer dana ke rekening yang tertera di atas</li>
                  <li>
                    Pastikan jumlah transfer <strong>tepat</strong> sesuai dengan jumlah yang tertera
                  </li>
                  <li>Sertakan nomor registrasi pada keterangan transfer</li>
                  <li>Simpan bukti pembayaran</li>
                  <li>
                    Pembayaran akan diverifikasi dalam waktu 7x24 jam (hari kerja). Jika dalam 24 jam belum
                    terverifikasi, silakan hubungi panitia.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {paymentMethod === "sponsor" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Instruksi Pembayaran Sponsor/Institusi</h3>
                <div className="rounded-md border p-4 space-y-2">
                  <p className="text-sm">
                    Untuk pembayaran melalui sponsor atau institusi, silakan kirimkan surat pengantar resmi dari
                    institusi Anda ke email <strong>panitia.mcvu@perkimakassar.com</strong> dengan menyertakan:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Nomor registrasi: {registration.registration_number}</li>
                    <li>Nama peserta yang didaftarkan</li>
                    <li>Jumlah pembayaran: Rp {paymentAmount.toLocaleString("id-ID")}</li>
                    <li>Kontak person yang dapat dihubungi</li>
                  </ol>
                </div>
              </div>

              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-800" />
                <AlertTitle className="text-yellow-800">Penting</AlertTitle>
                <AlertDescription className="text-yellow-800">
                  <p>Pembayaran melalui sponsor/institusi harus dilunasi paling lambat 7 hari sebelum acara dimulai.</p>
                  <p className="mt-1">
                    Panitia akan mengirimkan invoice resmi ke email yang terdaftar setelah menerima surat pengantar dari
                    institusi Anda.
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            Kembali ke Beranda
          </Button>
          <Button onClick={() => router.push(`/check-status`)} variant="outline" className="mt-2">
            Cek Status Pembayaran
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
