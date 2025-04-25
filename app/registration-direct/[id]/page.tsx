import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export default async function RegistrationDirectPage({
  params,
}: {
  params: { id: string }
}) {
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
    console.log("Direct access: Attempting to find registration with ID:", params.id)

    // Try to find the registration directly by ID
    const { data: registration, error } = await supabase
      .from("registrations")
      .select("id")
      .eq("id", params.id)
      .maybeSingle()

    if (error) {
      console.error("Error finding registration:", error)
    }

    if (registration) {
      console.log("Found registration, redirecting to details page")
      redirect(`/registration-details/${registration.id}`)
      return null
    }

    // Try manual case-insensitive search since the function might not exist
    console.log("Trying manual case-insensitive search")
    const { data: allRegistrations, error: allRegistrationsError } = await supabase
      .from("registrations")
      .select("id, registration_number, created_at")
      .order("created_at", { ascending: false })
      .limit(100) // Get a reasonable number of registrations to search through

    if (allRegistrationsError) {
      console.error("Error fetching registrations:", allRegistrationsError)
    } else if (allRegistrations && allRegistrations.length > 0) {
      // Manually search for case-insensitive match
      const matchingRegistration = allRegistrations.find((reg) => reg.id.toLowerCase() === params.id.toLowerCase())

      if (matchingRegistration) {
        console.log("Found registration via manual case-insensitive search, redirecting to details page")
        redirect(`/registration-details/${matchingRegistration.id}`)
        return null
      }
    }

    // Try to find by payment
    console.log("Trying to find via payment")
    const { data: paymentData, error: paymentError } = await supabase
      .from("payments")
      .select("registration_id")
      .eq("id", params.id)
      .maybeSingle()

    if (paymentError) {
      console.error("Error finding payment:", paymentError)
    }

    if (paymentData && paymentData.registration_id) {
      console.log("Found registration via payment, redirecting to details page")
      redirect(`/registration-details/${paymentData.registration_id}`)
      return null
    }

    // If all else fails, redirect to the check status page
    console.log("Could not find registration, redirecting to check status page")
    redirect("/check-status")
    return null
  } catch (error) {
    console.error("Error in direct access page:", error)
    redirect("/check-status")
    return null
  }
}
