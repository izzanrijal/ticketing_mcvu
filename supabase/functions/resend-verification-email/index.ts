import { serve, Request } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
// --- START VERBOSE LOGGING ---
console.log("Function resend-verification-email starting up...");
// --- END VERBOSE LOGGING ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// Check Env Vars Early
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_API_URL = 'https://api.resend.com/emails';
console.log(`SUPABASE_URL loaded: ${!!SUPABASE_URL}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY loaded: ${!!SUPABASE_SERVICE_ROLE_KEY}`);
console.log(`RESEND_API_KEY loaded: ${!!RESEND_API_KEY}`);
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
  console.error("CRITICAL ERROR: Missing one or more required environment variables!");
  // Throwing error here might help surface it in logs if basic response fails
  throw new Error("Server configuration error: Missing environment variables.");
}
// Helper function for error responses (with logging)
const errorResponse = (message, status)=>{
  console.error(`Responding with error: Status ${status}, Message: ${message}`);
  return new Response(JSON.stringify({
    error: message
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    },
    status: status
  });
};
// Map participant_type to display names
const categoryDisplayNames = {
  specialist_doctor: 'Dokter Spesialis',
  general_doctor: 'Dokter Umum',
  nurse: 'Perawat',
  student: 'Mahasiswa',
  other: 'Kategori Lainnya'
};

// Helper function to format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID').format(amount);
}

