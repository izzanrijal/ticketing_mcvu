/**
 * Moota Webhook Handler
 * This endpoint receives webhooks from Moota.co for real-time payment notifications
 */

import { type NextRequest, NextResponse } from "next/server"
import { verifyWebhookSignature, type MootaWebhookPayload } from "@/lib/moota-api"
import { processMutation } from "@/lib/payment-processor"
import { createClient } from "@/lib/supabase"

// Create Supabase client
const supabase = createClient()

export async function POST(req: NextRequest) {
  try {
    // Get the request body as text for signature verification
    const bodyText = await req.text()
    let body: MootaWebhookPayload

    try {
      body = JSON.parse(bodyText)
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
    }

    // Get the signature from headers
    const signature = req.headers.get("X-Moota-Signature") || ""

    // Verify the signature
    const isValid = verifyWebhookSignature(signature, bodyText)

    // Log the webhook
    const { data: webhookLog, error: logError } = await supabase
      .from("webhook_logs")
      .insert({
        source: "moota",
        event_type: body.type === "CR" ? "credit" : "debit",
        payload: body,
        headers: Object.fromEntries(req.headers.entries()),
        signature_valid: isValid,
      })
      .select()
      .single()

    if (logError) {
      console.error("Error logging webhook:", logError)
    }

    // If signature is invalid, return error
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    // Skip outgoing transactions (DB = Debit)
    if (body.type === "DB") {
      return NextResponse.json({
        success: true,
        message: "Skipped outgoing transaction",
      })
    }

    // Process the mutation
    const result = await processMutation({
      bank_id: body.bank_id,
      account_number: body.account_number,
      bank_type: body.bank_type,
      date: body.date,
      amount: body.amount,
      description: body.description,
      type: body.type,
      balance: body.balance,
      created_at: body.created_at,
      updated_at: body.updated_at,
      mutation_id: body.mutation_id,
      token: body.token,
      attachment: body.attachment,
      note: body.note,
    })

    // Update webhook log with processing result
    if (webhookLog) {
      await supabase
        .from("webhook_logs")
        .update({
          processing_result: result,
          processed_at: new Date().toISOString(),
        })
        .eq("id", webhookLog.id)
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error("Error processing Moota webhook:", error)

    // Log the error
    await supabase.from("error_logs").insert({
      source: "moota_webhook",
      message: `Error processing webhook: ${error.message}`,
      stack: error.stack,
      level: "error",
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
