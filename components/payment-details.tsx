"use client"

import { useState } from "react"
import { Copy, Check, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"

interface PaymentDetailsProps {
  registration: any
}

export function PaymentDetails({ registration }: PaymentDetailsProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  // Add null checks for registration items and payments
  const registrationItem =
    registration.registration_items && registration.registration_items.length > 0
      ? registration.registration_items[0]
      : null
  const ticket = registrationItem?.ticket
  const payment = registration.payments && registration.payments.length > 0 ? registration.payments[0] : null

  // Get bank details from event_config
  const bankDetails = {
    bank_name: "Bank Mandiri",
    account_number: "1234567890",
    account_name: "MCVU Symposium 2025",
  }

  // Format expiry time (24 hours from now) with null check
  const expiryTime = payment?.created_at ? new Date(payment.created_at) : new Date()

  if (payment?.created_at) {
    expiryTime.setHours(expiryTime.getHours() + 24)
  }

  const formattedExpiryTime = expiryTime.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  // Extract unique deduction from notes if available
  const getUniqueDeduction = () => {
    if (registration.notes && registration.notes.includes("Unique Deduction:")) {
      const match = registration.notes.match(/Unique Deduction: (\d+)/)
      if (match && match[1]) {
        return Number.parseInt(match[1])
      }
    }
    return null
  }

  const uniqueDeduction = getUniqueDeduction()
  const originalAmount = uniqueDeduction ? registration.final_amount + uniqueDeduction : registration.final_amount

  // Copy account number to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast({
      title: "Disalin!",
      description: "Nomor rekening telah disalin ke clipboard",
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {!payment && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Data Pembayaran Tidak Lengkap</AlertTitle>
          <AlertDescription>
            Data pembayaran tidak ditemukan atau belum lengkap. Silakan hubungi administrator jika Anda yakin telah
            melakukan pembayaran.
          </AlertDescription>
        </Alert>
      )}

      {payment && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Perhatian</AlertTitle>
          <AlertDescription>
            Harap selesaikan pembayaran dalam 24 jam. Pendaftaran Anda akan dibatalkan jika pembayaran tidak diterima
            sebelum <strong>{formattedExpiryTime} WIB</strong>.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Detail Pembayaran</CardTitle>
          <CardDescription>Nomor Registrasi: {registration.registration_number}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {registrationItem?.participant && (
            <>
              <div className="space-y-2">
                <h3 className="font-medium">Informasi Peserta</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Nama</div>
                  <div>{registrationItem.participant.full_name}</div>
                  <div className="text-muted-foreground">Email</div>
                  <div>{registrationItem.participant.email}</div>
                  <div className="text-muted-foreground">Tipe Peserta</div>
                  <div>
                    {registrationItem.participant.participant_type === "specialist_doctor"
                      ? "Dokter Spesialis"
                      : registrationItem.participant.participant_type === "general_doctor"
                        ? "Dokter Umum"
                        : registrationItem.participant.participant_type === "nurse"
                          ? "Perawat"
                          : registrationItem.participant.participant_type === "student"
                            ? "Mahasiswa"
                            : "Dokter Residen"}
                  </div>
                </div>
              </div>

              <Separator />
            </>
          )}

          {ticket && (
            <>
              <div className="space-y-2">
                <h3 className="font-medium">Detail Tiket</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Paket</div>
                  <div>{ticket.name}</div>
                  {uniqueDeduction && (
                    <>
                      <div className="text-muted-foreground">Harga Asli</div>
                      <div>Rp {originalAmount.toLocaleString("id-ID")}</div>
                      <div className="text-muted-foreground">Pengurangan Unik</div>
                      <div className="text-amber-600">- Rp {uniqueDeduction.toLocaleString("id-ID")}</div>
                    </>
                  )}
                  <div className="text-muted-foreground">Jumlah Pembayaran</div>
                  <div className="font-bold">Rp {registration.final_amount?.toLocaleString("id-ID") || "0"}</div>
                </div>
              </div>

              <Separator />
            </>
          )}

          <div className="space-y-2">
            <h3 className="font-medium">Instruksi Transfer Bank</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Bank</div>
              <div>{bankDetails.bank_name}</div>
              <div className="text-muted-foreground">Nomor Rekening</div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{bankDetails.account_number}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(bankDetails.account_number)}
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="text-muted-foreground">Atas Nama</div>
              <div>{bankDetails.account_name}</div>
              <div className="text-muted-foreground">Jumlah Transfer</div>
              <div className="font-bold">Rp {registration.final_amount?.toLocaleString("id-ID") || "0"}</div>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Penting</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                Pastikan untuk mentransfer{" "}
                <strong>tepat sebesar Rp {registration.final_amount?.toLocaleString("id-ID") || "0"}</strong> untuk
                memudahkan verifikasi pembayaran.
              </p>
              {uniqueDeduction && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="font-medium text-amber-800">
                    Jumlah pembayaran ini sudah termasuk pengurangan unik sebesar Rp{" "}
                    {uniqueDeduction.toLocaleString("id-ID")} untuk identifikasi pembayaran Anda.
                  </p>
                </div>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Setelah melakukan pembayaran, sistem akan secara otomatis memverifikasi pembayaran Anda. Proses ini dapat
            memakan waktu hingga 1x24 jam.
          </p>
          <Button className="w-full" asChild>
            <a href="/">Kembali ke Beranda</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
