import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"

// This is not a server action anymore, just a regular function
export function createServerSupabaseClient() {
  // This function should only be used in server components or server actions
  // It should not be directly called in client components
  
  // Create a Supabase client for server-side usage
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookieStore = cookies()
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          const cookieStore = cookies()
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          const cookieStore = cookies()
          cookieStore.set({ name, value: "", ...options })
        },
      },
    }
  )
}
