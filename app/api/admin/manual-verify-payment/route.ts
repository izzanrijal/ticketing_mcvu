/**
 * Manual Payment Verification API
 * This endpoint allows admins to manually verify payments
 */

import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase" // Use the admin client
import { sendPaymentConfirmationEmail } from "@/lib/email-service"

// Use the imported admin client
const supabase = supabaseAdmin

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

    // --- Debugging Email --- 
    console.log("Preparing to send payment confirmation email for registration:", registration?.id);
    console.log("Registration data being passed to email function:", JSON.stringify(registration, null, 2));
    // --- End Debugging --- 

    // Send confirmation email
    const emailResult = await sendPaymentConfirmationEmail(registration)

    // --- Debugging Email --- 
    console.log("Result received from sendPaymentConfirmationEmail:", JSON.stringify(emailResult, null, 2));
    // --- End Debugging --- 

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      payment_id: paymentId,
      registration_id: registrationId,
      email_result: emailResult,
    })
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error in manual payment verification:", error)

      // Log the error
      await supabase.from("error_logs").insert({
        source: "manual_payment_verification",
        message: `Error verifying payment: ${error.message}`,
        stack: error.stack,
        level: "error",
      })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
