import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log('[Server] /api/registrations/[id] received request'); // Early log

  const registrationId = params.id;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Pastikan ini ada di .env.local

  // --- PERIKSA ENVIRONMENT VARIABLE DI AWAL ---
  if (!supabaseUrl || !serviceKey) {
    console.error('[Server] FATAL ERROR: Missing Supabase URL or Service Role Key');
    console.error(`[Server] SUPABASE_URL exists: ${!!supabaseUrl}`);
    console.error(`[Server] SERVICE_KEY exists: ${!!serviceKey}`);
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials. Check server logs.' },
      { status: 500 }
    );
  }
  // --- AKHIR PEMERIKSAAN ---

  if (!registrationId) {
    console.log('[Server] ERROR: Registration ID is missing in request');
    return NextResponse.json(
      { error: 'Registration ID is required' },
      { status: 400 }
    );
  }

  try {
    // --- PINDAHKAN INISIALISASI KE DALAM TRY ---
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    // --- AKHIR INISIALISASI ---

    console.log(`[Server] Supabase client initialized successfully.`);
    console.log(`[Server] Fetching registration details for ID: ${registrationId}`);

    // Fetch registration data with related tables
    const { data, error } = await supabaseAdmin
      .from('registrations')
      .select(`
        *,\n        participants(*),\n        tickets(*),\n        contact_persons(*),\n        payments(*)
      `)
      .eq('id', registrationId)
      .maybeSingle();

    if (error) {
      console.error('[Server] Supabase query error:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        {
          error: `Database query error: ${error.message}`,
          details: error.details,
          hint: error.hint,
          code: error.code,
          debug: { id: registrationId }
        },
        { status: 500 }
      );
    }

    if (!data) {
      console.log(`[Server] No data found for registration ID: ${registrationId}`);
      // Kembalikan 404 jika tidak ditemukan
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    console.log('[Server] Successfully retrieved registration data');
    return NextResponse.json({ data });

  } catch (err: any) {
    console.error('[Server] UNEXPECTED CATCH BLOCK ERROR:', err);
    // Tambahkan detail error ke respons jika memungkinkan
    return NextResponse.json(
      { error: 'An unexpected server error occurred during processing.', details: err.message || String(err) },
      { status: 500 }
    );
  }
}