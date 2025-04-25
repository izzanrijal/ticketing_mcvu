/**
 * Cron Job API for Processing Payments
 * This endpoint is called by a cron job to process pending payments
 */

import { type NextRequest, NextResponse } from "next/server"
import { processRecentMutations, processPendingPayments } from "@/lib/payment-processor"
import { createClient } from "@/lib/supabase"

// Create Supabase client
const supabase = createClient()

export async function GET(req: NextRequest) {
  try {
    // Verify API key for security (should be set in environment variables)
    const apiKey = req.headers.get("x-api-key")

    if (apiKey !== process.env.CRON_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Process recent mutations
    const mutationsResult = await processRecentMutations()

    // Process pending payments
    const paymentsResult = await processPendingPayments()

    // Log the cron job execution
    await supabase.from("cron_logs").insert({
      job_name: "process_payments",
      result: {
        mutations: mutationsResult,
        payments: paymentsResult,
      },
    })

    return NextResponse.json({
      success: true,
      mutations: mutationsResult,
      payments: paymentsResult,
    })
  } catch (error) {
    console.error("Error in payment processing cron job:", error)

    // Log the error
    await supabase.from("error_logs").insert({
      source: "payment_processing_cron",
      message: `Error in cron job: ${error.message}`,
      stack: error.stack,
      level: "error",
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
