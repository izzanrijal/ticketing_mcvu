"use client"

import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

export function ParticipantTypeChart() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchParticipantData() {
      try {
        const { data: participants, error } = await supabase.from("participants").select("participant_type")

        if (error) throw error

        // Count by participant type
        const typeCounts: Record<string, number> = {}

        participants?.forEach((p) => {
          typeCounts[p.participant_type] = (typeCounts[p.participant_type] || 0) + 1
        })

        // Convert to array format for chart
        const chartData = Object.entries(typeCounts).map(([type, count]) => ({
          name: getParticipantTypeLabel(type),
          value: count,
        }))

        setData(chartData)
      } catch (error) {
        console.error("Error fetching participant data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchParticipantData()
  }, [supabase])

  function getParticipantTypeLabel(type: string) {
    switch (type) {
      case "specialist_doctor":
        return "Dokter Spesialis"
      case "general_doctor":
        return "Dokter Umum"
      case "nurse":
        return "Perawat"
      case "student":
        return "Mahasiswa"
      default:
        return "Lainnya"
    }
  }

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"]

  if (loading) {
    return <div className="h-[200px] w-full animate-pulse bg-muted rounded-md"></div>
  }

  if (data.length === 0) {
    return (
      <div className="h-[200px] w-full flex items-center justify-center">
        <p className="text-muted-foreground">Belum ada data peserta</p>
      </div>
    )
  }

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const total = data.reduce((sum, item) => sum + item.value, 0);
      const value = payload[0].value;
      const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white rounded shadow px-3 py-2 border text-xs">
          <div><b>{payload[0].name}</b></div>
          <div>Jumlah: {value}</div>
          <div>Persentase: {percent}%</div>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        {/* <Legend layout="vertical" verticalAlign="middle" align="right" /> */}
      </PieChart>
    </ResponsiveContainer>
  )
}
