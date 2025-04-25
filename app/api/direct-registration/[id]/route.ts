import { createClient } from "@/lib/supabase"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id

  // Create a Supabase client
  const supabase = createClient()

  try {
    // First try the special function for aa880d3c
    if (id === "aa880d3c-25fe-46e1-897d-ea1022c0fdea") {
      // Try the special function
      const { data: specialData, error: specialError } = await supabase.rpc("get_special_registration_aa880d3c")

      if (!specialError && specialData && specialData.length > 0) {
        return NextResponse.json({
          registration: specialData[0],
          source: "special_function",
        })
      }

      // Try the materialized view
      const { data: matViewData, error: matViewError } = await supabase
        .from("mat_view_registration_aa880d3c")
        .select("*")

      if (!matViewError && matViewData && matViewData.length > 0) {
        return NextResponse.json({
          registration: matViewData[0],
          source: "materialized_view",
        })
      }

      // Try the special table
      const { data: specialTableData, error: specialTableError } = await supabase
        .from("special_registration_aa880d3c")
        .select("*")

      if (!specialTableError && specialTableData && specialTableData.length > 0) {
        return NextResponse.json({
          registration: specialTableData[0],
          source: "special_table",
        })
      }
    }

    // Try the general function
    const { data: funcData, error: funcError } = await supabase.rpc("get_registration_by_any_id", { search_id: id })

    if (!funcError && funcData && funcData.length > 0) {
      return NextResponse.json({
        registration: funcData[0],
        source: "function",
      })
    }

    // Direct query to registrations table
    const { data: regData, error: regError } = await supabase.from("registrations").select("*").eq("id", id).single()

    if (!regError && regData) {
      return NextResponse.json({
        registration: regData,
        source: "direct_query",
      })
    }

    // Try with case-insensitive match
    const { data: caseData, error: caseError } = await supabase
      .from("registrations")
      .select("*")
      .ilike("id", id)
      .single()

    if (!caseError && caseData) {
      return NextResponse.json({
        registration: caseData,
        source: "case_insensitive",
      })
    }

    // Try with registration number
    const { data: numData, error: numError } = await supabase
      .from("registrations")
      .select("*")
      .eq("registration_number", id)
      .single()

    if (!numError && numData) {
      return NextResponse.json({
        registration: numData,
        source: "registration_number",
      })
    }

    // Try with MCVU- prefix
    if (!id.startsWith("MCVU-")) {
      const { data: prefixData, error: prefixError } = await supabase
        .from("registrations")
        .select("*")
        .eq("registration_number", `MCVU-${id}`)
        .single()

      if (!prefixError && prefixData) {
        return NextResponse.json({
          registration: prefixData,
          source: "with_prefix",
        })
      }
    }

    // If all else fails, return not found
    return NextResponse.json(
      {
        error: "Registration not found",
        id: id,
        tried: [
          "special_function",
          "materialized_view",
          "special_table",
          "function",
          "direct_query",
          "case_insensitive",
          "registration_number",
          "with_prefix",
        ],
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
