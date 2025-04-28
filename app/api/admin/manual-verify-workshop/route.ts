import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Create a Supabase client with admin privileges using service role key
// This bypasses RLS policies for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    // Authentication and admin check are now handled by page/middleware access control.
    // We proceed directly with the operation using the admin client.

    // Get the workshop_registration_id from the request
    const { workshop_registration_id, registration_id, registration_number } = await request.json();

    if (!workshop_registration_id) {
      return NextResponse.json(
        { error: "Workshop registration ID is required" },
        { status: 400 }
      );
    }

    // Update the participant_workshops status to 'paid'
    const { error: workshopError } = await supabaseAdmin
      .from('participant_workshops')
      .update({ status: 'paid' })
      .eq('id', workshop_registration_id);

    if (workshopError) {
      console.error("Error updating workshop status:", workshopError);
      return NextResponse.json(
        { 
          error: "Failed to update workshop status", 
          details: workshopError.message,
          debug: {
            workshop_registration_id,
            registration_id,
            registration_number
          }
        },
        { status: 500 }
      );
    }

    // If registration_id is provided, update the registration status as well
    let registrationUpdateResult = null;
    if (registration_id) {
      const { data: regData, error: regError } = await supabaseAdmin
        .from('registrations')
        .update({ status: 'paid' })
        .eq('id', registration_id)
        .select();

      registrationUpdateResult = { data: regData, error: regError };
    }

    // Fetch all related workshop registrations if registration_number is provided
    let relatedWorkshops = [];
    if (registration_number) {
      const { data: workshopData, error: relatedError } = await supabaseAdmin
        .from('workshop_registration_summary')
        .select('*')
        .eq('registration_number', registration_number);

      if (!relatedError && workshopData) {
        relatedWorkshops = workshopData;
      }
    }

    // Return success response with debug info
    return NextResponse.json({
      success: true,
      message: "Workshop registration successfully verified and marked as paid",
      debug: {
        workshop_registration_id,
        registration_id,
        registration_number,
        registrationUpdateResult,
        relatedWorkshopsCount: relatedWorkshops.length
      }
    });

  } catch (error: any) {
    console.error("Error in manual workshop verification:", error);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error.message || "Unknown error",
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
