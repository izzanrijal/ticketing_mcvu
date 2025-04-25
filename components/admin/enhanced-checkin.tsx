"use client"

import { useState, useRef, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { QrCode, Search, CheckCircle, XCircle, AlertCircle, Camera, CameraOff } from "lucide-react"
import dynamic from "next/dynamic"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { validateAndCheckIn } from "@/lib/qr-utils"

// Dynamically import QrScanner with no SSR
const QrScanner = dynamic(
  () =>
    import("qr-scanner").then((mod) => {
      // Make sure we're getting the default export
      return typeof mod.default === "function" ? mod.default : mod
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 w-full max-w-md items-center justify-center rounded-md bg-muted">
        <div className="text-center">
          <Camera className="mx-auto h-10 w-10 text-muted-foreground animate-pulse" />
          <p className="mt-2 text-sm text-muted-foreground">Loading camera...</p>
        </div>
      </div>
    ),
  },
)

export function EnhancedCheckin() {
  const [searchQuery, setSearchQuery] = useState("")
  const [scanning, setScanning] = useState(false)
  const [participant, setParticipant] = useState<any>(null)
  const [checkInResult, setCheckInResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [recentCheckIns, setRecentCheckIns] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState("scan")
  const [qrScannerError, setQrScannerError] = useState<string | null>(null)
  const [qrScannerLoaded, setQrScannerLoaded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<any>(null)
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  useEffect(() => {
    fetchRecentCheckIns()

    // Set up realtime subscription for check-ins
    const channel = supabase
      .channel("check-ins-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "check_ins",
        },
        () => {
          fetchRecentCheckIns()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      stopScanner()
    }
  }, [supabase])

  // Safely stop the scanner
  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        if (typeof scannerRef.current.stop === "function") {
          scannerRef.current.stop()
        }
        scannerRef.current = null
      } catch (error) {
        console.error("Error stopping scanner:", error)
      }
    }
  }

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") return

    // Clean up previous scanner instance if it exists
    stopScanner()

    if (scanning && videoRef.current) {
      // Check if QrScanner is available
      if (!QrScanner || typeof QrScanner !== "function") {
        console.error("QrScanner is not a function:", QrScanner)
        setQrScannerError("QR Scanner library not available")
        setScanning(false)
        return
      }

      try {
        // Create a new scanner instance
        const handleScanResult = (result: any) => {
          if (result && result.data) {
            handleQrResult(result.data)
          }
        }

        // Initialize scanner with proper error handling
        const initScanner = async () => {
          try {
            scannerRef.current = new QrScanner(videoRef.current, handleScanResult, {
              highlightScanRegion: true,
              highlightCodeOutline: true,
            })

            // Check if start method exists
            if (typeof scannerRef.current.start !== "function") {
              throw new Error("Scanner start method not available")
            }

            await scannerRef.current.start()
            setQrScannerLoaded(true)
          } catch (error: any) {
            console.error("Scanner initialization error:", error)
            setQrScannerError(error.message || "Could not access camera")
            toast({
              title: "Camera Error",
              description: "Could not access camera. Please check permissions.",
              variant: "destructive",
            })
            setScanning(false)
          }
        }

        initScanner()
      } catch (error: any) {
        console.error("QR Scanner initialization error:", error)
        setQrScannerError(error.message || "Failed to initialize scanner")
        setScanning(false)
      }
    }

    return () => {
      if (!scanning) {
        stopScanner()
      }
    }
  }, [scanning, toast, QrScanner])

  async function fetchRecentCheckIns() {
    try {
      const { data, error } = await supabase
        .from("check_ins")
        .select(`
          id,
          checked_in_at,
          registration_item:registration_items (
            id,
            registration:registrations (
              id,
              registration_number
            ),
            participant:participants (
              id,
              full_name,
              email,
              participant_type
            )
          )
        `)
        .is("workshop_id", null)
        .order("checked_in_at", { ascending: false })
        .limit(10)

      if (error) throw error
      setRecentCheckIns(data || [])
    } catch (error) {
      console.error("Error fetching recent check-ins:", error)
    }
  }

  async function handleSearch() {
    if (!searchQuery) return

    setLoading(true)
    try {
      // Search by registration number or participant name/email
      const { data: registrationsData, error: registrationsError } = await supabase
        .from("registrations")
        .select(`
          id,
          registration_number,
          status,
          final_amount
        `)
        .or(`registration_number.ilike.%${searchQuery}%`)
        .eq("status", "paid")
        .limit(1)

      if (registrationsError) throw registrationsError

      // If no registration found by number, search by participant
      if (!registrationsData || registrationsData.length === 0) {
        const { data: participantsData, error: participantsError } = await supabase
          .from("participants")
          .select(`
            id,
            full_name,
            email,
            phone,
            participant_type,
            institution,
            registration_items!registration_items_participant_id_fkey (
              id,
              parent_registration_id,
              ticket:tickets (
                id,
                name,
                description
              )
            )
          `)
          .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .limit(1)

        if (participantsError) throw participantsError

        if (participantsData && participantsData.length > 0 && participantsData[0].registration_items.length > 0) {
          const registrationItemId = participantsData[0].registration_items[0].id
          const registrationId = participantsData[0].registration_items[0].parent_registration_id

          // Get registration details
          const { data: registrationData } = await supabase
            .from("registrations")
            .select("id, registration_number, status, final_amount")
            .eq("id", registrationId)
            .eq("status", "paid")
            .single()

          if (registrationData) {
            setParticipant({
              registration: registrationData,
              participant: participantsData[0],
              ticket: participantsData[0].registration_items[0].ticket,
              registrationItemId: registrationItemId,
            })

            // Check if already checked in
            const { data: checkInData, error: checkInError } = await supabase
              .from("check_ins")
              .select("*")
              .eq("registration_item_id", registrationItemId)
              .is("workshop_id", null)
              .maybeSingle()

            if (!checkInError) {
              setCheckInResult(
                checkInData
                  ? {
                      success: true,
                      message: "Participant already checked in",
                      data: {
                        checkInStatus: "already_checked_in",
                        checkInTime: checkInData.checked_in_at,
                      },
                    }
                  : null,
              )
            }
          } else {
            toast({
              title: "Not Found",
              description: "Participant found but registration is not paid",
              variant: "destructive",
            })
          }
        } else {
          toast({
            title: "Not Found",
            description: "Participant not found or registration is not paid",
            variant: "destructive",
          })
        }
      } else {
        // Registration found by number, get participant details
        const registrationId = registrationsData[0].id

        const { data: registrationItemsData, error: itemsError } = await supabase
          .from("registration_items")
          .select(`
            id,
            participant:participants (*),
            ticket:tickets (*)
          `)
          .eq("parent_registration_id", registrationId)
          .limit(1)
          .single()

        if (itemsError) throw itemsError

        if (registrationItemsData) {
          setParticipant({
            registration: registrationsData[0],
            participant: registrationItemsData.participant,
            ticket: registrationItemsData.ticket,
            registrationItemId: registrationItemsData.id,
          })

          // Check if already checked in
          const { data: checkInData, error: checkInError } = await supabase
            .from("check_ins")
            .select("*")
            .eq("registration_item_id", registrationItemsData.id)
            .is("workshop_id", null)
            .maybeSingle()

          if (!checkInError) {
            setCheckInResult(
              checkInData
                ? {
                    success: true,
                    message: "Participant already checked in",
                    data: {
                      checkInStatus: "already_checked_in",
                      checkInTime: checkInData.checked_in_at,
                    },
                  }
                : null,
            )
          }
        }
      }
    } catch (error) {
      console.error("Error searching participant:", error)
      toast({
        title: "Error",
        description: "An error occurred while searching",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleQrResult(result: string) {
    try {
      // Stop scanning temporarily to prevent multiple scans
      if (scannerRef.current && typeof scannerRef.current.stop === "function") {
        try {
          scannerRef.current.stop()
        } catch (error) {
          console.error("Error stopping scanner:", error)
        }
      }

      setLoading(true)
      const checkInResult = await validateAndCheckIn(result)

      setCheckInResult(checkInResult)

      if (checkInResult.success) {
        toast({
          title: "Success",
          description: checkInResult.message,
        })

        if (checkInResult.data?.registrationItem) {
          setParticipant({
            registration: checkInResult.data.registrationItem.registration,
            participant: checkInResult.data.registrationItem.participant,
            registrationItemId: checkInResult.data.registrationItem.id,
          })
        }
      } else {
        toast({
          title: "Check-in Failed",
          description: checkInResult.message,
          variant: "destructive",
        })

        if (checkInResult.data?.registrationItem) {
          setParticipant({
            registration: checkInResult.data.registrationItem.registration,
            participant: checkInResult.data.registrationItem.participant,
            registrationItemId: checkInResult.data.registrationItem.id,
          })
        }
      }

      // Resume scanning after a delay
      setTimeout(() => {
        if (scannerRef.current && scanning && typeof scannerRef.current.start === "function") {
          try {
            scannerRef.current.start()
          } catch (error) {
            console.error("Error restarting scanner:", error)
            setQrScannerError("Failed to restart scanner")
            setScanning(false)
          }
        }
      }, 3000)
    } catch (error) {
      console.error("Error processing QR code:", error)
      toast({
        title: "Error",
        description: "Failed to process QR code",
        variant: "destructive",
      })

      // Resume scanning
      if (scannerRef.current && scanning && typeof scannerRef.current.start === "function") {
        try {
          scannerRef.current.start()
        } catch (error) {
          console.error("Error restarting scanner:", error)
          setQrScannerError("Failed to restart scanner")
          setScanning(false)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleManualCheckin() {
    if (!participant?.registrationItemId) return

    setLoading(true)
    try {
      // Check if already checked in
      const { data: existingCheckIn } = await supabase
        .from("check_ins")
        .select("*")
        .eq("registration_item_id", participant.registrationItemId)
        .is("workshop_id", null)
        .maybeSingle()

      if (existingCheckIn) {
        setCheckInResult({
          success: true,
          message: "Participant already checked in",
          data: {
            checkInStatus: "already_checked_in",
            checkInTime: existingCheckIn.checked_in_at,
          },
        })

        toast({
          title: "Already Checked In",
          description: "This participant has already been checked in",
          variant: "default",
        })
        return
      }

      // Create check-in record
      const { error } = await supabase.from("check_ins").insert({
        registration_item_id: participant.registrationItemId,
        checked_in_by: "00000000-0000-0000-0000-000000000000", // Replace with actual admin ID
      })

      if (error) throw error

      setCheckInResult({
        success: true,
        message: "Participant successfully checked in",
        data: {
          checkInStatus: "checked_in",
          checkInTime: new Date().toISOString(),
        },
      })

      toast({
        title: "Check-in Successful",
        description: `${participant.participant.full_name} has been successfully checked in`,
      })
    } catch (error) {
      console.error("Error checking in:", error)
      toast({
        title: "Check-in Failed",
        description: "An error occurred during check-in",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  function getParticipantTypeLabel(type: string) {
    switch (type) {
      case "specialist_doctor":
        return "Specialist Doctor"
      case "general_doctor":
        return "General Doctor"
      case "nurse":
        return "Nurse"
      case "student":
        return "Student"
      default:
        return "Other"
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function getCheckInStatusBadge(status: string) {
    switch (status) {
      case "checked_in":
        return <Badge className="bg-green-500">Checked In</Badge>
      case "already_checked_in":
        return <Badge className="bg-blue-500">Already Checked In</Badge>
      case "unpaid":
        return <Badge variant="destructive">Unpaid</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Participant Check-in</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scan">QR Scan</TabsTrigger>
          <TabsTrigger value="search">Manual Search</TabsTrigger>
          <TabsTrigger value="recent">Recent Check-ins</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scan QR Code</CardTitle>
              <CardDescription>Scan a participant's QR code to check them in</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                {scanning ? (
                  <div className="relative w-full max-w-md aspect-square rounded-md overflow-hidden bg-muted">
                    <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
                    {qrScannerError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white p-4 text-center">
                        <div>
                          <CameraOff className="mx-auto h-10 w-10 mb-2" />
                          <p>{qrScannerError}</p>
                          <Button
                            variant="outline"
                            className="mt-4 bg-white text-black hover:bg-gray-100"
                            onClick={() => setScanning(false)}
                          >
                            Close Camera
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-64 w-full max-w-md items-center justify-center rounded-md bg-muted">
                    <QrCode className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}

                <Button
                  onClick={() => {
                    setQrScannerError(null)
                    setScanning(!scanning)
                  }}
                  variant={scanning ? "destructive" : "default"}
                >
                  {scanning ? "Stop Scanning" : "Start Scanning"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {checkInResult && (
            <Card className={checkInResult.success ? "border-green-500" : "border-red-500"}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {checkInResult.success ? (
                      <div className="flex items-center text-green-500">
                        <CheckCircle className="mr-2 h-5 w-5" />
                        Check-in Result
                      </div>
                    ) : (
                      <div className="flex items-center text-red-500">
                        <XCircle className="mr-2 h-5 w-5" />
                        Check-in Failed
                      </div>
                    )}
                  </CardTitle>
                  {checkInResult.data?.checkInStatus && getCheckInStatusBadge(checkInResult.data.checkInStatus)}
                </div>
                <CardDescription>{checkInResult.message}</CardDescription>
              </CardHeader>

              {checkInResult.data?.checkInTime && (
                <CardContent className="pb-2 pt-0">
                  <p className="text-sm text-muted-foreground">
                    Check-in time: {formatDate(checkInResult.data.checkInTime)}
                  </p>
                </CardContent>
              )}
            </Card>
          )}

          {participant && (
            <Card>
              <CardHeader>
                <CardTitle>Participant Details</CardTitle>
                <CardDescription>Registration #: {participant.registration.registration_number}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Participant Information</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Name</div>
                      <div>{participant.participant.full_name}</div>
                      <div className="text-muted-foreground">Email</div>
                      <div>{participant.participant.email}</div>
                      <div className="text-muted-foreground">Phone</div>
                      <div>{participant.participant.phone}</div>
                      <div className="text-muted-foreground">Type</div>
                      <div>{getParticipantTypeLabel(participant.participant.participant_type)}</div>
                      <div className="text-muted-foreground">Institution</div>
                      <div>{participant.participant.institution}</div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium">Registration Information</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Registration #</div>
                      <div>{participant.registration.registration_number}</div>
                      <div className="text-muted-foreground">Status</div>
                      <div>{participant.registration.status}</div>
                      <div className="text-muted-foreground">Amount</div>
                      <div>Rp {participant.registration.final_amount?.toLocaleString("id-ID")}</div>
                      {participant.ticket && (
                        <>
                          <div className="text-muted-foreground">Ticket</div>
                          <div>{participant.ticket.name}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                {!checkInResult?.success ||
                (checkInResult?.data?.checkInStatus !== "checked_in" &&
                  checkInResult?.data?.checkInStatus !== "already_checked_in") ? (
                  <Button
                    className="w-full"
                    onClick={handleManualCheckin}
                    disabled={loading || participant.registration.status !== "paid"}
                  >
                    {loading ? "Processing..." : "Check-in Participant"}
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" disabled>
                    Already Checked In
                  </Button>
                )}
              </CardFooter>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Participant</CardTitle>
              <CardDescription>Search by registration number, name, or email</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative flex w-full gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by registration number or name..."
                    className="w-full pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSearch()
                      }
                    }}
                  />
                </div>
                <Button onClick={handleSearch} disabled={loading || !searchQuery}>
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {participant && (
            <Card>
              <CardHeader>
                <CardTitle>Participant Details</CardTitle>
                <CardDescription>Registration #: {participant.registration.registration_number}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Participant Information</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Name</div>
                      <div>{participant.participant.full_name}</div>
                      <div className="text-muted-foreground">Email</div>
                      <div>{participant.participant.email}</div>
                      <div className="text-muted-foreground">Phone</div>
                      <div>{participant.participant.phone}</div>
                      <div className="text-muted-foreground">Type</div>
                      <div>{getParticipantTypeLabel(participant.participant.participant_type)}</div>
                      <div className="text-muted-foreground">Institution</div>
                      <div>{participant.participant.institution}</div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium">Registration Information</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Registration #</div>
                      <div>{participant.registration.registration_number}</div>
                      <div className="text-muted-foreground">Status</div>
                      <div>{participant.registration.status}</div>
                      <div className="text-muted-foreground">Amount</div>
                      <div>Rp {participant.registration.final_amount?.toLocaleString("id-ID")}</div>
                      {participant.ticket && (
                        <>
                          <div className="text-muted-foreground">Ticket</div>
                          <div>{participant.ticket.name}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {checkInResult && (
                  <div className={`p-4 rounded-md ${checkInResult.success ? "bg-green-50" : "bg-red-50"}`}>
                    <div className="flex items-center">
                      {checkInResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                      )}
                      <span className={checkInResult.success ? "text-green-700" : "text-red-700"}>
                        {checkInResult.message}
                      </span>
                    </div>
                    {checkInResult.data?.checkInTime && (
                      <p className="text-sm mt-1 text-muted-foreground">
                        Check-in time: {formatDate(checkInResult.data.checkInTime)}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                {!checkInResult?.success ||
                (checkInResult?.data?.checkInStatus !== "checked_in" &&
                  checkInResult?.data?.checkInStatus !== "already_checked_in") ? (
                  <Button
                    className="w-full"
                    onClick={handleManualCheckin}
                    disabled={loading || participant.registration.status !== "paid"}
                  >
                    {loading ? "Processing..." : "Check-in Participant"}
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" disabled>
                    Already Checked In
                  </Button>
                )}
              </CardFooter>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent Check-ins</CardTitle>
              <CardDescription>The most recent participant check-ins</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Registration #</TableHead>
                      <TableHead>Participant</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Check-in Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCheckIns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          No recent check-ins
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentCheckIns.map((checkIn) => (
                        <TableRow key={checkIn.id}>
                          <TableCell className="font-medium">
                            {checkIn.registration_item.registration.registration_number}
                          </TableCell>
                          <TableCell>
                            {checkIn.registration_item.participant.full_name}
                            <div className="text-xs text-muted-foreground">
                              {checkIn.registration_item.participant.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getParticipantTypeLabel(checkIn.registration_item.participant.participant_type)}
                          </TableCell>
                          <TableCell>{formatDate(checkIn.checked_in_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
