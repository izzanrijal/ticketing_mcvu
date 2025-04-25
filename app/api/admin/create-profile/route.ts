import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const { userId, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json({ error: "User ID and email are required" }, { status: 400 })
    }

    // First verify that the request is coming from the actual user
    const cookieStore = cookies()
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      },
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user || user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use service role key to bypass RLS for admin operations
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        persistSession: false,
      },
    })

    // Check if profile already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from("admin_profiles")
      .select("*")
      .eq("id", userId)

    if (checkError) {
      console.error("Error checking existing profile:", checkError)
      return NextResponse.json({ error: "Failed to check existing profile: " + checkError.message }, { status: 500 })
    }

    if (existingProfile && existingProfile.length > 0) {
      return NextResponse.json({ error: "Admin profile already exists for this user" }, { status: 400 })
    }

    // Create admin profile
    const { error: insertError } = await supabase.from("admin_profiles").insert({
      id: userId,
      email,
      full_name: email.split("@")[0], // Default name from email
      role: "admin",
    })

    if (insertError) {
      console.error("Error creating admin profile:", insertError)
      return NextResponse.json({ error: "Failed to create admin profile: " + insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Admin profile created successfully",
    })
  } catch (error) {
    console.error("Server error:", error)
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 })
  }
}
