import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Download } from "lucide-react"

interface ParticipantTicketProps {
  participant: any
  ticketName: string
  index: number
}

export function ParticipantTicket({ participant, ticketName, index }: ParticipantTicketProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted py-3 px-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-medium">Peserta {index + 1}</h3>
          <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">{ticketName}</span>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Nama</div>
          <div className="font-medium">{participant.full_name}</div>

          <div className="text-muted-foreground">Email</div>
          <div>{participant.email}</div>

          <div className="text-muted-foreground">Tipe Peserta</div>
          <div>
            {participant.participant_type === "specialist_doctor"
              ? "Dokter Spesialis"
              : participant.participant_type === "general_doctor"
                ? "Dokter Umum"
                : participant.participant_type === "nurse"
                  ? "Perawat"
                  : participant.participant_type === "student"
                    ? "Mahasiswa"
                    : "Lainnya"}
          </div>

          {participant.institution && (
            <>
              <div className="text-muted-foreground">Institusi</div>
              <div>{participant.institution}</div>
            </>
          )}
        </div>

        <div className="mt-4 pt-3 border-t flex justify-between items-center">
          <div className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" />
            <span>Tiket dikirim ke email</span>
          </div>
          <Button size="sm" variant="outline" className="h-8">
            <Download className="h-3.5 w-3.5 mr-1" />
            Unduh Tiket
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
