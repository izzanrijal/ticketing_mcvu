import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-auth"

export async function POST() {
  const supabase = createServerSupabaseClient()

  await supabase.auth.signOut()

  return NextResponse.redirect(new URL("/admin/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"))
}
