import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use the SQL function to get chart data
    const { data, error } = await supabase.rpc("get_registration_chart_data")

    if (error) {
      console.error("Error fetching registration chart data:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Process the data to match the expected format
    const processedData = data.map((item: any) => {
      const date = new Date(item.date)
      return {
        date: `${date.getDate()}/${date.getMonth() + 1}`,
        count: item.count,
      }
    })

    return NextResponse.json(processedData)
  } catch (error: any) {
    console.error("Error in registration chart data API:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
