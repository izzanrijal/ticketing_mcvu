import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { PaymentDetails } from "@/components/payment-details"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Pembayaran - MCVU XXIII 2025",
  description: "Instruksi pembayaran untuk MCVU XXIII 2025",
}

async function getRegistration(id: string) {
  console.log("Server: Fetching registration with ID:", id)

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options })
        },
      },
    },
  )

  try {
    // Use raw SQL to avoid relationship issues
    const query = `
      SELECT 
        r.*,
        COALESCE(json_agg(p.*) FILTER (WHERE p.id IS NOT NULL), '[]') as payments,
        (
          SELECT json_agg(ri.*)
          FROM registration_items ri
          WHERE ri.parent_registration_id = r.id OR ri.registration_id = r.id
        ) as registration_items
      FROM 
        registrations r
      LEFT JOIN 
        payments p ON p.registration_id = r.id
      WHERE 
        r.id = '${id}'
      GROUP BY 
        r.id
    `

    try {
      // Try using execute_sql function if available
      const { data, error } = await supabase.rpc("execute_sql", { query_text: query })

      if (!error && data && data.length > 0) {
        console.log("Server: Registration data fetched successfully using SQL")

        // Fetch tickets separately
        const registrationData = data[0]

        if (!registrationData || Object.keys(registrationData).length === 0) {
          console.error("Server: Empty registration data for ID:", id)
          return null
        }

        const ticketIds = []

        if (registrationData.registration_items) {
          for (const item of registrationData.registration_items) {
            if (item.ticket_id) {
              ticketIds.push(item.ticket_id)
            }
          }
        }

        if (ticketIds.length > 0) {
          const { data: ticketsData } = await supabase.from("tickets").select("*").in("id", ticketIds)

          if (ticketsData) {
            // Attach ticket data to registration items
            registrationData.registration_items = registrationData.registration_items.map((item) => {
              if (item.ticket_id) {
                const ticket = ticketsData.find((t) => t.id === item.ticket_id)
                return { ...item, ticket }
              }
              return item
            })
          }
        }

        return registrationData
      }
    } catch (rpcError) {
      console.error("Server: RPC error:", rpcError)
      // Continue to fallback approach
    }

    // Fallback: Use separate queries
    console.log("Server: Falling back to separate queries")

    // Step 1: Fetch the registration
    const { data: registrationData, error: registrationError } = await supabase
      .from("registrations")
      .select("*")
      .eq("id", id)
      .single()

    if (registrationError) {
      console.error("Server: Error fetching registration:", registrationError)
      return null
    }

    if (!registrationData || Object.keys(registrationData).length === 0) {
      console.error("Server: Empty registration data for ID:", id)
      return null
    }

    if (!registrationData) {
      console.error("Server: No registration found with ID:", id)
      return null
    }

    // Step 2: Fetch payments
    const { data: paymentsData } = await supabase.from("payments").select("*").eq("registration_id", id)

    // Step 3: Fetch registration items
    const { data: itemsData } = await supabase
      .from("registration_items")
      .select(`
        *,
        participant:participants (*)
      `)
      .or(`parent_registration_id.eq.${id},registration_id.eq.${id}`)

    // Step 4: Fetch tickets
    const ticketIds = itemsData?.filter((item) => item.ticket_id).map((item) => item.ticket_id) || []

    let ticketsData = []
    if (ticketIds.length > 0) {
      const { data } = await supabase.from("tickets").select("*").in("id", ticketIds)

      ticketsData = data || []
    }

    // Step 5: Combine all data
    const result = {
      ...registrationData,
      payments: paymentsData || [],
      registration_items:
        itemsData?.map((item) => {
          if (item.ticket_id) {
            const ticket = ticketsData.find((t) => t.id === item.ticket_id)
            return { ...item, ticket }
          }
          return item
        }) || [],
    }

    if (!result.registration_items || result.registration_items.length === 0) {
      console.warn("Server: No registration items found for registration:", id)
      result.registration_items = []
    }

    if (!result.payments || result.payments.length === 0) {
      console.warn("Server: No payments found for registration:", id)
      result.payments = []
    }

    console.log("Server: Registration data fetched successfully using separate queries")
    return result
  } catch (error) {
    console.error("Server: Error in getRegistration:", error)
    console.error("Server: Error stack:", error.stack)
    return null
  }
}

export default async function PaymentPage({
  params,
}: {
  params: { id: string }
}) {
  const registration = await getRegistration(params.id)

  if (!registration) {
    notFound()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold md:text-4xl">Instruksi Pembayaran</h1>
              <p className="mt-2 text-muted-foreground">Silakan selesaikan pembayaran Anda</p>
            </div>
            <PaymentDetails registration={registration} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
