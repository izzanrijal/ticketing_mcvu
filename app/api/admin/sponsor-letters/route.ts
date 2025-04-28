// app/api/admin/sponsor-letters/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase' // Using the already configured admin client

export const dynamic = 'force-dynamic' // Ensure fresh data

export async function GET() {
  try {
    // Directly use the supabaseAdmin client that's already configured with the service role key
    // Fetch registrations with non-null sponsor letters and related participants
    const { data: registrations, error } = await supabaseAdmin
      .from('registrations')
      .select(`
        id,
        registration_number,
        status,
        created_at,
        sponsor_letter_url
      `)
      .not('sponsor_letter_url', 'is', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase Admin API Error:', error)
      throw error
    }

    // For each registration, fetch the related participant separately to avoid join issues
    const registrationsWithParticipants = await Promise.all(
      registrations.map(async (registration) => {
        const { data: participants, error: participantError } = await supabaseAdmin
          .from('participants')
          .select('id, full_name, email')
          .eq('registration_id', registration.id)
          .maybeSingle()

        if (participantError) {
          console.warn(`Error fetching participant for registration ${registration.id}:`, participantError)
        }

        return {
          ...registration,
          participants: participants || null
        }
      })
    )

    // Return the enhanced data
    return NextResponse.json({ 
      data: registrationsWithParticipants, 
      error: null, 
      debug: null 
    })
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
