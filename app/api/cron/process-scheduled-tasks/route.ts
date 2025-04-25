/**
 * Cron Job API for Processing Scheduled Tasks
 * This endpoint is called by a cron job to process scheduled tasks
 */

import { type NextRequest, NextResponse } from "next/server"
import { processScheduledPaymentChecks } from "@/lib/payment-check-scheduler"
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

    // Process scheduled payment checks
    const result = await processScheduledPaymentChecks()

    // Log the cron job execution
    await supabase.from("cron_logs").insert({
      job_name: "process_scheduled_tasks",
      result: result,
    })

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error("Error in scheduled tasks processing cron job:", error)

    // Log the error
    await supabase.from("error_logs").insert({
      source: "scheduled_tasks_processing_cron",
      message: `Error in cron job: ${error.message}`,
      stack: error.stack,
      level: "error",
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
