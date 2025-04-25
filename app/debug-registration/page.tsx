"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Search } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function DebugRegistrationPage() {
  const [id, setId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any>(null)

  const debugRegistration = async () => {
    if (!id) {
      setError("Please enter a registration ID")
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch("/api/debug-registration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "An error occurred")
        return
      }

      setResults(data)
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-4xl py-10">
      <h1 className="text-3xl font-bold mb-6">Debug Registration</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Registration ID Lookup</CardTitle>
          <CardDescription>Enter a registration ID to debug lookup issues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Enter registration ID"
              className="flex-1"
            />
            <Button onClick={debugRegistration} disabled={loading}>
              {loading ? "Debugging..." : "Debug"}
              {!loading && <Search className="ml-2 h-4 w-4" />}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Debug Results</CardTitle>
            <CardDescription>Results of registration lookup attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary">
              <TabsList className="mb-4">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="direct">Direct Lookup</TabsTrigger>
                <TabsTrigger value="case">Case-Insensitive</TabsTrigger>
                <TabsTrigger value="payment">Via Payment</TabsTrigger>
                <TabsTrigger value="participant">Via Participant</TabsTrigger>
              </TabsList>

              <TabsContent value="summary">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Lookup Summary</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="font-medium">Direct Lookup:</div>
                    <div>{results.directLookup.found ? "✅ Found" : "❌ Not Found"}</div>

                    <div className="font-medium">Case-Insensitive Lookup:</div>
                    <div>{results.caseSensitiveLookup.found ? "✅ Found" : "❌ Not Found"}</div>

                    <div className="font-medium">Via Payment:</div>
                    <div>{results.paymentLookup.found ? "✅ Found" : "❌ Not Found"}</div>

                    <div className="font-medium">Via Participant:</div>
                    <div>{results.participantLookup.found ? "✅ Found" : "❌ Not Found"}</div>
                  </div>

                  <h3 className="text-lg font-medium mt-6">Exists in Tables</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="font-medium">Registrations Table:</div>
                    <div>{results.existsInTables.registrations ? "✅ Yes" : "❌ No"}</div>

                    <div className="font-medium">Payments Table:</div>
                    <div>{results.existsInTables.payments ? "✅ Yes" : "❌ No"}</div>

                    <div className="font-medium">Participants Table:</div>
                    <div>{results.existsInTables.participants ? "✅ Yes" : "❌ No"}</div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="direct">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Direct Lookup Results</h3>
                  {results.directLookup.found ? (
                    <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96">
                      {JSON.stringify(results.directLookup.data, null, 2)}
                    </pre>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Not Found</AlertTitle>
                      <AlertDescription>No registration found with direct ID lookup.</AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="case">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Case-Insensitive Lookup Results</h3>
                  {results.caseSensitiveLookup.found ? (
                    <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96">
                      {JSON.stringify(results.caseSensitiveLookup.data, null, 2)}
                    </pre>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Not Found</AlertTitle>
                      <AlertDescription>No registration found with case-insensitive lookup.</AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="payment">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Via Payment Lookup Results</h3>
                  {results.paymentLookup.found ? (
                    <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96">
                      {JSON.stringify(results.paymentLookup.data, null, 2)}
                    </pre>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Not Found</AlertTitle>
                      <AlertDescription>No registration found via payment lookup.</AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="participant">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Via Participant Lookup Results</h3>
                  {results.participantLookup.found ? (
                    <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96">
                      {JSON.stringify(results.participantLookup.data, null, 2)}
                    </pre>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Not Found</AlertTitle>
                      <AlertDescription>No registration found via participant lookup.</AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter>
            <div className="text-sm text-muted-foreground">
              ID used for lookup: <code className="bg-muted px-1 py-0.5 rounded">{id}</code>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
