/**
 * Manual Payment Verification API
 * This endpoint allows admins to manually verify payments
 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { sendPaymentConfirmationEmail } from "@/lib/email-service"

// Create Supabase client
const supabase = createClient()

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { paymentId, registrationId, transactionId, notes } = await req.json()

    if (!paymentId || !registrationId) {
      return NextResponse.json({ error: "Payment ID and Registration ID are required" }, { status: 400 })
    }

    // Update payment status
    const { error: paymentError } = await supabase
      .from("payments")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        verification_notes: notes || "Manually verified by admin",
      })
      .eq("id", paymentId)

    if (paymentError) throw paymentError

    // If transaction ID is provided, update it
    if (transactionId) {
      const { error: transactionError } = await supabase
        .from("transaction_mutations")
        .update({
          status: "processed",
          payment_id: paymentId,
          registration_id: registrationId,
          notes: notes || "Manually matched by admin",
        })
        .eq("id", transactionId)

      if (transactionError) throw transactionError
    }

    // Get registration details
    const { data: registration, error: registrationError } = await supabase
      .from("registrations")
      .select(`
        *,
        participants(*)
      `)
      .eq("id", registrationId)
      .single()

    if (registrationError) throw registrationError

    // Send confirmation email
    const emailResult = await sendPaymentConfirmationEmail(registration)

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      payment_id: paymentId,
      registration_id: registrationId,
      email_result: emailResult,
    })
  } catch (error) {
    console.error("Error in manual payment verification:", error)

    // Log the error
    await supabase.from("error_logs").insert({
      source: "manual_payment_verification",
      message: `Error verifying payment: ${error.message}`,
      stack: error.stack,
      level: "error",
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
