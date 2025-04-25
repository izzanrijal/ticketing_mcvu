"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

interface TicketDetails {
  price_student: number
  price_regular: number
  price_corporate: number
  [key: string]: any
}

interface Workshop {
  id: string
  title: string
  price: number
}

interface Participant {
  id: string
  participant_type: string
  attendSymposium: boolean
  workshops: string[]
  full_name?: string
}

interface PaymentSummaryProps {
  participants: Participant[]
  ticketId: string
  promoCode: string
  onPromoCodeChange: (code: string) => void
  setRegistrationData: (data: any) => void
  registrationData: any
}

const PaymentSummary: React.FC<PaymentSummaryProps> = ({
  participants,
  ticketId,
  promoCode,
  onPromoCodeChange,
  setRegistrationData,
  registrationData,
}) => {
  const [ticketDetails, setTicketDetails] = useState<TicketDetails | null>(null)
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [promoError, setPromoError] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<any>(null)
  const [finalAmount, setFinalAmount] = useState(totalAmount)
  const { toast } = useToast()
  const toastRef = useRef(null)

  useEffect(() => {
    toastRef.current = toast
  }, [toast])

  // Calculate final amount after discount
  useEffect(() => {
    let final = totalAmount

    // Apply promo discount if available
    if (appliedPromo) {
      if (appliedPromo.discount_type === "percentage") {
        const discountAmount = totalAmount * (appliedPromo.discount_value / 100)
        final = totalAmount - discountAmount
        setDiscount(discountAmount)
      } else {
        final = totalAmount - appliedPromo.discount_value
        setDiscount(appliedPromo.discount_value)
      }
    } else {
      setDiscount(0)
    }

    setFinalAmount(Math.max(0, final))
  }, [totalAmount, appliedPromo])

  // Fetch ticket and workshop data
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch workshops
        const { data: workshopsData } = await supabase.from("workshops").select("*")
        setWorkshops(workshopsData || [])

        // Fetch ticket details
        if (ticketId) {
          const { data: ticketData } = await supabase.from("tickets").select("*").eq("id", ticketId).single()
          setTicketDetails(ticketData)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }

    fetchData()
  }, [ticketId])

  // Calculate total amount based on selections
  useEffect(() => {
    // Calculate total amount
    let total = 0

    participants.forEach((participant) => {
      // Add ticket price ONLY if symposium is selected
      if (participant.attendSymposium === true && participant.participant_type && ticketDetails) {
        const priceKey = `price_${participant.participant_type}`
        if (ticketDetails[priceKey] !== undefined) {
          total += ticketDetails[priceKey]
        }
      }

      // Add workshop prices
      if (participant.workshops && participant.workshops.length > 0) {
        participant.workshops.forEach((workshopId) => {
          const workshop = workshops.find((w) => w.id === workshopId)
          if (workshop) {
            total += workshop.price
          }
        })
      }
    })

    console.log("Calculated total amount:", total)
    setTotalAmount(total)
  }, [participants, ticketDetails, workshops])

  // Apply promo code
  async function applyPromoCode() {
    if (!promoCode) {
      setPromoError("Masukkan kode promo")
      return
    }

    setPromoLoading(true)
    setPromoError("")

    try {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", promoCode.toUpperCase())
        .eq("is_active", true)
        .single()

      if (error) throw error

      if (!data) {
        setPromoError("Kode promo tidak valid")
        return
      }

      // Check if promo is expired
      const now = new Date()
      if (data.valid_until && new Date(data.valid_until) < now) {
        setPromoError("Kode promo sudah berakhir")
        return
      }

      // Check if promo has reached max usage
      if (data.max_uses && data.used_count >= data.max_uses) {
        setPromoError("Kode promo sudah mencapai batas penggunaan")
        return
      }

      // Check participant type restriction if any
      if (data.participant_type) {
        // Check if any participant matches the required type
        const hasMatchingParticipant = participants.some((p) => p.participant_type === data.participant_type)
        if (!hasMatchingParticipant) {
          setPromoError(`Kode promo hanya berlaku untuk peserta tipe ${data.participant_type}`)
          return
        }
      }

      setAppliedPromo(data)
      toast({
        title: "Promo berhasil diterapkan",
        description: `${data.discount_type === "percentage" ? data.discount_value + "%" : "Rp " + data.discount_value.toLocaleString("id-ID")} diskon`,
      })

      // Store the promo code in registration data
      setRegistrationData({
        ...registrationData,
        promo_code: promoCode.toUpperCase(),
      })
    } catch (error) {
      console.error("Error applying promo code:", error)
      setPromoError("Kode promo tidak valid")
    } finally {
      setPromoLoading(false)
    }
  }

  // Calculate participant subtotal
  const calculateParticipantSubtotal = (participant: Participant) => {
    let subtotal = 0

    // Add symposium price only if selected
    if (participant.attendSymposium === true && participant.participant_type && ticketDetails) {
      const priceKey = `price_${participant.participant_type}`
      if (ticketDetails[priceKey] !== undefined) {
        subtotal += ticketDetails[priceKey]
      }
    }

    // Add workshop prices
    if (participant.workshops && participant.workshops.length > 0) {
      participant.workshops.forEach((workshopId) => {
        const workshop = workshops.find((w) => w.id === workshopId)
        if (workshop) {
          subtotal += workshop.price
        }
      })
    }

    return subtotal
  }

  // Debug log to check values
  useEffect(() => {
    console.log("Current totalAmount:", totalAmount)
    console.log("Current finalAmount:", finalAmount)
    console.log("Applied promo:", appliedPromo)
    console.log("Discount:", discount)
  }, [totalAmount, finalAmount, appliedPromo, discount])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ringkasan Pembayaran</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {participants.map((participant, index) => (
          <div key={participant.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                Peserta {index + 1}: {participant.full_name || "Belum mengisi data"}
              </h3>
              {!participant.attendSymposium && (!participant.workshops || participant.workshops.length === 0) && (
                <Badge variant="destructive">Belum memilih acara</Badge>
              )}
            </div>
            <div className="space-y-1 pl-4 text-sm">
              {/* Symposium item - only show if selected */}
              {participant.attendSymposium === true && participant.participant_type && ticketDetails && (
                <div className="flex justify-between">
                  <span>Simposium: {ticketDetails.name}</span>
                  <span>
                    Rp{" "}
                    {ticketDetails[`price_${participant.participant_type}`]
                      ? ticketDetails[`price_${participant.participant_type}`].toLocaleString("id-ID")
                      : "0"}
                  </span>
                </div>
              )}

              {/* Workshop items */}
              {participant.workshops && participant.workshops.length > 0 && (
                <div className="space-y-1">
                  {participant.workshops.map((workshopId) => {
                    const workshop = workshops.find((w) => w.id === workshopId)
                    if (!workshop) return null
                    return (
                      <div key={workshopId} className="flex justify-between">
                        <span>Workshop: {workshop.title}</span>
                        <span>Rp {workshop.price?.toLocaleString("id-ID") || "0"}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Warning or subtotal */}
              {!participant.full_name ||
              (!participant.attendSymposium && (!participant.workshops || participant.workshops.length === 0)) ? (
                <div className="text-amber-600 text-xs mt-1">
                  {!participant.full_name
                    ? "Silahkan lengkapi data peserta"
                    : "Peserta harus memilih minimal satu acara"}
                </div>
              ) : (
                <div className="flex justify-between font-medium mt-1">
                  <span>Subtotal Peserta {index + 1}</span>
                  <span>Rp {calculateParticipantSubtotal(participant).toLocaleString("id-ID")}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        <Separator />

        {/* Promo code section */}
        <div className="space-y-2 mt-4">
          <Label htmlFor="promo-code">Kode Promo (Opsional)</Label>
          <div className="flex space-x-2">
            <Input
              id="promo-code"
              placeholder="MCVU2025"
              value={promoCode}
              onChange={(e) => onPromoCodeChange(e.target.value)}
              className="uppercase"
              disabled={!!appliedPromo}
            />
            <Button
              type="button"
              onClick={applyPromoCode}
              disabled={promoLoading || !!appliedPromo}
              variant={appliedPromo ? "outline" : "default"}
            >
              {promoLoading ? "Memeriksa..." : appliedPromo ? "Diterapkan" : "Terapkan"}
            </Button>
          </div>
          {promoError && <p className="text-sm text-destructive">{promoError}</p>}
          {appliedPromo && (
            <div className="flex items-center justify-between text-sm">
              <span>Promo: {appliedPromo.code}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAppliedPromo(null)
                  setRegistrationData({
                    ...registrationData,
                    promo_code: "",
                  })
                }}
                className="h-auto p-0 text-destructive"
              >
                Hapus
              </Button>
            </div>
          )}
        </div>

        {/* Total section */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>Rp {totalAmount.toLocaleString("id-ID")}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Diskon</span>
              <span>- Rp {discount.toLocaleString("id-ID")}</span>
            </div>
          )}

          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            {appliedPromo ? (
              <div className="text-right">
                <div className="text-sm line-through text-muted-foreground">
                  Rp {totalAmount.toLocaleString("id-ID")}
                </div>
                <div className="text-green-600">Rp {finalAmount.toLocaleString("id-ID")}</div>
              </div>
            ) : (
              <span>Rp {totalAmount.toLocaleString("id-ID")}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default PaymentSummary
