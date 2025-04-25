import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    // This endpoint should be protected in production
    // Only use this for initial admin setup

    const { email, password, full_name } = await request.json()

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: "Email, password, and full_name are required" }, { status: 400 })
    }

    // Use service role key to bypass RLS
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        persistSession: false,
      },
    })

    // Create user
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (userError) {
      console.error("Error creating user:", userError)
      return NextResponse.json({ error: "Failed to create user: " + userError.message }, { status: 500 })
    }

    if (!userData.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    // Create admin profile
    const { error: profileError } = await supabase.from("admin_profiles").insert({
      id: userData.user.id,
      email,
      full_name,
      role: "admin",
    })

    if (profileError) {
      console.error("Error creating admin profile:", profileError)

      // Delete user if profile creation fails
      await supabase.auth.admin.deleteUser(userData.user.id)

      return NextResponse.json({ error: "Failed to create admin profile: " + profileError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Admin account created successfully",
      userId: userData.user.id,
    })
  } catch (error) {
    console.error("Server error:", error)
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 })
  }
}
