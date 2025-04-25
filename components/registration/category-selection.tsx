"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { CreditCard, Building2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"

const formSchema = z.object({
  ticket_id: z.string({
    required_error: "Pilih jenis tiket",
  }),
  participant_count: z.coerce
    .number()
    .min(1, {
      message: "Minimal 1 peserta",
    })
    .max(10, {
      message: "Maksimal 10 peserta",
    }),
  payment_type: z.enum(["self", "sponsor"], {
    required_error: "Pilih tipe pembayaran",
  }),
  sponsor_letter: z.any().optional(),
})

type FormValues = z.infer<typeof formSchema>

type CategorySelectionProps = {
  onNext: (data: FormValues) => void
}

export function CategorySelection({ onNext }: CategorySelectionProps) {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      participant_count: 1,
      payment_type: "self",
    },
  })

  useEffect(() => {
    async function fetchTickets() {
      try {
        const { data, error } = await supabase.from("tickets").select("*").order("sort_order", { ascending: true })

        if (error) {
          console.error("Error fetching tickets:", error)
          return
        }

        setTickets(data || [])
      } catch (error) {
        console.error("Error fetching tickets:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTickets()
  }, [supabase])

  function onSubmit(data: FormValues) {
    // Manual validation for sponsor letter when payment type is sponsor
    if (data.payment_type === "sponsor") {
      if (!data.sponsor_letter) {
        form.setError("sponsor_letter", {
          type: "custom",
          message: "Surat jaminan sponsor wajib diupload",
        })
        return
      }

      const file = data.sponsor_letter as File

      // Validate file type
      if (file.type !== "application/pdf") {
        form.setError("sponsor_letter", {
          type: "custom",
          message: "File harus berformat PDF",
        })
        return
      }

      // Validate file size (3MB)
      if (file.size > 3 * 1024 * 1024) {
        form.setError("sponsor_letter", {
          type: "custom",
          message: "Ukuran file maksimal 3MB",
        })
        return
      }
    }

    onNext(data)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Pilih Jumlah Peserta & Metode Pembayaran</h2>
        <p className="text-muted-foreground">Tentukan jumlah peserta dan metode pembayaran yang akan digunakan</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Ticket Type Selection Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Jenis Tiket</h3>
            <FormField
              control={form.control}
              name="ticket_id"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                      {loading ? (
                        // Skeletons while loading
                        Array.from({ length: 3 }).map((_, index) => (
                          <Skeleton key={index} className="h-24 w-full" />
                        ))
                      ) : tickets.length > 0 ? (
                        tickets.map((ticket) => (
                          <FormItem key={ticket.id} className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <Card
                                className={`w-full cursor-pointer transition-all hover:opacity-90 border ${
                                  field.value === ticket.id ? "ring-2 ring-primary border-primary" : ""
                                }`}
                                onClick={() => field.onChange(ticket.id)}
                              >
                                <CardHeader className="p-4">
                                  <div className="flex items-center justify-between">
                                    <FormLabel className="font-medium cursor-pointer">{ticket.name}</FormLabel>
                                    <RadioGroupItem value={ticket.id} className="sr-only" />
                                  </div>
                                  <CardDescription className="text-xs">{ticket.description}</CardDescription>
                                </CardHeader>
                                {/* Optionally display prices if needed, requires fetching participant types */}
                              </Card>
                            </FormControl>
                          </FormItem>
                        ))
                      ) : (
                        <p className="text-muted-foreground col-span-full">Tidak ada tiket yang tersedia saat ini.</p>
                      )}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Participant Count Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Jumlah Peserta</h3>
            <FormField
              control={form.control}
              name="participant_count"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newValue = Math.max(1, Number.parseInt(field.value.toString()) - 1)
                          field.onChange(newValue)
                        }}
                        disabled={field.value <= 1}
                      >
                        -
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        {...field}
                        className="w-20 text-center"
                        onChange={(e) => {
                          const value = Number.parseInt(e.target.value)
                          if (!isNaN(value)) {
                            if (value < 1) field.onChange(1)
                            else if (value > 10) field.onChange(10)
                            else field.onChange(value)
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newValue = Math.min(10, Number.parseInt(field.value.toString()) + 1)
                          field.onChange(newValue)
                        }}
                        disabled={field.value >= 10}
                      >
                        +
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>Masukkan jumlah peserta yang akan didaftarkan (maksimal 10)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Payment Type Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Metode Pembayaran</h3>
            <FormField
              control={form.control}
              name="payment_type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Pilih metode pembayaran</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {/* Self Payment Option */}
                      <div
                        className={`cursor-pointer transition-all hover:opacity-90 ${
                          field.value === "self" ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => field.onChange("self")}
                      >
                        <Card className={`h-full border ${field.value === "self" ? "border-primary" : ""}`}>
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2">
                              <CreditCard className="h-5 w-5" />
                              Bayar Sendiri
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <CardDescription>Pembayaran dilakukan langsung oleh peserta</CardDescription>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Sponsor Payment Option */}
                      <div
                        className={`cursor-pointer transition-all hover:opacity-90 ${
                          field.value === "sponsor" ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => field.onChange("sponsor")}
                      >
                        <Card className={`h-full border ${field.value === "sponsor" ? "border-primary" : ""}`}>
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2">
                              <Building2 className="h-5 w-5" />
                              Dibayarkan Sponsor
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <CardDescription>Pembayaran dilakukan oleh institusi/sponsor</CardDescription>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {form.watch("payment_type") === "sponsor" && (
            <FormField
              control={form.control}
              name="sponsor_letter"
              render={({ field: { value, onChange, ...fieldProps } }) => (
                <FormItem>
                  <FormLabel>
                    Surat Jaminan Sponsor <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="flex flex-col gap-2">
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            onChange(file)

                            // Clear any previous errors when a new file is selected
                            form.clearErrors("sponsor_letter")
                          }
                        }}
                        {...fieldProps}
                      />
                      {value && (
                        <div className="text-sm text-green-600">
                          File dipilih: {value instanceof File ? value.name : ""}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Upload surat jaminan dari sponsor/institusi (format PDF, maksimal 3MB)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <div className="flex justify-end">
            <Button type="submit">Lanjut</Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
