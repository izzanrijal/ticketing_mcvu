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

    // Use the SQL function to get recent registrations
    const { data, error } = await supabase.rpc("get_recent_registrations")

    if (error) {
      console.error("Error fetching recent registrations:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Process the data to match the expected format
    const processedData = data.map((item: any) => {
      return {
        id: item.id,
        registration_number: item.registration_number,
        created_at: item.created_at,
        final_amount: item.final_amount,
        payment_status: item.payment_status || "pending",
        participant: item.participant_id
          ? {
              id: item.participant_id,
              full_name: item.full_name,
              email: item.email,
              participant_type: item.participant_type,
            }
          : null,
      }
    })

    return NextResponse.json(processedData)
  } catch (error: any) {
    console.error("Error in recent registrations API:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
