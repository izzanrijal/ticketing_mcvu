"use client"

import { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle, AlertCircle, Search, Database, RefreshCw } from "lucide-react"
import { DashboardLayout } from "@/components/admin/dashboard-layout"

export default function RegistrationDiagnosticPage() {
  const [registrationId, setRegistrationId] = useState("")
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any>(null)
  const [fixApplied, setFixApplied] = useState(false)
  const [fixLoading, setFixLoading] = useState(false)
  const [fixError, setFixError] = useState<string | null>(null)
  const [fixResult, setFixResult] = useState<string | null>(null)
  const supabase = createClientComponentClient()

  const searchById = async () => {
    if (!registrationId) {
      setError("Please enter a registration ID")
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      // First, try to get the registration by ID
      const { data: registrationData, error: registrationError } = await supabase
        .from("registrations")
        .select("*")
        .eq("id", registrationId)
        .maybeSingle()

      if (registrationError) {
        console.error("Error fetching registration by ID:", registrationError)
        setError(`Error fetching registration: ${registrationError.message}`)
        return
      }

      // Try case-insensitive search
      const { data: caseInsensitiveData, error: caseInsensitiveError } = await supabase.rpc("find_registration_by_id", {
        search_id: registrationId,
      })

      // Try to get all registrations to check for similar IDs
      const { data: allRegistrations, error: allRegistrationsError } = await supabase
        .from("registrations")
        .select("id, registration_number, created_at")
        .order("created_at", { ascending: false })
        .limit(10)

      // Try to get payments with this registration ID
      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .select("*")
        .eq("registration_id", registrationId)
        .order("created_at", { ascending: false })

      // Try to get participants with this registration ID
      const { data: participantData, error: participantError } = await supabase
        .from("participants")
        .select("*")
        .eq("registration_id", registrationId)

      setResults({
        registrationData,
        caseInsensitiveData,
        allRegistrations: allRegistrationsError ? null : allRegistrations,
        paymentData: paymentError ? null : paymentData,
        participantData: participantError ? null : participantData,
        errors: {
          registration: registrationError ? registrationError.message : null,
          caseInsensitive: caseInsensitiveError ? caseInsensitiveError.message : null,
          allRegistrations: allRegistrationsError ? allRegistrationsError.message : null,
          payment: paymentError ? paymentError.message : null,
          participant: participantError ? participantError.message : null,
        },
      })
    } catch (err: any) {
      console.error("Error in diagnostic search:", err)
      setError(`Error in diagnostic search: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const searchByNumber = async () => {
    if (!registrationNumber) {
      setError("Please enter a registration number")
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      // Format the registration number to ensure it has the MCVU- prefix
      let formattedRegNumber = registrationNumber
      if (!formattedRegNumber.startsWith("MCVU-")) {
        formattedRegNumber = `MCVU-${formattedRegNumber}`
      }

      // Try to get the registration by registration number
      const { data: registrationData, error: registrationError } = await supabase
        .from("registrations")
        .select("*")
        .eq("registration_number", formattedRegNumber)
        .maybeSingle()

      if (registrationError) {
        console.error("Error fetching registration by number:", registrationError)
        setError(`Error fetching registration: ${registrationError.message}`)
        return
      }

      // Try flexible search
      const { data: flexibleData, error: flexibleError } = await supabase.rpc("find_registration_by_number", {
        search_number: formattedRegNumber,
      })

      // Try to get all registrations to check for similar numbers
      const { data: allRegistrations, error: allRegistrationsError } = await supabase
        .from("registrations")
        .select("id, registration_number, created_at")
        .order("created_at", { ascending: false })
        .limit(10)

      setResults({
        registrationData,
        flexibleData,
        allRegistrations: allRegistrationsError ? null : allRegistrations,
        errors: {
          registration: registrationError ? registrationError.message : null,
          flexible: flexibleError ? flexibleError.message : null,
          allRegistrations: allRegistrationsError ? allRegistrationsError.message : null,
        },
      })
    } catch (err: any) {
      console.error("Error in diagnostic search:", err)
      setError(`Error in diagnostic search: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const fixRegistrationRelationships = async () => {
    if (!registrationId) {
      setFixError("Please enter a registration ID to fix")
      return
    }

    setFixLoading(true)
    setFixError(null)
    setFixResult(null)
    setFixApplied(false)

    try {
      // Execute SQL to fix relationships
      const { data, error } = await supabase.rpc("fix_registration_relationships", {
        reg_id: registrationId,
      })

      if (error) {
        console.error("Error fixing relationships:", error)
        setFixError(`Error fixing relationships: ${error.message}`)
        return
      }

      setFixResult("Relationships fixed successfully. Please search again to verify.")
      setFixApplied(true)
    } catch (err: any) {
      console.error("Error in fix operation:", err)
      setFixError(`Error in fix operation: ${err.message}`)
    } finally {
      setFixLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="container py-10">
        <h1 className="text-3xl font-bold mb-6">Registration Diagnostic Tool</h1>

        <Tabs defaultValue="id" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="id">Search by ID</TabsTrigger>
            <TabsTrigger value="number">Search by Registration Number</TabsTrigger>
          </TabsList>

          <TabsContent value="id" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Search Registration by ID</CardTitle>
                <CardDescription>Enter a registration ID to diagnose issues</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={registrationId}
                    onChange={(e) => setRegistrationId(e.target.value)}
                    placeholder="e.g., aa880d3c-25fe-46e1-897d-ea1022c0fdea"
                    className="flex-1"
                  />
                  <Button onClick={searchById} disabled={loading}>
                    {loading ? "Searching..." : "Search"}
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

            {loading && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </CardContent>
              </Card>
            )}

            {results && !loading && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Direct Registration Lookup</CardTitle>
                    <CardDescription>Results from direct ID lookup</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {results.registrationData ? (
                      <div className="space-y-4">
                        <Alert variant="success" className="border-green-200 bg-green-50 text-green-800">
                          <CheckCircle className="h-4 w-4" />
                          <AlertTitle>Registration Found</AlertTitle>
                          <AlertDescription>
                            Registration with ID {registrationId} was found in the database.
                          </AlertDescription>
                        </Alert>

                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Field</TableHead>
                                <TableHead>Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Object.entries(results.registrationData).map(([key, value]: [string, any]) => (
                                <TableRow key={key}>
                                  <TableCell className="font-medium">{key}</TableCell>
                                  <TableCell>
                                    {typeof value === "object"
                                      ? JSON.stringify(value)
                                      : value instanceof Date
                                        ? value.toISOString()
                                        : String(value)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Registration Not Found</AlertTitle>
                        <AlertDescription>
                          No registration with ID {registrationId} was found in the database.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Case-Insensitive Lookup</CardTitle>
                    <CardDescription>Results from case-insensitive ID lookup</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {results.caseInsensitiveData && results.caseInsensitiveData.length > 0 ? (
                      <div className="space-y-4">
                        <Alert variant="success" className="border-green-200 bg-green-50 text-green-800">
                          <CheckCircle className="h-4 w-4" />
                          <AlertTitle>Registration Found (Case-Insensitive)</AlertTitle>
                          <AlertDescription>
                            Registration with similar ID was found using case-insensitive search.
                          </AlertDescription>
                        </Alert>

                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Registration Number</TableHead>
                                <TableHead>Created At</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {results.caseInsensitiveData.map((reg: any) => (
                                <TableRow key={reg.id}>
                                  <TableCell className="font-medium">{reg.id}</TableCell>
                                  <TableCell>{reg.registration_number}</TableCell>
                                  <TableCell>
                                    {new Date(reg.created_at).toLocaleDateString("id-ID", {
                                      day: "numeric",
                                      month: "long",
                                      year: "numeric",
                                    })}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No Case-Insensitive Matches</AlertTitle>
                        <AlertDescription>
                          No registrations with similar ID were found using case-insensitive search.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Related Data</CardTitle>
                    <CardDescription>Payments and participants related to this registration</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="payments">
                      <TabsList>
                        <TabsTrigger value="payments">Payments</TabsTrigger>
                        <TabsTrigger value="participants">Participants</TabsTrigger>
                      </TabsList>

                      <TabsContent value="payments" className="mt-4">
                        {results.paymentData && results.paymentData.length > 0 ? (
                          <div className="space-y-4">
                            <Alert variant="success" className="border-green-200 bg-green-50 text-green-800">
                              <CheckCircle className="h-4 w-4" />
                              <AlertTitle>Payments Found</AlertTitle>
                              <AlertDescription>
                                {results.paymentData.length} payment(s) found for this registration.
                              </AlertDescription>
                            </Alert>

                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created At</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {results.paymentData.map((payment: any) => (
                                    <TableRow key={payment.id}>
                                      <TableCell className="font-medium">{payment.id}</TableCell>
                                      <TableCell>Rp {payment.amount?.toLocaleString("id-ID") || "0"}</TableCell>
                                      <TableCell>
                                        <span
                                          className={`px-2 py-1 rounded-full text-xs ${
                                            payment.status === "verified"
                                              ? "bg-green-100 text-green-800"
                                              : payment.status === "rejected"
                                                ? "bg-red-100 text-red-800"
                                                : "bg-amber-100 text-amber-800"
                                          }`}
                                        >
                                          {payment.status}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        {new Date(payment.created_at).toLocaleDateString("id-ID", {
                                          day: "numeric",
                                          month: "long",
                                          year: "numeric",
                                        })}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        ) : (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>No Payments Found</AlertTitle>
                            <AlertDescription>No payments found for this registration.</AlertDescription>
                          </Alert>
                        )}
                      </TabsContent>

                      <TabsContent value="participants" className="mt-4">
                        {results.participantData && results.participantData.length > 0 ? (
                          <div className="space-y-4">
                            <Alert variant="success" className="border-green-200 bg-green-50 text-green-800">
                              <CheckCircle className="h-4 w-4" />
                              <AlertTitle>Participants Found</AlertTitle>
                              <AlertDescription>
                                {results.participantData.length} participant(s) found for this registration.
                              </AlertDescription>
                            </Alert>

                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Type</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {results.participantData.map((participant: any) => (
                                    <TableRow key={participant.id}>
                                      <TableCell className="font-medium">{participant.id}</TableCell>
                                      <TableCell>{participant.full_name}</TableCell>
                                      <TableCell>{participant.email}</TableCell>
                                      <TableCell>{participant.participant_type}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        ) : (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>No Participants Found</AlertTitle>
                            <AlertDescription>No participants found for this registration.</AlertDescription>
                          </Alert>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Registrations</CardTitle>
                    <CardDescription>Most recent registrations in the database</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {results.allRegistrations && results.allRegistrations.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Registration Number</TableHead>
                              <TableHead>Created At</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.allRegistrations.map((reg: any) => (
                              <TableRow key={reg.id}>
                                <TableCell className="font-medium">{reg.id}</TableCell>
                                <TableCell>{reg.registration_number}</TableCell>
                                <TableCell>
                                  {new Date(reg.created_at).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No Registrations</AlertTitle>
                        <AlertDescription>No recent registrations found in the database.</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Fix Registration Relationships</CardTitle>
                    <CardDescription>Apply fixes to registration relationships</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Alert>
                        <Database className="h-4 w-4" />
                        <AlertTitle>Database Fix</AlertTitle>
                        <AlertDescription>
                          This will attempt to fix relationships between registrations, participants, and payments for
                          the specified registration ID.
                        </AlertDescription>
                      </Alert>

                      {fixError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>{fixError}</AlertDescription>
                        </Alert>
                      )}

                      {fixResult && (
                        <Alert variant="success" className="border-green-200 bg-green-50 text-green-800">
                          <CheckCircle className="h-4 w-4" />
                          <AlertTitle>Fix Applied</AlertTitle>
                          <AlertDescription>{fixResult}</AlertDescription>
                        </Alert>
                      )}

                      <Button onClick={fixRegistrationRelationships} disabled={fixLoading}>
                        {fixLoading ? "Applying Fix..." : "Apply Fix"}
                        {!fixLoading && <RefreshCw className="ml-2 h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="number" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Search Registration by Number</CardTitle>
                <CardDescription>Enter a registration number to diagnose issues</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
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
                    />
                  </div>
                  <Button onClick={searchByNumber} disabled={loading}>
                    {loading ? "Searching..." : "Search"}
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

            {loading && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </CardContent>
              </Card>
            )}

            {results && !loading && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Direct Registration Lookup</CardTitle>
                    <CardDescription>Results from direct registration number lookup</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {results.registrationData ? (
                      <div className="space-y-4">
                        <Alert variant="success" className="border-green-200 bg-green-50 text-green-800">
                          <CheckCircle className="h-4 w-4" />
                          <AlertTitle>Registration Found</AlertTitle>
                          <AlertDescription>
                            Registration with number{" "}
                            {registrationNumber.startsWith("MCVU-") ? registrationNumber : `MCVU-${registrationNumber}`}{" "}
                            was found in the database.
                          </AlertDescription>
                        </Alert>

                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Field</TableHead>
                                <TableHead>Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Object.entries(results.registrationData).map(([key, value]: [string, any]) => (
                                <TableRow key={key}>
                                  <TableCell className="font-medium">{key}</TableCell>
                                  <TableCell>
                                    {typeof value === "object"
                                      ? JSON.stringify(value)
                                      : value instanceof Date
                                        ? value.toISOString()
                                        : String(value)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Registration Not Found</AlertTitle>
                        <AlertDescription>
                          No registration with number{" "}
                          {registrationNumber.startsWith("MCVU-") ? registrationNumber : `MCVU-${registrationNumber}`}{" "}
                          was found in the database.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Flexible Lookup</CardTitle>
                    <CardDescription>Results from flexible registration number lookup</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {results.flexibleData && results.flexibleData.length > 0 ? (
                      <div className="space-y-4">
                        <Alert variant="success" className="border-green-200 bg-green-50 text-green-800">
                          <CheckCircle className="h-4 w-4" />
                          <AlertTitle>Registration Found (Flexible Search)</AlertTitle>
                          <AlertDescription>
                            Registration with similar number was found using flexible search.
                          </AlertDescription>
                        </Alert>

                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Registration Number</TableHead>
                                <TableHead>Created At</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {results.flexibleData.map((reg: any) => (
                                <TableRow key={reg.id}>
                                  <TableCell className="font-medium">{reg.id}</TableCell>
                                  <TableCell>{reg.registration_number}</TableCell>
                                  <TableCell>
                                    {new Date(reg.created_at).toLocaleDateString("id-ID", {
                                      day: "numeric",
                                      month: "long",
                                      year: "numeric",
                                    })}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No Flexible Matches</AlertTitle>
                        <AlertDescription>
                          No registrations with similar number were found using flexible search.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Registrations</CardTitle>
                    <CardDescription>Most recent registrations in the database</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {results.allRegistrations && results.allRegistrations.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Registration Number</TableHead>
                              <TableHead>Created At</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.allRegistrations.map((reg: any) => (
                              <TableRow key={reg.id}>
                                <TableCell className="font-medium">{reg.id}</TableCell>
                                <TableCell>{reg.registration_number}</TableCell>
                                <TableCell>
                                  {new Date(reg.created_at).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No Registrations</AlertTitle>
                        <AlertDescription>No recent registrations found in the database.</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
