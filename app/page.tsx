import Link from "next/link"
import Image from "next/image"
import { CalendarDays, MapPin, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EventDetails } from "@/components/event-details"
import { TicketPricing } from "@/components/ticket-pricing"
import { WorkshopList } from "@/components/workshop-list"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 xl:grid-cols-2">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter text-primary sm:text-4xl md:text-5xl lg:text-6xl/none">
                    MCVU Symposium 2025
                  </h1>
                  <p className="text-xl text-muted-foreground md:text-2xl">
                    Interconnected Health: Membangun Masa Depan Kesehatan Indonesia
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button asChild size="lg" className="btn-primary">
                    <Link href="/register">Daftar Sekarang</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="btn-secondary">
                    <Link href="#info">Informasi Acara</Link>
                  </Button>
                </div>
                <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:gap-4">
                  <div className="flex items-center gap-1">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span>15-16 April 2025</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>Jakarta Convention Center</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-primary" />
                    <span>1000+ Peserta</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative h-[300px] w-[300px] sm:h-[350px] sm:w-[350px] md:h-[400px] md:w-[400px] lg:h-[450px] lg:w-[450px]">
                  <Image
                    src="/medical-symposium-gathering.png"
                    alt="MCVU Symposium 2025"
                    fill
                    className="object-cover rounded-xl"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Event Details Section */}
        <section id="info" className="py-12 md:py-16 lg:py-20">
          <div className="container px-4 md:px-6">
            <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
              <h2 className="text-3xl font-bold leading-[1.1] text-primary sm:text-3xl md:text-5xl">Tentang Acara</h2>
              <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                MCVU Symposium 2025 adalah acara tahunan yang menghubungkan profesional kesehatan dari seluruh Indonesia
                untuk berbagi pengetahuan, pengalaman, dan inovasi terbaru dalam dunia medis.
              </p>
            </div>
            <EventDetails />
          </div>
        </section>

        {/* Ticket Pricing Section */}
        <section className="bg-secondary py-12 md:py-16 lg:py-20">
          <div className="container px-4 md:px-6">
            <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
              <h2 className="text-3xl font-bold leading-[1.1] text-primary sm:text-3xl md:text-5xl">Harga Tiket</h2>
              <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                Pilih paket tiket yang sesuai dengan kebutuhan Anda
              </p>
            </div>
            <TicketPricing />
          </div>
        </section>

        {/* Workshop Section */}
        <section className="py-12 md:py-16 lg:py-20">
          <div className="container px-4 md:px-6">
            <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
              <h2 className="text-3xl font-bold leading-[1.1] text-primary sm:text-3xl md:text-5xl">Workshop</h2>
              <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                Tingkatkan pengetahuan dan keterampilan Anda melalui workshop interaktif
              </p>
            </div>
            <WorkshopList />
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-secondary py-12 md:py-16 lg:py-20">
          <div className="container px-4 md:px-6">
            <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-6 text-center">
              <h2 className="text-3xl font-bold leading-[1.1] text-primary sm:text-3xl md:text-5xl">Daftar Sekarang</h2>
              <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                Jangan lewatkan kesempatan untuk menghadiri MCVU Symposium 2025
              </p>
              <Button asChild size="lg" className="btn-primary">
                <Link href="/register">Daftar Sekarang</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
