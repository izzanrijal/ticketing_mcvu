// supabase/functions/moota-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as crypto from "https://deno.land/std@0.168.0/node/crypto.ts"; // For HMAC
import { timingSafeEqual } from "https://deno.land/std@0.168.0/crypto/timing_safe_equal.ts"; // For secure comparison
import { corsHeaders } from '../_shared/cors.ts';
// WARNING: Ensure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MOOTA_WEBHOOK_SECRET are set in Function Secrets
const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
const MOOTA_IP_ADDRESS = '128.199.173.138';
const MOOTA_SECRET = Deno.env.get('MOOTA_WEBHOOK_SECRET'); // Get the secret
// Helper function for signature verification
async function verifySignature(secret, req, rawBody) {
  // **IMPORTANT: Replace 'X-Moota-Signature' with the actual header name from Moota's docs**
  const signatureHeader = req.headers.get('X-Moota-Signature');
  if (!signatureHeader) {
    console.warn('Missing signature header');
    return false;
  }
  // Assuming signature is hex-encoded HMAC-SHA256
  const key = crypto.createHmac('sha256', secret);
  key.update(rawBody);
  const digest = key.digest('hex'); // Calculate expected signature
  const expectedSignature = `sha256=${digest}`; // Common format, adjust if needed
  // Use timingSafeEqual for security
  const encoder = new TextEncoder();
  try {
    return timingSafeEqual(encoder.encode(signatureHeader), encoder.encode(expectedSignature));
  } catch (e) {
    console.error("Error comparing signatures:", e);
    return false; // Signatures likely have different lengths
  }
}
serve(async (req)=>{
  // --- CORS Preflight ---
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  // --- Read Raw Body FIRST for Signature Verification ---
  // Cloning the request to read the body twice (once as text, once as JSON)
  const reqClone = req.clone();
  let rawBody;
  try {
    rawBody = await req.text(); // Read body as text for signature
  } catch (e) {
    console.error("Could not read request body:", e);
    return new Response(JSON.stringify({
      error: 'Bad Request: Could not read body'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  // --- Signature Verification ---
  if (!MOOTA_SECRET) {
    console.error('MOOTA_WEBHOOK_SECRET is not set in environment variables.');
    // Return 500 because it's a server config issue
    return new Response(JSON.stringify({
      error: 'Webhook secret not configured.'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  const isVerified = await verifySignature(MOOTA_SECRET, reqClone, rawBody); // Use original req for headers
  if (!isVerified) {
    console.warn('Request rejected: Invalid signature.');
    return new Response(JSON.stringify({
      error: 'Access denied: Invalid signature.'
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  console.log('Signature verified successfully.');
  // --- IP Address Verification (Optional Layer) ---
  // Note: Still potentially unreliable depending on infra. Signature is primary.
  const remoteAddr = reqClone.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? reqClone.headers.get('remote-addr');
  if (remoteAddr !== MOOTA_IP_ADDRESS) {
    console.warn(`Request passed signature check but IP address ${remoteAddr} not whitelisted. Proceeding cautiously, but review setup.`);
  // Decide if you want to fail here or just log it now that signature is checked
  // return new Response(JSON.stringify({ error: 'Access denied: Invalid source IP.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  } else {
    console.log('IP address matches whitelist.');
  }
  // --- Process Webhook ---
  try {
    // Now parse the JSON from the raw body we already read
    const payload = JSON.parse(rawBody);
    console.log('Moota Webhook Payload Received:', payload);
    const mutations = Array.isArray(payload) ? payload : [
      payload
    ];
    for (const mutation of mutations){
      // ... (rest of your existing processing logic) ...
      // Process only Credit transactions
      if (mutation.type !== 'CR') {
        console.log(`Skipping non-credit transaction: ${mutation.mutation_id}`);
        continue;
      }
      const uniqueAmount = parseFloat(mutation.amount);
      if (isNaN(uniqueAmount)) {
        console.error(`Invalid amount received: ${mutation.amount}`);
        continue; // Skip this mutation
      }
      console.log(`Processing credit mutation: ID=${mutation.mutation_id}, Amount=${uniqueAmount}`);
      // 1. Find matching 'pending' payment by unique_amount
      const { data: paymentData, error: paymentError } = await supabase.from('payments').select(`
          id,
          registration_id,
          registrations (
            id,
            participant_id,
            registration_status
          )
        `).eq('unique_amount', uniqueAmount).eq('status', 'pending') // Ensure we only match pending payments
      .single(); // Expecting only one match per unique amount
      if (paymentError || !paymentData) {
        if (paymentError && paymentError.code !== 'PGRST116') {
          console.error('Error fetching payment:', paymentError.message);
        } else {
          console.log(`No pending payment found for amount: ${uniqueAmount}`);
        }
        continue; // Move to the next mutation if any
      }
      // Defensive check: Ensure registration relation loaded correctly
      if (!paymentData.registrations) {
        console.error(`Registration data missing for payment ID: ${paymentData.id}`);
        continue;
      }
      const paymentId = paymentData.id;
      const registrationId = paymentData.registrations.id;
      const participantId = paymentData.registrations.participant_id;
      const currentRegStatus = paymentData.registrations.registration_status;
      console.log(`Match found: PaymentID=${paymentId}, RegID=${registrationId}, ParticipantID=${participantId}, CurrentStatus=${currentRegStatus}`);
      // Ensure registration is still pending or unpaid before verifying
      if (currentRegStatus !== 'pending' && currentRegStatus !== 'pending verification' && currentRegStatus !== 'unpaid') {
        console.log(`Registration ${registrationId} status is already '${currentRegStatus}'. Skipping verification.`);
        continue;
      }
      // 2. Update payment status and store Moota transaction ID
      const { error: updatePaymentError } = await supabase.from('payments').update({
        status: 'paid',
        transaction_id: mutation.mutation_id,
        paid_at: new Date().toISOString()
      }).eq('id', paymentId);
      if (updatePaymentError) {
        console.error(`Error updating payment status for ID ${paymentId}:`, updatePaymentError.message);
        continue; // Skip to next mutation
      }
      console.log(`Payment status updated for ID: ${paymentId}`);
      // 3. Update registration status
      const { error: updateRegError } = await supabase.from('registrations').update({
        registration_status: 'verified'
      }).eq('id', registrationId);
      if (updateRegError) {
        console.error(`Error updating registration status for ID ${registrationId}:`, updateRegError.message);
        continue; // Skip to next mutation
      }
      console.log(`Registration status updated for ID: ${registrationId}`);
      // 4. Invoke the verification email function
      console.log(`Invoking send-verification-email for RegID: ${registrationId}, ParticipantID: ${participantId}`);
      const { error: invokeError } = await supabase.functions.invoke('send-verification-email', {
        body: {
          registrationId: registrationId,
          participantId: participantId
        }
      });
      if (invokeError) {
        console.error(`Error invoking send-verification-email for RegID ${registrationId}:`, invokeError.message);
      // Statuses are updated, but email failed. Log for potential manual resend.
      } else {
        console.log(`Successfully invoked send-verification-email for RegID: ${registrationId}`);
      }
    } // End of loop through mutations
    // Respond OK to Moota
    return new Response(JSON.stringify({
      message: 'Webhook processed successfully'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    // Check if error is from JSON parsing
    if (error instanceof SyntaxError) {
      console.error('Error parsing JSON:', error.message);
      return new Response(JSON.stringify({
        error: 'Bad Request: Invalid JSON payload'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // General error
    console.error('Error processing Moota webhook:', error.message);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
