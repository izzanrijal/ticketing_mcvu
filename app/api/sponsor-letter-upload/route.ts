import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    // Get the form data from the request
    const formData = await request.formData();
    
    // Get the file and registration info
    const file = formData.get('file') as File;
    const registrationId = formData.get('registrationId') as string;
    const registrationNumber = formData.get('registrationNumber') as string;
    
    if (!file || !registrationId) {
      return NextResponse.json({ error: "Missing file or registration ID" }, { status: 400 });
    }

    if (!file.type.includes('pdf') && !file.type.includes('image/')) {
      return NextResponse.json({ error: "Invalid file type. Only PDF and images are allowed." }, { status: 400 });
    }

    // Create the filename with standardized format: MCVU-64602088-sponsorship-letter.pdf
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const fileName = `${registrationNumber}-sponsorship-letter.${fileExtension}`;
    
    // Convert File to ArrayBuffer and then to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Upload file to Supabase Storage
    const { data, error } = await supabaseAdmin
      .storage
      .from('Sponsor Letters')
      .upload(fileName, uint8Array, {
        contentType: file.type,
        upsert: true
      });
    
    if (error) {
      console.error("Storage upload error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Get the public URL for the uploaded file
    const { data: publicUrlData } = supabaseAdmin
      .storage
      .from('Sponsor Letters')
      .getPublicUrl(fileName);
    
    // Update the registration record with both the sponsor letter URL and path
    const { error: updateError } = await supabaseAdmin
      .from('registrations')
      .update({ 
        sponsor_letter_url: publicUrlData.publicUrl,
        sponsor_letter_path: data.path
      })
      .eq('id', registrationId);
    
    if (updateError) {
      console.error("Registration update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      path: data.path
    });
    
  } catch (error) {
    console.error("Sponsor letter upload error:", error);
    return NextResponse.json({ 
      error: "Internal server error: " + (error instanceof Error ? error.message : String(error)) 
    }, { status: 500 });
  }
}
