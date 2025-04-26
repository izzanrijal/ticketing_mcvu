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

    // Check if payment exists, if not create it
    const { data: existingPayment, error: checkPaymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single()

    if (checkPaymentError && checkPaymentError.code === "PGRST116") {
      // Payment not found, create a new one
      console.log("Payment not found, creating a new payment record")
      const { data: newPayment, error: createPaymentError } = await supabase
        .from("payments")
        .insert({
          id: paymentId,
          registration_id: registrationId,
          status: "paid", // Changed from verified to paid for consistency
          verified_at: new Date().toISOString(),
          notes: notes || "Manually verified by admin",
          payment_method: "manual",
          amount: 0, // Will be updated with registration amount,
        })
        .select()

      if (createPaymentError) throw createPaymentError
    } else if (checkPaymentError) {
      throw checkPaymentError
    }

    // Update payment status to paid (not just verified)
    const { error: paymentError } = await supabase
      .from("payments")
      .update({
        status: "paid", // Changed from verified to paid for consistency
        verified_at: new Date().toISOString(),
        notes: notes || "Manually verified by admin",
      })
      .eq("id", paymentId)

    if (paymentError) throw paymentError
      
    // Update registration status to paid
    const { error: updateRegistrationError } = await supabase
      .from("registrations")
      .update({
        status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", registrationId)

    if (updateRegistrationError) throw updateRegistrationError

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

    // Get registration details with amount to update payment if needed
    const { data: registration, error: registrationError } = await supabase
      .from("registrations")
      .select(`
        *,
        participants(*)
      `)
      .eq("id", registrationId)
      .single()

    if (registrationError) throw registrationError

    // Update payment amount if it's 0
    if (existingPayment?.amount === 0 || !existingPayment?.amount) {
      const { error: updatePaymentAmountError } = await supabase
        .from("payments")
        .update({
          amount: registration.final_amount || registration.total_amount,
        })
        .eq("id", paymentId)

      if (updatePaymentAmountError) throw updatePaymentAmountError
    }

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
      registration_status: "paid",
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
