"use client"

import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react"

export function SupabaseConnectionTest() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [tables, setTables] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const supabase = createClientComponentClient()

  async function testConnection() {
    setIsLoading(true)
    setError(null)

    try {
      // Simple query to test connection
      const { data, error } = await supabase.from("tickets").select("id").limit(1)

      if (error) throw error

      setIsConnected(true)

      // Get list of tables to display
      const { data: tablesData, error: tablesError } = await supabase
        .from("pg_tables")
        .select("tablename")
        .eq("schemaname", "public")

      if (tablesError) {
        console.error("Error fetching tables:", tablesError)
      } else {
        setTables(tablesData?.map((t) => t.tablename) || [])
      }
    } catch (err: any) {
      console.error("Connection error:", err)
      setIsConnected(false)
      setError(err.message || "Terjadi kesalahan saat menghubungkan ke Supabase")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    testConnection()
  }, [])

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Tes Koneksi Supabase</CardTitle>
        <CardDescription>Memverifikasi koneksi ke database Supabase Anda</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Menguji koneksi...</span>
          </div>
        ) : isConnected === null ? (
          <div className="py-6 text-center text-muted-foreground">Memulai pengujian koneksi...</div>
        ) : isConnected ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Berhasil Terhubung</AlertTitle>
            <AlertDescription className="text-green-700">
              Aplikasi Anda berhasil terhubung ke Supabase.
              {tables.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Tabel yang tersedia:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {tables.map((table) => (
                      <li key={table}>{table}</li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Koneksi Gagal</AlertTitle>
            <AlertDescription>
              {error || "Tidak dapat terhubung ke Supabase. Silakan periksa kredensial Anda."}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={testConnection} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Menguji...
            </>
          ) : (
            "Uji Koneksi Lagi"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
