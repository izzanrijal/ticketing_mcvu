import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="container max-w-4xl py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Detail Pendaftaran</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/check-status">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pendaftaran Tidak Ditemukan</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Maaf, pendaftaran dengan ID ini tidak ditemukan. Silakan periksa kembali nomor pendaftaran Anda.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button asChild>
              <Link href="/check-status">Kembali ke Cek Status</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
