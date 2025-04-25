"use client"

import { useEffect, useState } from "react"
import { CalendarDays, Clock, MapPin } from "lucide-react"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

type Workshop = {
  id: string
  title: string
  description: string
  start_time: string
  end_time: string
  location: string
  price: number
  max_capacity: number
}

export function WorkshopList() {
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchWorkshops() {
      try {
        const { data, error } = await supabase.from("workshops").select("*").order("sort_order", { ascending: true })

        if (error) {
          console.error("Error fetching workshops:", error)
          return
        }

        setWorkshops(data || [])
      } catch (error) {
        console.error("Error fetching workshops:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchWorkshops()
  }, [supabase])

  if (loading) {
    return (
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse card-basic">
            <CardHeader className="h-40 bg-muted"></CardHeader>
            <CardContent className="h-60 bg-muted"></CardContent>
            <CardFooter className="h-16 bg-muted"></CardFooter>
          </Card>
        ))}
      </div>
    )
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {workshops.map((workshop) => (
        <Card key={workshop.id} className="flex flex-col card-interactive">
          <CardHeader>
            <div className="flex justify-between">
              <CardTitle>{workshop.title}</CardTitle>
              <Badge variant="outline" className="bg-secondary text-primary">
                Rp {workshop.price.toLocaleString("id-ID")}
              </Badge>
            </div>
            <CardDescription>{workshop.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="text-sm">{formatDate(workshop.start_time)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  {formatTime(workshop.start_time)} - {formatTime(workshop.end_time)} WIB
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm">{workshop.location}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Kapasitas: {workshop.max_capacity} peserta</span>
            </div>
          </CardContent>
          <CardFooter>
            <Badge className="w-full justify-center py-2 text-center bg-secondary text-primary">
              Tersedia saat pendaftaran
            </Badge>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
