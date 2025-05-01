import { supabaseAdmin } from "@/lib/supabase"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id

  // Create a Supabase client
  const supabase = supabaseAdmin

  try {
    // Special handling for the problematic ID
    if (id === "aa880d3c-25fe-46e1-897d-ea1022c0fdea") {
      // Try the special function
      try {
        const { data: funcData, error: funcError } = await supabase.rpc("get_registration_aa880d3c")

        if (!funcError && funcData && funcData.length > 0) {
          return NextResponse.json({
            registration: funcData[0],
            source: "special_function",
          })
        }
      } catch (e) {
        console.log("Special function error:", e)
      }

      // Try the view
      try {
        const { data: viewData, error: viewError } = await supabase.from("view_registration_aa880d3c").select("*")

        if (!viewError && viewData && viewData.length > 0) {
          return NextResponse.json({
            registration: viewData[0],
            source: "special_view",
          })
        }
      } catch (e) {
        console.log("View error:", e)
      }

      // Try the materialized view
      try {
        const { data: matViewData, error: matViewError } = await supabase
          .from("mat_view_registration_aa880d3c")
          .select("*")

        if (!matViewError && matViewData && matViewData.length > 0) {
          return NextResponse.json({
            registration: matViewData[0],
            source: "materialized_view",
          })
        }
      } catch (e) {
        console.log("Materialized view error:", e)
      }

      // Try the special table
      try {
        const { data: tableData, error: tableError } = await supabase.from("special_registration_aa880d3c").select("*")

        if (!tableError && tableData && tableData.length > 0) {
          return NextResponse.json({
            registration: tableData[0],
            source: "special_table",
          })
        }
      } catch (e) {
        console.log("Special table error:", e)
      }
    }

    // Direct query to registrations table as fallback
    const { data: regData, error: regError } = await supabase.from("registrations").select("*").eq("id", id).single()

    if (!regError && regData) {
      return NextResponse.json({
        registration: regData,
        source: "direct_query",
      })
    }

    // If all else fails, return not found
    return NextResponse.json(
      {
        error: "Registration not found",
        id: id,
      },
      { status: 404 },
    )
  } catch (error) {
    console.error("Error fetching registration:", error)
    return NextResponse.json(
      {
        error: "Error fetching registration",
        details: error instanceof Error ? error.message : String(error),
        id: id,
      },
      { status: 500 },
    )
  }
}
