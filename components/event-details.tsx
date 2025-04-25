import { Calendar, Clock, MapPin, Users } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function EventDetails() {
  return (
    <div className="grid gap-6 pt-8 md:grid-cols-2 lg:grid-cols-4">
      <Card className="card-basic">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Tanggal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-base text-foreground">15-16 April 2025</CardDescription>
          <p className="mt-2 text-sm text-muted-foreground">Simposium utama dan workshop selama 2 hari penuh</p>
        </CardContent>
      </Card>
      <Card className="card-basic">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Waktu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-base text-foreground">08:00 - 17:00 WIB</CardDescription>
          <p className="mt-2 text-sm text-muted-foreground">Registrasi dibuka mulai pukul 07:00 WIB</p>
        </CardContent>
      </Card>
      <Card className="card-basic">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Lokasi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-base text-foreground">Jakarta Convention Center</CardDescription>
          <p className="mt-2 text-sm text-muted-foreground">Jl. Gatot Subroto, Jakarta Pusat</p>
        </CardContent>
      </Card>
      <Card className="card-basic">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Peserta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-base text-foreground">1000+ Profesional Kesehatan</CardDescription>
          <p className="mt-2 text-sm text-muted-foreground">Dokter, perawat, dan mahasiswa kedokteran</p>
        </CardContent>
      </Card>
    </div>
  )
}
