/**
 * Email Service
 * This module handles sending emails for payment confirmations and tickets
 */

import { supabaseAdmin } from "@/lib/supabase"
import { generateQRCode } from "@/lib/qr-utils"
import { formatCurrency } from "./format-utils"

// Use the pre-configured Supabase admin client
const supabase = supabaseAdmin

/**
 * Generates a PDF invoice for a registration
 * @param registration The registration data
 * @param paymentAmount The payment amount
 * @returns The PDF content as a Buffer
 */
async function generateInvoicePDF(registration: any, paymentAmount: number): Promise<Buffer> {
  // In a real implementation, you would use a PDF generation library
  // For example, using PDFKit, jsPDF, or another PDF generation library
  // For now, we'll just create a placeholder Buffer
  // This would be replaced with actual PDF generation code
  
  console.log("Generating invoice PDF for registration:", registration.registration_number)
  
  // Create a simple buffer with placeholder text
  // In a real implementation, this would be a properly formatted PDF
  const pdfContent = `INVOICE\n\nRegistration Number: ${registration.registration_number}\nAmount: ${formatCurrency(paymentAmount)}\nStatus: Pending Payment\n\nPlease transfer to our bank account.`
  
  return Buffer.from(pdfContent)
}

/**
 * Generates HTML email content for registration confirmation
 * @param registration The registration data
 * @param paymentAmount The payment amount
 * @returns The HTML content as a string
 */
function generateRegistrationEmailHTML(registration: any, paymentAmount: number): string {
  const formattedAmount = formatCurrency(paymentAmount)
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee;">
      <h2 style="color: #333; text-align: center;">Registration Confirmation</h2>
      <p>Dear ${registration.contact_person?.name || 'Participant'},</p>
      <p>Thank you for registering for MCVU 2025. Your registration has been received and is pending payment.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <p><strong>Registration Number:</strong> ${registration.registration_number}</p>
        <p><strong>Amount to Pay:</strong> ${formattedAmount}</p>
      </div>
      
      <h3>Payment Instructions:</h3>
      <ol>
        <li>Transfer the exact amount of ${formattedAmount} to our bank account.</li>
        <li>Include your registration number (${registration.registration_number}) in the transfer description.</li>
        <li>Keep your payment receipt for verification if needed.</li>
      </ol>
      
      <p>Please see the attached invoice for more details.</p>
      
      <p>If you have any questions, please contact our support team.</p>
      
      <p style="text-align: center; margin-top: 30px; color: #777; font-size: 12px;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  `
}

/**
 * Sends a registration confirmation email with PDF invoice attachment
 * @param registrationId The registration ID
 * @param contactPerson The contact person information
 * @param registrationNumber The registration number
 * @param paymentAmount The payment amount
 */
export async function sendRegistrationConfirmationEmail(
  registrationId: string,
  contactPerson: { name: string; email: string; phone: string },
  registrationNumber: string,
  paymentAmount: number
) {
  try {
    console.log(`Starting async email sending for registration ${registrationNumber}`)
    
    // Fetch complete registration data
    const { data: registration, error: registrationError } = await supabase
      .from("registrations")
      .select("*, participants(*)")
      .eq("id", registrationId)
      .single()
    
    if (registrationError || !registration) {
      throw new Error(`Failed to fetch registration data: ${registrationError?.message || 'Registration not found'}`)
    }
    
    // Generate PDF invoice
    const pdfBuffer = await generateInvoicePDF(registration, paymentAmount)
    
    // Generate HTML email content
    const htmlContent = generateRegistrationEmailHTML(registration, paymentAmount)
    
    // Prepare email data
    const emailData = {
      to: contactPerson.email,
      subject: `Registration Confirmation - ${registrationNumber}`,
      html: htmlContent,
      attachments: [
        {
          filename: `invoice_${registrationNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    }
    
    // In a real implementation, you would send the email here
    // For example, using Resend, SendGrid, or another email service
    console.log("Sending registration confirmation email:", {
      to: emailData.to,
      subject: emailData.subject,
      hasAttachment: !!emailData.attachments?.length
    })
    
    // For now, we'll just log it and return success
    return {
      success: true,
      message: "Registration confirmation email sent",
      email: contactPerson.email,
    }
  } catch (error) {
    console.error("Error sending registration confirmation email:", error)
    return {
      success: false,
      message: `Error sending registration confirmation email: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

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
      message: `Error sending payment confirmation email: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
