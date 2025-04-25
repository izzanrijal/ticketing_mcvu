import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { schedulePaymentCheck } from "@/lib/payment-check-scheduler"

export async function POST(request: Request) {
  try {
    // Gunakan service role key untuk bypass RLS
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        persistSession: false,
      },
    })
    
    let registrationData, registrationNumber, totalAmount, sponsorLetterFile;
    
    // Check content type to determine how to parse the request
    const contentType = request.headers.get("content-type") || "";
    
    if (contentType.includes("multipart/form-data")) {
      // Handle FormData with file upload
      const formData = await request.formData();
      registrationData = JSON.parse(formData.get("registrationData") as string);
      registrationNumber = formData.get("registrationNumber") as string;
      totalAmount = parseFloat(formData.get("totalAmount") as string);
      sponsorLetterFile = formData.get("sponsor_letter") as File;
    } else {
      // Handle regular JSON request
      const jsonData = await request.json();
      registrationData = jsonData.registrationData;
      registrationNumber = jsonData.registrationNumber;
      totalAmount = jsonData.totalAmount;
    }

    console.log("API received data:", { registrationNumber, totalAmount })
    console.log("Participant count:", registrationData.participants.length)

    // Recalculate total amount to ensure accuracy
    let recalculatedTotal = 0

    // Get ticket details
    const { data: ticketData } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", registrationData.ticket_id)
      .single()

    // Get all workshop details
    const allWorkshopIds = registrationData.participants.flatMap((p) => p.workshops || [])
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
        participant.workshops.forEach((workshopId) => {
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
      `Generated unique payment amount: ${uniqueFinalAmount} (original: ${finalAmount}, deduction: ${uniqueDeduction})`,
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
    }

    // Tambahkan kolom opsional jika ada dalam skema
    const registrationData1 = { ...registrationBase }

    // Cek dan tambahkan kolom total_amount jika ada
    if (registrationColumns && Object.keys(registrationColumns).includes("total_amount")) {
      registrationData1["total_amount"] = verifiedTotalAmount
    }

    // Cek dan tambahkan kolom discount_amount jika ada
    if (registrationColumns && Object.keys(registrationColumns).includes("discount_amount")) {
      registrationData1["discount_amount"] = discountAmount
    }

    // Cek dan tambahkan kolom final_amount jika ada
    if (registrationColumns && Object.keys(registrationColumns).includes("final_amount")) {
      registrationData1["final_amount"] = uniqueFinalAmount
    }

    // Cek dan tambahkan kolom notes jika ada
    if (registrationColumns && Object.keys(registrationColumns).includes("notes")) {
      registrationData1["notes"] = appliedPromoCode
        ? `Promo: ${appliedPromoCode}, Unique Deduction: ${uniqueDeduction}`
        : `Unique Deduction: ${uniqueDeduction}`
    }

    console.log("Creating registration with data:", registrationData1)

    // Step 1: Create registration record with available columns
    const { data: registration, error: registrationError } = await supabase
      .from("registrations")
      .insert(registrationData1)
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
    console.log("Registration created with ID:", registrationId)

    // Handle sponsor letter upload if present
    if (registrationData.payment_type === "sponsor" && sponsorLetterFile) {
      try {
        console.log("Uploading sponsor letter file...");
        
        // Create a buffer from the file
        const fileBuffer = await sponsorLetterFile.arrayBuffer();
        const fileName = `${registrationId}-${Date.now()}.pdf`;
        
        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('sponsor_letters')
          .upload(fileName, fileBuffer, {
            contentType: 'application/pdf'
          });
          
        if (uploadError) {
          console.error("Sponsor letter upload error:", uploadError);
        } else {
          console.log("Sponsor letter uploaded successfully:", uploadData.path);
          
          // Update registration with sponsor letter URL
          const { error: updateError } = await supabase
            .from("registrations")
            .update({ sponsor_letter_url: uploadData.path })
            .eq("id", registrationId);
            
          if (updateError) {
            console.error("Error updating registration with sponsor letter URL:", updateError);
          }
        }
      } catch (fileError) {
        console.error("Error processing sponsor letter file:", fileError);
      }
    }
    
    // Create payment record with the unique amount and ONLY use registration_id
    const paymentData = {
      status: "pending",
      amount: uniqueFinalAmount,
      payment_method: registrationData.payment_type === "sponsor" ? "sponsor" : "bank_transfer",
      registration_id: registrationId,
      notes:
        registrationData.payment_type === "sponsor"
          ? "Pembayaran sponsor"
          : `Pembayaran mandiri (Unique Deduction: ${uniqueDeduction})`,
      check_attempts: 0, // Initialize check attempts counter
    }

    console.log("Creating payment with data:", paymentData)

    // Create payment record with the unique amount
    const { data: payment, error: paymentError } = await supabase.from("payments").insert(paymentData).select().single()

    if (paymentError) {
      console.error("Payment error:", paymentError)
      // Log but continue since registration was successful
    } else {
      // Schedule payment check for this registration
      // This will start a timer to check for payment every 5 minutes
      await schedulePaymentCheck(registrationId)
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
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 })
  }
}
