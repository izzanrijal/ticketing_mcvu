// app/api/admin/sponsor-letters/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// IMPORTANT: Ensure these are set in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error(
    'Missing Supabase URL or Service Role Key in environment variables.'
  )
  // Avoid throwing here during build time, handle in GET
}

export const dynamic = 'force-dynamic' // Ensure fresh data

export async function GET() {
  // Check environment variables again at runtime
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json(
      {
        error:
          'Server configuration error: Missing Supabase environment variables.',
        data: null,
        debug: {
          hasUrl: !!supabaseUrl,
          hasServiceKey: !!supabaseServiceRoleKey,
        },
      },
      { status: 500 }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      // Explicitly disable auto-refreshing tokens for service role
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // Fetch registrations with non-null sponsor letters and related participant
    // Using the admin client might resolve previous join/cache issues
    // Try implicit join first with admin client
    const { data, error } = await supabaseAdmin
      .from('registrations')
      .select(
        `
        id,
        registration_number,
        status,
        created_at,
        sponsor_letter_url,
        participants (
          full_name,
          email
        )
      `
      )
      .not('sponsor_letter_url', 'is', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase Admin API Error:', error)
      // Throwing the error will be caught by the outer catch block
      throw error
    }

    // Return the fetched data
    return NextResponse.json({ data, error: null, debug: null })
  } catch (err: any) {
    console.error('API Route Error fetching sponsor letters:', err)
    return NextResponse.json(
      {
        error: err.message || 'An unexpected error occurred.',
        data: [], // Provide fallback empty array
        debug: { errorMessage: err.message, code: err.code },
      },
      { status: 500 } // Use 500 for server errors
    )
  }
}
