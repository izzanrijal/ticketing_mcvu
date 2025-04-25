/**
 * Payment Processor
 * This module handles payment verification and processing logic
 */

import { createClient } from "@/lib/supabase"
import { fetchMutations, type MootaMutation } from "@/lib/moota-api"
import { sendPaymentConfirmationEmail } from "@/lib/email-service"

// Create Supabase client
const supabase = createClient()

// Maximum number of check attempts (5 minutes interval for 24 hours = 288 attempts)
const MAX_CHECK_ATTEMPTS = 288

// Process a single mutation
export async function processMutation(mutation: MootaMutation) {
  try {
    // Skip outgoing transactions (DB = Debit)
    if (mutation.type === "DB") {
      console.log(`Skipping outgoing transaction: ${mutation.mutation_id}`)
      return {
        success: true,
        message: "Skipped outgoing transaction",
        mutation_id: mutation.mutation_id,
      }
    }

    // Check if mutation already exists in our database
    const { data: existingMutation } = await supabase
      .from("transaction_mutations")
      .select("id, status")
      .eq("moota_mutation_id", mutation.mutation_id)
      .single()

    // If mutation already exists and is processed, skip it
    if (existingMutation && ["matched", "processed"].includes(existingMutation.status)) {
      console.log(`Mutation already processed: ${mutation.mutation_id}`)
      return {
        success: true,
        message: "Mutation already processed",
        mutation_id: mutation.mutation_id,
        status: existingMutation.status,
      }
    }

    // If mutation exists but is not processed, update it
    if (existingMutation) {
      const { data, error } = await supabase
        .from("transaction_mutations")
        .update({
          amount: mutation.amount,
          description: mutation.description,
          transaction_date: mutation.date,
          raw_data: mutation,
          status: "unprocessed", // Reset status to reprocess
        })
        .eq("id", existingMutation.id)
        .select()
        .single()

      if (error) throw error

      // Try to match with registration
      const { data: matchResult } = await supabase.rpc("match_transaction_with_registration", {
        p_transaction_id: data.id,
      })

      return {
        success: true,
        message: "Mutation updated and processed",
        mutation_id: mutation.mutation_id,
        transaction_id: data.id,
        match_result: matchResult,
      }
    }

    // Insert new mutation
    const { data: newMutation, error } = await supabase
      .from("transaction_mutations")
      .insert({
        moota_mutation_id: mutation.mutation_id,
        bank_id: mutation.bank_id,
        account_number: mutation.account_number,
        amount: mutation.amount,
        description: mutation.description,
        type: mutation.type,
        transaction_date: mutation.date,
        raw_data: mutation,
        status: "unprocessed",
      })
      .select()
      .single()

    if (error) throw error

    // Try to match with registration
    const { data: matchResult } = await supabase.rpc("match_transaction_with_registration", {
      p_transaction_id: newMutation.id,
    })

    // If matched successfully and doesn't need review, send confirmation email
    if (matchResult?.success && !matchResult?.needs_review && matchResult?.registration_id && matchResult?.payment_id) {
      // Get registration details
      const { data: registration } = await supabase
        .from("registrations")
        .select(`
          *,
          participants(*)
        `)
        .eq("id", matchResult.registration_id)
        .single()

      if (registration) {
        // Send confirmation email
        await sendPaymentConfirmationEmail(registration)

        // Update transaction status to processed
        await supabase.from("transaction_mutations").update({ status: "processed" }).eq("id", newMutation.id)
      }
    }

    return {
      success: true,
      message: "New mutation processed",
      mutation_id: mutation.mutation_id,
      transaction_id: newMutation.id,
      match_result: matchResult,
    }
  } catch (error) {
    console.error("Error processing mutation:", error)
    return {
      success: false,
      message: `Error processing mutation: ${error.message}`,
      mutation_id: mutation.mutation_id,
    }
  }
}

// Check payment for a specific registration
export async function checkPaymentForRegistration(registrationId: string) {
  try {
    // Get registration details
    const { data: registration, error: registrationError } = await supabase
      .from("registrations")
      .select("*, payments(*)")
      .eq("id", registrationId)
      .single()

    if (registrationError) throw registrationError

    if (!registration) {
      return {
        success: false,
        message: "Registration not found",
        registration_id: registrationId,
      }
    }

    // Check if payment is already verified
    const payment = registration.payments?.[0]
    if (payment?.status === "verified" || registration.status === "paid") {
      return {
        success: true,
        message: "Payment already verified",
        registration_id: registrationId,
        payment_id: payment?.id,
      }
    }

    // Increment check attempts
    const { data: updatedPayment, error: updateError } = await supabase
      .from("payments")
      .update({
        check_attempts: (payment?.check_attempts || 0) + 1,
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", payment?.id)
      .select()
      .single()

    if (updateError) throw updateError

    // Get date for last 24 hours
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const startDate = yesterday.toISOString().split("T")[0]

    // Fetch mutations from Moota
    const mutations = await fetchMutations(startDate)

    // Look for matching mutation
    const matchingMutation = mutations.find((mutation) => {
      // Skip outgoing transactions
      if (mutation.type === "DB") return false

      // Check if amount matches (with small tolerance for bank fees)
      const amountMatches = Math.abs(mutation.amount - payment.amount) < 10000

      // Check if description contains registration number
      const descriptionMatches =
        registration.registration_number &&
        mutation.description.toLowerCase().includes(registration.registration_number.toLowerCase())

      return amountMatches || descriptionMatches
    })

    if (matchingMutation) {
      // Process the matching mutation
      const result = await processMutation(matchingMutation)

      // If we've reached max attempts, stop checking
      if ((payment?.check_attempts || 0) >= MAX_CHECK_ATTEMPTS) {
        return {
          success: true,
          registration_id: registrationId,
          payment_id: payment?.id,
          matched: true,
          result,
          message: "Max check attempts reached, stopping checks",
          continue_checking: false,
        }
      }

      return {
        success: true,
        registration_id: registrationId,
        payment_id: payment?.id,
        matched: true,
        result,
        continue_checking: false, // Stop checking since we found a match
      }
    }

    // If we've reached max attempts, stop checking
    if ((payment?.check_attempts || 0) >= MAX_CHECK_ATTEMPTS) {
      return {
        success: true,
        registration_id: registrationId,
        payment_id: payment?.id,
        matched: false,
        message: "Max check attempts reached, stopping checks",
        continue_checking: false,
      }
    }

    return {
      success: true,
      registration_id: registrationId,
      payment_id: payment?.id,
      matched: false,
      message: "No matching mutation found, will check again",
      continue_checking: true, // Continue checking
    }
  } catch (error) {
    console.error(`Error checking payment for registration ${registrationId}:`, error)
    return {
      success: false,
      registration_id: registrationId,
      message: `Error: ${error.message}`,
      continue_checking: true, // Continue checking despite error
    }
  }
}
