import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

/**
 * Generate a QR code image as a data URL
 * @param data The data to encode in the QR code
 * @returns Promise resolving to a data URL for the QR code image
 */
export async function generateQRCode(data: string): Promise<string> {
  try {
    // In a real implementation, you would use a QR code generation library
    // For example, using qrcode-generator, qrcode, or another QR library
    // For now, we'll just return a placeholder URL
    
    // This would be replaced with actual QR code generation code
    // Example with qrcode library:
    // const QRCode = require('qrcode');
    // return await QRCode.toDataURL(data);
    
    // Placeholder implementation
    console.log("Generating QR code for data:", data);
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==`;
  } catch (error) {
    console.error("Error generating QR code:", error);
    // Return a fallback image URL
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==`;
  }
}

// Generate a QR code for a participant
export function generateParticipantQrData(registrationItemId: string) {
  // Create a data object with the registration item ID
  const data = {
    type: "participant_checkin",
    id: registrationItemId,
    timestamp: new Date().toISOString(),
  }

  // Return JSON string that will be encoded in QR
  return JSON.stringify(data)
}

// Validate a QR code and perform check-in
export async function validateAndCheckIn(qrData: string) {
  try {
    const supabase = createClientComponentClient()

    // Parse the QR data
    const data = JSON.parse(qrData)

    // Validate the QR data structure
    if (!data.type || data.type !== "participant_checkin" || !data.id) {
      return { success: false, message: "Invalid QR code format" }
    }

    const registrationItemId = data.id

    // Check if the registration item exists and is valid
    const { data: registrationItem, error: itemError } = await supabase
      .from("registration_items")
      .select(`
        id,
        registration:registrations!inner (
          id,
          registration_number,
          status
        ),
        participant:participants (
          id,
          full_name,
          email,
          participant_type
        )
      `)
      .eq("id", registrationItemId)
      .single()

    if (itemError || !registrationItem) {
      return { success: false, message: "Registration not found" }
    }

    // Check if the registration is paid
    // Ensure we're accessing the status correctly from the registration object
    // Use type assertion to handle the complex structure
    const registration = registrationItem.registration as any;
    const registrationStatus = Array.isArray(registration) 
      ? registration[0]?.status 
      : registration?.status;
      
    if (registrationStatus !== "paid") {
      return {
        success: false,
        message: "Registration is not paid",
        data: {
          registrationItem,
          checkInStatus: "unpaid",
        },
      }
    }

    // Check if already checked in
    const { data: existingCheckIn, error: checkInError } = await supabase
      .from("check_ins")
      .select("*")
      .eq("registration_item_id", registrationItemId)
      .is("workshop_id", null)
      .maybeSingle()

    if (checkInError) {
      return { success: false, message: "Error checking check-in status" }
    }

    if (existingCheckIn) {
      return {
        success: true,
        message: "Participant already checked in",
        data: {
          registrationItem,
          checkInStatus: "already_checked_in",
          checkInTime: existingCheckIn.checked_in_at,
        },
      }
    }

    // Perform check-in
    const { error: createError } = await supabase.from("check_ins").insert({
      registration_item_id: registrationItemId,
      checked_in_by: "00000000-0000-0000-0000-000000000000", // Replace with actual admin ID
      checked_in_at: new Date().toISOString(),
    })

    if (createError) {
      return { success: false, message: "Failed to check in participant" }
    }

    return {
      success: true,
      message: "Participant successfully checked in",
      data: {
        registrationItem,
        checkInStatus: "checked_in",
        checkInTime: new Date().toISOString(),
      },
    }
  } catch (error) {
    console.error("Error validating QR code:", error)
    return { success: false, message: "Invalid QR code" }
  }
}
