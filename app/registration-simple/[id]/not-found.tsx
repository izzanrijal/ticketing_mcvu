import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export default function RegistrationNotFound() {
  return (
    <div className="container max-w-md py-20">
      <Card className="text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Pendaftaran Tidak Ditemukan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Maaf, kami tidak dapat menemukan pendaftaran yang Anda cari. Silakan periksa kembali nomor pendaftaran Anda
            atau hubungi panitia untuk bantuan.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild>
            <Link href="/check-status">Kembali ke Cek Status</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
