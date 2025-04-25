"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"

export default function SimpleRegistrationPage({ params }: { params: { id: string } }) {
  const [registration, setRegistration] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRegistration() {
      try {
        const response = await fetch(`/api/simple-registration/${params.id}`)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to fetch registration")
        }

        const data = await response.json()
        setRegistration(data.registration)
        setSource(data.source)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred")
        setLoading(false)
      }
    }

    fetchRegistration()
  }, [params.id])

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <p>Registration ID: {params.id}</p>
          <div className="mt-4 flex space-x-4">
            <Button asChild>
              <Link href="/check-status">Back to Check Status</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Registration Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="font-semibold">Registration Number:</p>
              <p>{registration.registration_number}</p>
            </div>
            <div>
              <p className="font-semibold">Status:</p>
              <p>{registration.status}</p>
            </div>
            <div>
              <p className="font-semibold">Created At:</p>
              <p>{new Date(registration.created_at).toLocaleString()}</p>
            </div>
            {registration.final_amount && (
              <div>
                <p className="font-semibold">Amount:</p>
                <p>Rp {registration.final_amount.toLocaleString()}</p>
              </div>
            )}
            <div>
              <p className="font-semibold">Registration ID:</p>
              <p className="break-all">{registration.id}</p>
            </div>
            {source && (
              <div>
                <p className="font-semibold">Data Source:</p>
                <p>{source}</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex space-x-4">
            <Button asChild>
              <Link href={`/registration-details/${registration.id}`}>View Full Details</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/check-status">Back to Check Status</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
