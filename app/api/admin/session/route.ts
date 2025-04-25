import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-auth"

export async function GET() {
  const supabase = createServerSupabaseClient()

  try {
    // Get the session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 })
    }

    if (!session) {
      return NextResponse.json({ authenticated: false, message: "No session found" }, { status: 200 })
    }

    // Check if user is admin
    const { data: adminProfile, error: profileError } = await supabase
      .from("admin_profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        {
          authenticated: true,
          isAdmin: false,
          message: "Admin profile error",
          error: profileError.message,
          userId: session.user.id,
        },
        { status: 200 },
      )
    }

    if (!adminProfile) {
      return NextResponse.json(
        {
          authenticated: true,
          isAdmin: false,
          message: "No admin profile found",
          userId: session.user.id,
        },
        { status: 200 },
      )
    }

    return NextResponse.json(
      {
        authenticated: true,
        isAdmin: true,
        user: session.user,
        adminProfile,
      },
      { status: 200 },
    )
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
