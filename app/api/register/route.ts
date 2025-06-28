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

// Helper function to generate unique final amount
async function generateUniqueFinalAmount(
  baseAmount: number,
  maxAttempts = 10
): Promise<number> {
  let finalAmount = baseAmount
  let attempts = 0

  while (attempts < maxAttempts) {
    // Check if the current finalAmount exists
    const { count, error } = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("final_amount", finalAmount)

    if (error) {
      console.error("Error checking final amount uniqueness:", error)
      // Decide how to handle the error, maybe throw or return baseAmount
      throw new Error("Could not verify final amount uniqueness")
    }

    if (count === 0) {
      // Amount is unique, return it
      return finalAmount
    }

    // Amount exists, generate a unique addition (1-499)
    const uniqueAddition = Math.floor(Math.random() * 499) + 1
    finalAmount = baseAmount + uniqueAddition
    attempts++

    console.log(`Attempt ${attempts}: Generated new final amount ${finalAmount}`)
  }

  // If max attempts reached, throw an error or handle as needed
  throw new Error(
    `Could not find a unique final amount for base ${baseAmount} after ${maxAttempts} attempts.`
  )
}

// Helper function to calculate "Buy 6, Get 1 Free" discount for same-category groups
async function calculateB6G1Discount(
  participants: any[],
  promoDetails: any,
  symposiumPrices: { [key: string]: number }
): Promise<number> {
  let totalDiscount = 0;
  console.log("Running B6G1 discount calculation with:", {
    participantCount: participants.length,
    eligibleCategories: promoDetails.eligible_categories,
    availablePrices: Object.keys(symposiumPrices)
  });

  // Debug: Log all participants to check their properties
  console.log("All participants:", participants.map(p => ({
    category: p.category,
    symposium: p.symposium,
    attendSymposium: p.attendSymposium
  })));

  // 1. Group participants by category, only including those attending the symposium
  const participantsByCategory: { [key: string]: any[] } = {};
  
  // Process each participant
  for (const p of participants) {
    // Check if participant is attending symposium (check both properties)
    const isAttendingSymposium = p.symposium === true || p.attendSymposium === true;
    
    if (isAttendingSymposium) {
      // Initialize array for this category if it doesn't exist
      if (!participantsByCategory[p.category]) {
        participantsByCategory[p.category] = [];
      }
      
      // Add participant to the category group
      participantsByCategory[p.category].push(p);
    }
  }

  console.log("Participants grouped by category:", 
    Object.keys(participantsByCategory).map(cat => ({ 
      category: cat, 
      count: participantsByCategory[cat].length 
    })));

  // 2. Iterate over each category group
  for (const category in participantsByCategory) {
    // 3. Check if the category is eligible for the promotion
    const isEligibleCategory = promoDetails.eligible_categories && 
                             Array.isArray(promoDetails.eligible_categories) && 
                             promoDetails.eligible_categories.includes(category);
    
    console.log(`Category ${category} eligible for promo: ${isEligibleCategory}`);
    
    if (isEligibleCategory) {
      const categoryParticipants = participantsByCategory[category];
      const participantCount = categoryParticipants.length;
      console.log(`Category ${category} has ${participantCount} participants`);

      // 4. Calculate how many groups of 6 exist
      const numberOfDiscountableGroups = Math.floor(participantCount / 6);
      console.log(`Number of discountable groups (6 participants each): ${numberOfDiscountableGroups}`);

      if (numberOfDiscountableGroups > 0) {
        // 5. Get the symposium price for this specific category
        let priceForCategory = symposiumPrices[category];
        
        // Handle possible category name differences
        if (!priceForCategory && category === 'general_practitioner') {
          priceForCategory = symposiumPrices['general_doctor'];
        }
        
        console.log(`Price for category ${category}: ${priceForCategory}`);
        
        if (priceForCategory) {
          // 6. Add the discount for this category to the total
          const categoryDiscount = numberOfDiscountableGroups * priceForCategory;
          totalDiscount += categoryDiscount;
          console.log(`Applied B6G1 discount for ${numberOfDiscountableGroups} group(s) in category '${category}'. Discount amount: ${categoryDiscount}`);
        } else {
          console.warn(`B6G1 Promo: Price not found for category '${category}'. Available categories: ${Object.keys(symposiumPrices).join(', ')}`);
        }
      }
    } else {
      console.log(`Category ${category} is not eligible for this promo. Eligible categories: ${promoDetails.eligible_categories?.join(', ') || 'none'}`);
    }
  }

  console.log(`Total B6G1 discount calculated: ${totalDiscount}`);
  return totalDiscount;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const registrationData = JSON.parse(formData.get("registrationData") as string);
    const sponsorLetterFile = formData.get("sponsorLetter") as File | null;
    const turnstileToken = formData.get("cf-turnstile-response") as string | null;

    // --- Step 0: Validate Turnstile Token ---
    const isTokenValid = await validateTurnstileToken(turnstileToken);
    if (!isTokenValid) {
      return NextResponse.json(
        { error: "Invalid CAPTCHA. Please try again." },
        { status: 403 }
      );
    }

    const {
      participants: participantsData,
      contact_person: contactPerson,
      payment_type: paymentType,
      promo_code: promoCode,
    } = registrationData;

    if (!participantsData || !Array.isArray(participantsData) || participantsData.length === 0) {
      return NextResponse.json({ error: "Participant data is missing or empty." }, { status: 400 });
    }
    if (!contactPerson || !contactPerson.email || !contactPerson.name || !contactPerson.phone_number) {
      return NextResponse.json({ error: "Contact person details are incomplete." }, { status: 400 });
    }

    // --- Step 1: Verify Prices and Calculate Total Amount ---
    // Fetch ticket prices (symposium)
    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select("*")
      .eq("includes_symposium", true)
      .order("created_at", { ascending: false })
      .limit(1);
    
    if (ticketsError) throw new Error("Could not fetch symposium ticket prices from database.");
    if (!tickets || tickets.length === 0) throw new Error("No active symposium ticket found.");
    
    const ticket = tickets[0];
    console.log("Using symposium ticket:", { id: ticket.id, name: ticket.name });
    
    // Map ticket prices by category
    const symposiumPrices: { [key: string]: number } = {
      general_doctor: ticket.price_general_doctor,
      specialist_doctor: ticket.price_specialist_doctor,
      nurse: ticket.price_nurse,
      student: ticket.price_student,
      other: ticket.price_other
    };
    
    console.log("Symposium prices by category:", symposiumPrices);
    
    // Fetch workshop prices
    const { data: workshops, error: workshopsError } = await supabaseAdmin.from("workshops").select("*");
    if (workshopsError) throw new Error("Could not fetch workshop prices from database.");
    
    const workshopPrices: { [key: string]: { id: string; name: string; price: number } } = {};
    workshops.forEach(workshop => {
      workshopPrices[workshop.id] = { 
        id: workshop.id, 
        name: workshop.title, 
        price: workshop.price 
      };
    });
    
    console.log(`Loaded ${Object.keys(workshopPrices).length} workshops`);

    let verifiedTotalAmount = 0;
    
    // Debug: Log participant data before calculating total
    console.log("Calculating total for participants:", participantsData.map(p => ({
      category: p.category,
      symposium: p.symposium,
      workshops: p.workshops
    })));
    
    for (const participant of participantsData) {
      // Handle symposium price
      if (participant.symposium === true) {
        // Get price for this category
        let categoryPrice = symposiumPrices[participant.category];
        
        // Handle possible category name differences
        if (!categoryPrice && participant.category === 'general_practitioner') {
          categoryPrice = symposiumPrices['general_doctor'];
        }
        
        if (categoryPrice) {
          verifiedTotalAmount += categoryPrice;
          console.log(`Added symposium price for ${participant.category}: ${categoryPrice}`);
        } else {
          console.warn(`No symposium price found for category: ${participant.category}`);
        }
      }
      
      // Handle workshop prices
      if (participant.workshops && Array.isArray(participant.workshops)) {
        for (const workshopId of participant.workshops) {
          const workshopPrice = workshopPrices[workshopId]?.price || 0;
          verifiedTotalAmount += workshopPrice;
          console.log(`Added workshop price for ${workshopId}: ${workshopPrice}`);
        }
      }
    }
    
    console.log(`Total verified amount before discount: ${verifiedTotalAmount}`);

    // --- Step 2: Handle Promo Code ---
    let promoDiscount = 0;
    let promoId: string | null = null;

    if (promoCode) {
      console.log(`Processing promo code: ${promoCode}`);
      
      // Fetch promo code details
      const { data: promo, error: promoError } = await supabaseAdmin
        .from("promo_codes")
        .select("id, code, discount_type, discount_value, max_uses, used_count, promo_logic_type, valid_from, valid_until, eligible_categories")
        .eq("code", promoCode)
        .single();

      if (promoError || !promo) {
        console.error("Promo code error:", promoError);
        return NextResponse.json({ error: "Invalid promo code." }, { status: 400 });
      }

      console.log("Found promo code:", {
        id: promo.id,
        code: promo.code,
        type: promo.discount_type,
        value: promo.discount_value,
        logic: promo.promo_logic_type,
        maxUses: promo.max_uses,
        usedCount: promo.used_count,
        validFrom: promo.valid_from,
        validUntil: promo.valid_until,
        eligibleCategories: promo.eligible_categories
      });

      // Check usage limits
      if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
        return NextResponse.json({ 
          error: `Promo code has reached its maximum usage limit (${promo.max_uses}).` 
        }, { status: 400 });
      }

      // Check validity period
      const now = new Date();
      if (promo.valid_from && new Date(promo.valid_from) > now) {
        return NextResponse.json({ 
          error: `Promo code is not yet active. Valid from ${new Date(promo.valid_from).toLocaleDateString()}.` 
        }, { status: 400 });
      }
      if (promo.valid_until && new Date(promo.valid_until) < now) {
        return NextResponse.json({ 
          error: `Promo code has expired on ${new Date(promo.valid_until).toLocaleDateString()}.` 
        }, { status: 400 });
      }

      // Apply discount based on promo type
      if (promo.promo_logic_type === 'B6G1_SAME_CATEGORY') {
        // Normalize participant data to ensure consistent property names
        const normalizedParticipants = participantsData.map(p => {
          // Log original participant data
          console.log(`Original participant data:`, {
            id: p.id,
            category: p.category,
            symposium: p.symposium,
            attendSymposium: p.attendSymposium
          });
          
          return {
            ...p,
            // Ensure we have a consistent property for symposium attendance
            // and make sure it's a boolean value
            symposium: p.symposium === true || p.attendSymposium === true,
            attendSymposium: p.symposium === true || p.attendSymposium === true,
            // Ensure category is properly set
            category: p.category || 'general_doctor'
          };
        });
        
        // Log normalized participants
        console.log(`Normalized ${normalizedParticipants.length} participants for B6G1 calculation`);
        
        promoDiscount = await calculateB6G1Discount(normalizedParticipants, promo, symposiumPrices);
        console.log(`B6G1 promo discount calculated: ${promoDiscount}`);
      } else if (promo.discount_type === 'percentage' && promo.discount_value) {
        promoDiscount = (verifiedTotalAmount * promo.discount_value) / 100;
        console.log(`Percentage discount (${promo.discount_value}%): ${promoDiscount}`);
      } else if (promo.discount_type === 'fixed' && promo.discount_value) {
        promoDiscount = Math.min(verifiedTotalAmount, promo.discount_value);
        console.log(`Fixed discount: ${promoDiscount}`);
      }

      if (promoDiscount > 0) {
        promoId = promo.id;
        console.log(`Applied promo ${promo.code} with discount: ${promoDiscount}`);
      } else if (promo.promo_logic_type === 'B6G1_SAME_CATEGORY') {
        return NextResponse.json({ 
          error: "Promo code is valid, but the conditions for the discount are not met. This promo requires at least 6 participants from the same eligible category attending the symposium." 
        }, { status: 400 });
      }
    }

    // --- Step 3: Calculate Final Amount and Generate Unique Code ---
    let finalAmount = Math.max(0, verifiedTotalAmount - promoDiscount);
    const uniqueAddition = (paymentType === "bank_transfer" && finalAmount > 0) ? (await generateUniqueFinalAmount(finalAmount)) - finalAmount : 0;
    finalAmount += uniqueAddition;
    
    // --- Step 4: Create Registration Record ---
    const { data: registration, error: registrationError } = await supabaseAdmin
      .from("registrations")
      .insert({
        total_amount: verifiedTotalAmount,
        discount_amount: promoDiscount,
        final_amount: finalAmount,
        payment_type: paymentType,
        status: "pending",
        contact_person: contactPerson,
        promo_code_id: promoId,
      })
      .select()
      .single();

    if (registrationError) throw registrationError;
    const registrationId = registration.id;
    const registrationNumber = registration.registration_number;

    // --- Step 5: Create Participant and Ticket Records ---
    const participantOrderItems: { participant_id: string, items: any[] }[] = [];
    const createdParticipantIds: string[] = [];

    for (const participantInput of participantsData) {
        const { data: createdParticipant, error: participantError } = await supabaseAdmin
          .from("participants")
          .insert({ ...participantInput, registration_id: registrationId })
          .select("id")
          .single();

        if (participantError) {
            console.error(`Error inserting participant ${participantInput.full_name}:`, participantError);
            continue;
        }
        createdParticipantIds.push(createdParticipant.id);

        // QR Code Generation
        const qrCodeId = generateQRCodeId();
        await supabaseAdmin.from("participant_qr_codes").insert({ id: qrCodeId, participant_id: createdParticipant.id, registration_id: registrationId, status: 'active' });
        generateAndStoreQRCodeImage(qrCodeId, createdParticipant.id, registrationId, supabaseAdmin);

        // Construct Order Details
        const currentParticipantItems: any[] = [];
        if (participantInput.symposium) {
            currentParticipantItems.push({ type: 'symposium', name: 'Symposium Ticket', amount: symposiumPrices[participantInput.category] });
        }
        if (participantInput.workshops) {
            for (const wsId of participantInput.workshops) {
                const workshop = workshopPrices[wsId];
                if (workshop) currentParticipantItems.push({ type: 'workshop', id: wsId, name: workshop.name, amount: workshop.price });
            }
        }
        participantOrderItems.push({ participant_id: createdParticipant.id, items: currentParticipantItems });
    }

    // --- Step 6: Update Registration with Participant IDs and Order Details ---
    const orderDetailsJson = { participants: participantOrderItems };
    await supabaseAdmin.from('registrations').update({ participant_ids: createdParticipantIds, order_details: orderDetailsJson }).eq('id', registrationId);

    // --- Step 7: Increment Promo Code Usage ---
    if (promoId) {
      console.log(`Incrementing usage count for promo ID: ${promoId}`);
      
      // Try using the RPC function first
      const { error: rpcError } = await supabaseAdmin.rpc('increment_promo_uses', { promo_id_to_inc: promoId });
      
      if (rpcError) {
        console.warn(`RPC increment_promo_uses failed: ${rpcError.message}. Falling back to direct update.`);
        
        // Fallback: Direct update if RPC fails
        const { error: updateError } = await supabaseAdmin
          .from('promo_codes')
          .update({ used_count: supabaseAdmin.rpc('increment', { count: 1 }) })
          .eq('id', promoId);
        
        if (updateError) {
          console.error(`Failed to increment promo usage via direct update: ${updateError.message}`);
        } else {
          console.log(`Successfully incremented promo usage via direct update`);
        }
      } else {
        console.log(`Successfully incremented promo usage via RPC`);
      }
    }
    
    // --- Step 8: Handle Sponsor Letter Upload ---
    if (sponsorLetterFile && paymentType === "sponsor") {
        const fileExtension = sponsorLetterFile.name.split('.').pop() || 'pdf';
        const fileName = `${registrationNumber}-sponsorship-letter.${fileExtension}`;
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage.from('Sponsor Letters').upload(fileName, await sponsorLetterFile.arrayBuffer(), { contentType: 'application/pdf' });
        if (!uploadError) {
            const { data: publicUrlData } = supabaseAdmin.storage.from('Sponsor Letters').getPublicUrl(fileName);
            await supabaseAdmin.from('registrations').update({ sponsor_letter_path: uploadData.path, sponsor_letter_url: publicUrlData.publicUrl }).eq('id', registrationId);
        }
    }

    // --- Step 9: Create Payment Record and Schedule Check ---
    const { error: paymentError } = await supabaseAdmin.from("payments").insert({ 
        status: "pending", 
        amount: finalAmount, 
        payment_method: paymentType === "sponsor" ? "sponsor" : "bank_transfer", 
        registration_id: registrationId, 
        notes: paymentType === "sponsor" ? "Pembayaran sponsor" : `Pembayaran mandiri (Unique Code: +${uniqueAddition.toFixed(0)})`
    });
    if (paymentError) throw paymentError;
    await schedulePaymentCheck(registrationId);

    // --- Step 10: Send Invoice ---
    if (contactPerson.email) {
      sendRegistrationInvoice(registrationId, contactPerson.email).catch(console.error);
    }

    // --- Final Response ---
    return NextResponse.json({
      success: true,
      registrationId: registrationId,
      uniqueAddition: uniqueAddition,
      uniqueAmount: finalAmount,
      originalAmount: verifiedTotalAmount,
    });

  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json({ 
      error: "Internal server error: " + (error instanceof Error ? error.message : String(error)) 
    }, { 
      status: 500,
    });
  }
}
