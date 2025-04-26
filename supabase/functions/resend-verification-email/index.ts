import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_API_URL = 'https://api.resend.com/emails';

serve(async (req) => {
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
      return new Response(JSON.stringify({ 
        error: `Invalid JSON: ${e.message}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const { participantId, registrationId } = payload;

    if (!participantId || !registrationId) {
      return new Response(JSON.stringify({ 
        error: 'Missing participantId or registrationId' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    if (!RESEND_API_KEY) {
      throw new Error("Missing environment variable RESEND_API_KEY");
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
      return new Response(JSON.stringify({ 
        error: `Failed to fetch participant: ${participantError?.message}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const { data: registrationData, error: registrationError } = await supabaseAdmin
      .from('registrations')
      .select('registration_number')
      .eq('id', registrationId)
      .single();

    if (registrationError || !registrationData) {
      return new Response(JSON.stringify({ 
        error: `Failed to fetch registration: ${registrationError?.message}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const { data: qrCodeData, error: qrCodeError } = await supabaseAdmin
      .from('participant_qr_codes')
      .select('qr_code_id, qr_code_url')
      .eq('participant_id', participantId)
      .eq('registration_id', registrationId)
      .maybeSingle();

    if (qrCodeError) {
      return new Response(JSON.stringify({ 
        error: `Failed to fetch QR code: ${qrCodeError.message}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    let qrCodeId = "N/A";
    let qrCodeUrl = "";

    if (qrCodeData && qrCodeData.qr_code_id) {
      qrCodeId = qrCodeData.qr_code_id;

      if (!qrCodeData.qr_code_url) {
        try {
          // Use a public QR code generation service instead of generating it locally
          // This is more reliable in a serverless environment
          const generatedQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeId)}`;
          
          // No need to upload to storage, just use the URL directly

          // Update database with URL directly
          const { error: updateError } = await supabaseAdmin
            .from('participant_qr_codes')
            .update({ qr_code_url: generatedQrUrl })
            .eq('participant_id', participantId)
            .eq('registration_id', registrationId);

          qrCodeUrl = generatedQrUrl;

          if (updateError) {
            throw new Error(`Failed to update QR code URL: ${updateError.message}`);
          }
        } catch (qrError) {
          console.error("QR code generation error:", qrError);
        }
      } else {
        qrCodeUrl = qrCodeData.qr_code_url;
      }
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
    if (qrCodeId !== "N/A") {
      // Log QR code URL for debugging
      console.log("QR code URL from database:", qrCodeUrl);
      
      // If we have a QR code URL, use it
      if (qrCodeUrl && qrCodeUrl.trim() !== '') {
        // Ensure the URL is absolute
        const absoluteQrUrl = qrCodeUrl.startsWith('http') ? qrCodeUrl : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeId)}`;
        
        console.log("Using QR code URL in email:", absoluteQrUrl);
        
        qrCodeSection = `
          <h3>Informasi Check-in di Venue:</h3>
          <p>Untuk melakukan registrasi ulang di venue acara, harap tunjukkan QR Code berikut kepada petugas:</p>
          <div style="text-align: center; margin: 20px 0;">
            <img src="${absoluteQrUrl}" alt="QR Code" style="width: 200px; height: 200px; border: 1px solid #ddd;"><br>
            <strong style="font-size: 1.2em;">${qrCodeId}</strong>
          </div>
          <p>Simpan email ini atau screenshot QR Code Anda.</p>
        `;
      } else {
        // Generate a QR code URL on the fly if we don't have one
        const generatedQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeId)}`;
        console.log("Generated QR code URL for email:", generatedQrUrl);
        
        qrCodeSection = `
          <h3>Informasi Check-in di Venue:</h3>
          <p>Untuk melakukan registrasi ulang di venue acara, harap tunjukkan QR Code berikut kepada petugas:</p>
          <div style="text-align: center; margin: 20px 0;">
            <img src="${generatedQrUrl}" alt="QR Code" style="width: 200px; height: 200px; border: 1px solid #ddd;"><br>
            <strong style="font-size: 1.2em;">${qrCodeId}</strong>
          </div>
          <p>Simpan email ini atau screenshot QR Code Anda.</p>
        `;
        
        // Update the database with this URL for future use
        try {
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
        } catch (error) {
          console.error("Error updating QR code URL:", error);
        }
      }
    } else {
      qrCodeSection = `
        <h3>Informasi Check-in di Venue:</h3>
        <p>QR Code Anda akan diberikan saat registrasi di venue acara.</p>
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
  } catch (error) {
    return new Response(JSON.stringify({
      error: `Unexpected error: ${error.message}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
