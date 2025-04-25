"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

export default function DatabaseSchema() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tables, setTables] = useState<any[]>([])
  const [foreignKeys, setForeignKeys] = useState<any[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableColumns, setTableColumns] = useState<any[]>([])
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchSchema() {
      try {
        setLoading(true)

        // Fetch tables
        const { data: tablesData, error: tablesError } = await supabase
          .from("information_schema.tables")
          .select("table_name")
          .eq("table_schema", "public")
          .order("table_name")

        if (tablesError) throw tablesError

        // Fetch foreign keys
        const { data: fkData, error: fkError } = await supabase
          .from("information_schema.table_constraints")
          .select(`
            constraint_name,
            table_name,
            constraint_type
          `)
          .eq("constraint_type", "FOREIGN KEY")
          .eq("table_schema", "public")

        if (fkError) throw fkError

        // Get more details about foreign keys
        const { data: fkDetailsData, error: fkDetailsError } = await supabase
          .from("information_schema.key_column_usage")
          .select(`
            constraint_name,
            table_name,
            column_name,
            referenced_table_name,
            referenced_column_name
          `)
          .in(
            "constraint_name",
            fkData.map((fk) => fk.constraint_name),
          )

        if (fkDetailsError) throw fkDetailsError

        setTables(tablesData)
        setForeignKeys(fkDetailsData)

        if (tablesData.length > 0) {
          setSelectedTable(tablesData[0].table_name)
        }
      } catch (err: any) {
        console.error("Error fetching schema:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSchema()
  }, [supabase])

  useEffect(() => {
    async function fetchTableColumns() {
      if (!selectedTable) return

      try {
        const { data, error } = await supabase
          .from("information_schema.columns")
          .select(`
            column_name,
            data_type,
            is_nullable,
            column_default
          `)
          .eq("table_schema", "public")
          .eq("table_name", selectedTable)
          .order("ordinal_position")

        if (error) throw error

        setTableColumns(data)
      } catch (err: any) {
        console.error(`Error fetching columns for ${selectedTable}:`, err)
        setError(err.message)
      }
    }

    fetchTableColumns()
  }, [selectedTable, supabase])

  const getRelationshipsForTable = (tableName: string) => {
    return foreignKeys.filter((fk) => fk.table_name === tableName || fk.referenced_table_name === tableName)
  }

  const fixRegistrationParticipantsRelationship = async () => {
    try {
      setLoading(true)

      // Execute the SQL to fix the relationship
      const { data, error } = await supabase.rpc("execute_sql", {
        sql: `
          -- Check if the foreign key constraint exists and create it if it doesn't
          DO $$
          BEGIN
            -- Check if the foreign key constraint already exists
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints 
              WHERE constraint_name = 'participants_registration_id_fkey' 
              AND table_name = 'participants'
            ) THEN
              -- Add the foreign key constraint
              ALTER TABLE participants
              ADD CONSTRAINT participants_registration_id_fkey
              FOREIGN KEY (registration_id)
              REFERENCES registrations(id)
              ON DELETE CASCADE;
            END IF;
          END $$;
        `,
      })

      if (error) throw error

      // Refresh the data
      window.location.reload()
    } catch (err: any) {
      console.error("Error fixing relationship:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Database Schema Diagnostic</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Tables</CardTitle>
            <CardDescription>Database tables in the public schema</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-1">
                {tables.map((table) => (
                  <Button
                    key={table.table_name}
                    variant={selectedTable === table.table_name ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setSelectedTable(table.table_name)}
                  >
                    {table.table_name}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{selectedTable || "Table Details"}</CardTitle>
            <CardDescription>Columns and relationships</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : selectedTable ? (
              <Tabs defaultValue="columns">
                <TabsList>
                  <TabsTrigger value="columns">Columns</TabsTrigger>
                  <TabsTrigger value="relationships">Relationships</TabsTrigger>
                </TabsList>

                <TabsContent value="columns" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Column Name</TableHead>
                        <TableHead>Data Type</TableHead>
                        <TableHead>Nullable</TableHead>
                        <TableHead>Default</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableColumns.map((column) => (
                        <TableRow key={column.column_name}>
                          <TableCell className="font-medium">{column.column_name}</TableCell>
                          <TableCell>{column.data_type}</TableCell>
                          <TableCell>{column.is_nullable === "YES" ? "Yes" : "No"}</TableCell>
                          <TableCell>{column.column_default || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="relationships" className="mt-4">
                  {getRelationshipsForTable(selectedTable).length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Constraint Name</TableHead>
                          <TableHead>From Table</TableHead>
                          <TableHead>From Column</TableHead>
                          <TableHead>To Table</TableHead>
                          <TableHead>To Column</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getRelationshipsForTable(selectedTable).map((fk) => (
                          <TableRow key={fk.constraint_name}>
                            <TableCell className="font-medium">{fk.constraint_name}</TableCell>
                            <TableCell>{fk.table_name}</TableCell>
                            <TableCell>{fk.column_name}</TableCell>
                            <TableCell>{fk.referenced_table_name}</TableCell>
                            <TableCell>{fk.referenced_column_name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Alert>
                      <AlertDescription>No relationships found for this table.</AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <Alert>
                <AlertDescription>Select a table to view its details.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      <Card>
        <CardHeader>
          <CardTitle>Quick Fixes</CardTitle>
          <CardDescription>Apply fixes to common database issues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border rounded-md">
              <h3 className="font-medium mb-2">Fix Registrations-Participants Relationship</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This will add the foreign key constraint between the registrations and participants tables if it doesn't
                exist. This fixes the "Could not find a relationship between 'registrations' and 'participants'" error.
              </p>
              <Button onClick={fixRegistrationParticipantsRelationship} disabled={loading}>
                {loading ? "Applying Fix..." : "Apply Fix"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
