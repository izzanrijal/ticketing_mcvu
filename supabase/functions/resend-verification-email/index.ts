import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
const categoryDisplayNames = {
  'specialist_doctor': 'Dokter Spesialis',
  'general_doctor': 'Dokter Umum',
  'nurse': 'Perawat',
  'student': 'Mahasiswa',
  'other': 'Dokter Residen'
};
serve(async (req)=>{
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
    if (!participantId || !registrationId) {
      console.error("Validation Error: Missing participantId or registrationId in payload.");
      return errorResponse('Missing participantId or registrationId', 400);
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
    // 1. Fetch Participant Data (including participant_type)
    console.log(`Fetching participant data for ID: ${participantId}...`);
    const { data: participantData, error: participantError } = await supabaseAdmin
      .from('participants')
      .select('full_name, email, participant_type') // Added participant_type
      .eq('id', participantId)
      .single();

    if (participantError) console.error("Participant fetch error:", participantError);
    if (participantData) console.log("Participant data fetched:", participantData);

    if (participantError || !participantData) {
      return errorResponse(`Failed to fetch participant: ${participantError?.message || 'Not found'}`, 500);
    }
    const recipientEmail = participantData.email;
    const recipientName = participantData.full_name;
    const participantCategory = participantData.participant_type; // Use participant_type directly

    if (!participantCategory) {
      console.error(`Participant ${participantId} is missing participant_type.`);
      return errorResponse(`Participant data incomplete: Missing participant type.`, 500);
    }
    const symposiumTicketName = categoryDisplayNames[participantCategory] || participantCategory;
    console.log(`Determined symposium ticket name: ${symposiumTicketName} from participant_type: ${participantCategory}`);

    // 2. Fetch Registration Data (only need registration_number)
    console.log(`Fetching registration data for ID: ${registrationId}...`);
    const { data: registrationData, error: registrationError } = await supabaseAdmin
      .from('registrations')
      .select('registration_number, id') // Only need registration_number now
      .eq('id', registrationId)
      .single();

    if (registrationError) console.error("Registration fetch error:", registrationError);
    if (registrationData) console.log("Registration data fetched:", registrationData);

    if (registrationError || !registrationData) {
      return errorResponse(`Failed to fetch registration: ${registrationError?.message || 'Not found'}`, 500);
    }
    const registrationNumber = registrationData.registration_number;

    // 3. Fetch Associated Workshops
    console.log(`Fetching workshop details for registration number: ${registrationNumber}...`);
    let workshopItemsHtml = '';
    try {
      const { data: workshopData, error: workshopError } = await supabaseAdmin.from('workshop_registration_summary').select('workshop_name').eq('registration_number', registrationNumber);
      if (workshopError) {
        console.error("Error fetching workshop details:", workshopError.message);
        workshopItemsHtml = '<li>Gagal memuat detail workshop.</li>';
      } else if (workshopData && workshopData.length > 0) {
        console.log(`Found ${workshopData.length} workshop(s) for registration ${registrationNumber}.`);
        workshopItemsHtml = workshopData.map((ws)=>`<li>${ws.workshop_name || 'Nama Workshop Tidak Diketahui'}</li>`).join('');
      } else {
        console.log(`No additional workshops found for registration ${registrationNumber}.`);
        workshopItemsHtml = '<li>Tidak ada workshop tambahan yang terdaftar.</li>';
      }
    } catch (wsFetchErr) {
      console.error("Exception fetching workshop details:", wsFetchErr.message);
      workshopItemsHtml = '<li>Terjadi kesalahan saat memuat detail workshop.</li>';
    }
    // 4. Fetch QR Code
    console.log(`Fetching QR code for participant ${participantId}, registration ${registrationId}...`);
    let qrCodeId = "N/A";
    let qrCodeUrl = "";
    try {
      const { data: qrCodeData, error: qrCodeError } = await supabaseAdmin.from('participant_qr_codes').select('qr_code_id, qr_code_url').eq('participant_id', participantId).eq('registration_id', registrationId).maybeSingle();
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
            }).eq('participant_id', participantId).eq('registration_id', registrationId).then(({ error: updateError })=>{
              if (updateError) console.error(`Background QR URL update failed: ${updateError.message}`);
              else console.log("Background QR URL update successful.");
            });
          } catch (qrGenError) {
            console.error("Error generating/updating QR code URL:", qrGenError.message);
          }
        }
      } else {
        console.warn(`QR Code data not found for participant ${participantId}, registration ${registrationId}.`);
      }
    } catch (qrCodeFetchErr) {
      console.error("Exception fetching/processing QR Code:", qrCodeFetchErr.message);
    }
    // 5. Fetch Payment Details
    console.log(`Fetching payment details for registration ${registrationId}...`);
    let paymentAmount = 0;
    let paymentNotes = 'N/A';
    try {
      const { data: paymentData, error: paymentFetchError } = await supabaseAdmin.from('payments').select('amount, notes').eq('registration_id', registrationId).eq('status', 'paid').order('created_at', {
        ascending: false
      }).limit(1).maybeSingle();
      if (paymentFetchError && paymentFetchError.code !== 'PGRST116') {
        console.error("Error fetching payment data:", paymentFetchError.message);
      } else if (paymentData) {
        paymentAmount = paymentData.amount || 0;
        paymentNotes = paymentData.notes || 'N/A';
        console.log(`Payment details found: Amount=${paymentAmount}, Notes=${paymentNotes}`);
      } else {
        console.log("No 'paid' payment record found for this registration.");
      }
    } catch (paymentFetchErr) {
      console.error("Exception fetching payment details:", paymentFetchErr.message);
    }
    // 6. Construct Email Body
    console.log("Constructing email body...");
    const subject = `[Ulang] Konfirmasi Registrasi MVCU 2025 - ${registrationNumber}`;
    let qrCodeSection = '';
    // [QR Code Section Logic - unchanged]
    if (qrCodeUrl && qrCodeUrl.trim() !== '') {
      qrCodeSection = `
          <h3>Informasi Check-in di Venue:</h3>
          <p>Untuk melakukan registrasi ulang di venue acara, harap tunjukkan QR Code berikut kepada petugas:</p>
          <div style="text-align: center; margin: 20px 0;">
            <img src="${qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px; border: 1px solid #ddd;" /><br>
            <strong style="font-size: 1.2em;">${qrCodeId}</strong>
          </div>
          <p>Simpan email ini atau screenshot QR Code Anda.</p>
        `;
    } else {
      qrCodeSection = `
        <h3>Informasi Check-in di Venue:</h3>
        <p>QR Code Anda tidak dapat dimuat saat ini. Jangan khawatir, Anda tetap dapat melakukan check-in di venue dengan menunjukkan email ini dan KTP/Identitas Anda.</p>
        <p>Nomor Registrasi: ${registrationNumber}</p>
        <p>Nama: ${recipientName}</p>
      `;
    }
    // ---
    const emailBody = `
      <html><body style="font-family: sans-serif;">
        <h2>Konfirmasi Ulang Registrasi MVCU 2025</h2>
        <p>Halo ${recipientName},</p>
        <p>Berikut adalah salinan konfirmasi registrasi Anda dengan nomor <strong>${registrationNumber}</strong>.</p>
        <h3>Item Registrasi Anda:</h3>
        <ul>
          <li>Tiket Simposium: <strong>${symposiumTicketName}</strong></li>
          ${workshopItemsHtml}
        </ul>
        <hr>
        ${qrCodeSection}
        <hr>
        <h3>Detail Pembayaran (Invoice Lunas):</h3>
        <ul>
          <li>Nomor Registrasi: ${registrationNumber}</li>
          <li>Total Pembayaran: ${new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(paymentAmount)}</li>
          <li>Catatan: ${paymentNotes}</li>
        </ul>
        <p>Anda juga dapat mengecek status registrasi Anda kapan saja melalui link:</p>
        <p><a href="https://ticketing.perkimakassar.com/check-status?registration_number=${registrationNumber}">Cek Status Registrasi</a></p>
        <p>Terima kasih atas partisipasi Anda. Sampai jumpa di MVCU 2025!</p><br>
        <p>Salam,</p><p>Panitia MVCU 2025</p>
      </body></html>
    `;
    console.log("Email body constructed.");
    // 7. Send Email via Resend
    console.log(`Attempting to send email via Resend to: ${recipientEmail}`);
    const resendPayload = {
      from: `Panitia MVCU 2025 <panitia.mcvu@perkimakassar.com>`,
      to: [
        recipientEmail
      ],
      subject: subject,
      html: emailBody
    };
    try {
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
        console.error(`Resend API Error Body: ${errorBody}`);
        throw new Error(`Failed to resend email via Resend: ${resendResponse.status} ${resendResponse.statusText} - ${errorBody}`);
      }
      const responseData = await resendResponse.json();
      console.log('Email resent successfully via Resend:', responseData);
      console.log("Function execution successful. Sending 200 response.");
      return new Response(JSON.stringify({
        message: 'Verification email resent successfully',
        resend_id: responseData.id
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } catch (resendError) {
      const errorMessage = resendError instanceof Error ? resendError.message : String(resendError);
      console.error("Resend API error during fetch:", errorMessage);
      // Use the specific error message if available
      return errorResponse(`Failed to send email: ${errorMessage}`, 500);
    }
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
});
console.log("Function resend-verification-email finished setting up serve listener.");
