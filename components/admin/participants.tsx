"use client"; // Re-add the missing directive
import React from 'react'; // Add missing React import
import { useEffect, useState, useCallback } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Download, Search, RotateCw as ReloadIcon } from "lucide-react"
import * as XLSX from 'xlsx';

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"

interface ParticipantData {
  participant_id: string;
  registration_id: string | null;
  registration_number: string | null;
  registration_date: string | null;
  final_amount: number | null;
  promo_code_id: string | null;
  registration_status: string | null; // Status from registrations table
  created_at: string | null; // Participant creation date
  full_name: string | null;
  email: string | null;
  phone: string | null;
  participant_type: string | null;
  institution: string | null;
  nik: string | null;
  qr_code_id: string | null;
  payment_note: string | null; // Note from payments table
}

// Define participant type mapping for display
const participantTypeMap: { [key: string]: string } = {
  'specialist_doctor': 'Dokter Spesialis',
  'general_doctor': 'Dokter Umum',
  'nurse': 'Perawat',
  'student': 'Mahasiswa',
  'other': 'Dokter Residen',
};

export function AdminParticipants() {
  // Log environment variables to check if they are accessible client-side
  console.log('--- DEBUG: NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('--- DEBUG: NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Exists' : 'MISSING or Undefined'); // Don't log the key itself

  const [participants, setParticipants] = useState<ParticipantData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [participantType, setParticipantType] = useState("all")
  const [resendingEmail, setResendingEmail] = useState<{ [key: string]: boolean }>({})
  const [showManualVerifyModal, setShowManualVerifyModal] = useState(false);
  const [showResendEmailModal, setShowResendEmailModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantData | null>(null);
  // State for Manual Verification Modal
  const [orderDetails, setOrderDetails] = useState<any | null>(null); // Replace 'any' with a proper type later
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false); // For verification loading state
  const [isResending, setIsResending] = useState<string | null>(null); // Store participant ID being resent

  const supabase = createClientComponentClient()

  // Define fetchParticipants using useCallback outside useEffect
  const fetchParticipants = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch data directly from the registration_summary view
      let query = supabase
        .from('registration_summary') // Use the view
        .select('*') // Select all columns from the view
        .order('registration_date', { ascending: false }); // Order by registration date

      // Apply filters if needed
      // Note: Filtering might need adjustment based on joined data structure
      if (participantType !== "all") {
        query = query.eq('participant_type', participantType)
      }

      if (searchQuery) {
        // Filter on columns available in the view
        query = query.or(
          `full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,nik.ilike.%${searchQuery}%,registration_number.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching participant data from view:", error);
        throw error;
      }

      // Data from the view should already be in the desired flat structure
      const viewData = (data || []) as ParticipantData[];

      // console.log('Data from view:', viewData);
      setParticipants(viewData.filter(p => p.participant_id !== null)); // Basic filter

    } catch (error) {
      console.error("Error in fetchParticipants:", error);
      setParticipants([]); // Clear participants on error
    } finally {
      setLoading(false);
    }
  }, [supabase, searchQuery, participantType]); // Add participantType dependency

  // useEffect for initial data fetching
  useEffect(() => {
    fetchParticipants(); // Call the useCallback version
  }, [fetchParticipants]); // Add fetchParticipants to dependency array

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
      case "other":
        return "Dokter Residen"
      default:
        return "Dokter Residen"
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const exportToExcel = () => {
    if (participants.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    // Define headers matching the table columns
    const headers = [
      "No. Registrasi",
      "QR Code ID",
      "Nama",
      "NIK",
      "Email",
      "Telepon",
      "Institusi",
      "Kategori Peserta", // New header
      "Status Registrasi",
      "Catatan Pembayaran", // Added notes header
      "Tanggal Registrasi" // Add registration date if needed
    ];

    // Map participants data from the view
    const dataToExport = participants.map(p => [
      p.registration_number ?? 'N/A',
      p.qr_code_id ?? 'N/A',
      p.full_name ?? 'N/A',
      p.nik ?? 'N/A',
      p.email ?? 'N/A',
      p.phone ?? 'N/A',
      p.institution ?? 'N/A',
      p.participant_type ? (participantTypeMap[p.participant_type] || p.participant_type) : '-', // New data
      p.registration_status ?? 'N/A',
      p.payment_note ?? '-', // Use payment_note
      p.registration_date ? new Date(p.registration_date).toLocaleDateString('id-ID') : 'N/A' // Format date
    ]);

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataToExport]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Peserta");

    const date = new Date().toISOString().split('T')[0];
    const fileName = `participants_${date}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  // Function to handle resending email
  const handleResendEmail = async (participantId: string, email: string) => {
    if (!participantId || !email) {
      alert("Informasi partisipan tidak lengkap untuk mengirim ulang email.");
      return;
    }

    // Find the participant's registration ID (needed for fetching full details in edge function)
    const participant = participants.find(p => p.participant_id === participantId);
    if (!participant?.registration_id) {
        alert("Tidak dapat menemukan ID registrasi untuk partisipan ini.");
        return;
    }
    const registrationId = participant.registration_id;

    setResendingEmail(prev => ({ ...prev, [participantId]: true }));
    console.log(`Resending email for participant ID: ${participantId}, registration ID: ${registrationId}`);

    try {
      // Call the new Edge Function
      const { error } = await supabase.functions.invoke('resend-verification-email', {
        body: { participantId: participantId, registrationId: registrationId }
      });

      if (error) {
        throw error;
      }

      console.log(`Resend email function invoked successfully for participant: ${participantId}`);
      alert(`Email konfirmasi berhasil dikirim ulang ke ${email}.`);

    } catch (error: any) {
      console.error("Error invoking/resending verification email:", error);
      alert(`Gagal mengirim ulang email ke ${email}: ${error.message || 'Unknown error'}`);
    } finally {
      setResendingEmail(prev => ({ ...prev, [participantId]: false }));
    }
  };

  async function handleManualVerification() {
    if (!selectedParticipant?.registration_number || !selectedParticipant?.registration_id) {
      toast({ title: "Error", description: "Nomor registrasi atau ID registrasi tidak ditemukan.", variant: "destructive" });
      return;
    }

    // Check status before verifying
    if (selectedParticipant.registration_status === 'paid') {
        toast({ title: "Info", description: `Status registrasi saat ini sudah 'paid', tidak dapat diverifikasi manual lagi.` });
        return;
    }

    setIsVerifying(true);
    console.log(`Attempting manual verification for: ${selectedParticipant.registration_number} (ID: ${selectedParticipant.registration_id})`);

    try {
      // 1. Get existing Payment ID for this registration (if any)
      let existingPaymentId: string | null = null;
      const { data: paymentData, error: paymentFetchError } = await supabase
        .from('payments')
        .select('id')
        .eq('registration_id', selectedParticipant.registration_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // Use maybeSingle to avoid error if no payment exists

      if (paymentFetchError && paymentFetchError.code !== 'PGRST116') { // Ignore 'No rows found' error
        throw new Error(`Failed to check existing payment: ${paymentFetchError.message}`);
      }
      existingPaymentId = paymentData?.id ?? null;
      console.log(`Existing Payment ID found: ${existingPaymentId}`);

      // 2. Prepare Payload for API
      const apiPayload = {
        paymentId: existingPaymentId, // Send existing ID or null
        registrationId: selectedParticipant.registration_id,
        notes: "Verified through admin participants interface",
      };
      console.log("Calling manual-verify-payment API with data:", apiPayload);

      // 3. Call the manual-verify-payment API
      const response = await fetch("/api/admin/manual-verify-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiPayload),
      });

      const responseData = await response.json();
      console.log("Manual verification API response:", responseData);

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to verify payment via API");
      }

      console.log(`Verification successful via API for: ${selectedParticipant.registration_number}`);

      // 4. Refresh participant data from server instead of optimistic update
      await fetchParticipants(); // Reload data from the source of truth
      toast({ title: "Success", description: `Registrasi ${selectedParticipant.registration_number} berhasil diverifikasi.` });
      setShowManualVerifyModal(false); // Close modal on success


      // 5. Trigger email sending AFTER successful verification and state update
      //    Run this async without blocking the UI closing
      (async () => {
          try {
              console.log(`Attempting to send verification email for participant: ${selectedParticipant.participant_id}`);
              if (!selectedParticipant.participant_id || !selectedParticipant.registration_id) {
                  console.error("Missing participant or registration ID for email sending.");
                  return; // Don't proceed if IDs are missing
              }
              const { error: emailError } = await supabase.functions.invoke('resend-verification-email', {
                  body: { 
                  participantId: selectedParticipant.participant_id, 
                  registrationId: selectedParticipant.registration_id 
                  }
              });

              if (emailError) {
                  throw emailError; // Let the catch block handle it
              }
              console.log(`Verification email function invoked successfully for participant: ${selectedParticipant.participant_id}`);
              // Optional: Show a less intrusive success toast for email?
              // toast({ title: "Info", description: "Email konfirmasi sedang dikirim." });

          } catch (emailError: any) {
              console.error("Error invoking/sending verification email:", emailError);
              // Notify admin separately about email failure without blocking verification success
               toast({ 
                  title: "Peringatan Email", 
                  description: `Verifikasi berhasil, TAPI GAGAL mengirim email: ${emailError.message || 'Unknown error'}. Kirim ulang manual jika perlu.`,
                  variant: "destructive",
                  duration: 10000 // Longer duration for warning
              });
          }
      })(); // Immediately invoke the async email function

    } catch (error: any) {
      console.error("Error during manual verification:", error);
       toast({ 
          title: "Gagal Verifikasi", 
          description: error.message || 'Unknown error',
          variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Function to format currency (Example)
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  };

  // Fetch order details when the manual verification modal opens
  useEffect(() => {
    if (showManualVerifyModal && selectedParticipant?.registration_id) {
      const fetchDetails = async () => {
        if (!selectedParticipant || !selectedParticipant.registration_id) return;

        console.log(`Fetching details for registration_id: ${selectedParticipant.registration_id}`);
        setIsFetchingDetails(true);
        setFetchError(null);
        setOrderDetails(null);

        try {
          const registrationId = selectedParticipant.registration_id;
          console.log(`--- DEBUG: fetchDetails called for registrationId: ${registrationId} ---`);
          
          // Use the new API endpoint instead of direct Supabase client
          const response = await fetch(`/api/registrations/${registrationId}`);
          const jsonResponse = await response.json();
          
          // Log the full API response for debugging
          console.log('API Response:', JSON.stringify(jsonResponse, null, 2));

          // Check if we have an error in the response
          if (!response.ok && !jsonResponse.data) {
            throw new Error(jsonResponse.error || 'Failed to fetch registration details');
          }
          
          // If we have data but also status 'fallback', log a warning
          if (jsonResponse.status === 'fallback') {
            console.warn('Using fallback data:', jsonResponse.error);
          }

          const registrationDetails = jsonResponse.data;
          console.log('Fetched registration details:', registrationDetails);

          // Ensure tickets is an array before mapping
          const ticket = Array.isArray(registrationDetails.tickets) 
            ? registrationDetails.tickets 
            : registrationDetails.tickets 
              ? [registrationDetails.tickets] 
              : [];

          // Prepare order details for display
          const orderDetails = {
            registrationNumber: registrationDetails.registration_number,
            participants: registrationDetails.participants?.[0] ? [registrationDetails.participants[0].full_name] : [],
            items: ticket.map((item: any) => ({
              name: item.name,
              price: item.price,
            })),
            totalAmount: registrationDetails.payments?.[0] ? registrationDetails.payments[0].amount : 0,
          };

          setOrderDetails(orderDetails);

        } catch (err: any) {
          console.error("Error fetching registration details:", err);
          setFetchError(err.message || 'Gagal memuat detail registrasi.');
          toast({ title: "Error", description: err.message || 'Gagal memuat detail registrasi.', variant: "destructive" });
        } finally {
          setIsFetchingDetails(false);
        }
      };
      fetchDetails();
    }
  }, [showManualVerifyModal, selectedParticipant, supabase]);;

  // Handler function to resend the paid invoice/ticket
  const handleResendPaidInvoice = async (participant: ParticipantData) => {
    if (!participant.registration_id || !participant.participant_id) {
      toast({ title: "Error", description: "ID Registrasi atau Peserta tidak ditemukan.", variant: "destructive" });
      return;
    }

    console.log(`Attempting to resend paid invoice for participant: ${participant.participant_id} on registration: ${participant.registration_id}`);
    setIsResending(participant.participant_id); // Set loading state for this specific participant

    try {
      const { error: functionError } = await supabase.functions.invoke('send-paid-invoice', {
        body: { 
          registrationId: participant.registration_id, 
          participantId: participant.participant_id 
        }
      });

      if (functionError) {
        console.error('Error invoking send-paid-invoice function:', functionError);
        throw new Error(functionError.message || 'Gagal memanggil fungsi kirim ulang.');
      }

      console.log(`Resend function invoked successfully for participant: ${participant.participant_id}`);
      toast({ title: "Sukses", description: `Email tiket/invoice untuk ${participant.full_name} sedang dikirim ulang.` });

    } catch (error: any) {
      console.error("Error during resend paid invoice:", error);
       toast({ 
          title: "Gagal Kirim Ulang", 
          description: error.message || 'Unknown error',
          variant: "destructive"
      });
    } finally {
      setIsResending(null); // Clear loading state
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Daftar Peserta</h2>
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari peserta..."
              className="w-full pl-8 md:w-[250px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={participantType} onValueChange={setParticipantType}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Tipe Peserta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              <SelectItem value="specialist_doctor">Dokter Spesialis</SelectItem>
              <SelectItem value="general_doctor">Dokter Umum</SelectItem>
              <SelectItem value="nurse">Perawat</SelectItem>
              <SelectItem value="student">Mahasiswa</SelectItem>
              <SelectItem value="other">Dokter Residen</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={exportToExcel} disabled={participants.length === 0}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Registrasi</TableHead>
              <TableHead>QR Code ID</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>NIK</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead>Institusi</TableHead>
              <TableHead>Kategori Peserta</TableHead>
              <TableHead>Status Registrasi</TableHead>
              <TableHead>Catatan Pembayaran</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={11} className="h-12 animate-pulse bg-muted"></TableCell>
                </TableRow>
              ))
            ) : participants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center">
                  Tidak ada data peserta
                </TableCell>
              </TableRow>
            ) : (
              participants.map((p) => {
                // Log the status for debugging
                console.log(`Participant: ${p.full_name}, Status: '${p.registration_status}'`); 
                
                // Determine badge variant based on status
                const badgeVariant = p.registration_status === 'verified' 
                  ? 'success' 
                  : (p.registration_status === 'pending' || p.registration_status === 'pending verification' 
                      ? 'secondary' 
                      : 'destructive');

                return (
                  <TableRow key={p.participant_id}>
                    <TableCell>{p.registration_number ?? 'N/A'}</TableCell>
                    <TableCell>{p.qr_code_id ?? 'N/A'}</TableCell>
                    <TableCell>{p.full_name ?? 'N/A'}</TableCell>
                    <TableCell>{p.nik ?? 'N/A'}</TableCell>
                    <TableCell>{p.email ?? 'N/A'}</TableCell>
                    <TableCell>{p.phone ?? 'N/A'}</TableCell>
                    <TableCell>{p.institution ?? 'N/A'}</TableCell>
                    <TableCell>{p.participant_type ? (participantTypeMap[p.participant_type] || p.participant_type) : '-'}</TableCell>
                    <TableCell><Badge variant={badgeVariant === 'success' ? 'default' : badgeVariant}>{p.registration_status ?? 'N/A'}</Badge></TableCell>
                    <TableCell>{p.payment_note ?? '-'}</TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        if (p.registration_status === 'paid') {
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                console.log(`DEBUG: Resend Ticket button clicked for participant: ${p.participant_id}`);
                                handleResendPaidInvoice(p);
                              }}
                              disabled={isResending === p.participant_id}
                            >
                              {isResending === p.participant_id ? <ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> : null}Kirim Ulang Tiket
                            </Button>
                          );
                        } else if (p.registration_status === 'pending' || p.registration_status === 'pending verification') {
                          return (
                            <Button variant="outline" size="sm" onClick={() => { setSelectedParticipant(p); setShowManualVerifyModal(true); }} disabled={isVerifying}>
                              Verifikasi Manual
                            </Button>
                          );
                        } else if (p.registration_status === 'verified') {
                          const canResendVerification = p.participant_id && p.email;
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => canResendVerification && handleResendEmail(p.participant_id!, p.email!)}
                              disabled={!canResendVerification || resendingEmail[p.participant_id!]}
                            >
                              {resendingEmail[p.participant_id!] ? "Mengirim..." : "Kirim Ulang Email"}
                            </Button>
                          );
                        } else {
                          return <span>-</span>;
                        }
                      })()}
                    </TableCell>
                  </TableRow>
                )
              }))
            }
          </TableBody>
        </Table>
      </div>

      {/* Manual Verification Modal */}
      <Dialog open={showManualVerifyModal} onOpenChange={setShowManualVerifyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verifikasi Pembayaran Manual</DialogTitle>
            <DialogDescription>
              Verifikasi pembayaran untuk peserta: <strong>{selectedParticipant?.full_name ?? ''}</strong> 
              (Reg: {selectedParticipant?.registration_number ?? 'N/A'}).
              {/* TODO: Fetch and display order details here */}
            </DialogDescription>
          </DialogHeader>
          {/* Placeholder for order details */}
          <div className="my-4 p-4 border rounded bg-muted/40 min-h-[150px]">
            {isFetchingDetails ? (
              <p className="text-sm text-center text-muted-foreground">Memuat detail pesanan...</p>
            ) : fetchError ? (
              <p className="text-sm text-center text-red-600">{fetchError}</p>
            ) : orderDetails ? (
              <div className="text-sm space-y-2">
                <p><strong>No. Registrasi:</strong> {orderDetails.registrationNumber}</p>
                <p><strong>Peserta Terkait:</strong> {orderDetails.participants.join(', ')}</p>
                <div><strong>Item Pesanan:</strong>
                  <ul className="list-disc pl-5 mt-1">
                    {orderDetails.items.map((item: any, index: number) => (
                      <li key={index}>{item.name} ({formatCurrency(item.price)})</li>
                    ))}
                  </ul>
                </div>
                <p className="font-semibold"><strong>Total Tagihan:</strong> {formatCurrency(orderDetails.totalAmount)}</p>
                {/* Add more details as needed */}
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground">Detail pesanan akan muncul di sini.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualVerifyModal(false)} disabled={isVerifying}>Batal</Button>
            <Button 
              onClick={handleManualVerification} 
              disabled={isFetchingDetails || !orderDetails || isVerifying}
            >
              {isVerifying ? "Memverifikasi..." : "Konfirmasi Verifikasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resend Email Modal */}
      <Dialog open={showResendEmailModal} onOpenChange={setShowResendEmailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kirim Ulang Email Tiket</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin mengirim ulang email tiket ke peserta: <strong>{selectedParticipant?.full_name ?? ''}</strong> ({selectedParticipant?.email ?? 'N/A'})?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResendEmailModal(false)}>Batal</Button>
            <Button 
              onClick={() => {
                // Use participant_id for resend logic, email from view data
                if (selectedParticipant?.participant_id && selectedParticipant?.email) {
                  console.log("Confirm Resend Email for:", selectedParticipant.participant_id);
                  handleResendEmail(selectedParticipant.participant_id, selectedParticipant.email);
                } else {
                  console.error("Missing participant ID or email for resend");
                }
                setShowResendEmailModal(false); // Close modal after action
              }}
              // Add loading/disabled state during email resend
            >
              Kirim Ulang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