// Function to generate invoice PDF for email attachment - WITHOUT QR IMAGE
async function generatePaidInvoicePdf(params) {
  console.log(`Generating paid invoice PDF for registration ${params.registrationNumber}`);
  
  const { 
    registrationNumber, 
    contactPersonName, 
    contactPersonEmail, 
    contactPersonPhone,
    registrationStatus,
    paymentDeadline,
    orderDetails, 
    originalAmount, 
    discountAmount, 
    uniqueCodeValue,
    finalAmount,
    qrCodeIds, 
    creationDate,
    participantDetails 
  } = params;

  // Create a new PDF document
  const doc = await PDFDocument.create();
  
  // Add a page
  const page = doc.addPage();
  const { width, height } = page.getSize();
  
  // Get the standard font
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  
  // Define colors and dimensions
  const black = rgb(0, 0, 0);
  const gray = rgb(0.5, 0.5, 0.5);
  const green = rgb(0, 0.5, 0);
  const orange = rgb(1, 0.5, 0);
  
  const fontSize = 10;
  const headerFontSize = 14;
  const titleFontSize = 18;
  const lineHeight = 15;
  const margin = 50;
  
  // Helper functions for drawing text
  const drawText = (text, x, y, options: {
    fontSize?: number;
    font?: any;
    color?: any;
    align?: string;
    maxWidth?: number | null;
  } = {}) => {
    const { 
      fontSize: size = fontSize, 
      font: textFont = font, 
      color = black,
      align = 'left',
      maxWidth = null
    } = options;
    
    // Handle text that's too long
    let displayText = text || '';
    if (maxWidth !== null) {
      // Calculate text width
      const textWidth = textFont.widthOfTextAtSize(displayText, size);
      if (textWidth > maxWidth) {
        // Truncate text if it's too wide
        let truncated = displayText;
        while (textFont.widthOfTextAtSize(truncated + '...', size) > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        displayText = truncated + '...';
      }
    }
    
    let xPosition = x;
    if (align === 'center') {
      const textWidth = textFont.widthOfTextAtSize(displayText, size);
      xPosition = x - textWidth / 2;
    } else if (align === 'right') {
      const textWidth = textFont.widthOfTextAtSize(displayText, size);
      xPosition = x - textWidth;
    }
    
    page.drawText(displayText, {
      x: xPosition,
      y: y,
      size: size,
      font: textFont,
      color: color
    });
    
    return y - lineHeight;
  };
  
  // Draw a line
  const drawLine = (x1, y1, x2, y2, thickness = 1, color = gray) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness,
      color
    });
  };
  
  // Start drawing the invoice
  let y = height - margin;
  
  // Header - Title and Invoice Details
  const rightColumnX = width - margin;
  
  // Try to load the logo from URL
  try {
    // Logo dimensions
    const logoWidth = 120;
    const logoHeight = 44;
    
    // Logo URL
    const logoUrl = "https://evlrrhhjfaiitpglqmqy.supabase.co/storage/v1/object/public/assets//logo_invoice.png";
    
    // Fetch logo image
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      const logoData = await logoResponse.arrayBuffer();
      const logoImage = await doc.embedPng(logoData);
      
      // Draw logo
      page.drawImage(logoImage, {
        x: margin,
        y: height - margin - logoHeight,
        width: logoWidth,
        height: logoHeight
      });
    } else {
      console.error("Failed to load logo image, using text fallback");
      drawText('MAKASSAR CARDIOVASCULAR UPDATE - XXIII 2025', margin, y, { fontSize: 14, font: boldFont });
    }
  } catch (logoError) {
    console.error("Error loading logo image:", logoError);
    // Fallback to text header
    drawText('MAKASSAR CARDIOVASCULAR UPDATE - XXIII 2025', margin, y, { fontSize: 14, font: boldFont });
  }
  
  // Invoice title (right side)
  drawText('INVOICE', rightColumnX, height - margin, { fontSize: titleFontSize, font: boldFont, align: 'right' });
  y = height - margin - 20;
  
  // Invoice details (right side)
  drawText(`No: ${registrationNumber}`, rightColumnX, y, { align: 'right' });
  y -= lineHeight;
  
  const formattedCreationDate = creationDate ? new Date(creationDate).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID');
  drawText(`Tanggal Dibuat: ${formattedCreationDate}`, rightColumnX, y, { align: 'right' });
  y -= lineHeight;
  
  // Status - LUNAS with green color for paid, orange for unpaid
  if (registrationStatus === 'paid') {
    drawText(`Status: LUNAS`, rightColumnX, y, { align: 'right', color: green, font: boldFont });
  } else {
    drawText(`Status: Belum Lunas`, rightColumnX, y, { align: 'right', color: orange, font: boldFont });
    y -= lineHeight;
    
    if (paymentDeadline) {
      const formattedDeadline = new Date(paymentDeadline).toLocaleDateString('id-ID');
      drawText(`Batas Pembayaran: ${formattedDeadline}`, rightColumnX, y, { align: 'right' });
    }
  }
  
  // Reset y position for the next section
  y = height - margin - 80;
  
  // Billing info section
  drawText('Ditagihkan Kepada:', margin, y, { font: boldFont });
  y -= lineHeight;
  drawText(contactPersonName || 'N/A', margin + 10, y);
  y -= lineHeight;
  drawText(contactPersonEmail || 'N/A', margin + 10, y);
  y -= lineHeight;
  if (contactPersonPhone) {
    drawText(contactPersonPhone, margin + 10, y);
    y -= lineHeight;
  }
  
  y -= 10;
  
  // Order details section
  drawText('Rincian Pemesanan:', margin, y, { font: boldFont });
  y -= 20;
  
  // Table headers
  const col1 = margin;           // Item/Participant
  const col2 = margin + 250;     // Kategori
  const col3 = width - margin;   // Harga
  
  drawText('Item', col1, y, { font: boldFont });
  drawText('Kategori Peserta', col2, y, { font: boldFont });
  drawText('Harga (IDR)', col3, y, { font: boldFont, align: 'right' });
  
  y -= 5;
  drawLine(col1, y, col3, y);
  y -= 15;
  
  // Calculate total amount from order details
  let calculatedTotal = 0;
  
  // Table rows - Display items from orderDetails if available
  if (orderDetails && orderDetails.participants && orderDetails.participants.length > 0) {
    console.log("Using complete order details for invoice items");
    
    for (const participant of orderDetails.participants) {
      // Get participant details from the participantDetails map
      const participantInfo = participantDetails && participant.participant_id && participantDetails[participant.participant_id] ? 
        participantDetails[participant.participant_id] : 
        { full_name: 'Unnamed Participant', participant_type: 'unknown' };
      
      // Get QR code ID for this participant
      const qrCodeId = qrCodeIds[participant.participant_id] || 'N/A';
      
      // Display participant name as a header for their items
      const nameWithQR = `${participantInfo.full_name || 'Unnamed Participant'} - Kode Peserta: ${qrCodeId}`;
      drawText(nameWithQR, col1, y, { 
        font: boldFont,
        maxWidth: col2 - col1 - 10 
      });
      y -= lineHeight;
      
      // Display each item for this participant
      let participantSubtotal = 0;
      
      for (const item of participant.items || []) {
        // Get the participant type display name
        const participantType = participantInfo.participant_type || 'unknown';
        const participantTypeDisplay = categoryDisplayNames[participantType] || participantType;
        
        // Calculate available width for the item name
        const itemNameWidth = col2 - col1 - 20;
        
        // Draw item name with potential truncation
        drawText(item.name || 'Unnamed Item', col1 + 10, y, { 
          maxWidth: itemNameWidth 
        });
        
        drawText(participantTypeDisplay, col2, y);
        
        // Use the amount from the item if available
        const itemPrice = item.amount || item.price || 0;
        participantSubtotal += itemPrice;
        calculatedTotal += itemPrice;
        
        drawText(`Rp ${formatCurrency(itemPrice)}`, col3, y, { align: 'right' });
        y -= lineHeight;
      }
      
      y -= 5; // Add a small gap between participants
    }
  } else {
    // Fallback if order details aren't available in the right format
    console.log("Order details not available in expected format, using fallback display");
    
    if (params.participants && params.participants.length > 0) {
      for (const participant of params.participants) {
        // Display participant name
        const qrCodeId = qrCodeIds[participant.id] || 'N/A';
        const nameWithQR = `${participant.full_name || 'Unnamed Participant'} - Kode Peserta: ${qrCodeId}`;
        
        drawText(nameWithQR, col1, y, { 
          font: boldFont,
          maxWidth: col2 - col1 - 10
        });
        y -= lineHeight;
        
        const participantType = participant.participant_type || 'unknown';
        const participantTypeDisplay = categoryDisplayNames[participantType] || participantType;
        
        for (const item of participant.items) {
          drawText(item.name || 'Unnamed Item', col1 + 10, y, {
            maxWidth: col2 - col1 - 20
          });
          drawText(participantTypeDisplay, col2, y);
          
          const itemPrice = item.amount || item.price || 0;
          calculatedTotal += itemPrice;
          
          drawText(`Rp ${formatCurrency(itemPrice)}`, col3, y, { align: 'right' });
          y -= lineHeight;
        }
        
        y -= 5; // Add a small gap between participants
      }
    }
  }
  
  y -= lineHeight * 0.5; // Space after table

  // --- Payment Summary Section ---
  // Find the existing 'Total Dibayar' or similar section and replace it

  y -= lineHeight * 1.5; // Add some space before the summary
  drawLine(margin, y + 5, width - margin, y + 5); // Line above summary
  y -= lineHeight;

  // Draw Subtotal
  drawText('Subtotal', margin, y);
  drawText(`Rp ${formatCurrency(originalAmount)}`, rightColumnX, y, { align: 'right' });
  y -= lineHeight;

  // Draw Discount if applicable
  if (discountAmount > 0) {
    drawText('Diskon', margin, y);
    drawText(`- Rp ${formatCurrency(discountAmount)}`, rightColumnX, y, { align: 'right', color: green }); // Using green for discount
    y -= lineHeight;
  }

  // Draw Unique Code if applicable (non-zero)
  if (uniqueCodeValue !== 0) {
    drawText('Kode Unik Pembayaran', margin, y);
    const uniqueCodeText = uniqueCodeValue > 0
      ? `+ Rp ${formatCurrency(uniqueCodeValue)}`
      : `- Rp ${formatCurrency(Math.abs(uniqueCodeValue))}`; // Show subtraction if negative
    drawText(uniqueCodeText, rightColumnX, y, { align: 'right' });
    y -= lineHeight;
  }

  drawLine(margin, y + 5, width - margin, y + 5, 0.5); // Thin line before total
  y -= lineHeight;

  // Draw Grand Total (using bold font)
  drawText('Total Dibayar', margin, y, { font: boldFont });
  drawText(`Rp ${formatCurrency(finalAmount)}`, rightColumnX, y, { font: boldFont, align: 'right' });
  y -= lineHeight * 1.5; // Add space after total

  // Draw Payment Status (Keep this as it was)
  drawText('Status Pembayaran:', margin, y);
  drawText('LUNAS', rightColumnX, y, { font: boldFont, color: green, align: 'right' });
  y -= lineHeight;

  // Payment Date (Optional, maybe use creationDate or a dedicated paid_at field if available)
  // drawText('Tanggal Pembayaran:', margin, y);
  
  // Payment section
  const paymentSectionY = y;
  const paymentSectionHeight = 120;
  const paymentSectionWidth = width - 2 * margin;
  
  // Draw a light gray background
  page.drawRectangle({
    x: margin,
    y: paymentSectionY - paymentSectionHeight,
    width: paymentSectionWidth,
    height: paymentSectionHeight,
    color: rgb(0.97, 0.97, 0.97),
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
  });
  
  // Payment details content
  if (registrationStatus === 'paid') {
    drawText('Detail Pembayaran (LUNAS):', margin + 15, paymentSectionY - 15, { font: boldFont });
    y = paymentSectionY - 35;
    
    drawText(`Pembayaran telah diverifikasi dan lunas.`, margin + 15, y);
    y -= lineHeight;
  } else {
    drawText('Instruksi Pembayaran:', margin + 15, paymentSectionY - 15, { font: boldFont });
    y = paymentSectionY - 35;
    
    drawText(`Mohon transfer SEJUMLAH PERSIS: Rp ${formatCurrency(finalAmount || 0)}`, margin + 15, y);
    y -= lineHeight;
    
    if (paymentDeadline) {
      const formattedDeadline = new Date(paymentDeadline).toLocaleDateString('id-ID');
      drawText(`Batas Waktu Pembayaran: ${formattedDeadline}`, margin + 15, y);
      y -= lineHeight;
    }
  }
  
  drawText(`Ke Rekening Bank Bank BTN:`, margin + 15, y);
  y -= lineHeight;
  
  drawText(`No. Rek: 00077-01-30-000120-6`, margin + 25, y, { font: boldFont });
  y -= lineHeight;
  
  drawText(`A/N: PERKI CABANG MAKASSAR`, margin + 25, y, { font: boldFont });
  
  // Reset y position after the payment section
  y = paymentSectionY - paymentSectionHeight - 20;
  
  // Notes section
  drawText('Catatan:', margin, y, { font: boldFont });
  y -= lineHeight;
  
  if (registrationStatus === 'paid') {
    drawText('- Invoice ini merupakan bukti pembayaran sah untuk registrasi MCVU XXIII 2025.', margin + 10, y);
    y -= lineHeight;
    
    drawText('- Simpan invoice ini sebagai bukti telah melakukan pembayaran.', margin + 10, y);
    y -= lineHeight;
    
    drawText('- Tunjukkan kode peserta saat check-in di venue.', margin + 10, y);
  } else {
    drawText('- Pastikan jumlah transfer sesuai hingga digit terakhir untuk verifikasi otomatis.', margin + 10, y);
    y -= lineHeight;
    
    drawText('- Pembayaran diverifikasi dalam 7x24 jam hari kerja.', margin + 10, y);
    y -= lineHeight;
    
    drawText('- Anda akan menerima email konfirmasi & tiket elektronik setelah pembayaran berhasil diverifikasi.', margin + 10, y);
    y -= lineHeight;
    
    drawText('- Hubungi panitia jika ada pertanyaan.', margin + 10, y);
  }
  
  y -= 30;
  
  // Footer
  drawText('Panitia MCVU XXIII 2025 - Invoice ini sah tanpa tanda tangan.', width / 2, y, { align: 'center', fontSize: 9 });
  
  // Return the PDF as bytes
  return doc.save();
}

