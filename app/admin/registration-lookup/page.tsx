"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"

export default function RegistrationLookup() {
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const supabase = createClientComponentClient()

  const lookupRegistration = async () => {
    if (!registrationNumber.trim()) {
      setError("Please enter a registration number")
      return
    }

    setLoading(true)
    setError("")
    setResults(null)

    try {
      // Try direct lookup first
      const { data: directData, error: directError } = await supabase
        .from("registrations")
        .select("id, registration_number, created_at")
        .eq("registration_number", registrationNumber)

      // Try with MCVU- prefix if not found
      const formattedNumber = registrationNumber.startsWith("MCVU-")
        ? registrationNumber
        : `MCVU-${registrationNumber.replace(/\D/g, "")}`

      const { data: prefixData, error: prefixError } = await supabase
        .from("registrations")
        .select("id, registration_number, created_at")
        .eq("registration_number", formattedNumber)

      // Try flexible search
      const numericPart = registrationNumber.replace(/\D/g, "")
      const { data: flexibleData, error: flexibleError } = await supabase
        .from("registrations")
        .select("id, registration_number, created_at")
        .ilike("registration_number", `%${numericPart}%`)
        .limit(5)

      // Try the function if available
      let functionData = null
      let functionError = null
      try {
        const functionResult = await supabase.rpc("find_registration_by_number", {
          search_number: registrationNumber,
        })
        functionData = functionResult.data
        functionError = functionResult.error
      } catch (err) {
        functionError = err
      }

      setResults({
        input: registrationNumber,
        formattedNumber,
        directLookup: {
          data: directData,
          error: directError ? directError.message : null,
        },
        prefixLookup: {
          data: prefixData,
          error: prefixError ? prefixError.message : null,
        },
        flexibleLookup: {
          data: flexibleData,
          error: flexibleError ? flexibleError.message : null,
        },
        functionLookup: {
          data: functionData,
          error: functionError ? (functionError as any).message : null,
        },
      })
    } catch (err: any) {
      setError(err.message || "An error occurred during lookup")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Registration Lookup Diagnostic</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Lookup Registration</CardTitle>
          <CardDescription>Enter a registration number to test different lookup methods</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Enter registration number (e.g., MCVU-12345678 or 12345678)"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  lookupRegistration()
                }
              }}
            />
            <Button onClick={lookupRegistration} disabled={loading}>
              {loading ? "Looking up..." : "Lookup"}
            </Button>
          </div>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Lookup Results</CardTitle>
            <CardDescription>Results from different lookup methods</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Input Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Original Input:</span>
                <span>{results.input}</span>
                <span className="text-muted-foreground">Formatted Number:</span>
                <span>{results.formattedNumber}</span>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Direct Lookup</h3>
              {results.directLookup.error ? (
                <Alert>
                  <AlertDescription>Error: {results.directLookup.error}</AlertDescription>
                </Alert>
              ) : results.directLookup.data && results.directLookup.data.length > 0 ? (
                <div className="space-y-2">
                  {results.directLookup.data.map((item: any) => (
                    <div key={item.id} className="p-3 bg-muted rounded-md">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">ID:</span>
                        <span>{item.id}</span>
                        <span className="text-muted-foreground">Registration Number:</span>
                        <span>{item.registration_number}</span>
                        <span className="text-muted-foreground">Created At:</span>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>No results found</AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Prefix Lookup (MCVU-)</h3>
              {results.prefixLookup.error ? (
                <Alert>
                  <AlertDescription>Error: {results.prefixLookup.error}</AlertDescription>
                </Alert>
              ) : results.prefixLookup.data && results.prefixLookup.data.length > 0 ? (
                <div className="space-y-2">
                  {results.prefixLookup.data.map((item: any) => (
                    <div key={item.id} className="p-3 bg-muted rounded-md">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">ID:</span>
                        <span>{item.id}</span>
                        <span className="text-muted-foreground">Registration Number:</span>
                        <span>{item.registration_number}</span>
                        <span className="text-muted-foreground">Created At:</span>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>No results found</AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Flexible Lookup (LIKE %number%)</h3>
              {results.flexibleLookup.error ? (
                <Alert>
                  <AlertDescription>Error: {results.flexibleLookup.error}</AlertDescription>
                </Alert>
              ) : results.flexibleLookup.data && results.flexibleLookup.data.length > 0 ? (
                <div className="space-y-2">
                  {results.flexibleLookup.data.map((item: any) => (
                    <div key={item.id} className="p-3 bg-muted rounded-md">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">ID:</span>
                        <span>{item.id}</span>
                        <span className="text-muted-foreground">Registration Number:</span>
                        <span>{item.registration_number}</span>
                        <span className="text-muted-foreground">Created At:</span>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>No results found</AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Function Lookup (find_registration_by_number)</h3>
              {results.functionLookup.error ? (
                <Alert>
                  <AlertDescription>Error: {results.functionLookup.error}</AlertDescription>
                </Alert>
              ) : results.functionLookup.data && results.functionLookup.data.length > 0 ? (
                <div className="space-y-2">
                  {results.functionLookup.data.map((item: any) => (
                    <div key={item.id} className="p-3 bg-muted rounded-md">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">ID:</span>
                        <span>{item.id}</span>
                        <span className="text-muted-foreground">Registration Number:</span>
                        <span>{item.registration_number}</span>
                        <span className="text-muted-foreground">Created At:</span>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>No results found</AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Raw Results</h3>
              <Textarea readOnly className="font-mono text-xs h-64" value={JSON.stringify(results, null, 2)} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
