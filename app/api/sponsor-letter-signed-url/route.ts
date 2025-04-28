import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    // Get the path from the query parameters
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    
    if (!path) {
      return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }
    
    // Generate a signed URL with 7-day expiry (604800 seconds)
    const { data, error } = await supabaseAdmin
      .storage
      .from('sponsor_letters')
      .createSignedUrl(path, 604800);
    
    if (error) {
      console.error("Error creating signed URL:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl
    });
    
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return NextResponse.json({ 
      error: "Internal server error: " + (error instanceof Error ? error.message : String(error)) 
    }, { status: 500 });
  }
}
