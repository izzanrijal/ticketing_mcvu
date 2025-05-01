/**
 * Moota Webhook Handler
 * This endpoint receives webhooks from Moota.co for real-time payment notifications
 */

import { type NextRequest, NextResponse } from "next/server"
import { verifyWebhookSignature, type MootaWebhookPayload } from "@/lib/moota-api"
import { processRecentMutations } from "@/lib/payment-processor"
import { supabaseAdmin } from "@/lib/supabase"

// Create Supabase client
const supabase = supabaseAdmin

export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret
    const secret = req.headers.get("x-webhook-secret")
    if (secret !== process.env.MOOTA_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 })
    }

    // Get the request body as text for signature verification
    const bodyText = await req.text()
    let body: MootaWebhookPayload

    try {
      body = JSON.parse(bodyText)
    } catch (err) {
      const error = err as Error
      console.error("Error parsing webhook payload:", error.message)
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
    }

    // Verify webhook signature
    const signature = req.headers.get("x-webhook-signature")
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 })
    }

    const isValid = verifyWebhookSignature(bodyText, signature)
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    // Log webhook
    const { data: webhookLog, error: logError } = await supabase
      .from("webhook_logs")
      .insert({
        source: "moota",
        payload: body,
        signature,
      })
      .select()
      .single()

    if (logError) {
      console.error("Error logging webhook:", logError)
    }

    // Process the webhook payload
    await processRecentMutations()

    // Update webhook log with processing result
    if (webhookLog) {
      await supabase
        .from("webhook_logs")
        .update({
          processing_result: "success",
          processed_at: new Date().toISOString(),
        })
        .eq("id", webhookLog.id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const error = err as Error
    console.error("Error processing Moota webhook:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
