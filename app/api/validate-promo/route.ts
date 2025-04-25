import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        persistSession: false,
      },
    })

    const { code, participantTypes, totalAmount } = await request.json()

    if (!code) {
      return NextResponse.json({ valid: false, message: "Kode promo tidak boleh kosong" }, { status: 400 })
    }

    // Get promo details
    const { data: promo, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
      .single()

    if (error || !promo) {
      return NextResponse.json({ valid: false, message: "Kode promo tidak valid" }, { status: 404 })
    }

    // Check if promo is expired
    const now = new Date()
    if (promo.valid_until && new Date(promo.valid_until) < now) {
      return NextResponse.json({ valid: false, message: "Kode promo sudah berakhir" }, { status: 400 })
    }

    // Check if promo hasn't started yet
    if (promo.valid_from && new Date(promo.valid_from) > now) {
      return NextResponse.json({ valid: false, message: "Kode promo belum berlaku" }, { status: 400 })
    }

    // Check if promo has reached max usage
    if (promo.max_uses && promo.used_count >= promo.max_uses) {
      return NextResponse.json({ valid: false, message: "Kode promo sudah mencapai batas penggunaan" }, { status: 400 })
    }

    // Check participant type restriction if any
    if (promo.participant_type && participantTypes && participantTypes.length > 0) {
      const hasMatchingParticipant = participantTypes.includes(promo.participant_type)
      if (!hasMatchingParticipant) {
        return NextResponse.json(
          { valid: false, message: `Kode promo hanya berlaku untuk peserta tipe ${promo.participant_type}` },
          { status: 400 },
        )
      }
    }

    // Calculate discount
    let discountAmount = 0
    if (promo.discount_type === "percentage") {
      discountAmount = Math.round(totalAmount * (promo.discount_value / 100))
    } else {
      discountAmount = promo.discount_value
    }

    const finalAmount = Math.max(0, totalAmount - discountAmount)

    return NextResponse.json({
      valid: true,
      promo: {
        id: promo.id,
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        participant_type: promo.participant_type,
      },
      discount_amount: discountAmount,
      final_amount: finalAmount,
    })
  } catch (error) {
    console.error("Error validating promo code:", error)
    return NextResponse.json({ valid: false, message: "Server error" }, { status: 500 })
  }
}
