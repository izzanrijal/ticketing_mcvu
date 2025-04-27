import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_API_URL = 'https://api.resend.com/emails';

// Helper function for error responses
const errorResponse = (message: string, status: number) => {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: status,
  });
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    const bodyText = await req.text();
    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      return errorResponse(`Invalid JSON: ${errorMessage}`, 400);
    }

    const { participantId, registrationId } = payload;

    if (!participantId || !registrationId) {
      return errorResponse('Missing participantId or registrationId', 400);
    }

    if (!RESEND_API_KEY) {
      console.error("Missing environment variable RESEND_API_KEY");
      return errorResponse("Email service configuration error.", 500);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: participantData, error: participantError } = await supabaseAdmin
      .from('participants')
      .select('full_name, email')
      .eq('id', participantId)
      .single();

    if (participantError || !participantData) {
      return errorResponse(`Failed to fetch participant: ${participantError?.message}`, 500);
    }

    const { data: registrationData, error: registrationError } = await supabaseAdmin
      .from('registrations')
      .select('registration_number')
      .eq('id', registrationId)
      .single();

    if (registrationError || !registrationData) {
      return errorResponse(`Failed to fetch registration: ${registrationError?.message}`, 500);
    }

    const { data: qrCodeData, error: qrCodeError } = await supabaseAdmin
      .from('participant_qr_codes')
      .select('qr_code_id, qr_code_url')
      .eq('participant_id', participantId)
      .eq('registration_id', registrationId)
      .maybeSingle();

    if (qrCodeError) {
      return errorResponse(`Failed to fetch QR code: ${qrCodeError.message}`, 500);
    }

    let qrCodeId = "N/A";
    let qrCodeUrl = ""; // Final URL to use in img tag

    if (qrCodeData && qrCodeData.qr_code_id) {
      qrCodeId = qrCodeData.qr_code_id;

      if (qrCodeData.qr_code_url && qrCodeData.qr_code_url.trim() !== '') {
        console.log("Using existing QR code URL from database:", qrCodeData.qr_code_url);
        qrCodeUrl = qrCodeData.qr_code_url; // Use existing URL
      } else {
        console.log("QR code URL missing or invalid in DB. Generating new URL for ID:", qrCodeId);
        try {
          const generatedQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeId)}`;
          console.log("Generated QR code URL:", generatedQrUrl);
          qrCodeUrl = generatedQrUrl; // Use the newly generated URL

          const { error: updateError } = await supabaseAdmin
            .from('participant_qr_codes')
            .update({ qr_code_url: generatedQrUrl })
            .eq('participant_id', participantId)
            .eq('registration_id', registrationId);

          if (updateError) {
            console.error(`Failed to update QR code URL in database: ${updateError.message}`);
          } else {
            console.log("Updated QR code URL in database:", generatedQrUrl);
          }
        } catch (qrError) {
          const errorMessage = qrError instanceof Error ? qrError.message : String(qrError);
          console.error("QR code generation/update error:", errorMessage);
          // qrCodeUrl remains empty, will trigger fallback message later
        }
      }
    } else {
      console.warn(`QR Code ID not found for participant ${participantId} / registration ${registrationId}. Cannot generate/display QR code.`);
      // qrCodeId remains "N/A", qrCodeUrl remains empty
    }

    let paymentAmount = 0;
    let paymentNotes = 'N/A';

    const { data: paymentData } = await supabaseAdmin
      .from('payments')
      .select('amount, notes, payment_method')
      .eq('registration_id', registrationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentData) {
      paymentAmount = paymentData.amount || 0;
      paymentNotes = paymentData.notes || 'N/A';
    }

    const recipientEmail = participantData.email;
    const recipientName = participantData.full_name;
    const registrationNumber = registrationData.registration_number;

    const subject = `[Ulang] Konfirmasi Registrasi MVCU 2025 - ${registrationNumber}`;

    let qrCodeSection = '';
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
        <p>Terjadi masalah saat memuat QR Code Anda. Silakan coba lagi nanti atau hubungi panitia. Anda dapat menunjukkan email ini sebagai bukti pembayaran.</p>
        <p>Nomor Registrasi: ${registrationNumber}</p>
        <p>Nama: ${recipientName}</p>
      `;
    }

    const emailBody = `
      <html><body>
        <h2>Konfirmasi Ulang Registrasi MVCU 2025</h2>
        <p>Halo ${recipientName},</p>
        <p>Berikut adalah salinan konfirmasi registrasi Anda dengan nomor <strong>${registrationNumber}</strong>.</p>
        ${qrCodeSection}
        <p>Anda juga dapat mengecek status registrasi Anda kapan saja melalui link:</p>
        <p><a href="/check-status?registration_number=${registrationNumber}">Cek Status Registrasi</a></p> 
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
        <p>Terima kasih atas partisipasi Anda. Sampai jumpa di MVCU 2025!</p><br>
        <p>Salam,</p><p>Panitia MVCU 2025</p>
      </body></html>
    `;

    const resendPayload = {
      from: `Panitia MVCU 2025 <panitia.mcvu@perkimakassar.com>`,
      to: [recipientEmail],
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

      if (!resendResponse.ok) {
        const errorBody = await resendResponse.text();
        throw new Error(`Failed to resend email via Resend: ${resendResponse.status} ${resendResponse.statusText} - ${errorBody}`);
      }

      const responseData = await resendResponse.json();
      console.log('Email resent successfully via Resend:', responseData);

      return new Response(JSON.stringify({
        message: 'Verification email resent successfully',
        resend_id: responseData.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (resendError) {
      const errorMessage = resendError instanceof Error ? resendError.message : String(resendError);
      console.error("Resend API error:", errorMessage);
      return errorResponse(`Failed to send email: ${errorMessage}`, 500);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Unexpected function error:", errorMessage);
    return errorResponse(`Unexpected error: ${errorMessage}`, 500);
  }
});
