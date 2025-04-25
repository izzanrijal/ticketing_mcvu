"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

interface Registration {
  id: string
  registration_number: string
  created_at: string
  status: string
  final_amount: number
  [key: string]: any
}

export default function DirectRegistrationPage({ params }: { params: { id: string } }) {
  const [registration, setRegistration] = useState<Registration | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  useEffect(() => {
    async function fetchRegistration() {
      try {
        const response = await fetch(`/api/direct-registration/${params.id}`)
        const data = await response.json()

        if (response.ok) {
          setRegistration(data.registration)
          setSource(data.source)
        } else {
          setError(data.error || "Failed to fetch registration")
          setDebugInfo(data)
        }
      } catch (err) {
        setError("An error occurred while fetching the registration")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchRegistration()
  }, [params.id])

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Requested ID:</h3>
                <p className="font-mono">{params.id}</p>
              </div>

              {debugInfo && (
                <div>
                  <h3 className="font-semibold">Methods Tried:</h3>
                  <ul className="list-disc pl-5">
                    {debugInfo.tried?.map((method: string) => (
                      <li key={method}>{method}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-4">
                <Link href="/check-status">
                  <Button>Return to Check Status</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      {source && (
        <Alert className="mb-4">
          <AlertTitle>Data Source</AlertTitle>
          <AlertDescription>
            Registration data retrieved from: <span className="font-semibold">{source}</span>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registration Details</CardTitle>
        </CardHeader>
        <CardContent>
          {registration && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Registration Number:</h3>
                <p>{registration.registration_number}</p>
              </div>

              <div>
                <h3 className="font-semibold">Registration ID:</h3>
                <p className="font-mono text-sm break-all">{registration.id}</p>
              </div>

              <div>
                <h3 className="font-semibold">Created At:</h3>
                <p>{new Date(registration.created_at).toLocaleString()}</p>
              </div>

              <div>
                <h3 className="font-semibold">Status:</h3>
                <p>{registration.status}</p>
              </div>

              <div>
                <h3 className="font-semibold">Amount:</h3>
                <p>Rp {registration.final_amount?.toLocaleString() || "N/A"}</p>
              </div>

              <div className="pt-4 flex space-x-4">
                <Link href={`/registration-simple/${registration.id}`}>
                  <Button>View Simple Registration</Button>
                </Link>

                <Link href={`/registration-details/${registration.id}`}>
                  <Button variant="outline">View Full Details</Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
