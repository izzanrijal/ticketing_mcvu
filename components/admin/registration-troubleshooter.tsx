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
import { CheckCircle, AlertCircle, Search, Database, RefreshCw, FileText } from "lucide-react"
import Link from "next/link"

export function RegistrationTroubleshooter() {
  const [registrationId, setRegistrationId] = useState("")
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any>(null)
  const [fixApplied, setFixApplied] = useState(false)
  const [fixLoading, setFixLoading] = useState(false)
  const [fixError, setFixError] = useState<string | null>(null)
  const [fixResult, setFixResult] = useState<string | null>(null)
  const [sqlQuery, setSqlQuery] = useState<string>("")
  const [sqlResult, setSqlResult] = useState<any>(null)
  const [sqlError, setSqlError] = useState<string | null>(null)
  const [sqlLoading, setSqlLoading] = useState(false)
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

      // Try to get all registrations to check for similar IDs
      const { data: similarRegistrations, error: similarError } = await supabase
        .from("registrations")
        .select("id, registration_number, created_at")
        .filter("id", "ilike", `${registrationId.substring(0, 8)}%`)
        .order("created_at", { ascending: false })
        .limit(10)

      // Check if this ID exists in other tables
      const { data: paymentExists, error: paymentExistsError } = await supabase
        .from("payments")
        .select("id, registration_id")
        .eq("id", registrationId)
        .maybeSingle()

      const { data: participantExists, error: participantExistsError } = await supabase
        .from("participants")
        .select("id, registration_id")
        .eq("id", registrationId)
        .maybeSingle()

      setResults({
        registrationData,
        paymentData: paymentError ? null : paymentData,
        participantData: participantError ? null : participantData,
        similarRegistrations: similarError ? null : similarRegistrations,
        paymentExists: paymentExistsError ? null : paymentExists,
        participantExists: participantExistsError ? null : participantExists,
        errors: {
          registration: registrationError ? registrationError.message : null,
          payment: paymentError ? paymentError.message : null,
          participant: participantError ? participantError.message : null,
          similar: similarError ? similarError.message : null,
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

      // If we found a registration, get related data
      let paymentData = null
      let participantData = null
      let similarRegistrations = null

      if (registrationData) {
        // Get payments
        const { data: payments, error: paymentError } = await supabase
          .from("payments")
          .select("*")
          .eq("registration_id", registrationData.id)
          .order("created_at", { ascending: false })

        if (!paymentError) {
          paymentData = payments
        }

        // Get participants
        const { data: participants, error: participantError } = await supabase
          .from("participants")
          .select("*")
          .eq("registration_id", registrationData.id)

        if (!participantError) {
          participantData = participants
        }
      }

      // Try to find similar registration numbers
      const { data: similar, error: similarError } = await supabase
        .from("registrations")
        .select("id, registration_number, created_at")
        .filter("registration_number", "ilike", `MCVU-${registrationNumber.replace(/\D/g, "")}%`)
        .order("created_at", { ascending: false })
        .limit(10)

      if (!similarError) {
        similarRegistrations = similar
      }

      setResults({
        registrationData,
        paymentData,
        participantData,
        similarRegistrations,
        errors: {
          registration: registrationError ? registrationError.message : null,
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
      // First, check if the registration exists
      const { data: registration, error: registrationError } = await supabase
        .from("registrations")
        .select("*")
        .eq("id", registrationId)
        .maybeSingle()

      if (registrationError) {
        setFixError(`Error checking registration: ${registrationError.message}`)
        return
      }

      if (!registration) {
        setFixError(`Registration with ID ${registrationId} not found`)
        return
      }

      // Check for orphaned participants (participants without a registration_id)
      const { data: orphanedParticipants, error: orphanedError } = await supabase
        .from("participants")
        .select("id, full_name, email")
        .is("registration_id", null)

      if (orphanedError) {
        console.error("Error checking orphaned participants:", orphanedError)
      }

      // Check for orphaned payments (payments without a registration_id)
      const { data: orphanedPayments, error: orphanedPaymentsError } = await supabase
        .from("payments")
        .select("id, amount, status")
        .is("registration_id", null)

      if (orphanedPaymentsError) {
        console.error("Error checking orphaned payments:", orphanedPaymentsError)
      }

      // Apply fixes
      const fixResults = []

      // Fix 1: Update participants that might be related to this registration
      if (orphanedParticipants && orphanedParticipants.length > 0) {
        const { data: updatedParticipants, error: updateError } = await supabase
          .from("participants")
          .update({ registration_id: registrationId })
          .is("registration_id", null)
          .select()

        if (updateError) {
          fixResults.push(`Error updating participants: ${updateError.message}`)
        } else {
          fixResults.push(`Updated ${updatedParticipants?.length || 0} orphaned participants`)
        }
      }

      // Fix 2: Update payments that might be related to this registration
      if (orphanedPayments && orphanedPayments.length > 0) {
        const { data: updatedPayments, error: updateError } = await supabase
          .from("payments")
          .update({ registration_id: registrationId })
          .is("registration_id", null)
          .select()

        if (updateError) {
          fixResults.push(`Error updating payments: ${updateError.message}`)
        } else {
          fixResults.push(`Updated ${updatedPayments?.length || 0} orphaned payments`)
        }
      }

      // Fix 3: Ensure the registration has a registration_number
      if (!registration.registration_number) {
        // Generate a registration number
        const regNumber = `MCVU-${Math.floor(Math.random() * 100000000)
          .toString()
          .padStart(8, "0")}`

        const { error: updateError } = await supabase
          .from("registrations")
          .update({ registration_number: regNumber })
          .eq("id", registrationId)

        if (updateError) {
          fixResults.push(`Error updating registration number: ${updateError.message}`)
        } else {
          fixResults.push(`Added registration number: ${regNumber}`)
        }
      }

      setFixResult(fixResults.join("\n"))
      setFixApplied(true)
    } catch (err: any) {
      console.error("Error in fix operation:", err)
      setFixError(`Error in fix operation: ${err.message}`)
    } finally {
      setFixLoading(false)
    }
  }

  const executeCustomSQL = async () => {
    if (!sqlQuery) {
      setSqlError("Please enter an SQL query")
      return
    }

    setSqlLoading(true)
    setSqlError(null)
    setSqlResult(null)

    try {
      // Execute the custom SQL query
      const { data, error } = await supabase.rpc("execute_sql", {
        sql_query: sqlQuery,
      })

      if (error) {
        console.error("Error executing SQL:", error)
        setSqlError(`Error executing SQL: ${error.message}`)
        return
      }

      setSqlResult(data)
    } catch (err: any) {
      console.error("Error in SQL execution:", err)
      setSqlError(`Error in SQL execution: ${err.message}`)
    } finally {
      setSqlLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Registration Troubleshooter</h2>
      <p className="text-muted-foreground">
        Use this tool to diagnose and fix issues with registrations in the database.
      </p>

      <Tabs defaultValue="id" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="id">Search by ID</TabsTrigger>
          <TabsTrigger value="number">Search by Registration Number</TabsTrigger>
          <TabsTrigger value="sql">Custom SQL</TabsTrigger>
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
                  <CardTitle>Registration Details</CardTitle>
                  <CardDescription>Results from direct ID lookup</CardDescription>
                </CardHeader>
                <CardContent>
                  {results.registrationData ? (
                    <div className="space-y-4">
                      <Alert className="border-green-200 bg-green-50 text-green-800">
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>Registration Found</AlertTitle>
                        <AlertDescription>
                          Registration with ID {registrationId} was found in the database.
                        </AlertDescription>
                      </Alert>

                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/registration-details/${registrationId}`} target="_blank">
                            <FileText className="mr-2 h-4 w-4" />
                            View Registration Details
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/registration-simple/${registrationId}`} target="_blank">
                            <FileText className="mr-2 h-4 w-4" />
                            View Simple Registration
                          </Link>
                        </Button>
                      </div>

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

              {results.paymentExists && (
                <Card>
                  <CardHeader>
                    <CardTitle>ID Found in Payments Table</CardTitle>
                    <CardDescription>This ID exists as a payment ID</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>ID Found as Payment</AlertTitle>
                      <AlertDescription>
                        The ID {registrationId} was found as a payment ID, not a registration ID.
                        {results.paymentExists.registration_id && (
                          <div className="mt-2">
                            This payment is linked to registration ID:{" "}
                            <Link
                              href="#"
                              className="font-medium underline"
                              onClick={(e) => {
                                e.preventDefault()
                                setRegistrationId(results.paymentExists.registration_id)
                                searchById()
                              }}
                            >
                              {results.paymentExists.registration_id}
                            </Link>
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}

              {results.participantExists && (
                <Card>
                  <CardHeader>
                    <CardTitle>ID Found in Participants Table</CardTitle>
                    <CardDescription>This ID exists as a participant ID</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>ID Found as Participant</AlertTitle>
                      <AlertDescription>
                        The ID {registrationId} was found as a participant ID, not a registration ID.
                        {results.participantExists.registration_id && (
                          <div className="mt-2">
                            This participant is linked to registration ID:{" "}
                            <Link
                              href="#"
                              className="font-medium underline"
                              onClick={(e) => {
                                e.preventDefault()
                                setRegistrationId(results.participantExists.registration_id)
                                searchById()
                              }}
                            >
                              {results.participantExists.registration_id}
                            </Link>
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}

              {results.similarRegistrations && results.similarRegistrations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Similar Registration IDs</CardTitle>
                    <CardDescription>Registrations with similar IDs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Registration Number</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.similarRegistrations.map((reg: any) => (
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
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setRegistrationId(reg.id)
                                    searchById()
                                  }}
                                >
                                  <Search className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {results.registrationData && (
                <>
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
                              <Alert className="border-green-200 bg-green-50 text-green-800">
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
                              <Alert className="border-green-200 bg-green-50 text-green-800">
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
                          <Alert className="border-green-200 bg-green-50 text-green-800">
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle>Fix Applied</AlertTitle>
                            <AlertDescription>
                              <pre className="whitespace-pre-wrap">{fixResult}</pre>
                            </AlertDescription>
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
                  <CardTitle>Registration Details</CardTitle>
                  <CardDescription>Results from registration number lookup</CardDescription>
                </CardHeader>
                <CardContent>
                  {results.registrationData ? (
                    <div className="space-y-4">
                      <Alert className="border-green-200 bg-green-50 text-green-800">
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>Registration Found</AlertTitle>
                        <AlertDescription>
                          Registration with number{" "}
                          {registrationNumber.startsWith("MCVU-") ? registrationNumber : `MCVU-${registrationNumber}`}{" "}
                          was found in the database.
                        </AlertDescription>
                      </Alert>

                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/registration-details/${results.registrationData.id}`} target="_blank">
                            <FileText className="mr-2 h-4 w-4" />
                            View Registration Details
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/registration-simple/${results.registrationData.id}`} target="_blank">
                            <FileText className="mr-2 h-4 w-4" />
                            View Simple Registration
                          </Link>
                        </Button>
                      </div>

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
                        {registrationNumber.startsWith("MCVU-") ? registrationNumber : `MCVU-${registrationNumber}`} was
                        found in the database.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {results.similarRegistrations && results.similarRegistrations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Similar Registration Numbers</CardTitle>
                    <CardDescription>Registrations with similar numbers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Registration Number</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.similarRegistrations.map((reg: any) => (
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
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setRegistrationNumber(reg.registration_number.replace("MCVU-", ""))
                                    searchByNumber()
                                  }}
                                >
                                  <Search className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {results.registrationData && (
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
                            <Alert className="border-green-200 bg-green-50 text-green-800">
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
                            <Alert className="border-green-200 bg-green-50 text-green-800">
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
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="sql" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Execute Custom SQL</CardTitle>
              <CardDescription>Run custom SQL queries to diagnose or fix issues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Database className="h-4 w-4" />
                  <AlertTitle>Database Access</AlertTitle>
                  <AlertDescription>
                    This tool allows you to execute custom SQL queries. Use with caution as it can modify database data.
                  </AlertDescription>
                </Alert>

                <div className="border rounded-md">
                  <textarea
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    placeholder="Enter SQL query here..."
                    className="w-full h-40 p-4 font-mono text-sm resize-none focus:outline-none"
                  />
                </div>

                <Button onClick={executeCustomSQL} disabled={sqlLoading}>
                  {sqlLoading ? "Executing..." : "Execute SQL"}
                  {!sqlLoading && <Database className="ml-2 h-4 w-4" />}
                </Button>

                {sqlError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{sqlError}</AlertDescription>
                  </Alert>
                )}

                {sqlResult && (
                  <div className="space-y-4">
                    <Alert className="border-green-200 bg-green-50 text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>SQL Executed Successfully</AlertTitle>
                      <AlertDescription>The SQL query was executed successfully.</AlertDescription>
                    </Alert>

                    <div className="overflow-x-auto border rounded-md p-4">
                      <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(sqlResult, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SQL Templates</CardTitle>
              <CardDescription>Common SQL queries for troubleshooting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="justify-start h-auto py-2 px-4"
                    onClick={() => {
                      setSqlQuery(`-- Check registration by ID
SELECT * FROM registrations WHERE id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';`)
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium">Check Registration by ID</div>
                      <div className="text-xs text-muted-foreground">Retrieve registration details by ID</div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start h-auto py-2 px-4"
                    onClick={() => {
                      setSqlQuery(`-- Check registration by number
SELECT * FROM registrations WHERE registration_number = 'MCVU-12345678';`)
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium">Check Registration by Number</div>
                      <div className="text-xs text-muted-foreground">
                        Retrieve registration details by registration number
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start h-auto py-2 px-4"
                    onClick={() => {
                      setSqlQuery(`-- Check payments for a registration
SELECT * FROM payments WHERE registration_id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';`)
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium">Check Payments</div>
                      <div className="text-xs text-muted-foreground">Retrieve payments for a specific registration</div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start h-auto py-2 px-4"
                    onClick={() => {
                      setSqlQuery(`-- Check participants for a registration
SELECT * FROM participants WHERE registration_id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';`)
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium">Check Participants</div>
                      <div className="text-xs text-muted-foreground">
                        Retrieve participants for a specific registration
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start h-auto py-2 px-4"
                    onClick={() => {
                      setSqlQuery(`-- Fix orphaned participants
UPDATE participants 
SET registration_id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'
WHERE id = 'participant-id-here' AND registration_id IS NULL;`)
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium">Fix Orphaned Participants</div>
                      <div className="text-xs text-muted-foreground">Link orphaned participants to a registration</div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start h-auto py-2 px-4"
                    onClick={() => {
                      setSqlQuery(`-- Fix orphaned payments
UPDATE payments 
SET registration_id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea'
WHERE id = 'payment-id-here' AND registration_id IS NULL;`)
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium">Fix Orphaned Payments</div>
                      <div className="text-xs text-muted-foreground">Link orphaned payments to a registration</div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start h-auto py-2 px-4"
                    onClick={() => {
                      setSqlQuery(`-- Create a view for a specific registration
CREATE OR REPLACE VIEW registration_view_aa880d3c AS
SELECT 
  r.*,
  p.id as payment_id,
  p.amount,
  p.status as payment_status,
  p.created_at as payment_created_at
FROM 
  registrations r
LEFT JOIN 
  payments p ON r.id = p.registration_id
WHERE 
  r.id = 'aa880d3c-25fe-46e1-897d-ea1022c0fdea';`)
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium">Create Registration View</div>
                      <div className="text-xs text-muted-foreground">
                        Create a view for a specific registration with payment data
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start h-auto py-2 px-4"
                    onClick={() => {
                      setSqlQuery(`-- Check database schema
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM 
  information_schema.columns 
WHERE 
  table_schema = 'public' 
ORDER BY 
  table_name, 
  ordinal_position;`)
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium">Check Database Schema</div>
                      <div className="text-xs text-muted-foreground">View all tables and columns in the database</div>
                    </div>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
