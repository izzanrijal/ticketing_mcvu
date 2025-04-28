import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { schedulePaymentCheck } from "@/lib/payment-check-scheduler"
import { sendRegistrationInvoice } from "@/lib/notifications"

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
      } else {
        throw new Error('Missing required JSON data in form')
      }
      
      // Get file
      sponsorLetterFile = formData.get('sponsor_letter') as File | null
    } else {
      // Handle JSON data (for backward compatibility)
      const jsonData = await request.json()
      registrationData = jsonData.registrationData
      registrationNumber = jsonData.registrationNumber
      totalAmount = jsonData.totalAmount
    }

    console.log("API received data:", { registrationNumber, totalAmount })
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

    // Generate a unique payment identifier by SUBTRACTING a random value (1-100) from the total
    // This ensures the amount is unique and can be easily identified in bank transactions
    // We'll check for collisions to make sure we don't generate the same unique amount for different registrations

    let uniqueDeduction = 0
    let uniqueFinalAmount = 0
    let isUniqueAmountAvailable = false
    let attempts = 0
    const maxAttempts = 50 // Limit attempts to prevent infinite loop

    while (!isUniqueAmountAvailable && attempts < maxAttempts) {
      // Generate a random deduction between 1 and 100 (smaller range to minimize financial impact)
      uniqueDeduction = Math.floor(Math.random() * 100) + 1

      // Calculate the unique final amount by SUBTRACTING the deduction
      uniqueFinalAmount = finalAmount - uniqueDeduction

      // Make sure the unique amount is positive
      if (uniqueFinalAmount <= 0) {
        uniqueDeduction = Math.floor(Math.random() * (finalAmount - 1)) + 1
        uniqueFinalAmount = finalAmount - uniqueDeduction
      }

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
      `Generated unique payment amount: ${uniqueFinalAmount} (original: ${finalAmount}, deduction: ${uniqueDeduction})`
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
    const registrationData1 = { ...registrationBase }

    // Cek dan tambahkan kolom total_amount jika ada
    if (registrationColumns && Object.keys(registrationColumns).includes("total_amount")) {
      (registrationData1 as any)["total_amount"] = verifiedTotalAmount
    }

    // Cek dan tambahkan kolom discount_amount jika ada
    if (registrationColumns && Object.keys(registrationColumns).includes("discount_amount")) {
      (registrationData1 as any)["discount_amount"] = discountAmount
    }

    // Cek dan tambahkan kolom final_amount jika ada
    if (registrationColumns && Object.keys(registrationColumns).includes("final_amount")) {
      (registrationData1 as any)["final_amount"] = uniqueFinalAmount
    }

    // Cek dan tambahkan kolom notes jika ada
    if (registrationColumns && Object.keys(registrationColumns).includes("notes")) {
      (registrationData1 as any)["notes"] = appliedPromoCode
        ? `Promo: ${appliedPromoCode}, Unique Deduction: ${uniqueDeduction}`
        : `Unique Deduction: ${uniqueDeduction}`
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
    // Validasi apakah participants array ada dan valid
    if (!registrationData.participants || !Array.isArray(registrationData.participants) || registrationData.participants.length === 0) {
      console.error("Invalid or empty participants array:", registrationData.participants)
      // Buat participant default dari contact person
      registrationData.participants = [{
        id: `default-${Date.now()}`,
        full_name: registrationData.contact_person?.name || "Unnamed Participant",
        email: registrationData.contact_person?.email || "",
        phone: registrationData.contact_person?.phone || "",
        participant_type: "other",
        institution: "",
        workshops: [],
        attendSymposium: true
      }]
      console.log("Created default participant from contact person:", registrationData.participants[0])
    }
    
    // Process each participant and insert into participants table
    const createdParticipantIds: string[] = []
    for (const participant of registrationData.participants) {
      try {
        // Log raw participant data untuk debugging
        console.log("Raw participant data received:", JSON.stringify(participant))
        
        // Validasi lebih longgar untuk data participant
        // Pastikan participant memiliki nama, jika tidak gunakan nilai default
        const participantName = participant.full_name || registrationData.contact_person?.name || "Unnamed Participant"
        
        // Prepare participant data without registration_id initially
        const participantData: any = {
          full_name: participantName, // Gunakan nama yang sudah divalidasi
          // Gunakan nilai default untuk field yang mungkin kosong
          email: participant.email || registrationData.contact_person?.email || "",
          phone: participant.phone || registrationData.contact_person?.phone || "",
          nik: participant.nik || "",
          participant_type: participant.participant_type || "other",
          institution: participant.institution || "",
          registration_id: registrationId // Add registration_id directly
        }
        
        console.log("Creating participant with data:", JSON.stringify(participantData))
        
        try {
          console.log("Attempting to insert participant with data:", JSON.stringify(participantData))
          
          // Insert participant record with error handling
          const { data: createdParticipant, error: participantError } = await supabase
            .from("participants")
            .insert(participantData)
            .select()
          
          if (participantError) {
            console.error(
              "Error creating participant with data:", 
              JSON.stringify(participantData),
              "Error:",
              participantError.message,
              participantError.details
            )
            // Continue with other participants even if one fails
            continue
          }
          
          if (!createdParticipant || createdParticipant.length === 0 || !createdParticipant[0]?.id) {
            console.error(
              "Participant created but no ID returned. Data attempted:", 
              JSON.stringify(participantData),
              "Result:",
              JSON.stringify(createdParticipant)
            )
            continue
          }
          
          // Use the first participant from the array
          const newParticipant = createdParticipant[0]
          console.log("Participant created successfully:", newParticipant)
          
          // Add to our array of participant IDs
          createdParticipantIds.push(newParticipant.id);
          
          // --- Create QR Code and Workshop Registrations within this loop --- 
          
          // Generate and manage QR Code
          try {
            const qrCodeId = generateQRCodeId()
            const { error: qrError } = await supabase.from("participant_qr_codes").insert({
              participant_id: newParticipant.id,
              registration_id: registrationId,
              qr_code_id: qrCodeId,
            })
            
            if (qrError) {
              console.error(`Error creating QR code for participant ${newParticipant.id}:`, qrError)
            } else {
              generateAndStoreQRCodeImage(qrCodeId, newParticipant.id, registrationId, supabase)
                .catch(imgError => {
                  console.error(`Error generating QR code image for ${newParticipant.id}:`, imgError)
                })
            }
          } catch (qrInsertError) {
            console.error(`Exception creating QR code for participant ${newParticipant.id}:`, qrInsertError)
          }
          
          // Create workshop registrations if needed
          if (participant.workshops && Array.isArray(participant.workshops) && participant.workshops.length > 0) {
            console.log("Creating workshop registrations for participant:", newParticipant.id)
            for (const workshopId of participant.workshops) {
              if (!workshopId) continue; // Skip invalid workshop IDs
              const workshopRegistration = {
                participant_id: newParticipant.id,
                workshop_id: workshopId,
                registration_id: registrationId
              }
              console.log(`Registering workshop ${workshopId} for participant ${newParticipant.id}`)
              try {
                const { error: workshopError } = await supabase
                  .from("workshop_registrations")
                  .insert(workshopRegistration)
                if (workshopError) {
                  console.error("Error registering workshop:", workshopError.message)
                } else {
                  console.log("Workshop registration created for workshop ID:", workshopId)
                }
              } catch (workshopError) {
                console.error(`Error registering workshop ${workshopId}:`, workshopError)
              }
            }
          }
          // --- End QR Code and Workshop --- 
          
        } catch (insertError) {
          console.error("Exception during participant insert:", insertError)
          continue
        }
        
      } catch (individualParticipantError) {
        console.error("Error processing individual participant:", individualParticipantError)
        // Continue with other participants
      }
    }
    
    // Jika tidak ada participant yang berhasil dibuat, buat satu participant default
    if (createdParticipantIds.length === 0) {
      console.log("No participants were created successfully, creating a default participant")
      
      let defaultParticipant: any = {}
      
      try {
        console.log("Attempting to create default participant based on contact person:", registrationData.contact_person)
        
        // Buat participant default berdasarkan contact person (gunakan optional chaining)
        defaultParticipant = {
          full_name: registrationData.contact_person?.name || "Unnamed Participant",
          email: registrationData.contact_person?.email || "",
          phone: registrationData.contact_person?.phone || "",
          participant_type: "other",
          institution: "",
          registration_id: registrationId // Add registration_id
        }
        
        console.log("Creating default participant with data:", JSON.stringify(defaultParticipant))
        
        // Gunakan .select() untuk konsistensi
        const { data: createdDefaultArray, error: defaultError } = await supabase
          .from("participants")
          .insert(defaultParticipant)
          .select()
          
        if (defaultError) {
          console.error(
            "Error creating default participant. Data attempted:", 
            JSON.stringify(defaultParticipant),
            "Error:", 
            defaultError.message, 
            defaultError.details, 
            defaultError.hint
          )
          // Jangan langsung return error, biarkan cek akhir di luar try-catch yang menangani
        } else if (createdDefaultArray && createdDefaultArray.length > 0 && createdDefaultArray[0]?.id) {
          // Cek hasil array
          const createdDefault = createdDefaultArray[0]
          createdParticipantIds.push(createdDefault.id)
          console.log("Default participant created successfully with ID:", createdDefault.id)
          
          // --- Create QR Code and Workshop Registrations for Default Participant --- 
          try {
            const qrCodeId = generateQRCodeId()
            const { error: qrError } = await supabase.from("participant_qr_codes").insert({
              participant_id: createdDefault.id,
              registration_id: registrationId,
              qr_code_id: qrCodeId,
            })
            if (qrError) {
              console.error(`Error creating QR code for default participant ${createdDefault.id}:`, qrError)
            } else {
              generateAndStoreQRCodeImage(qrCodeId, createdDefault.id, registrationId, supabase)
                .catch(imgError => {
                  console.error(`Error generating QR code image for default participant ${createdDefault.id}:`, imgError)
                })
            }
          } catch (qrInsertError) {
            console.error(`Exception creating QR code for default participant ${createdDefault.id}:`, qrInsertError)
          }
          // Default participant usually doesn't have workshops, but add logic if needed in future
          // --- End QR Code and Workshop --- 
          
        } else {
          console.error(
            "Default participant created but no valid data returned. Data attempted:",
            JSON.stringify(defaultParticipant),
            "Result:",
            JSON.stringify(createdDefaultArray)
          )
          // Jangan langsung return error, biarkan cek akhir di luar try-catch yang menangani
        }
      } catch (exceptionDuringDefaultCreation) {
        console.error(
          "Exception during default participant creation. Data attempted:", 
          JSON.stringify(defaultParticipant), 
          "Exception:",
          exceptionDuringDefaultCreation
        )
        // Jangan langsung return error, biarkan cek akhir di luar try-catch yang menangani
      }
      
      // Jika masih tidak ada participant yang berhasil dibuat (setelah mencoba default)
      if (createdParticipantIds.length === 0) {
        console.error("Failed to create any participants, even after attempting default. Check previous logs for specific errors.")
        return NextResponse.json(
          { error: "Failed to create any participants" },
          { status: 400 }
        )
      }
    }
    
    // --- Step 2.5: Update Registration with Participant IDs ---
    console.log(`Updating registration ${registrationId} with participant IDs:`, createdParticipantIds);
    const { error: updateRegError } = await supabase
      .from('registrations')
      .update({ participant_ids: createdParticipantIds })
      .eq('id', registrationId);

    if (updateRegError) {
      // Log the error but don't necessarily stop the process, 
      // as registration & participants are already created.
      // Critical monitoring should catch this for investigation.
      console.error(`Failed to update registration ${registrationId} with participant IDs:`, updateRegError);
    }

    // --- Step 3: Create Payment Record --- 
    // Prepare payment data
    const paymentData = {
      status: "pending",
      amount: uniqueFinalAmount,
      payment_method: registrationData.payment_type === "sponsor" ? "sponsor" : "bank_transfer",
      registration_id: registrationId,
      notes:
        registrationData.payment_type === "sponsor"
          ? "Pembayaran sponsor"
          : `Pembayaran mandiri (Unique Deduction: ${uniqueDeduction})`
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
          .from('sponsor_letters')
          .upload(fileName, fileBuffer, {
            contentType: 'application/pdf'
          })
          
        if (uploadError) {
          console.error("File upload error:", uploadError)
        } else {
          // Update registration with sponsor letter URL
          await supabase
            .from('registrations')
            .update({ 
              sponsor_letter_url: uploadData.path 
            })
            .eq('id', registrationId)
            
          console.log("Sponsor letter uploaded successfully:", uploadData.path)
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

    // --- Insert Contact Person if provided ---
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
      const uniqueAmount = paymentData.amount ?? 0;
      const uniqueDeduction = originalAmount - uniqueAmount;
      const paymentType = paymentData.payment_method ?? 'unknown';
      const originalParticipantsData = registrationData.participants ?? [];

      // Fire-and-forget: Don't await this promise. Call with individual arguments.
      sendRegistrationInvoice(
        registrationId,                      // registrationId: string
        registration.registration_number,    // registrationNumber: string
        originalAmount,                      // originalAmount: number
        discountAmount,                      // discountAmount: number
        uniqueDeduction,                     // uniqueDeduction: number
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

    return NextResponse.json({
      success: true,
      registrationId: registrationId, // Ensure we return the correct ID
      uniqueDeduction: uniqueDeduction,
      uniqueAmount: uniqueFinalAmount,
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
