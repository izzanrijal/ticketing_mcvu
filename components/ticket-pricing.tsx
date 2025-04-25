"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

type Ticket = {
  id: string
  name: string
  description: string
  price_specialist_doctor: number
  price_general_doctor: number
  price_nurse: number
  price_student: number
  price_other: number
  includes_symposium: boolean
}

export function TicketPricing() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchTickets() {
      try {
        const { data, error } = await supabase.from("tickets").select("*").order("sort_order", { ascending: true })

        if (error) {
          console.error("Error fetching tickets:", error)
          return
        }

        setTickets(data || [])
      } catch (error) {
        console.error("Error fetching tickets:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTickets()
  }, [supabase])

  if (loading) {
    return (
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="animate-pulse card-basic">
            <CardHeader className="h-40 bg-muted"></CardHeader>
            <CardContent className="h-60 bg-muted"></CardContent>
            <CardFooter className="h-16 bg-muted"></CardFooter>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {tickets.map((ticket) => (
        <Card key={ticket.id} className="flex flex-col card-interactive">
          <CardHeader>
            <CardTitle>{ticket.name}</CardTitle>
            <CardDescription>{ticket.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-medium">Dokter Spesialis</h4>
                <span className="text-lg font-bold text-primary">
                  Rp {ticket.price_specialist_doctor.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-medium">Dokter Umum</h4>
                <span className="text-lg font-bold text-primary">
                  Rp {ticket.price_general_doctor.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-medium">Perawat</h4>
                <span className="text-lg font-bold text-primary">Rp {ticket.price_nurse.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-medium">Mahasiswa</h4>
                <span className="text-lg font-bold text-primary">
                  Rp {ticket.price_student.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  {ticket.includes_symposium
                    ? "Termasuk akses ke simposium utama"
                    : "Tidak termasuk akses ke simposium"}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm">Sertifikat kehadiran</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm">Makan siang</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm">Materi simposium</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full btn-primary">
              <Link href={`/register?ticket=${ticket.id}`}>Pilih Paket</Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
