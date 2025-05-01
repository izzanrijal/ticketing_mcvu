"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Download, Copy } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { generateParticipantQrData } from "@/lib/qr-utils"

interface ParticipantQrProps {
  registrationItemId: string
}

export function ParticipantQr({ registrationItemId }: ParticipantQrProps) {
  const [participant, setParticipant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [qrData, setQrData] = useState("")
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  useEffect(() => {
    async function fetchParticipant() {
      try {
        const { data, error } = await supabase
          .from("registration_items")
          .select(`
            id,
            registration:registrations (
              id,
              registration_number,
              status
            ),
            participant:participants (
              id,
              full_name,
              email,
              participant_type
            )
          `)
          .eq("id", registrationItemId)
          .single()

        if (error) throw error
        setParticipant(data)

        // Generate QR data
        const qrData = generateParticipantQrData(registrationItemId)
        setQrData(qrData)
      } catch (error) {
        console.error("Error fetching participant:", error)
        toast({
          title: "Error",
          description: "Failed to load participant data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchParticipant()
  }, [registrationItemId, supabase, toast])

  function downloadQrCode() {
    const canvas = document.getElementById("participant-qr-code") as HTMLCanvasElement
    if (canvas) {
      const url = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.href = url
      link.download = `qr-${participant?.registration?.registration_number || "participant"}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  function copyQrData() {
    navigator.clipboard.writeText(qrData)
    toast({
      title: "Copied",
      description: "QR data copied to clipboard",
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex h-64 items-center justify-center">
            <div className="h-32 w-32 animate-pulse rounded-md bg-muted"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!participant) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex h-64 items-center justify-center">
            <p className="text-center text-muted-foreground">Participant not found</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Participant QR Code</CardTitle>
        <CardDescription>Registration #: {participant.registration.registration_number}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          <div className="rounded-md bg-white p-4">
            <QRCodeSVG id="participant-qr-code" value={qrData} size={200} level="H" includeMargin />
          </div>
          <div className="text-center">
            <h3 className="font-medium">{participant.participant.full_name}</h3>
            <p className="text-sm text-muted-foreground">{participant.participant.email}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-center space-x-2">
        <Button variant="outline" size="sm" onClick={downloadQrCode}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
        <Button variant="outline" size="sm" onClick={copyQrData}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Data
        </Button>
      </CardFooter>
    </Card>
  )
}
