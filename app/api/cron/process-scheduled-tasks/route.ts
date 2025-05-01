/**
 * Cron Job API for Processing Scheduled Tasks
 * This endpoint is called by a cron job to process scheduled tasks
 */

import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { processScheduledPaymentChecks } from "@/lib/payment-check-scheduler"

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

    // Process scheduled payment checks
    await processScheduledPaymentChecks()

    return NextResponse.json({ success: true })
  } catch (err) {
    const error = err as Error
    console.error("Error processing scheduled tasks:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
