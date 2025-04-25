import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"

interface RegistrationSummaryProps {
  registration: any
}

export function RegistrationSummary({ registration }: RegistrationSummaryProps) {
  // Format date for display
  const formattedDate = new Date(registration.created_at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <Card className="mb-6">
      <CardHeader className="bg-green-50 border-b border-green-100">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle className="h-5 w-5" />
          <CardTitle>Pembayaran Terverifikasi</CardTitle>
        </div>
        <CardDescription>
          Nomor Registrasi: <span className="font-medium">{registration.registration_number}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <h3 className="font-medium">Informasi Registrasi</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">Tanggal Pendaftaran</div>
            <div>{formattedDate}</div>
            <div className="text-muted-foreground">Total Pembayaran</div>
            <div className="font-medium">Rp {registration.final_amount?.toLocaleString("id-ID") || "0"}</div>
            <div className="text-muted-foreground">Status</div>
            <div className="text-green-600 font-medium">Terverifikasi</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
