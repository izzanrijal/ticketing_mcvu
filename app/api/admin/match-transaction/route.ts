/**
 * Match Transaction API
 * This endpoint allows admins to manually match transactions with registrations
 */

import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

// Create Supabase client
const supabase = supabaseAdmin

export async function POST(req: NextRequest) {
  try {
    const { registrationId, transactionId } = await req.json()

    if (!registrationId || !transactionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Match the transaction with the registration
    const { error: updateError } = await supabase
      .from("transactions")
      .update({ registration_id: registrationId })
      .eq("id", transactionId)

    if (updateError) {
      console.error("Error matching transaction:", updateError)
      return NextResponse.json(
        { error: "Failed to match transaction" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const error = err as Error
    console.error("Error in match transaction:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
