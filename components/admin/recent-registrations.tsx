"use client"

import { useEffect, useState } from "react"
import React from 'react';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function AdminRecentRegistrations() {
  const [registrations, setRegistrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchRegistrations() {
      try {
        // Use a raw SQL query with explicit table aliases to avoid ambiguity
        const query = `
          SELECT 
            r.id, 
            r.registration_number, 
            r.created_at, 
            r.final_amount,
            p.status as payment_status,
            part.id as participant_id,
            part.full_name,
            part.email,
            part.participant_type
          FROM 
            registrations r
          LEFT JOIN 
            payments p ON p.registration_id = r.id
          LEFT JOIN 
            participants part ON part.registration_id = r.id
          ORDER BY 
            r.created_at DESC
          LIMIT 10
        `

        const { data, error } = await supabase.rpc("execute_sql", { query_text: query })

        if (error) throw error

        // Process the data to match the expected format
        const enhancedRegistrations = data.map((item: any) => {
          return {
            id: item.id,
            registration_number: item.registration_number,
            created_at: item.created_at,
            final_amount: item.final_amount,
            payment_status: item.payment_status || "pending",
            participant: item.participant_id
              ? {
                  id: item.participant_id,
                  full_name: item.full_name,
                  email: item.email,
                  participant_type: item.participant_type,
                }
              : null,
          }
        })

        setRegistrations(enhancedRegistrations)
      } catch (error) {
        console.error("Error fetching registrations:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRegistrations()

    // Set up realtime subscription
    const channel = supabase
      .channel("registrations-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registrations",
        },
        () => {
          fetchRegistrations()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function getParticipantTypeLabel(type: string) {
    switch (type) {
      case "specialist_doctor":
        return "Dokter Spesialis"
      case "general_doctor":
        return "Dokter Umum"
      case "nurse":
        return "Perawat"
      case "student":
        return "Mahasiswa"
      default:
        return "Lainnya"
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Menunggu</Badge>
      case "verified":
        return <Badge variant="secondary">Terverifikasi</Badge>
      case "rejected":
        return <Badge variant="destructive">Ditolak</Badge>
      default:
        return <Badge variant="outline">Menunggu</Badge>
    }
  }

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Registrasi</TableHead>
              <TableHead>Peserta</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7} className="h-12 animate-pulse bg-muted"></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>No. Registrasi</TableHead>
            <TableHead>Peserta</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead>Jumlah</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {registrations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                Belum ada pendaftaran
              </TableCell>
            </TableRow>
          ) : (
            registrations.map((registration, index) => (
              <React.Fragment key={`${registration.id}-${index}`}>
                <TableRow>
                  <TableCell className="font-medium">{registration.registration_number}</TableCell>
                  <TableCell>
                    {registration.participant?.full_name || "N/A"}
                    <div className="text-xs text-muted-foreground">{registration.participant?.email || "N/A"}</div>
                  </TableCell>
                  <TableCell>
                    {registration.participant
                      ? getParticipantTypeLabel(registration.participant.participant_type)
                      : "N/A"}
                  </TableCell>
                  <TableCell>Rp {registration.final_amount.toLocaleString("id-ID")}</TableCell>
                  <TableCell>{getStatusBadge(registration.payment_status)}</TableCell>
                  <TableCell>{formatDate(registration.created_at)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      Detail
                    </Button>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
