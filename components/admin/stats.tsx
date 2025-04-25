"use client"

import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function AdminStats() {
  const [participantStats, setParticipantStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data, error } = await supabase.from("participants").select("participant_type")

        if (error) throw error

        // Count by participant type
        const stats = data.reduce((acc: any, curr) => {
          acc[curr.participant_type] = (acc[curr.participant_type] || 0) + 1
          return acc
        }, {})

        setParticipantStats(stats)
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [supabase])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Dokter Spesialis</CardTitle>
          <CardDescription>Total peserta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{loading ? "..." : participantStats.specialist_doctor || 0}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Dokter Umum</CardTitle>
          <CardDescription>Total peserta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{loading ? "..." : participantStats.general_doctor || 0}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Perawat</CardTitle>
          <CardDescription>Total peserta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{loading ? "..." : participantStats.nurse || 0}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Mahasiswa</CardTitle>
          <CardDescription>Total peserta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{loading ? "..." : participantStats.student || 0}</div>
        </CardContent>
      </Card>
    </div>
  )
}