serve(async (req: Request)=>{
  console.log(`--- New Request Received: ${req.method} ${req.url} ---`);
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request.");
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let participantId = null;
  let registrationId = null;
  try {
    console.log("Attempting to parse request body...");
    const bodyText = await req.text();
    console.log("Raw body received:", bodyText); // Log raw body
    let payload;
    try {
      payload = JSON.parse(bodyText);
      console.log("Parsed payload:", payload);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("JSON Parsing Error:", errorMessage);
      return errorResponse(`Invalid JSON: ${errorMessage}`, 400);
    }
    participantId = payload?.participantId;
    registrationId = payload?.registrationId;
    console.log(`Extracted participantId: ${participantId}, registrationId: ${registrationId}`);
    if (!registrationId) {
      console.error("Validation Error: Missing registrationId in payload.");
      return errorResponse('Missing registrationId', 400);
    }
    console.log("Attempting to create Supabase admin client...");
    let supabaseAdmin;
    try {
      supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      console.log("Supabase admin client created successfully.");
    } catch (clientError) {
      console.error("Error creating Supabase admin client:", clientError.message);
      return errorResponse("Failed to initialize database connection.", 500);
    }
    // 1. First, fetch the registration details to get registration number
    console.log(`Fetching registration data for ID: ${registrationId}...`);
    const { data: registrationData, error: registrationError } = await supabaseAdmin
      .from('registrations')
      .select('registration_number, id, final_amount, status, participant_ids, total_amount, discount_amount, unique_code, order_details, created_at')
      .eq('id', registrationId)
      .single();
      
    if (registrationError) console.error("Registration fetch error:", registrationError);
    if (registrationData) console.log("Registration data fetched:", registrationData);
    
    if (registrationError || !registrationData) {
      return errorResponse(`Failed to fetch registration: ${registrationError?.message || 'Not found'}`, 500);
    }
    
    const registrationNumber = registrationData.registration_number;
    const registrationStatus = registrationData.status || 'unknown';
    const paymentAmount = registrationData.final_amount || 0;
    const allParticipantIds = registrationData.participant_ids || [];
    const originalAmount = registrationData.total_amount || 0;
    const discountAmount = registrationData.discount_amount || 0;
    const finalAmount = registrationData.final_amount || 0;
    const uniqueCode = registrationData.unique_code || 0;
    const creationDate = registrationData.created_at;
    const completeOrderDetails = registrationData.order_details;
    
    // Calculate the unique code value added/subtracted for display
    const uniqueAddition = finalAmount - (originalAmount - discountAmount);
    
    // Determine if there was a discount (based on amount > 0)
    const isDiscountApplied = discountAmount > 0;
    
    console.log(`Found ${allParticipantIds.length} participants in registration ${registrationNumber}`);
    
    if (registrationStatus !== 'paid') {
      console.warn(`Registration ${registrationNumber} has status '${registrationStatus}', not 'paid'`);
      // We'll still send emails but include this warning
    }

    // Get all participant details in one query to avoid multiple database calls
    let participantDetailsMap: Record<string, any> = {};
    try {
      if (allParticipantIds.length > 0) {
        const { data: participantsData, error: participantsError } = await supabaseAdmin
          .from('participants')
          .select('id, full_name, email, phone, participant_type')
          .in('id', allParticipantIds);
        
        if (!participantsError && participantsData) {
          // Create a map of participant details by ID for easy lookup
          participantDetailsMap = participantsData.reduce((map: Record<string, any>, participant: any) => {
            map[participant.id] = participant;
            return map;
          }, {});
          console.log("Fetched details for all participants");
        }
      }
    } catch (participantsError) {
      console.error("Error fetching participant details:", participantsError);
    }
    
    // Get all QR codes for this registration in one query
    let qrCodeMap: Record<string, string> = {};
    try {
      const { data: qrCodesData, error: qrCodesError } = await supabaseAdmin
        .from('participant_qr_codes')
        .select('participant_id, qr_code_id, qr_code_url')
        .eq('registration_id', registrationId);
      
      if (!qrCodesError && qrCodesData) {
        // Create a map of QR codes by participant ID for easy lookup
        qrCodeMap = qrCodesData.reduce((map: Record<string, string>, qrCode: any) => {
          map[qrCode.participant_id] = qrCode.qr_code_id;
          return map;
        }, {});
        console.log("Fetched all QR codes for registration");
      }
    } catch (qrCodesError) {
      console.error("Error fetching QR codes:", qrCodesError);
    }
    
    // Get contact person data from the first participant
    let contactPerson = null;
    try {
      if (allParticipantIds.length > 0) {
        // Use the already fetched participant data if available
        const firstParticipantId = allParticipantIds[0];
        const firstParticipant = participantDetailsMap[firstParticipantId];
        
        if (firstParticipant) {
          contactPerson = {
            name: firstParticipant.full_name,
            email: firstParticipant.email,
            phone: firstParticipant.phone
          };
          console.log("Contact person data from participant map:", contactPerson);
        } else {
          // Fallback to fetching just this one participant if not in the map
          const { data: contactData, error: contactError } = await supabaseAdmin
            .from('participants')
            .select('full_name, email, phone')
            .eq('id', firstParticipantId)
            .single();
          
          if (!contactError && contactData) {
            contactPerson = {
              name: contactData.full_name,
              email: contactData.email, 
              phone: contactData.phone
            };
            console.log("Contact person data fetched:", contactPerson);
          }
        }
      }
    } catch (contactError) {
      console.error("Error fetching contact person:", contactError);
    }
    
    // Get payment deadline if available
    let paymentDeadline = null;
    try {
      const { data: paymentData, error: paymentError } = await supabaseAdmin
        .from('payments')
        .select('deadline')
        .eq('registration_id', registrationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!paymentError && paymentData && paymentData.deadline) {
        paymentDeadline = paymentData.deadline;
      }
    } catch (deadlineError) {
      console.error("Error fetching payment deadline:", deadlineError);
    }
    
    // Construct the parameters for the PDF generation ONCE outside the loop
    const pdfParams = {
      registrationNumber,
      contactPersonName: contactPerson?.name,
      contactPersonEmail: contactPerson?.email,
      contactPersonPhone: contactPerson?.phone,
      registrationStatus,
      paymentDeadline: paymentDeadline ? new Date(paymentDeadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A',
      orderDetails: completeOrderDetails, 
      originalAmount: originalAmount, 
      discountAmount: discountAmount, 
      uniqueCodeValue: uniqueAddition, 
      finalAmount: finalAmount, 
      qrCodeIds: qrCodeMap, 
      creationDate: creationDate ? new Date(creationDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A',
      participantDetails: participantDetailsMap 
    };

    console.log("Generating PDF with params:", pdfParams);
    const pdfBuffer = await generatePaidInvoicePdf(pdfParams);
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
    console.log(`PDF generated for registration ${registrationNumber}. Size: ${pdfBuffer.byteLength} bytes.`);

    // If a specific participant ID was provided, only send to that one
    // Otherwise send to all participants in the registration
    const participantIdsToProcess = allParticipantIds;
    if (participantIdsToProcess.length === 0) {
      return errorResponse(`No participants found for registration ${registrationNumber}`, 404);
    }
    // Track successful and failed email sends
    const emailResults = {
      success: [],
      failed: []
    };
    // Process each participant
    for (const currentParticipantId of participantIdsToProcess){
      try {
        console.log(`Processing participant ${currentParticipantId} for registration ${registrationNumber}...`);
        // Fetch participant data
        const { data: participantData, error: participantError } = await supabaseAdmin.from('participants').select('full_name, email, participant_type').eq('id', currentParticipantId).single();
        if (participantError || !participantData) {
          console.error(`Failed to fetch participant ${currentParticipantId}:`, participantError?.message || 'Not found');
          emailResults.failed.push({
            participant_id: currentParticipantId,
            error: participantError?.message || 'Participant not found'
          });
          continue; // Skip to next participant
        }
        const recipientEmail = participantData.email;
        const recipientName = participantData.full_name;
        const participantCategory = participantData.participant_type;
        if (!participantCategory) {
          console.error(`Participant ${currentParticipantId} is missing participant_type.`);
          emailResults.failed.push({
            participant_id: currentParticipantId,
            error: 'Missing participant type'
          });
          continue; // Skip to next participant
        }
        const symposiumTicketName = categoryDisplayNames[participantCategory] || participantCategory;
        // Fetch this participant's workshops from order_details
        let workshopItemsHtml = '';
        try {
          // Get the order_details from the registration
          const { data: orderDetailsData, error: orderDetailsError } = await supabaseAdmin.from('registrations').select('order_details').eq('id', registrationId).single();
          if (orderDetailsError) {
            console.error("Error fetching order details:", orderDetailsError.message);
            workshopItemsHtml = '<li>Gagal memuat detail pesanan.</li>';
          } else if (orderDetailsData?.order_details) {
            console.log(`Order details found for registration ${registrationId}.`);
            // Find this specific participant's items in the order_details
            const participantItems = orderDetailsData.order_details.participants?.find((p)=>p.participant_id === currentParticipantId)?.items || [];
            console.log(`Found ${participantItems.length} items for participant ${currentParticipantId}.`);
            // Filter for workshop items only
            const workshopItems = participantItems.filter((item)=>item.type === 'workshop');
            if (workshopItems.length > 0) {
              workshopItemsHtml = workshopItems.map((ws)=>`<li>${ws.name || 'Nama Workshop Tidak Diketahui'}</li>`).join('');
            } else {
              console.log(`No workshops found for participant ${currentParticipantId}.`);
              workshopItemsHtml = '<li>Tidak ada workshop tambahan yang terdaftar.</li>';
            }
          } else {
            console.log(`No order details found for registration ${registrationNumber}.`);
            // Fallback to the old method if order_details is not available
            console.log("Falling back to workshop_registration_summary table...");
            const { data: workshopData, error: workshopError } = await supabaseAdmin.from('workshop_registration_summary').select('workshop_name').eq('registration_number', registrationNumber).eq('participant_id', currentParticipantId);
            if (workshopError) {
              console.error("Error in fallback workshop fetch:", workshopError.message);
              workshopItemsHtml = '<li>Gagal memuat detail workshop.</li>';
            } else if (workshopData && workshopData.length > 0) {
              console.log(`Found ${workshopData.length} workshop(s) for participant ${currentParticipantId} in fallback.`);
              workshopItemsHtml = workshopData.map((ws)=>`<li>${ws.workshop_name || 'Nama Workshop Tidak Diketahui'}</li>`).join('');
            } else {
              console.log(`No workshops found for participant ${currentParticipantId} in fallback.`);
              workshopItemsHtml = '<li>Tidak ada workshop tambahan yang terdaftar.</li>';
            }
          }
        } catch (wsFetchErr) {
          console.error("Exception fetching workshop details:", wsFetchErr.message);
          workshopItemsHtml = '<li>Terjadi kesalahan saat memuat detail workshop.</li>';
        }
        // Fetch QR Code for this participant
        console.log(`Fetching QR code for participant ${currentParticipantId}, registration ${registrationId}...`);
        let qrCodeId = "N/A";
        let qrCodeUrl = "";
        try {
          const { data: qrCodeData, error: qrCodeError } = await supabaseAdmin.from('participant_qr_codes').select('qr_code_id, qr_code_url').eq('participant_id', currentParticipantId).eq('registration_id', registrationId).maybeSingle();
          if (qrCodeError) {
            console.error(`Error fetching QR code: ${qrCodeError.message}`);
          // Non-fatal, proceed without QR
          } else if (qrCodeData && qrCodeData.qr_code_id) {
            qrCodeId = qrCodeData.qr_code_id;
            console.log(`QR code ID found: ${qrCodeId}`);
            if (qrCodeData.qr_code_url && qrCodeData.qr_code_url.trim() !== '') {
              qrCodeUrl = qrCodeData.qr_code_url;
              console.log("Using existing QR code URL from DB:", qrCodeUrl);
            } else {
              console.log("QR code URL missing/invalid in DB. Generating new URL...");
              try {
                const generatedQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeId)}`;
                qrCodeUrl = generatedQrUrl;
                console.log("Generated QR code URL:", generatedQrUrl);
                // Attempt update in background
                supabaseAdmin.from('participant_qr_codes').update({
                  qr_code_url: generatedQrUrl
                }).eq('participant_id', currentParticipantId).eq('registration_id', registrationId).then(({ error: updateError })=>{
                  if (updateError) console.error(`Background QR URL update failed: ${updateError.message}`);
                  else console.log("Background QR URL update successful.");
                });
              } catch (qrGenError) {
                console.error("Error generating/updating QR code URL:", qrGenError.message);
              }
            }
          } else {
            console.warn(`QR Code data not found for participant ${currentParticipantId}, registration ${registrationId}.`);
          }
        } catch (qrCodeFetchErr) {
          console.error("Exception fetching/processing QR Code:", qrCodeFetchErr.message);
        }
        // Get payment notes
        console.log(`Fetching payment details for registration ${registrationId}...`);
        let paymentNotes = 'Pembayaran berhasil diverifikasi';
        try {
          // We'll still try to get payment notes from the payments table if available
          const { data: paymentData, error: paymentFetchError } = await supabaseAdmin.from('payments').select('notes').eq('registration_id', registrationId).eq('status', 'paid').order('created_at', {
            ascending: false
          }).limit(1).maybeSingle();
          if (paymentFetchError && paymentFetchError.code !== 'PGRST116') {
            console.error("Error fetching payment notes:", paymentFetchError.message);
          } else if (paymentData && paymentData.notes) {
            paymentNotes = paymentData.notes;
            console.log(`Payment notes found: ${paymentNotes}`);
          } else {
            console.log("No additional payment notes found, using default.");
          }
        } catch (paymentFetchErr) {
          console.error("Exception fetching payment details:", paymentFetchErr.message);
        }
        // Construct Email Body - PAID INVOICE VERSION (no payment instructions)
        console.log("Constructing paid invoice email body...");
        const subject = `[LUNAS] Tiket MCVU XXIII 2025 - ${registrationNumber}`;
        let qrCodeSection = '';
        if (qrCodeUrl && qrCodeUrl.trim() !== '') {
          qrCodeSection = `
              <h3>Informasi Check-in di Venue:</h3>
              <p>Tiket Anda telah LUNAS dan siap digunakan. Untuk melakukan registrasi ulang di venue acara, harap tunjukkan QR Code berikut kepada petugas:</p>
              <div style="text-align: center; margin: 20px 0;">
                <img src="${qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px; border: 1px solid #ddd;" /><br>
                <strong style="font-size: 1.2em;">${qrCodeId || 'No QR Code'}</strong>
              </div>
              <p>Simpan email ini atau screenshot QR Code Anda.</p>
            `;
        } else {
          qrCodeSection = `
            <h3>Informasi Check-in di Venue:</h3>
            <p>Tiket Anda telah LUNAS dan siap digunakan. QR Code Anda tidak dapat dimuat saat ini. Jangan khawatir, Anda tetap dapat melakukan check-in di venue dengan menunjukkan email ini dan KTP/Identitas Anda.</p>
            <p>Nomor Registrasi: ${registrationNumber}</p>
            <p>Nama: ${recipientName || 'N/A'}</p>
            <p>Kode Peserta: ${qrCodeId || 'N/A'}</p>
          `;
        }

        // Display the unique code information
        const uniqueCodeInfo = uniqueAddition ? `
          <tr>
            <td>Kode Unik:</td>
            <td style="padding-left: 15px;">Rp ${(uniqueAddition || 0).toLocaleString('id-ID')}</td>
          </tr>` : '';
        
        const emailBody = `
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Tiket MCVU XXIII 2025 - ${registrationNumber}</title>
          </head>
          <body style="font-family: sans-serif;">
            <h2>Tiket Registrasi MCVU XXIII 2025 (LUNAS)</h2>
            <p>Halo ${recipientName || 'Peserta'},</p>
            <p>Terima kasih atas partisipasi Anda di MCVU XXIII 2025. Berikut adalah tiket Anda dengan nomor registrasi <strong>${registrationNumber}</strong>.</p>
            <p style="background-color: #e6f7e6; color: #2e7d32; padding: 10px; border: 1px solid #c8e6c9; border-radius: 4px;">
              <strong>Status Pembayaran: LUNAS</strong><br>
              Pembayaran Anda telah diverifikasi dan tiket Anda telah aktif.
            </p>
            <h3>Item Registrasi Anda:</h3>
            <ul>
              <li>Tiket Simposium: <strong>${symposiumTicketName || 'Tiket Simposium'}</strong></li>
              ${workshopItemsHtml || '<li>Tidak ada workshop tambahan yang terdaftar.</li>'}
            </ul>
            <hr>
            ${qrCodeSection}
            <hr>
            <h3>Detail Pembayaran (Invoice Lunas):</h3>
            <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
              <tr>
                <td>Nomor Registrasi:</td>
                <td style="padding-left: 15px;">${registrationNumber}</td>
              </tr>
              <tr>
                <td>Total Pembayaran:</td>
                <td style="padding-left: 15px;">${new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR'
                }).format(paymentAmount || 0)}</td>
              </tr>
              ${uniqueCodeInfo}
              <tr>
                <td>Catatan Pembayaran:</td>
                <td style="padding-left: 15px;">${paymentNotes || 'Pembayaran berhasil diverifikasi'}</td>
              </tr>
            </table>
            <p>Terima kasih atas partisipasi Anda. Sampai jumpa di MCVU XXIII 2025!</p><br>
            <p>Salam,</p><p>Panitia MCVU XXIII 2025</p>
          </body>
          </html>
        `;
        
        // Generate PDF attachment
        const pdfParams = {
          registrationNumber,
          contactPersonName: contactPerson?.name || recipientName,
          contactPersonEmail: contactPerson?.email || recipientEmail,
          contactPersonPhone: contactPerson?.phone || '',
          registrationStatus,
          paymentDeadline,
          orderDetails: completeOrderDetails,
          originalAmount,
          discountAmount: 0,
          uniqueCodeValue: uniqueAddition,
          finalAmount: paymentAmount,
          qrCodeIds: qrCodeMap,
          isDiscount: isDiscountApplied,
          creationDate,
          participantDetails: participantDetailsMap,
          participants: [
            {
              full_name: recipientName,
              participant_type: participantCategory,
              items: [
                {
                  name: `Tiket Simposium: ${symposiumTicketName}`,
                  price: paymentAmount
                }
              ]
            }
          ]
        };
        
        console.log("Generating PDF attachment...");
        try {
          const pdfBuffer = await generatePaidInvoicePdf(pdfParams);
            
            // Ensure pdfBuffer is valid before proceeding
            if (!pdfBuffer) {
              throw new Error("Generated PDF buffer is empty or invalid");
            }
            
            // Convert PDF buffer to base64 using Deno's encoding API
            const pdfBytes = new Uint8Array(pdfBuffer);
            // Ensure we have bytes to encode
            if (pdfBytes.length === 0) {
              throw new Error("PDF bytes array is empty");
            }
            
            // Convert to base64 string using a safe approach
            const pdfBase64 = btoa(Array.from(pdfBytes).map(byte => String.fromCharCode(byte)).join(''));
            
            // Sanity check: ensure base64 string is not empty
            if (!pdfBase64 || pdfBase64.trim() === '') {
              throw new Error("PDF Base64 encoding resulted in empty string");
            }
            
            // Send Email via Resend with PDF attachment
            console.log(`Attempting to send paid invoice email via Resend to: ${recipientEmail} with PDF attachment`);
            
            // Prepare email data with null checks for all fields
            const resendPayload = {
              from: `Panitia MCVU XXIII 2025 <panitia.mcvu@perkimakassar.com>`,
              to: [
                recipientEmail
              ],
              subject: subject || `[LUNAS] Tiket MCVU XXIII 2025 - ${registrationNumber}`,
              html: emailBody,
              attachments: [
                {
                  filename: `invoice-${registrationNumber}.pdf`,
                  content: pdfBase64,
                  encoding: 'base64',
                  contentType: 'application/pdf'
                }
              ]
            };
            
            // Validate the payload before sending
            if (!resendPayload.html) {
              throw new Error("Email HTML body is empty or undefined");
            }
            
            const resendResponse = await fetch(RESEND_API_URL, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(resendPayload)
            });
            console.log(`Resend API response status: ${resendResponse.status}`);
            if (!resendResponse.ok) {
              const errorBody = await resendResponse.text();
              console.error(`Resend API error response: ${errorBody}`);
              throw new Error(`Failed to send email via Resend: ${resendResponse.status} ${resendResponse.statusText} - ${errorBody}`);
            }
            const responseData = await resendResponse.json();
            console.log('Email sent successfully via Resend:', responseData);
            emailResults.success.push({
              participant_id: currentParticipantId,
              email: recipientEmail,
              resend_id: responseData?.id
            });
          } catch (resendError) {
            const errorMessage = resendError instanceof Error ? resendError.message : String(resendError);
            console.error("Resend API error during fetch:", errorMessage);
            emailResults.failed.push({
              participant_id: currentParticipantId,
              email: recipientEmail,
              error: errorMessage
            });
          }
        } catch (participantError) {
          const errorMessage = participantError instanceof Error ? participantError.message : String(participantError);
          console.error(`Error processing participant ${currentParticipantId}:`, errorMessage);
          emailResults.failed.push({
            participant_id: currentParticipantId,
            error: errorMessage
          });
        }
      }
      // Return results
      console.log("Function execution completed. Sending response.");
      return new Response(JSON.stringify({
        message: 'Verification emails processed',
        registration_number: registrationNumber,
        results: emailResults
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } catch (error) {
      // Catch any unexpected errors not caught elsewhere
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`--- UNCAUGHT FUNCTION ERROR ---`);
      console.error(`Error: ${errorMessage}`);
      // Attempt to log stack trace if available
      if (error instanceof Error && error.stack) {
        console.error(`Stack Trace:\n${error.stack}`);
      }
      console.error(`--- END UNCAUGHT FUNCTION ERROR ---`);
      return errorResponse(`Unexpected server error: ${errorMessage}`, 500);
    }
  }
);

console.log("Function resend-verification-email finished setting up serve listener.");
