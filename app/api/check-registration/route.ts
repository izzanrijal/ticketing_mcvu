import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: Request) {
  try {
    // Use service role key to bypass RLS
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        persistSession: false,
      },
    })

    // Get registration number from query params
    const url = new URL(request.url)
    const registrationNumber = url.searchParams.get('registrationNumber')

    if (!registrationNumber) {
      return NextResponse.json({ error: "Nomor pendaftaran diperlukan" }, { status: 400 })
    }

    console.log("Checking registration number:", registrationNumber)

    // Clean the input - remove any non-numeric characters if it doesn't start with MCVU-
    let searchNumber = registrationNumber
    if (!searchNumber.startsWith("MCVU-")) {
      const numericPart = registrationNumber.replace(/\D/g, "")
      searchNumber = `MCVU-${numericPart}`
    }

    // Format the registration number to ensure it has the MCVU- prefix
    let formattedRegNumber = registrationNumber
    if (!formattedRegNumber.startsWith("MCVU-")) {
      formattedRegNumber = `MCVU-${formattedRegNumber}`
    }

    // First try direct query which is more reliable
    const { data: directData, error: directError } = await supabase
      .from("registrations")
      .select("id, registration_number, created_at")
      .eq("registration_number", searchNumber)
      .single()

    // If direct query succeeds, use that result
    if (!directError && directData) {
      console.log("Found registration via direct query:", directData)

      // Get registration data without using relationships
      const { data: registration, error: regError } = await supabase
        .from("registrations")
        .select("*")
        .eq("id", directData.id)
        .single()

      if (regError) {
        console.error("Error fetching registration details:", regError)
        return NextResponse.json(
          {
            error: "Gagal mengambil detail pendaftaran",
            details: regError.message,
          },
          { status: 500 },
        )
      }

      // Try to get participants - first check if they're linked by registration_id
      let participants = []
      let participantsError = null

      try {
        // First try using registration_id if it exists
        const { data: participantsData, error: partError } = await supabase
          .from("participants")
          .select("*")
          .eq("registration_id", directData.id)

        if (!partError && participantsData && participantsData.length > 0) {
          participants = participantsData
        } else {
          // If that fails, try using registration_number if it exists
          const { data: altParticipantsData, error: altPartError } = await supabase
            .from("participants")
            .select("*")
            .eq("registration_number", directData.registration_number)

          if (!altPartError && altParticipantsData && altParticipantsData.length > 0) {
            participants = altParticipantsData
          }
        }
      } catch (partFetchError) {
        console.error("Error fetching participants:", partFetchError)
        participantsError = partFetchError
      }

      // Get payment data - only use registration_id
      let payments = []
      let paymentError = null

      try {
        const { data: paymentsData, error: payError } = await supabase
          .from("payments")
          .select("*")
          .eq("registration_id", directData.id)
          .order("created_at", { ascending: false })

        if (!payError) {
          payments = paymentsData || []
        } else {
          console.error("Error fetching payment data:", payError)
          paymentError = payError
        }
      } catch (payFetchError) {
        console.error("Error fetching payment data:", payFetchError)
        paymentError = payFetchError
      }

      // Get workshop registrations for participants
      let workshopRegistrations = []
      let workshopError = null

      try {
        // Get all participant IDs
        const participantIds = participants.map(p => p.id)
        
        if (participantIds.length > 0) {
          const { data: workshopData, error: wsError } = await supabase
            .from("workshop_registrations")
            .select("*, workshops(*)")
            .in("participant_id", participantIds)

          if (!wsError) {
            workshopRegistrations = workshopData || []
          } else {
            console.error("Error fetching workshop data:", wsError)
            workshopError = wsError
          }
        }
      } catch (wsFetchError) {
        console.error("Error fetching workshop data:", wsFetchError)
        workshopError = wsFetchError
      }

      // Get pricing information
      let pricingInfo = null
      let pricingError = null

      try {
        const { data: pricingData, error: priceError } = await supabase
          .from("pricing")
          .select("*")
          .eq("participant_type", registration.participant_type)
          .single()

        if (!priceError) {
          pricingInfo = pricingData
        } else {
          console.error("Error fetching pricing data:", priceError)
          pricingError = priceError
        }
      } catch (priceFetchError) {
        console.error("Error fetching pricing data:", priceFetchError)
        pricingError = priceFetchError
      }

      // Combine the data
      const registrationWithParticipants = {
        ...registration,
        participants: participants.map(participant => {
          // Find workshops for this participant
          const participantWorkshops = workshopRegistrations
            .filter(wr => wr.participant_id === participant.id)
            .map(wr => ({
              id: wr.workshop_id,
              name: wr.workshops?.name || 'Unknown Workshop',
              price: wr.workshops?.price || 0
            }))

          return {
            ...participant,
            workshops: participantWorkshops
          }
        }),
        pricing: pricingInfo,
        totalAmount: registration.total_amount
      }

      return NextResponse.json({
        success: true,
        registration: registrationWithParticipants,
        payment: payments && payments.length > 0 ? payments[0] : null,
        matchType: "direct_query",
        debug: {
          participantsError: participantsError ? String(participantsError) : null,
          paymentError: paymentError ? String(paymentError) : null,
          workshopError: workshopError ? String(workshopError) : null,
          pricingError: pricingError ? String(pricingError) : null,
        },
      })
    }

    // If we get here, no registration was found
    return NextResponse.json(
      {
        error: "Nomor pendaftaran tidak ditemukan. Pastikan nomor yang dimasukkan benar.",
        searchedFor: searchNumber,
      },
      { status: 404 },
    )
  } catch (error) {
    console.error("Server error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server internal" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Use service role key to bypass RLS
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        persistSession: false,
      },
    })

    const { registrationNumber } = await request.json()

    if (!registrationNumber) {
      return NextResponse.json({ error: "Nomor pendaftaran diperlukan" }, { status: 400 })
    }

    console.log("Checking registration number:", registrationNumber)

    // Clean the input - remove any non-numeric characters if it doesn't start with MCVU-
    let searchNumber = registrationNumber
    if (!searchNumber.startsWith("MCVU-")) {
      const numericPart = registrationNumber.replace(/\D/g, "")
      searchNumber = `MCVU-${numericPart}`
    }

    // Format the registration number to ensure it has the MCVU- prefix
    let formattedRegNumber = registrationNumber
    if (!formattedRegNumber.startsWith("MCVU-")) {
      formattedRegNumber = `MCVU-${formattedRegNumber}`
    }

    // First try direct query which is more reliable
    const { data: directData, error: directError } = await supabase
      .from("registrations")
      .select("id, registration_number, created_at")
      .eq("registration_number", searchNumber)
      .single()

    // If direct query succeeds, use that result
    if (!directError && directData) {
      console.log("Found registration via direct query:", directData)

      // Get registration data without using relationships
      const { data: registration, error: regError } = await supabase
        .from("registrations")
        .select("*")
        .eq("id", directData.id)
        .single()

      if (regError) {
        console.error("Error fetching registration details:", regError)
        return NextResponse.json(
          {
            error: "Gagal mengambil detail pendaftaran",
            details: regError.message,
          },
          { status: 500 },
        )
      }

      // Try to get participants - first check if they're linked by registration_id
      let participants = []
      let participantsError = null

      try {
        // First try using registration_id if it exists
        const { data: participantsData, error: partError } = await supabase
          .from("participants")
          .select("*")
          .eq("registration_id", directData.id)

        if (!partError && participantsData && participantsData.length > 0) {
          participants = participantsData
        } else {
          // If that fails, try using registration_number if it exists
          const { data: altParticipantsData, error: altPartError } = await supabase
            .from("participants")
            .select("*")
            .eq("registration_number", directData.registration_number)

          if (!altPartError && altParticipantsData && altParticipantsData.length > 0) {
            participants = altParticipantsData
          }
        }
      } catch (partFetchError) {
        console.error("Error fetching participants:", partFetchError)
        participantsError = partFetchError
      }

      // Get payment data - only use registration_id
      let payments = []
      let paymentError = null

      try {
        const { data: paymentsData, error: payError } = await supabase
          .from("payments")
          .select("*")
          .eq("registration_id", directData.id)
          .order("created_at", { ascending: false })

        if (!payError) {
          payments = paymentsData || []
        } else {
          console.error("Error fetching payment data:", payError)
          paymentError = payError
        }
      } catch (payFetchError) {
        console.error("Error fetching payment data:", payFetchError)
        paymentError = payFetchError
      }

      // Combine the data
      const registrationWithParticipants = {
        ...registration,
        participants: participants || [],
      }

      return NextResponse.json({
        success: true,
        registration: registrationWithParticipants,
        payment: payments && payments.length > 0 ? payments[0] : null,
        matchType: "direct_query",
        debug: {
          participantsError: participantsError ? String(participantsError) : null,
          paymentError: paymentError ? String(paymentError) : null,
        },
      })
    }

    // If direct query fails, try a more flexible search
    console.log("Direct query failed, trying flexible search")

    // Try with just the numeric part
    const numericPart = registrationNumber.replace(/\D/g, "")
    if (numericPart.length > 0) {
      const { data: flexData, error: flexError } = await supabase
        .from("registrations")
        .select("id, registration_number, created_at")
        .ilike("registration_number", `%${numericPart}%`)
        .limit(1)

      if (!flexError && flexData && flexData.length > 0) {
        console.log("Found registration via flexible search:", flexData[0])

        // Get registration data without using relationships
        const { data: registration, error: regError } = await supabase
          .from("registrations")
          .select("*")
          .eq("id", flexData[0].id)
          .single()

        if (regError) {
          console.error("Error fetching registration details:", regError)
          return NextResponse.json(
            {
              error: "Gagal mengambil detail pendaftaran",
              details: regError.message,
            },
            { status: 500 },
          )
        }

        // Try to get participants - first check if they're linked by registration_id
        let participants = []
        let participantsError = null

        try {
          // First try using registration_id if it exists
          const { data: participantsData, error: partError } = await supabase
            .from("participants")
            .select("*")
            .eq("registration_id", flexData[0].id)

          if (!partError && participantsData && participantsData.length > 0) {
            participants = participantsData
          } else {
            // If that fails, try using registration_number if it exists
            const { data: altParticipantsData, error: altPartError } = await supabase
              .from("participants")
              .select("*")
              .eq("registration_number", flexData[0].registration_number)

            if (!altPartError && altParticipantsData && altParticipantsData.length > 0) {
              participants = altParticipantsData
            }
          }
        } catch (partFetchError) {
          console.error("Error fetching participants:", partFetchError)
          participantsError = partFetchError
        }

        // Get payment data - only use registration_id
        let payments = []
        let paymentError = null

        try {
          const { data: paymentsData, error: payError } = await supabase
            .from("payments")
            .select("*")
            .eq("registration_id", flexData[0].id)
            .order("created_at", { ascending: false })

          if (!payError) {
            payments = paymentsData || []
          } else {
            console.error("Error fetching payment data:", payError)
            paymentError = payError
          }
        } catch (payFetchError) {
          console.error("Error fetching payment data:", payFetchError)
          paymentError = payFetchError
        }

        // Combine the data
        const registrationWithParticipants = {
          ...registration,
          participants: participants || [],
        }

        return NextResponse.json({
          success: true,
          registration: registrationWithParticipants,
          payment: payments && payments.length > 0 ? payments[0] : null,
          matchType: "flexible_search",
          debug: {
            participantsError: participantsError ? String(participantsError) : null,
            paymentError: paymentError ? String(paymentError) : null,
          },
        })
      }
    }

    // If all else fails, try the function (but handle errors gracefully)
    try {
      const { data: functionData, error: functionError } = await supabase.rpc("find_registration_by_number", {
        search_number: registrationNumber,
      })

      if (functionError) {
        console.error("Function error:", functionError)
        // Don't return an error here, continue to the not found response
      } else if (functionData && functionData.length > 0) {
        console.log("Found registration via function:", functionData[0])

        // Get registration data without using relationships
        const { data: registration, error: regError } = await supabase
          .from("registrations")
          .select("*")
          .eq("id", functionData[0].id)
          .single()

        if (regError) {
          console.error("Error fetching registration details:", regError)
          return NextResponse.json(
            {
              error: "Gagal mengambil detail pendaftaran",
              details: regError.message,
            },
            { status: 500 },
          )
        }

        // Try to get participants - first check if they're linked by registration_id
        let participants = []
        let participantsError = null

        try {
          // First try using registration_id if it exists
          const { data: participantsData, error: partError } = await supabase
            .from("participants")
            .select("*")
            .eq("registration_id", functionData[0].id)

          if (!partError && participantsData && participantsData.length > 0) {
            participants = participantsData
          } else {
            // If that fails, try using registration_number if it exists
            const { data: altParticipantsData, error: altPartError } = await supabase
              .from("participants")
              .select("*")
              .eq("registration_number", functionData[0].registration_number)

            if (!altPartError && altParticipantsData && altParticipantsData.length > 0) {
              participants = altParticipantsData
            }
          }
        } catch (partFetchError) {
          console.error("Error fetching participants:", partFetchError)
          participantsError = partFetchError
        }

        // Get payment data - only use registration_id
        let payments = []
        let paymentError = null

        try {
          const { data: paymentsData, error: payError } = await supabase
            .from("payments")
            .select("*")
            .eq("registration_id", functionData[0].id)
            .order("created_at", { ascending: false })

          if (!payError) {
            payments = paymentsData || []
          } else {
            console.error("Error fetching payment data:", payError)
            paymentError = payError
          }
        } catch (payFetchError) {
          console.error("Error fetching payment data:", payFetchError)
          paymentError = payFetchError
        }

        // Combine the data
        const registrationWithParticipants = {
          ...registration,
          participants: participants || [],
        }

        return NextResponse.json({
          success: true,
          registration: registrationWithParticipants,
          payment: payments && payments.length > 0 ? payments[0] : null,
          matchType: "function_search",
          debug: {
            participantsError: participantsError ? String(participantsError) : null,
            paymentError: paymentError ? String(paymentError) : null,
          },
        })
      }
    } catch (functionCallError) {
      console.error("Error calling function:", functionCallError)
      // Don't return an error here, continue to the not found response
    }

    // If we get here, no registration was found
    return NextResponse.json(
      {
        error: "Nomor pendaftaran tidak ditemukan. Pastikan nomor yang dimasukkan benar.",
        searchedFor: searchNumber,
      },
      { status: 404 },
    )
  } catch (error) {
    console.error("Server error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server internal" }, { status: 500 })
  }
}
