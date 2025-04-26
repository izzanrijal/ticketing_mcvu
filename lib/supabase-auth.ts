import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"

// This is not a server action anymore, just a regular function
export async function createServerSupabaseClient() {
  // Get the cookie store instance once and await it
  const cookieStore = await cookies()

  // Create a Supabase client for server-side usage
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Use the cookieStore instance obtained above
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Use the cookieStore instance obtained above
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          // Use the cookieStore instance obtained above
          cookieStore.set({ name, value: "", ...options })
        },
      },
    }
  )
}
