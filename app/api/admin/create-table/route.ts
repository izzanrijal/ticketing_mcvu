import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    // Use service role key to bypass RLS
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        persistSession: false,
      },
    })

    // Try to create the table directly using SQL
    const { error: sqlError } = await supabase.rpc("exec_sql", {
      sql_query: `
        CREATE TABLE IF NOT EXISTS admin_profiles (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          full_name TEXT,
          role TEXT NOT NULL DEFAULT 'admin',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `,
    })

    if (sqlError) {
      console.error("Error creating admin_profiles table with SQL:", sqlError)

      // Alternative approach - try to insert a record which will create the table
      const { error: insertError } = await supabase.from("admin_profiles").insert({
        id: "00000000-0000-0000-0000-000000000000",
        email: "temp@example.com",
        full_name: "Temporary Admin",
        role: "admin",
      })

      if (insertError && !insertError.message.includes("already exists")) {
        return NextResponse.json({ error: "Failed to create table: " + insertError.message }, { status: 500 })
      }

      // Delete the temporary record if it was created
      await supabase.from("admin_profiles").delete().eq("id", "00000000-0000-0000-0000-000000000000")
    }

    return NextResponse.json({
      success: true,
      message: "admin_profiles table created successfully",
    })
  } catch (error) {
    console.error("Server error:", error)
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 })
  }
}
