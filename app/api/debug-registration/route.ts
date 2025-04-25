import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    console.log("Debug API: Attempting to find registration with ID:", id)

    // Approach 1: Direct ID lookup
    const directResult = await supabase.from("registrations").select("*").eq("id", id).maybeSingle()

    // Approach 2: Try with case-insensitive ID
    const lowercaseResult = await supabase.from("registrations").select("*").filter("id", "ilike", id).maybeSingle()

    // Approach 3: Try to find via payment
    const paymentResult = await supabase.from("payments").select("registration_id").eq("id", id).maybeSingle()

    let paymentRegistration = null
    if (paymentResult.data && paymentResult.data.registration_id) {
      const regResult = await supabase
        .from("registrations")
        .select("*")
        .eq("id", paymentResult.data.registration_id)
        .maybeSingle()

      paymentRegistration = regResult.data
    }

    // Approach 4: Try to find via participant
    const participantResult = await supabase.from("participants").select("registration_id").eq("id", id).maybeSingle()

    let participantRegistration = null
    if (participantResult.data && participantResult.data.registration_id) {
      const regResult = await supabase
        .from("registrations")
        .select("*")
        .eq("id", participantResult.data.registration_id)
        .maybeSingle()

      participantRegistration = regResult.data
    }

    // Check if the ID exists in any table
    const registrationExists = await supabase.from("registrations").select("id").eq("id", id).maybeSingle()

    const paymentExists = await supabase.from("payments").select("id").eq("id", id).maybeSingle()

    const participantExists = await supabase.from("participants").select("id").eq("id", id).maybeSingle()

    return NextResponse.json({
      directLookup: {
        found: !!directResult.data,
        data: directResult.data,
        error: directResult.error,
      },
      caseSensitiveLookup: {
        found: !!lowercaseResult.data,
        data: lowercaseResult.data,
        error: lowercaseResult.error,
      },
      paymentLookup: {
        found: !!paymentRegistration,
        data: paymentRegistration,
        error: paymentResult.error,
      },
      participantLookup: {
        found: !!participantRegistration,
        data: participantRegistration,
        error: participantResult.error,
      },
      existsInTables: {
        registrations: !!registrationExists.data,
        payments: !!paymentExists.data,
        participants: !!participantExists.data,
      },
    })
  } catch (error: any) {
    console.error("Error in debug-registration API:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
