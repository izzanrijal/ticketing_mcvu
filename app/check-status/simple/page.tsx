"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"

export default function SimpleCheckStatus() {
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [inputFocused, setInputFocused] = useState(false)

  const checkStatus = async () => {
    if (!registrationNumber) {
      setError("Silakan masukkan nomor pendaftaran Anda")
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/check-registration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ registrationNumber }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Terjadi kesalahan saat memeriksa status")
      }

      setResult(data)
    } catch (err: any) {
      console.error("Error checking status:", err)
      setError(err.message || "Terjadi kesalahan saat memeriksa status")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      checkStatus()
    }
  }

  const getStatusBadge = () => {
    if (!result || !result.payment) {
      return (
        <div className="flex items-center text-yellow-600">
          <AlertCircle className="mr-2 h-5 w-5" />
          <span>Menunggu Pembayaran</span>
        </div>
      )
    }

    if (result.payment.status === "verified") {
      return (
        <div className="flex items-center text-green-600">
          <CheckCircle className="mr-2 h-5 w-5" />
          <span>Pembayaran Terverifikasi</span>
        </div>
      )
    }

    if (result.payment.status === "pending") {
      return (
        <div className="flex items-center text-yellow-600">
          <AlertCircle className="mr-2 h-5 w-5" />
          <span>Pembayaran Sedang Diproses</span>
        </div>
      )
    }

    if (result.payment.status === "rejected") {
      return (
        <div className="flex items-center text-red-600">
          <XCircle className="mr-2 h-5 w-5" />
          <span>Pembayaran Ditolak</span>
        </div>
      )
    }

    return (
      <div className="flex items-center text-gray-600">
        <AlertCircle className="mr-2 h-5 w-5" />
        <span>Status: {result.payment.status}</span>
      </div>
    )
  }

  return (
    <div className="container max-w-3xl py-10">
      <h1 className="text-3xl font-bold mb-6 text-center">Cek Status Pembayaran</h1>

      <Card>
        <CardHeader>
          <CardTitle>Masukkan Nomor Pendaftaran</CardTitle>
          <CardDescription>Masukkan nomor pendaftaran Anda untuk memeriksa status pembayaran</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                MCVU-
              </div>
              <Input
                value={registrationNumber}
                onChange={(e) => {
                  // Only allow numbers in the input
                  const value = e.target.value.replace(/\D/g, "")
                  setRegistrationNumber(value)
                }}
                placeholder="12345678"
                className="pl-16" // Add padding to accommodate the prefix
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    checkStatus()
                  }
                }}
                disabled={loading}
              />
            </div>
            <Button onClick={checkStatus} disabled={loading}>
              {loading ? "Memeriksa..." : "Periksa"}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {result && !loading && (
            <div className="mt-6 space-y-4">
              <div className="p-4 border rounded-md">
                <h3 className="font-medium mb-2">Status Pembayaran</h3>
                {getStatusBadge()}
              </div>

              <div className="p-4 border rounded-md">
                <h3 className="font-medium mb-2">Detail Pendaftaran</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Nomor Pendaftaran:</div>
                  <div>{result.registration.registration_number}</div>
                  <div className="font-medium">Tanggal Pendaftaran:</div>
                  <div>{new Date(result.registration.created_at).toLocaleDateString("id-ID")}</div>
                  <div className="font-medium">Kategori:</div>
                  <div>{result.registration.category}</div>
                </div>
              </div>

              {result.payment && (
                <div className="p-4 border rounded-md">
                  <h3 className="font-medium mb-2">Detail Pembayaran</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="font-medium">Metode Pembayaran:</div>
                    <div>{result.payment.payment_method || "-"}</div>
                    <div className="font-medium">Jumlah:</div>
                    <div>
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        minimumFractionDigits: 0,
                      }).format(result.payment.amount || 0)}
                    </div>
                    <div className="font-medium">Tanggal Pembayaran:</div>
                    <div>
                      {result.payment.payment_date
                        ? new Date(result.payment.payment_date).toLocaleDateString("id-ID")
                        : "-"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <p className="text-sm text-muted-foreground">Jika Anda memiliki pertanyaan, silakan hubungi panitia.</p>
        </CardFooter>
      </Card>
    </div>
  )
}
