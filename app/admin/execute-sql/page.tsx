"use client"

import { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Play } from "lucide-react"
import { DashboardLayout } from "@/components/admin/dashboard-layout"

export default function ExecuteSqlPage() {
  const [sql, setSql] = useState(`-- Function to find a registration by ID (case-insensitive)
CREATE OR REPLACE FUNCTION public.find_registration_by_id(search_id text)
RETURNS TABLE (
  id uuid,
  registration_number text,
  created_at timestamptz
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.registration_number, r.created_at
  FROM public.registrations r
  WHERE LOWER(r.id::text) = LOWER(search_id)
  ORDER BY r.created_at DESC;
END;
$$;

-- Function to fix registration relationships
CREATE OR REPLACE FUNCTION public.fix_registration_relationships(reg_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  result text;
  reg_count int;
  payment_count int;
  participant_count int;
BEGIN
  -- Check if registration exists
  SELECT COUNT(*) INTO reg_count FROM public.registrations WHERE id = reg_id;
  
  IF reg_count = 0 THEN
    RETURN 'Registration not found';
  END IF;
  
  -- Fix payments relationship
  UPDATE public.payments
  SET registration_id = reg_id
  WHERE id = reg_id;
  
  GET DIAGNOSTICS payment_count = ROW_COUNT;
  
  -- Fix participants relationship
  UPDATE public.participants
  SET registration_id = reg_id
  WHERE id = reg_id;
  
  GET DIAGNOSTICS participant_count = ROW_COUNT;
  
  result := 'Fixed ' || payment_count || ' payment(s) and ' || participant_count || ' participant(s) relationships';
  RETURN result;
END;
$$;`)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClientComponentClient()

  const executeSQL = async () => {
    if (!sql.trim()) {
      setError("Please enter SQL to execute")
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Execute the SQL directly
      const { data, error: execError } = await supabase.rpc("execute_sql", {
        sql_query: sql,
      })

      if (execError) {
        console.error("Error executing SQL:", execError)
        setError(`Error executing SQL: ${execError.message}`)
        return
      }

      setResult(data)
    } catch (err: any) {
      console.error("Error in SQL execution:", err)
      setError(`Error in SQL execution: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="container py-10">
        <h1 className="text-3xl font-bold mb-6">Execute SQL</h1>

        <Card>
          <CardHeader>
            <CardTitle>SQL Query</CardTitle>
            <CardDescription>Enter SQL to execute (use with caution)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                placeholder="Enter SQL here..."
                className="font-mono h-80"
              />

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {result && (
                <Alert variant="success" className="border-green-200 bg-green-50 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>
                    {typeof result === "object" ? JSON.stringify(result, null, 2) : result}
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={executeSQL} disabled={loading} className="flex gap-2">
                {loading ? "Executing..." : "Execute SQL"}
                {!loading && <Play className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
