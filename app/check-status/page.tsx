"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, XCircle } from "lucide-react"
import RegistrationNumberInput from "@/components/registration-number-input"

export default function CheckStatusPage() {
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registrationData, setRegistrationData] = useState<any>(null)
  const [paymentData, setPaymentData] = useState<any>(null)
  const [debugMode, setDebugMode] = useState(false)
  const router = useRouter()

  const checkStatus = async () => {
    if (!registrationNumber) {
      setError("Silakan masukkan nomor pendaftaran Anda")
      return
    }

    setLoading(true)
    setError(null)
    setRegistrationData(null)
    setPaymentData(null)

    try {
      const response = await fetch("/api/check-registration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ registrationNumber }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("API error response:", data)
        setError(data.error || "Terjadi kesalahan saat memeriksa status")
        return
      }

      console.log("Registration data received:", data.registration)
      console.log("Payment data received:", data.payment)

      setRegistrationData(data.registration)
      setPaymentData(data.payment)
    } catch (err) {
      console.error("Error checking status:", err)
      setError("Terjadi kesalahan saat memeriksa status")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!registrationNumber) {
      setError("Please enter a registration number")
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        `/api/check-registration?registrationNumber=${encodeURIComponent(registrationNumber)}`,
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Registration not found")
      }

      if (data.registration) {
        // Try the simple registration page first
        router.push(`/simple-registration/${data.registration.id}`)
      } else {
        setError("Registration not found")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Check Registration Status</CardTitle>
          <CardDescription>Enter your registration number to check your status</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <RegistrationNumberInput
                value={registrationNumber}
                onChange={setRegistrationNumber}
                placeholder="Enter registration number"
                disabled={loading}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Checking..." : "Check Status"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
