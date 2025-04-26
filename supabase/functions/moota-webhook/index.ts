// supabase/functions/moota-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// WARNING: Ensure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are set in Function Secrets
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// IP Address provided by Moota documentation
const MOOTA_IP_ADDRESS = '128.199.173.138'

interface MootaWebhookPayload {
  // Assuming payload structure based on GET /mutations response item
  // This might need adjustment based on actual Moota webhook data
  account_number: string;
  date: string; // "YYYY-MM-DD HH:MM:SS"
  description: string;
  amount: string; // e.g., "100000.00"
  type: 'CR' | 'DB';
  mutation_id: string; // Use this to store transaction reference
  bank_id: string;
  // ... other potential fields
}

serve(async (req: Request) => {
  // --- CORS Preflight ---
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // --- IP Address Verification ---
  const remoteAddr = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
                     req.headers.get('remote-addr') // Fallback, might not be accurate behind proxies
  // console.log('Incoming request from IP:', remoteAddr); // For debugging

  // IMPORTANT: In a real deployment, rely on Supabase/infrastructure IP checks if possible.
  // This check might be spoofable or inaccurate depending on proxy setup.
  // Consider adding a secret token verification layer as well if Moota supports it.
  if (remoteAddr !== MOOTA_IP_ADDRESS) {
    console.warn(`Request rejected: IP address ${remoteAddr} not whitelisted.`);
    return new Response(JSON.stringify({ error: 'Access denied: Invalid source IP.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // --- Process Webhook ---
  try {
    const payload: MootaWebhookPayload | MootaWebhookPayload[] = await req.json()
    console.log('Moota Webhook Payload Received:', payload)

    // Moota might send a single object or an array
    const mutations = Array.isArray(payload) ? payload : [payload];

    for (const mutation of mutations) {
      // Process only Credit transactions
      if (mutation.type !== 'CR') {
        console.log(`Skipping non-credit transaction: ${mutation.mutation_id}`);
        continue;
      }

      const uniqueAmount = parseFloat(mutation.amount)
      if (isNaN(uniqueAmount)) {
        console.error(`Invalid amount received: ${mutation.amount}`);
        continue; // Skip this mutation
      }

      console.log(`Processing credit mutation: ID=${mutation.mutation_id}, Amount=${uniqueAmount}`);

      // 1. Find matching 'pending' payment by unique_amount
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select(`
          id,
          registration_id,
          registrations (
            id,
            participant_id,
            registration_status
          )
        `)
        .eq('unique_amount', uniqueAmount)
        .eq('status', 'pending') // Ensure we only match pending payments
        .single(); // Expecting only one match per unique amount

      if (paymentError || !paymentData) {
        if (paymentError && paymentError.code !== 'PGRST116') { // PGRST116 = No rows found
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
      const { error: updatePaymentError } = await supabase
        .from('payments')
        .update({
          status: 'paid',
          transaction_id: mutation.mutation_id, // Store Moota's ID
          paid_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (updatePaymentError) {
        console.error(`Error updating payment status for ID ${paymentId}:`, updatePaymentError.message);
        // Consider rolling back or logging for manual intervention
        continue; // Skip to next mutation
      }
      console.log(`Payment status updated for ID: ${paymentId}`);

      // 3. Update registration status
      const { error: updateRegError } = await supabase
        .from('registrations')
        .update({ registration_status: 'verified' })
        .eq('id', registrationId);

      if (updateRegError) {
        console.error(`Error updating registration status for ID ${registrationId}:`, updateRegError.message);
        // Payment is marked paid, but registration isn't. Log for manual check.
        continue; // Skip to next mutation
      }
      console.log(`Registration status updated for ID: ${registrationId}`);

      // 4. Invoke the verification email function
      console.log(`Invoking send-verification-email for RegID: ${registrationId}, ParticipantID: ${participantId}`);
      const { error: invokeError } = await supabase.functions.invoke('send-verification-email', {
        body: { registrationId: registrationId, participantId: participantId },
      })

      if (invokeError) {
        console.error(`Error invoking send-verification-email for RegID ${registrationId}:`, invokeError.message);
        // Statuses are updated, but email failed. Log for potential manual resend.
      } else {
         console.log(`Successfully invoked send-verification-email for RegID: ${registrationId}`);
      }
    } // End of loop through mutations

    // Respond OK to Moota after processing all mutations in the payload
    return new Response(JSON.stringify({ message: 'Webhook processed successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error processing Moota webhook:', error.message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
