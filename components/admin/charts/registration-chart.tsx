"use client"

import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export function RegistrationChart() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchRegistrationData() {
      try {
        // Use a raw SQL query with explicit table aliases to avoid ambiguity
        const query = `
          SELECT 
            DATE(r.created_at) AS date,
            COUNT(*) AS count
          FROM 
            registrations r
          GROUP BY 
            DATE(r.created_at)
          ORDER BY 
            date ASC
        `

        const { data: registrations, error } = await supabase.rpc("execute_sql", { query_text: query })

        if (error) throw error

        // Process data to get daily counts
        const chartData = registrations.map((item: any) => {
          const date = new Date(item.date)
          return {
            date: `${date.getDate()}/${date.getMonth() + 1}`,
            count: Number.parseInt(item.count),
          }
        })

        // If we have more than 14 days, only show the last 14
        const limitedData = chartData.length > 14 ? chartData.slice(-14) : chartData

        setData(limitedData)
      } catch (error) {
        console.error("Error fetching registration data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRegistrationData()
  }, [supabase])

  if (loading) {
    return <div className="h-[300px] w-full animate-pulse bg-muted rounded-md"></div>
  }

  if (data.length === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center border rounded-md">
        <p className="text-muted-foreground">Belum ada data pendaftaran</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#8884d8" name="Pendaftaran" />
      </BarChart>
    </ResponsiveContainer>
  )
}
