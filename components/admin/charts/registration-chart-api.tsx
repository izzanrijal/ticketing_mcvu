"use client"

import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export function RegistrationChartApi() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRegistrationData() {
      try {
        const response = await fetch("/api/admin/registration-chart-data")

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to fetch chart data")
        }

        const data = await response.json()
        setData(data)
      } catch (err: any) {
        console.error("Error fetching registration data:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchRegistrationData()
  }, [])

  if (loading) {
    return <div className="h-[300px] w-full animate-pulse bg-muted rounded-md"></div>
  }

  if (error) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center border rounded-md bg-red-50 text-red-800">
        <p>Error loading chart data: {error}</p>
      </div>
    )
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
