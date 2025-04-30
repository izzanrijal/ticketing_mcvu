// supabase/functions/send-verification-email/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts'; // Adjusted import path
// Ensure RESEND_API_KEY is set in Supabase Function Secrets
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_API_URL = 'https://api.resend.com/emails';
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    if (!RESEND_API_KEY) {
      throw new Error("Missing environment variable RESEND_API_KEY");
    }
    const { participantId, registrationId } = await req.json();
    if (!participantId || !registrationId) {
      return new Response(JSON.stringify({
        error: 'Missing participantId or registrationId'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      global: {
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        }
      }
    });
    // --- Fetch necessary data ---
    const { data: participantData, error: participantError } = await supabaseAdmin.from('participants').select('full_name, email').eq('id', participantId).single();
    if (participantError || !participantData) {
      throw new Error(`Failed to fetch participant ${participantId}: ${participantError?.message}`);
    }
    const { data: registrationData, error: registrationError } = await supabaseAdmin.from('registrations').select('registration_number').eq('id', registrationId).single();
    if (registrationError || !registrationData) {
      throw new Error(`Failed to fetch registration ${registrationId}: ${registrationError?.message}`);
    }
    const { data: qrCodeData, error: qrCodeError } = await supabaseAdmin.from('participant_qr_codes').select('qr_code_id').eq('participant_id', participantId).eq('registration_id', registrationId).single();
    if (qrCodeError || !qrCodeData) {
      throw new Error(`Failed to fetch QR code for participant ${participantId}: ${qrCodeError?.message}`);
    }
    const { data: paymentData, error: paymentError } = await supabaseAdmin.from('payments').select('amount, notes, payment_method').eq('registration_id', registrationId).order('created_at', {
      ascending: false
    }).limit(1).single();
    if (paymentError || !paymentData) {
      console.warn(`Could not fetch payment details for registration ${registrationId}: ${paymentError?.message}`);
    }
    const paymentAmount = paymentData?.amount ?? 0;
    const paymentNotes = paymentData?.notes ?? 'N/A';
    const recipientEmail = participantData.email;
    const recipientName = participantData.full_name;
    const registrationNumber = registrationData.registration_number;
    const qrCodeId = qrCodeData.qr_code_id;
    const subject = `Konfirmasi Registrasi MVCU 2025 - ${registrationNumber}`;
    const emailBody = `
      <html><body>
        <h2>Konfirmasi Registrasi MVCU 2025 Berhasil!</h2>
        <p>Halo ${recipientName},</p>
        <p>Registrasi Anda dengan nomor <strong>${registrationNumber}</strong> telah berhasil diverifikasi dan pembayaran telah diterima.</p>
        <h3>Informasi Check-in di Venue:</h3>
        <p>Untuk melakukan registrasi ulang di venue acara, harap tunjukkan <strong>QR Code ID</strong> berikut kepada petugas:</p>
        <div style="border: 1px solid #ccc; padding: 15px; text-align: center; margin: 20px 0; background-color: #f9f9f9;">
          <h1 style="font-size: 2.5em; letter-spacing: 3px; margin: 0;">${qrCodeId}</h1>
        </div>
        <p>Simpan email ini atau catat QR Code ID Anda. Anda juga dapat mengecek status dan QR Code ID Anda kapan saja melalui link:</p>
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
    // --- Send Email using Resend ---
    const resendPayload = {
      from: `Panitia MVCU 2025 <panitia.mcvu@perkimakassar.com>`,
      to: [
        recipientEmail
      ],
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
      throw new Error(`Failed to send email via Resend: ${resendResponse.status} ${resendResponse.statusText} - ${errorBody}`);
    }
    const responseData = await resendResponse.json();
    console.log("Email sent successfully via Resend:", responseData);
    return new Response(JSON.stringify({
      message: 'Verification email sent successfully',
      resend_id: responseData.id
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error("Error in send-verification-email function:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
