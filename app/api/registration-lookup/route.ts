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

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 })
    }

    console.log("Mencari registrasi dengan ID:", id)

    // Coba temukan registrasi dengan fungsi get_registration_by_any_id
    try {
      const { data: flexibleData, error: flexibleError } = await supabase.rpc("get_registration_by_any_id", {
        search_id: id,
      })

      if (flexibleError) {
        console.error("Error menggunakan fungsi get_registration_by_any_id:", flexibleError)
      } else if (flexibleData && flexibleData.length > 0) {
        console.log("Registrasi ditemukan dengan get_registration_by_any_id:", flexibleData[0])

        // Dapatkan data registrasi lengkap
        const { data: registration, error: regError } = await supabase
          .from("registrations")
          .select("*")
          .eq("id", flexibleData[0].id)
          .single()

        if (regError) {
          console.error("Error mengambil data registrasi:", regError)
          return NextResponse.json(
            {
              error: "Gagal mengambil detail pendaftaran",
              details: regError.message,
            },
            { status: 500 },
          )
        }

        // Dapatkan data peserta
        const { data: participants, error: partError } = await supabase
          .from("participants")
          .select("*")
          .eq("registration_id", flexibleData[0].id)

        if (partError) {
          console.error("Error mengambil data peserta:", partError)
        }

        // Dapatkan data pembayaran
        const { data: payments, error: payError } = await supabase
          .from("payments")
          .select("*")
          .eq("registration_id", flexibleData[0].id)
          .order("created_at", { ascending: false })

        if (payError) {
          console.error("Error mengambil data pembayaran:", payError)
        }

        return NextResponse.json({
          success: true,
          registration,
          participants: participants || [],
          payment: payments && payments.length > 0 ? payments[0] : null,
          matchType: flexibleData[0].match_type,
        })
      }
    } catch (functionError) {
      console.error("Error memanggil fungsi get_registration_by_any_id:", functionError)
      // Lanjutkan ke metode pencarian lain
    }

    // Coba temukan dengan query langsung
    const { data: directData, error: directError } = await supabase
      .from("registrations")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (!directError && directData) {
      console.log("Registrasi ditemukan dengan query langsung:", directData)

      // Dapatkan data peserta
      const { data: participants, error: partError } = await supabase
        .from("participants")
        .select("*")
        .eq("registration_id", directData.id)

      if (partError) {
        console.error("Error mengambil data peserta:", partError)
      }

      // Dapatkan data pembayaran
      const { data: payments, error: payError } = await supabase
        .from("payments")
        .select("*")
        .eq("registration_id", directData.id)
        .order("created_at", { ascending: false })

      if (payError) {
        console.error("Error mengambil data pembayaran:", payError)
      }

      return NextResponse.json({
        success: true,
        registration: directData,
        participants: participants || [],
        payment: payments && payments.length > 0 ? payments[0] : null,
        matchType: "direct_query",
      })
    }

    // Coba temukan sebagai ID pembayaran
    const { data: paymentData, error: paymentError } = await supabase
      .from("payments")
      .select("registration_id")
      .eq("id", id)
      .maybeSingle()

    if (!paymentError && paymentData && paymentData.registration_id) {
      console.log("Ditemukan sebagai ID pembayaran dengan registration_id:", paymentData.registration_id)

      // Dapatkan data registrasi
      const { data: registration, error: regError } = await supabase
        .from("registrations")
        .select("*")
        .eq("id", paymentData.registration_id)
        .single()

      if (regError) {
        console.error("Error mengambil data registrasi:", regError)
        return NextResponse.json(
          {
            error: "Gagal mengambil detail pendaftaran",
            details: regError.message,
          },
          { status: 500 },
        )
      }

      // Dapatkan data peserta
      const { data: participants, error: partError } = await supabase
        .from("participants")
        .select("*")
        .eq("registration_id", paymentData.registration_id)

      if (partError) {
        console.error("Error mengambil data peserta:", partError)
      }

      // Dapatkan data pembayaran
      const { data: payments, error: payError } = await supabase
        .from("payments")
        .select("*")
        .eq("registration_id", paymentData.registration_id)
        .order("created_at", { ascending: false })

      if (payError) {
        console.error("Error mengambil data pembayaran:", payError)
      }

      return NextResponse.json({
        success: true,
        registration,
        participants: participants || [],
        payment: payments && payments.length > 0 ? payments[0] : null,
        matchType: "payment_id",
      })
    }

    // Coba temukan sebagai ID peserta
    const { data: participantData, error: participantError } = await supabase
      .from("participants")
      .select("registration_id")
      .eq("id", id)
      .maybeSingle()

    if (!participantError && participantData && participantData.registration_id) {
      console.log("Ditemukan sebagai ID peserta dengan registration_id:", participantData.registration_id)

      // Dapatkan data registrasi
      const { data: registration, error: regError } = await supabase
        .from("registrations")
        .select("*")
        .eq("id", participantData.registration_id)
        .single()

      if (regError) {
        console.error("Error mengambil data registrasi:", regError)
        return NextResponse.json(
          {
            error: "Gagal mengambil detail pendaftaran",
            details: regError.message,
          },
          { status: 500 },
        )
      }

      // Dapatkan data peserta
      const { data: participants, error: partError } = await supabase
        .from("participants")
        .select("*")
        .eq("registration_id", participantData.registration_id)

      if (partError) {
        console.error("Error mengambil data peserta:", partError)
      }

      // Dapatkan data pembayaran
      const { data: payments, error: payError } = await supabase
        .from("payments")
        .select("*")
        .eq("registration_id", participantData.registration_id)
        .order("created_at", { ascending: false })

      if (payError) {
        console.error("Error mengambil data pembayaran:", payError)
      }

      return NextResponse.json({
        success: true,
        registration,
        participants: participants || [],
        payment: payments && payments.length > 0 ? payments[0] : null,
        matchType: "participant_id",
      })
    }

    // Coba akses view khusus untuk ID aa880d3c-25fe-46e1-897d-ea1022c0fdea
    if (id === "aa880d3c-25fe-46e1-897d-ea1022c0fdea") {
      try {
        const { data: specialData, error: specialError } = await supabase.from("registration_aa880d3c").select("*")

        if (!specialError && specialData && specialData.length > 0) {
          console.log("Ditemukan melalui view khusus:", specialData[0])

          return NextResponse.json({
            success: true,
            registration: specialData[0],
            participants: [],
            payment: null,
            matchType: "special_view",
          })
        }
      } catch (viewError) {
        console.error("Error mengakses view khusus:", viewError)
      }
    }

    // Jika semua metode gagal
    return NextResponse.json(
      {
        error: "Registrasi tidak ditemukan. Silakan periksa ID yang dimasukkan.",
        searchedFor: id,
      },
      { status: 404 },
    )
  } catch (error) {
    console.error("Server error:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server internal" }, { status: 500 })
  }
}
