"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, XCircle } from "lucide-react"
import { Input } from "@/components/ui/input"

export default function CheckStatusPage() {
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registrationData, setRegistrationData] = useState<any>(null)
  const [paymentData, setPaymentData] = useState<any>(null)
  const [debugMode, setDebugMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const checkStatus = async () => {
    if (!registrationNumber) {
      setError("Silakan masukkan nomor pemesanan Anda.")
      return
    }

    setLoading(true)
    setError(null)
    setRegistrationData(null)
    setPaymentData(null)

    try {
      // Format the registration number with MCVU- prefix
      const formattedNumber = `MCVU-${registrationNumber}`
      const response = await fetch(`/api/check-registration?registrationNumber=${encodeURIComponent(formattedNumber)}`)

      if (!response.ok) {
        const data = await response.json()
        console.error("API error response:", data)
        setError(data.error || "Terjadi kesalahan saat memeriksa status")
        return
      }

      const data = await response.json()

      console.log("Registration data received:", data.registration)
      console.log("Payment data received:", data.payment)

      setRegistrationData(data.registration)
      setPaymentData(data.payment)
    } catch (err) {
      console.error("Error checking status:", err)
      setError("Terjadi kesalahan saat memeriksa status. Silakan coba lagi nanti.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    checkStatus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      checkStatus()
    }
  }

  const getStatusBadge = () => {
  if (!paymentData) {
    return (
      <div className="flex items-center gap-2 text-amber-600">
        <AlertCircle className="h-5 w-5" />
        <span>Menunggu Pembayaran</span>
      </div>
    )
  }
  if (paymentData.status === "verified") {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="h-5 w-5" />
        <span>Pembayaran Terverifikasi</span>
      </div>
    )
  }
  if (paymentData.status === "rejected") {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <XCircle className="h-5 w-5" />
        <span>Pembayaran Ditolak</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-amber-600">
      <AlertCircle className="h-5 w-5" />
      <span>Menunggu Verifikasi</span>
    </div>
  )
}

  // Toggle debug mode with 5 clicks on the title
  const handleTitleClick = () => {
    const debugClickCount = Number.parseInt(localStorage.getItem("debugClickCount") || "0") + 1
    localStorage.setItem("debugClickCount", debugClickCount.toString())

    if (debugClickCount >= 5) {
      setDebugMode(true)
      localStorage.setItem("debugClickCount", "0")
    }
  }

  // Handle numeric input only
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numeric input
    const value = e.target.value.replace(/\D/g, '')
    setRegistrationNumber(value)
  }
  
  // Position cursor after prefix
  useEffect(() => {
    if (inputRef.current) {
      // Set the cursor position after the last character
      const length = registrationNumber.length
      inputRef.current.focus()
      inputRef.current.setSelectionRange(length, length)
    }
  }, [registrationNumber])

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle onClick={handleTitleClick}>Cek Status Pendaftaran</CardTitle>
<CardDescription>Masukkan nomor pemesanan tiket Anda untuk cek status pembayaran</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
  <span className="absolute inset-y-0 left-3 flex items-center text-gray-500 select-none z-10">MCVU-</span>
  <Input
    ref={inputRef}
    type="text"
    value={registrationNumber}
    onChange={handleInputChange}
    className="pl-[4.5rem] tracking-tight"
    style={{ letterSpacing: 0 }}
    placeholder="Masukkan nomor pemesanan tiket Anda"
    disabled={loading}
    onKeyDown={handleKeyDown}
    autoComplete="off"
    inputMode="numeric"
  />
</div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
  {loading ? "Memeriksa..." : "Cek Status"}
</Button>
          </form>

          {registrationData && (
  <div className="mt-6 p-4 border rounded-lg">
    <h3 className="text-lg font-semibold mb-4">Status Pembayaran</h3>
    <div className="flex items-center justify-center py-4">
      {getStatusBadge()}
    </div>
    {paymentData && paymentData.status === "verified" && (
      <div className="mt-4 text-center text-sm text-green-600">
        Pembayaran Anda sudah diverifikasi. Terima kasih!
      </div>
    )}
    {(!paymentData || paymentData.status === "pending") && (
      <div className="mt-4 text-center text-sm text-amber-600">
        Silakan lakukan pembayaran untuk konfirmasi pendaftaran Anda. Bila sudah melakukan pembayaran, mohon tunggu 1x24 jam, bila belum terverifikasi silahkan menghubungi panitia MCVU 2025.
      </div>
    )}
    {paymentData && paymentData.status === "rejected" && (
      <div className="mt-4 text-center text-sm text-red-600">
        Pembayaran Anda ditolak. Silakan hubungi panitia.
      </div>
    )}
  </div>
)}
        </CardContent>
      </Card>
    </div>
  )
}
