"use client"

import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

export function CheckinChart() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchCheckinData() {
      try {
        // Get total participants
        const { count: totalParticipants } = await supabase
          .from("participants")
          .select("*", { count: "exact", head: true })

        // Get total check-ins
        const { count: totalCheckins } = await supabase.from("check_ins").select("*", { count: "exact", head: true })

        const checkedIn = totalCheckins || 0
        const notCheckedIn = (totalParticipants || 0) - checkedIn

        setData([
          { name: "Check-in", value: checkedIn },
          { name: "Belum Check-in", value: notCheckedIn > 0 ? notCheckedIn : 0 },
        ])
      } catch (error) {
        console.error("Error fetching check-in data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCheckinData()
  }, [supabase])

  const COLORS = ["#0088FE", "#FFBB28"]

  if (loading) {
    return <div className="h-[200px] w-full animate-pulse bg-muted rounded-md"></div>
  }

  if (data.every((item) => item.value === 0)) {
    return (
      <div className="h-[200px] w-full flex items-center justify-center">
        <p className="text-muted-foreground">Belum ada data check-in</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}
