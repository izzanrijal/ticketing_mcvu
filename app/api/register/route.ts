import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { schedulePaymentCheck } from "@/lib/payment-check-scheduler"
import { sendRegistrationInvoice } from "@/lib/notifications"

// Function to validate the Turnstile token (copied from check-registration route)
async function validateTurnstileToken(token: string | null): Promise<boolean> {
  if (!token) {
    console.warn("Turnstile validation skipped: No token provided.");
    return false;
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error("Turnstile secret key is not set in environment variables.");
    return false; // Should not proceed without a secret key
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        // Optionally, pass the user's IP address (consider privacy implications)
        // remoteip: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For'),
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log("Turnstile validation successful.");
      return true;
    } else {
      console.warn("Turnstile validation failed:", data['error-codes'] || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error("Error validating Turnstile token:", error);
    return false;
  }
}

// Function to generate a unique QR code ID
function generateQRCodeId() {
  // Format kode booking tiket pesawat: 6 karakter alfanumerik (huruf kapital dan angka)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Menghindari karakter yang mirip seperti I/1, O/0
  let qrCodeId = '';
  for (let i = 0; i < 6; i++) {
    qrCodeId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return qrCodeId;
}

// Function to generate and store QR code image asynchronously
async function generateAndStoreQRCodeImage(qrCodeId: string, participantId: string, registrationId: string, supabase: any) {
  try {
    // Use a 3rd party service to generate QR code image
    // This is a simple approach using a public API
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeId)}`
    
    // Update the QR code record with the URL
    const { error } = await supabase
      .from("participant_qr_codes")
      .update({ qr_code_url: qrCodeUrl })
      .eq("participant_id", participantId)
      .eq("registration_id", registrationId)
    
    if (error) {
      console.error(`Error updating QR code URL for participant ${participantId}:`, error)
      return false
    }
    
    return true
  } catch (error) {
    console.error(`Error in QR code image generation for ${participantId}:`, error)
    return false
  }
}

export async function POST(request: Request) {
  try {
    // Gunakan supabaseAdmin yang sudah dikonfigurasi dengan service role key
    const supabase = supabaseAdmin

    // Check if this is a multipart form request
    const contentType = request.headers.get('content-type') || ''
    
    let registrationData: any
    let registrationNumber: string
    let totalAmount: number
    let sponsorLetterFile: File | null = null
    let turnstileToken: string | null = null // Variable to hold the token
    
    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data
      const formData = await request.formData()
      
      // Get JSON data
      const jsonData = formData.get('data')
      if (jsonData) {
        const parsedData = JSON.parse(jsonData.toString())
        registrationData = parsedData.registrationData
        registrationNumber = parsedData.registrationNumber
        totalAmount = parsedData.totalAmount
        turnstileToken = parsedData.turnstileToken // Extract token
      } else {
        throw new Error('Missing required JSON data in form')
      }
      
      // Get file
      sponsorLetterFile = formData.get('sponsor_letter') as File | null
    } else {
      // Handle JSON data (for backward compatibility or direct JSON requests)
      const jsonData = await request.json()
      registrationData = jsonData.registrationData
      registrationNumber = jsonData.registrationNumber
      totalAmount = jsonData.totalAmount
      turnstileToken = jsonData.turnstileToken // Extract token
    }

    // ---- Turnstile Validation ----
    const isHuman = await validateTurnstileToken(turnstileToken);
    if (!isHuman) {
      console.warn("Turnstile validation failed for registration attempt.");
      return NextResponse.json({ error: "Verifikasi CAPTCHA gagal. Mohon refresh halaman dan coba lagi." }, { status: 403 });
    }
    // ---- End Turnstile Validation ----

    console.log("API received data (post-validation):", { registrationNumber, totalAmount })
    console.log("Participant count:", registrationData.participants.length)

    // Recalculate total amount to ensure accuracy
    let recalculatedTotal = 0

    // Pastikan ticket_id selalu tersedia
    const ticketId = registrationData.ticket_id || "3d271769-9e63-4eab-aa6a-6d56c28d556f";
    console.log("API using ticket ID:", ticketId);
    
    // Get ticket details
    const { data: ticketData } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single()

    // Get all workshop details
    const allWorkshopIds = registrationData.participants.flatMap((p: any) => p.workshops || [])
    let workshopDetails = []
    if (allWorkshopIds.length > 0) {
      const { data: workshops } = await supabase.from("workshops").select("*").in("id", allWorkshopIds)
      workshopDetails = workshops || []
    }

    // Calculate total for each participant
    for (const participant of registrationData.participants) {
      // Add ticket price ONLY if symposium is selected
      if (participant.attendSymposium === true && participant.participant_type && ticketData) {
        const priceKey = `price_${participant.participant_type}`
        if (ticketData[priceKey] !== undefined) {
          recalculatedTotal += ticketData[priceKey]
        }
      }

      // Add workshop prices
      if (participant.workshops && participant.workshops.length > 0) {
        participant.workshops.forEach((workshopId: any) => {
          const workshop = workshopDetails.find((w) => w.id === workshopId)
          if (workshop) {
            recalculatedTotal += workshop.price
          }
        })
      }
    }

    // Use recalculated total instead of provided total
    const verifiedTotalAmount = recalculatedTotal
    console.log("Recalculated total:", verifiedTotalAmount)

    // Get promo code if provided
    let discountAmount = 0
    let finalAmount = verifiedTotalAmount
    let appliedPromoCode = null

    if (registrationData.promo_code) {
      try {
        // Get promo details
        const { data: promoData } = await supabase
          .from("promo_codes")
          .select("*")
          .eq("code", registrationData.promo_code)
          .eq("is_active", true)
          .single()

        if (promoData) {
          // Validate promo code
          const now = new Date()
          const isValid =
            (!promoData.valid_from || new Date(promoData.valid_from) <= now) &&
            (!promoData.valid_until || new Date(promoData.valid_until) >= now) &&
            (!promoData.max_uses || promoData.used_count < promoData.max_uses)

          if (isValid) {
            // Calculate discount
            if (promoData.discount_type === "percentage") {
              discountAmount = Math.round(verifiedTotalAmount * (promoData.discount_value / 100))
            } else {
              discountAmount = promoData.discount_value
            }

            finalAmount = Math.max(0, verifiedTotalAmount - discountAmount)
            appliedPromoCode = promoData.code

            // Increment usage count
            await supabase
              .from("promo_codes")
              .update({ used_count: promoData.used_count + 1 })
              .eq("id", promoData.id)

            console.log(`Applied promo code ${registrationData.promo_code}: discount ${discountAmount}`)
          }
        }
      } catch (promoError) {
        console.error("Error applying promo code:", promoError)
        // Continue with registration even if promo code fails
      }
    }

    // Generate a unique payment identifier by ADDING a random value (1-999) to the total
    // This ensures the amount is unique and can be easily identified in bank transactions
    // We'll check for collisions to make sure we don't generate the same unique amount for different registrations

    let isUniqueAmountAvailable = false
    let attempts = 0
    const maxAttempts = 50 // Limit attempts to prevent infinite loop
    
    // Random unique code to add to the total amount
    let uniqueCode = 0

    while (!isUniqueAmountAvailable && attempts < maxAttempts) {
      // Generate a random addition between 1 and 999 (small amount to add to the total)
      uniqueCode = Math.floor(Math.random() * 999) + 1

      // Calculate the unique final amount by ADDING the unique code
      const uniqueFinalAmount = finalAmount + uniqueCode

      // Check if this unique amount is already used in the database
      const { data: existingPayments, error: checkError } = await supabase
        .from("payments")
        .select("id")
        .eq("amount", uniqueFinalAmount)
        .limit(1)

      if (!checkError && (!existingPayments || existingPayments.length === 0)) {
        isUniqueAmountAvailable = true
      }

      attempts++
    }

    if (!isUniqueAmountAvailable) {
      console.error("Could not generate a unique payment amount after", maxAttempts, "attempts")
      return NextResponse.json(
        { error: "Failed to generate a unique payment amount. Please try again." },
        { status: 500 },
      )
    }

    console.log(
      `Generated unique payment amount: ${finalAmount + uniqueCode} (original: ${finalAmount}, unique code: +${uniqueCode})`
    )

    // Periksa skema tabel registrations untuk mengetahui kolom yang tersedia
    let registrationColumns = null
    try {
      const { data, error } = await supabase.from("registrations").select("*").limit(1)
      if (!error && data && data.length > 0) {
        registrationColumns = data[0]
        console.log("Registration table columns:", Object.keys(registrationColumns))
      }
    } catch (schemaError) {
      console.error("Error fetching registration schema:", schemaError)
    }

    // Buat objek dasar untuk registrasi
    const mcvuNumber = Math.floor(10000000 + Math.random() * 90000000).toString()
    const registrationBase = {
      registration_number: `MCVU-${mcvuNumber}`,
      status: "pending",
      ticket_id: ticketId // Add ticket ID here
    }

    // Tambahkan kolom opsional jika ada dalam skema
    // Selalu tambahkan total_amount (sebelum deduction) dan final_amount (setelah deduction)
    const registrationData1 = {
      ...registrationBase,
      total_amount: finalAmount,     // Total cost before unique code
      discount_amount: discountAmount,
      final_amount: finalAmount + uniqueCode, // Amount to be paid after adding unique code
      unique_code: uniqueCode,       // Store the unique code in the registration
    }

    // Cek dan tambahkan kolom notes jika ada
    if (registrationColumns && Object.keys(registrationColumns).includes("notes")) {
      (registrationData1 as any)["notes"] = appliedPromoCode
        ? `Promo: ${appliedPromoCode}, Unique Code: +${uniqueCode}`
        : `Unique Code: +${uniqueCode}`
    }

    console.log("Final registration data before insert:", registrationData1)

    // --- Step 1: Create Registration Record --- 
    console.log("Attempting to insert registration record...")

    const { data: registration, error: registrationError } = await supabase
      .from("registrations")
      .insert(registrationData1) // Insert without participant_ids
      .select()
      .single()

    if (registrationError) {
      console.error("Server registration error:", registrationError)
      return NextResponse.json(
        { error: "Failed to create registration: " + registrationError.message },
        { status: 500 },
      )
    }

    const registrationId = registration.id
    console.log("Registration created successfully with ID:", registrationId)

    // --- Step 2: Create Participant Records and link to Registration --- 
    const participantOrderItems: { participant_id: string, items: any[] }[] = []; // Store item details per participant
    const createdParticipantIds: string[] = []

    // Fallback if participants array is missing or empty (use contact person)
    if (!registrationData.participants || !Array.isArray(registrationData.participants) || registrationData.participants.length === 0) {
      console.warn("Invalid or empty participants array, using contact person as default participant.")
      registrationData.participants = [{
        full_name: registrationData.contact_person?.name || "Unnamed Participant",
        email: registrationData.contact_person?.email || "",
        phone: registrationData.contact_person?.phone || "",
        nik: "", // NIK is required, but we might not have it for contact person
        participant_type: "other",
        institution: "",
        workshops: [],
        attendSymposium: true, // Assume contact person attends symposium if no participant data
        ewaco_interest: false
      }]
    }

    for (const participantInput of registrationData.participants) {
      try {
        const participantName = participantInput.full_name || registrationData.contact_person?.name || "Unnamed Participant"
        const participantData: any = {
          full_name: participantName,
          email: participantInput.email || registrationData.contact_person?.email || "",
          phone: participantInput.phone || registrationData.contact_person?.phone || "",
          nik: participantInput.nik || "", // Handle potentially missing NIK
          participant_type: participantInput.participant_type || "other",
          institution: participantInput.institution || "",
          ewaco_interest: participantInput.ewaco_interest || false,
          registration_id: registrationId
        }

        console.log("Attempting to insert participant with data:", JSON.stringify(participantData))
        const { data: createdParticipant, error: participantError } = await supabase
          .from("participants")
          .insert(participantData)
          .select()
          .single() // Assume insert returns the created record

        if (participantError) {
          console.error("Error creating participant:", participantError)
          // Consider how to handle partial failure - rollback?
          // For now, we log and continue, but this might leave orphaned registrations
          continue // Skip to the next participant
        }

        if (!createdParticipant) {
          console.error("Participant insert did not return data for:", participantName);
          continue; // Skip if insertion failed silently
        }

        console.log(`Participant ${createdParticipant.full_name} created with ID: ${createdParticipant.id}`)
        createdParticipantIds.push(createdParticipant.id)

        // --- Generate and store QR Code --- 
        try {
          const qrCodeId = generateQRCodeId(); // Assume this function exists
          const { error: qrError } = await supabase.from("participant_qr_codes").insert({
            participant_id: createdParticipant.id,
            registration_id: registrationId, // Ensure registration_id is included
            qr_code_id: qrCodeId,
          });

          if (qrError) {
            console.error(`Error creating QR code record for participant ${createdParticipant.id}:`, qrError);
          } else {
            // Assuming async image generation/upload
            generateAndStoreQRCodeImage(qrCodeId, createdParticipant.id, registrationId, supabase)
              .catch(imgError => {
                console.error(`Error generating/storing QR code image for ${createdParticipant.id}:`, imgError);
              });
          }
        } catch (qrSetupError) {
          console.error(`Exception during QR Code setup for participant ${createdParticipant.id}:`, qrSetupError);
        }
        // --- End QR Code --- 

        // --- Construct item list for this participant (for order_details JSON) --- 
        const currentParticipantItems: any[] = [];
        // Add symposium ticket if attending
        if (participantInput.attendSymposium === true && ticketData) {
          const priceKey = `price_${createdParticipant.participant_type}`;
          const symposiumPrice = ticketData[priceKey] !== undefined ? ticketData[priceKey] : 0;
          if (symposiumPrice > 0) { // Only add if price is valid
            currentParticipantItems.push({
              type: 'symposium',
              id: ticketData.id,
              name: ticketData.name,
              amount: symposiumPrice
            });
          }
        }

        // Add workshops
        if (participantInput.workshops && Array.isArray(participantInput.workshops) && participantInput.workshops.length > 0) {
          for (const workshopId of participantInput.workshops) {
            const workshop = workshopDetails.find((w: any) => w.id === workshopId)
            if (workshop && workshop.price > 0) { // Ensure workshop exists and has price
              currentParticipantItems.push({
                type: 'workshop',
                id: workshop.id,
                name: workshop.title, // Use workshop.title instead of workshop.name
                amount: workshop.price
              });

              // Also create the workshop_registrations record
              const { error: workshopRegError } = await supabase
                .from("workshop_registrations")
                .insert({ 
                  participant_id: createdParticipant.id, 
                  workshop_id: workshopId,
                  registration_id: registrationId // <<< Fix: Add registration_id
                })
              if (workshopRegError) {
                console.error(`Error linking participant ${createdParticipant.id} to workshop ${workshopId}:`, workshopRegError)
              }
            }
          }
        }

        // Add this participant's items to the main list (for order_details JSON)
        participantOrderItems.push({
          participant_id: createdParticipant.id,
          items: currentParticipantItems
        });
        // --- End item list construction ---
      } catch (innerError) {
        console.error(`Error processing participant ${participantInput.full_name || 'unknown'}:`, innerError)
        // Decide if registration should fail completely
      }
    }

    // --- Step 3: Update Registration with Participant IDs and Order Details JSON --- 
    const orderDetailsJson = { participants: participantOrderItems };
    console.log("Updating registration with Participant IDs and Order Details:", createdParticipantIds, JSON.stringify(orderDetailsJson));

    // First update just the participant_ids (this is critical and we'll wait for it)
    const { error: updateParticipantIdsError } = await supabase
      .from("registrations")
      .update({ participant_ids: createdParticipantIds })
      .eq("id", registrationId)

    if (updateParticipantIdsError) {
      console.error("Error updating registration with participant IDs:", updateParticipantIdsError)
      // This is critical, so we'll return an error
      return NextResponse.json(
        { error: "Failed to update registration with participant IDs" },
        { status: 500 }
      )
    }

    // Then update the order_details asynchronously (fire and forget)
    // We don't need to wait for this to complete before returning the response
    (async () => {
      try {
        const result = await supabase
          .from("registrations")
          .update({ order_details: orderDetailsJson })
          .eq("id", registrationId);
          
        if (result.error) {
          console.error("Error updating registration with order details:", result.error);
        } else {
          console.log("Successfully updated registration with order details");
        }
      } catch (error) {
        console.error("Exception during async order_details update:", error);
      }
    })(); // Execute immediately but don't await

    // --- Step 4: Create Contact Person Record --- 
    const contactPersonFromRequest = registrationData.contact_person;
    if (contactPersonFromRequest && contactPersonFromRequest.email) {
      console.log(`Attempting to insert contact person data for registration ${registrationId}...`);
      const { data: contactPersonData, error: contactPersonError } = await supabaseAdmin
        .from('contact_persons')
        .insert({
          registration_id: registrationId,
          name: contactPersonFromRequest.name,
          email: contactPersonFromRequest.email,
          phone: contactPersonFromRequest.phone,
        })
        .select()
        .single();

      if (contactPersonError) {
        console.error(`Error inserting contact person for registration ${registrationId}:`, contactPersonError);
        // Decide if this should be a critical error or just logged
        // For now, log and continue, email might still fail later
      } else {
        console.log(`Contact person inserted successfully for registration ${registrationId}:`, contactPersonData);
      }
    } else {
      console.log(`No contact person data provided in request for registration ${registrationId}, skipping insert.`);
    }

    // --- Send registration invoice email asynchronously ---
    // Check again if contact person email exists before sending
    if (contactPersonFromRequest && contactPersonFromRequest.email) {
      const recipientEmail = contactPersonFromRequest.email;
      console.log(`Attempting to send invoice to contact person: ${recipientEmail} for registration ${registrationId}`);

      // Prepare arguments for the function call based on its definition
      const originalAmount = registrationData.totalAmount ?? 0;
      const discountAmount = registrationData.discount_amount ?? 0; // Assuming discount_amount is available or default to 0
      const uniqueAmount = finalAmount + uniqueCode;
      const uniqueAddition = uniqueAmount - originalAmount;
      const paymentType = "bank_transfer"; // Assuming bank transfer for now
      const originalParticipantsData = registrationData.participants ?? [];

      // Fire-and-forget: Don't await this promise. Call with individual arguments.
      sendRegistrationInvoice(
        registrationId,                      // registrationId: string
        registration.registration_number,    // registrationNumber: string
        originalAmount,                      // originalAmount: number
        discountAmount,                      // discountAmount: number
        uniqueAddition,                      // uniqueAddition: number
        paymentType,                         // paymentType: string
        originalParticipantsData             // originalParticipantsData: any[]
      ).catch(emailError => {
        // Log error if sending email fails, but don't block response
        console.error(`Error sending registration invoice for ${registrationId} to ${recipientEmail}:`, emailError);
      });
      console.log(`Initiated async invoice email send for registration ${registrationId} to ${recipientEmail}`);
    } else {
      console.warn(`No valid contact_person with email found in registrationData for ${registrationId}, skipping invoice email.`);
    }

    // --- Step 5: Create Payment Record --- 
    // Prepare payment data
    const paymentData = {
      status: "pending",
      amount: finalAmount + uniqueCode,
      payment_method: registrationData.payment_type === "sponsor" ? "sponsor" : "bank_transfer",
      registration_id: registrationId,
      notes:
        registrationData.payment_type === "sponsor"
          ? "Pembayaran sponsor"
          : `Pembayaran mandiri (Unique Code: +${uniqueCode})`
      // check_attempts column has a default value of 0 in the database
    }
    
    // Handle file upload if present
    if (sponsorLetterFile && registrationData.payment_type === "sponsor") {
      try {
        // Upload file to Supabase storage
        // Create the filename with standardized format: MCVU-64602088-sponsorship-letter.pdf
        const fileExtension = sponsorLetterFile.name.split('.').pop() || 'pdf';
        const fileName = `${registrationNumber}-sponsorship-letter.${fileExtension}`
        
        // Convert file to arrayBuffer for upload
        const arrayBuffer = await sponsorLetterFile.arrayBuffer()
        const fileBuffer = new Uint8Array(arrayBuffer)
        
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('Sponsor Letters')
          .upload(fileName, fileBuffer, {
            contentType: 'application/pdf'
          })
          
        if (uploadError) {
          console.error("File upload error:", uploadError)
        } else {
          // Get the public URL for the uploaded file
          const { data: publicUrlData } = supabase
            .storage
            .from('Sponsor Letters')
            .getPublicUrl(fileName);

          // Update registration with both path and URL
          await supabase
            .from('registrations')
            .update({ 
              sponsor_letter_path: uploadData.path,
              sponsor_letter_url: publicUrlData.publicUrl
            })
            .eq('id', registrationId)
            
          console.log("Sponsor letter uploaded successfully:", {
            path: uploadData.path,
            url: publicUrlData.publicUrl
          })
        }
      } catch (fileError) {
        console.error("Error processing sponsor letter:", fileError)
        // Continue with registration even if file upload fails
      }
    }

    console.log("Creating payment with data:", paymentData)

    // Create payment record with the unique amount
    const { data: payment, error: paymentError } = await supabase.from("payments").insert(paymentData).select().single()

    if (paymentError) {
      console.error("Payment error:", paymentError)
      return NextResponse.json(
        { error: "Failed to create payment: " + paymentError.message },
        { status: 500 }
      )
    } else {
      // Schedule payment check for this registration
      // This will start a timer to check for payment every 5 minutes
      await schedulePaymentCheck(registrationId)
    }

    return NextResponse.json({
      success: true,
      registrationId: registrationId, // Ensure we return the correct ID
      uniqueAddition: uniqueCode,
      uniqueAmount: finalAmount + uniqueCode,
      originalAmount: finalAmount,
    })
  } catch (error) {
    console.error("Server error:", error)
    // Always return a proper JSON response, even for errors
    return NextResponse.json({ 
      error: "Internal server error: " + (error instanceof Error ? error.message : String(error)) 
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}
