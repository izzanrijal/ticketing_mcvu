import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export default function RegistrationNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="mx-auto max-w-md">
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <CardTitle className="text-2xl">Registrasi Tidak Ditemukan</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-muted-foreground">
                <p>
                  Registrasi yang Anda cari tidak ditemukan atau belum diverifikasi. Silakan periksa kembali nomor
                  registrasi Anda atau hubungi panitia untuk informasi lebih lanjut.
                </p>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button className="w-full" asChild>
                  <Link href="/check-status">Cek Status Pembayaran</Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/">Kembali ke Beranda</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
