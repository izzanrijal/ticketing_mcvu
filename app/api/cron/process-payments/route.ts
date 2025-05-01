/**
 * Cron Job API for Processing Payments
 * This endpoint is called by a cron job to process pending payments
 */

import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { processRecentMutations, processPendingPayments } from "@/lib/payment-processor"

// Create Supabase client
const supabase = supabaseAdmin

export async function GET(req: NextRequest) {
  try {
    // Verify authorization token
    const authHeader = req.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    if (token !== process.env.CRON_SECRET) {
      return new NextResponse("Invalid token", { status: 401 })
    }

    // Process payments
    await processRecentMutations()
    await processPendingPayments()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing payments:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
