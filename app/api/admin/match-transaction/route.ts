/**
 * Match Transaction API
 * This endpoint allows admins to manually match transactions with registrations
 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

// Create Supabase client
const supabase = createClient()

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { transactionId, registrationId, paymentId, notes } = await req.json()

    if (!transactionId || !registrationId) {
      return NextResponse.json({ error: "Transaction ID and Registration ID are required" }, { status: 400 })
    }

    // Update transaction
    const { error: transactionError } = await supabase
      .from("transaction_mutations")
      .update({
        registration_id: registrationId,
        payment_id: paymentId,
        status: paymentId ? "matched" : "needs_review",
        notes: notes || "Manually matched by admin",
      })
      .eq("id", transactionId)

    if (transactionError) throw transactionError

    // If payment ID is provided, update it
    if (paymentId) {
      const { error: paymentError } = await supabase
        .from("payments")
        .update({
          status: "paid", // Changed from verified to paid for consistency
          verified_at: new Date().toISOString(),
          notes: notes || "Manually matched with transaction", // Changed from verification_notes to notes
        })
        .eq("id", paymentId)
        
      // Also update registration status to paid for consistency
      const { error: registrationError } = await supabase
        .from("registrations")
        .update({
          status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", registrationId)
        
      if (registrationError) throw registrationError

      if (paymentError) throw paymentError
    }

    return NextResponse.json({
      success: true,
      message: "Transaction matched successfully",
      transaction_id: transactionId,
      registration_id: registrationId,
      payment_id: paymentId,
    })
  } catch (error) {
    console.error("Error matching transaction:", error)

    // Log the error
    await supabase.from("error_logs").insert({
      source: "match_transaction",
      message: `Error matching transaction: ${error.message}`,
      stack: error.stack,
      level: "error",
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
