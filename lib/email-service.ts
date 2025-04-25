/**
 * Email Service
 * This module handles sending emails for payment confirmations and tickets
 */

import { createClient } from "@/lib/supabase"
import { generateQRCode } from "@/lib/qr-utils"

// Create Supabase client
const supabase = createClient()

// Function to send payment confirmation email with QR code ticket
export async function sendPaymentConfirmationEmail(registration: any) {
  try {
    // Get primary participant
    const primaryParticipant = registration.participants?.[0]

    if (!primaryParticipant || !primaryParticipant.email) {
      throw new Error("No primary participant or email found")
    }

    // Generate QR code for each participant
    const participantQRCodes = await Promise.all(
      registration.participants.map(async (participant: any) => {
        const qrData = {
          id: participant.id,
          name: participant.full_name,
          registration_id: registration.id,
          registration_number: registration.registration_number,
          participant_type: participant.participant_type,
        }

        // Generate QR code
        const qrCodeUrl = await generateQRCode(JSON.stringify(qrData))

        return {
          participant,
          qrCodeUrl,
        }
      }),
    )

    // Prepare email data
    const emailData = {
      to: primaryParticipant.email,
      subject: `Payment Confirmed - ${registration.registration_number}`,
      registration,
      participants: participantQRCodes,
    }

    // In a real implementation, you would send the email here
    // For example, using Resend, SendGrid, or another email service
    console.log("Sending payment confirmation email:", emailData)

    // For now, we'll just log it and return success
    return {
      success: true,
      message: "Payment confirmation email sent",
      email: primaryParticipant.email,
    }
  } catch (error) {
    console.error("Error sending payment confirmation email:", error)
    return {
      success: false,
      message: `Error sending payment confirmation email: ${error.message}`,
    }
  }
}
