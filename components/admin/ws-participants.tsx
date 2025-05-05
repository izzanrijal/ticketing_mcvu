"use client";
import React from 'react';
import { useEffect, useState, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Download, Search, RefreshCw, Loader2 as ReloadIcon } from "lucide-react";
import * as XLSX from 'xlsx';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

// Interface adjusted for workshop participants based on the workshop_registration_summary view
interface WsParticipantData {
  workshop_registration_id: string; // Primary key from the view
  registration_id: string | null;
  registration_number: string | null;
  registration_date: string | null;
  registration_status: 'pending' | 'pending verification' | 'verified' | 'paid' | null;
  participant_id: string | null;
  participant_name: string | null;
  participant_email: string | null;
  participant_phone: string | null;
  participant_type: string | null;
  institution: string | null;
  nik: string | null;
  workshop_id: string | null;
  workshop_name: string | null;
  qr_code_id: string | null;
  payment_status: string | null;
  payment_nominal: number | null;
}

interface Workshop {
  id: string;
  title: string;
}

// Define participant type mapping for display
const participantTypeMap: { [key: string]: string } = {
  'specialist_doctor': 'Dokter Spesialis',
  'general_doctor': 'Dokter Umum',
  'nurse': 'Perawat',
  'student': 'Mahasiswa',
  'other': 'Dokter Residen',
};

export function AdminWsParticipants() {
  const [participants, setParticipants] = useState<WsParticipantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkshopId, setSelectedWorkshopId] = useState("all"); // State for workshop filter
  const [workshopList, setWorkshopList] = useState<Workshop[]>([]); // State for workshop dropdown list

  // Remove states not directly needed for workshop view (adjust if needed)
  const [resendingEmail, setResendingEmail] = useState<{ [key: string]: boolean }>({});
  const [showManualVerifyModal, setShowManualVerifyModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<WsParticipantData | null>(null);
  const [relatedParticipants, setRelatedParticipants] = useState<WsParticipantData[]>([]);
  const [relatedWorkshops, setRelatedWorkshops] = useState<{name: string, participant: string}[]>([]);
  const [isVerifying, setIsVerifying] = useState(false); 
  const [isResending, setIsResending] = useState<string | null>(null); 

  // Add states for order details
  const [orderDetails, setOrderDetails] = useState<{
    registrationNumber: string | null;
    participants: string[];
    items: { name: string; price: number }[];
    totalAmount: number;
  } | null>(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const supabase = createClientComponentClient();

  // Fetch list of workshops for the filter dropdown
  useEffect(() => {
    const fetchWorkshops = async () => {
      const { data, error } = await supabase
        .from('workshops')
        .select('id, title')
        .order('title', { ascending: true });

      if (error) {
        console.error("Error fetching workshops:", error);
        toast({ title: "Error", description: "Gagal memuat daftar workshop.", variant: "destructive" });
      } else {
        setWorkshopList(data || []);
      }
    };
    fetchWorkshops();
  }, [supabase]);

  // Fetch workshop participants data
  const fetchWsParticipants = useCallback(async () => {
    setLoading(true);
    try {
      // Use the workshop_registration_summary view which already contains all needed data
      let query = supabase
        .from('workshop_registration_summary')
        .select('*')
        .order('registration_date', { ascending: false });

      // Apply workshop filter
      if (selectedWorkshopId !== "all") {
        query = query.eq('workshop_id', selectedWorkshopId); // Filter by selected workshop ID
      }

      // Apply search filter - Search participant and workshop details
      if (searchQuery) {
        query = query.or(
          `participant_name.ilike.%${searchQuery}%,participant_email.ilike.%${searchQuery}%,workshop_name.ilike.%${searchQuery}%,nik.ilike.%${searchQuery}%,registration_number.ilike.%${searchQuery}%`
        );
      }

      // Execute the query
      const { data, error } = await query;

      if (error) {
        // Throw error to be caught by the outer catch block
        throw error; 
      }

      console.log("Raw data from Supabase:", data);

      // Data from the view can be used directly
      setParticipants(data || []);

    } catch (err: any) { // Catch any error during fetch or transformation
      console.error("Error in fetchWsParticipants:", err); 
      // Display more informative error message if possible
      const errorMessage = err.message || JSON.stringify(err) || "Unknown error occurred";
      toast({ 
        title: "Gagal Mengambil Data", 
        description: `Terjadi kesalahan saat mengambil data peserta workshop: ${errorMessage}`, 
        variant: "destructive" 
      });
      setParticipants([]); // Clear participants on error
    } finally {
      setLoading(false);
    }
  }, [supabase, searchQuery, selectedWorkshopId]);

  // useEffect for initial and subsequent data fetching
  useEffect(() => {
    fetchWsParticipants();
  }, [fetchWsParticipants]);

  // --- Helper functions (formatDate, formatCurrency - Keep if needed) ---
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  };

  // --- Excel Export Function (Adjusted) ---
  const exportToExcel = () => {
    if (participants.length === 0) {
      toast({ title: "Info", description: "Tidak ada data untuk diekspor." });
      return;
    }

    // Adjust headers for workshop participants
    const headers = [
      "No. Registrasi",
      "Nama Peserta",
      "Email",
      "NIK",
      "Telepon",
      "Institusi",
      "Kategori",
      "Workshop",
      "Status Registrasi",
      "QR Code"
    ];

    const dataToExport = participants.map(p => [
      p.registration_number ?? 'N/A',
      p.participant_name ?? 'N/A',
      p.participant_email ?? 'N/A',
      p.nik ?? 'N/A',
      p.participant_phone ?? 'N/A',
      p.institution ?? 'N/A',
      p.participant_type ? (participantTypeMap[p.participant_type] || p.participant_type) : '-',
      p.workshop_name ?? 'N/A',
      p.registration_status ?? 'N/A',
      p.qr_code_id ?? 'N/A'
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataToExport]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Peserta Workshop");
    const date = new Date().toISOString().split('T')[0];
    const fileName = `workshop_participants_${selectedWorkshopId === 'all' ? 'all' : workshopList.find(w=>w.id === selectedWorkshopId)?.title.replace(/ /g,'_') ?? selectedWorkshopId}_${date}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // --- Action Handlers (handleManualVerification, handleResendEmail, handleResendPaidInvoice) ---
  // ** IMPORTANT: Review if these actions are applicable/need modification for workshop context **
  // For now, they are kept but might require backend adjustments or removal.

  async function handleManualVerification() {
    if (!selectedParticipant?.workshop_registration_id) {
      toast({ title: "Error", description: "ID pendaftaran workshop tidak ditemukan.", variant: "destructive" });
      return;
    }

    // Prevent re-verifying already verified or paid workshops
    if (selectedParticipant.registration_status === 'verified' || selectedParticipant.registration_status === 'paid') {
      toast({ title: "Info", description: "Workshop ini sudah diverifikasi atau dibayar.", variant: "secondary" });
      setShowManualVerifyModal(false);
      return;
    }

    setIsVerifying(true);

    try {
      // Use the server-side API endpoint to perform verification
      // This bypasses RLS and uses admin privileges, assuming access to this page means admin rights
      const response = await fetch('/api/admin/manual-verify-workshop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No Authorization header needed, API relies on admin client and page access control
        },
        body: JSON.stringify({
          workshop_registration_id: selectedParticipant.workshop_registration_id,
          registration_id: selectedParticipant.registration_id,
          registration_number: selectedParticipant.registration_number
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Error response from API:", result);
        throw new Error(result.error || result.details || "Gagal memverifikasi workshop.");
      }

      console.log("Verification result:", result);

      toast({ 
        title: "Sukses", 
        description: `Workshop '${selectedParticipant.workshop_name}' untuk ${selectedParticipant.participant_name} berhasil diverifikasi dan dibayar.` 
      });
      
      fetchWsParticipants(); // Refresh the list
      setShowManualVerifyModal(false); // Close modal

      // --- BEGIN: Invoke email sending function ---
      // Run this async without blocking the UI closing
      (async () => {
        try {
            console.log(`Attempting to send verification email for registration: ${selectedParticipant.registration_id} and participant: ${selectedParticipant.participant_id}`);
            if (!selectedParticipant.registration_id || !selectedParticipant.participant_id) {
                console.error("Missing registration ID or Participant ID for email sending.");
                 toast({ 
                    title: "Peringatan Email", 
                    description: `Verifikasi workshop berhasil, TAPI GAGAL mengirim email: ID Registrasi atau ID Peserta tidak ditemukan.`, 
                    variant: "warning", 
                    duration: 10000
                });
                return; // Don't proceed if ID is missing
            }

            // Ensure you have the correct function name and expected body parameters
            const { error: emailError } = await supabase.functions.invoke('resend-verification-email', {
                body: { 
                    registrationId: selectedParticipant.registration_id, 
                    participantId: selectedParticipant.participant_id
                    // Add other parameters if the function needs them
                }
            });

            if (emailError) {
                throw emailError; // Let the catch block handle it
            }
            console.log(`Verification email function invoked successfully for registration: ${selectedParticipant.registration_id}`);
            // Optional: Show a less intrusive success toast for email?
             toast({ title: "Info Email", description: "Email verifikasi sedang dikirim." });

        } catch (emailError: any) {
            console.error("Error invoking/sending verification email:", emailError);
            // Notify admin separately about email failure
             toast({ 
                title: "Peringatan Email", 
                description: `Verifikasi workshop berhasil, TAPI GAGAL mengirim email verifikasi: ${emailError.message || 'Unknown error'}.`, 
                variant: "destructive",
                duration: 10000 // Longer duration for warning
            });
        }
      })(); // Immediately invoke the async email function
      // --- END: Invoke email sending function ---

    } catch (err: any) {
      console.error("Verification failed:", err);
      toast({ 
        title: "Error", 
        description: err.message || "Terjadi kesalahan saat verifikasi.", 
        variant: "destructive" 
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Function to fetch all items purchased under the same registration number
  const fetchRelatedItems = async (participant: WsParticipantData) => {
    if (!participant.registration_id || !participant.registration_number) {
      // If there's no registration ID or number, there are no related items
      setRelatedParticipants([]);
      setRelatedWorkshops([]);
      return;
    }

    try {
      // Fetch all participants and workshops with the same registration number
      const { data, error } = await supabase
        .from('workshop_registration_summary') // Ensure this view name is correct
        .select('*')
        .eq('registration_number', participant.registration_number);

      if (error) {
        console.error("Error fetching related items:", error);
        toast({ 
          title: "Error", 
          description: `Gagal mengambil data terkait: ${error.message}`, 
          variant: "destructive" 
        });
        setRelatedParticipants([]); // Clear on error
        setRelatedWorkshops([]);
        return;
      }

      // Set the related participants (full data for potential future use)
      setRelatedParticipants(data || []);

      // Create a simplified list of workshops purchased in this registration for display
      const workshops = (data || []).map(item => ({
        name: item.workshop_name || 'Unknown Workshop',
        participant: item.participant_name || 'Unknown Participant'
      }));
      setRelatedWorkshops(workshops);

      // Fetch detailed order information from registrations.order_details
      fetchOrderDetails(participant.registration_id);

    } catch (err: any) {
      console.error("Error in fetchRelatedItems:", err);
      toast({ 
        title: "Error", 
        description: `Terjadi kesalahan saat mengambil data terkait: ${err.message || JSON.stringify(err)}`, 
        variant: "destructive" 
      });
      setRelatedParticipants([]); // Clear on error
      setRelatedWorkshops([]);
    }
  };

  // Function to fetch detailed order information from registrations.order_details
  const fetchOrderDetails = async (registrationId: string) => {
    if (!registrationId) return;

    console.log(`Fetching order details for registration_id: ${registrationId}`);
    setIsFetchingDetails(true);
    setFetchError(null);
    setOrderDetails(null);

    try {
      // Use the API endpoint to fetch registration details
      const response = await fetch(`/api/registrations/${registrationId}`);
      const jsonResponse = await response.json();

      // Log the full API response for debugging
      console.log('API Response for order details:', JSON.stringify(jsonResponse, null, 2));

      if (!response.ok && !jsonResponse.data) {
        throw new Error(jsonResponse.error || 'Failed to fetch registration details');
      }

      const registrationDetails = jsonResponse.data;
      console.log('Fetched registration details:', registrationDetails);

      // Prepare structure for order details to be displayed
      let displayOrderDetails: { 
        registrationNumber: string | null;
        participants: string[];
        items: { name: string; price: number }[];
        totalAmount: number;
      } | null = null;

      // Get participant names from the main participants array
      const participantsArray = Array.isArray(registrationDetails.participants)
        ? registrationDetails.participants
        : [];
      const participantNames = participantsArray.map((p: any) => p.full_name || 'Unknown Name');

      // --- Use order_details if available --- 
      if (registrationDetails.order_details && Array.isArray(registrationDetails.order_details.participants)) {
        console.log('Using order_details from API:', registrationDetails.order_details);
        const workshopIdsToFetch = new Set<string>();

        // Pre-scan to identify workshops without names
        registrationDetails.order_details.participants.forEach((participant: { items: any[] }) => {
          if (Array.isArray(participant.items)) {
            participant.items.forEach((item: { type: string; name: string; id: string }) => {
              if (item.type === 'workshop' && !item.name && item.id) {
                workshopIdsToFetch.add(item.id);
              }
            });
          }
        });

        // If we have workshop IDs missing names, fetch them
        let workshopTitles: Record<string, string> = {};
        if (workshopIdsToFetch.size > 0) {
          try {
            const { data: workshopsData } = await supabase
              .from('workshops')
              .select('id, title')
              .in('id', Array.from(workshopIdsToFetch));

            // Create a map of ID -> title
            if (workshopsData) {
              workshopsData.forEach((workshop: any) => {
                workshopTitles[workshop.id] = workshop.title;
              });
            }
          } catch (err) {
            console.error("Error fetching workshop titles:", err);
          }
        }

        // Now process all items with workshop names available
        const itemsList: { name: string; price: number }[] = [];
        registrationDetails.order_details.participants.forEach((participantDetail: { items: any[] }) => {
          if (Array.isArray(participantDetail.items)) {
            participantDetail.items.forEach((item: { type: string; name: string; id: string; amount: number }) => {
              if (typeof item.amount === 'number') {
                let itemName = item.name;

                // If name is missing but we have type and id
                if (!itemName && item.type && item.id) {
                  if (item.type === 'workshop') {
                    // Use the title we fetched from the database
                    itemName = workshopTitles[item.id] || `Workshop ID: ${item.id.substring(0, 8)}...`;
                  } else if (item.type === 'symposium') {
                    // For symposium, use the name from tickets
                    itemName = registrationDetails.tickets?.name || 'Symposium Ticket';
                  } else {
                    itemName = `${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Item`;
                  }
                }

                itemsList.push({ 
                  name: itemName || `Item ${item.id ? item.id.substring(0, 8) : ''}`, 
                  price: item.amount 
                });
              }
            });
          }
        });

        displayOrderDetails = {
          registrationNumber: registrationDetails.registration_number,
          participants: participantNames,
          items: itemsList,
          totalAmount: registrationDetails.final_amount || 0,
        };
      } else {
        // --- Fallback logic if order_details is missing --- 
        console.warn('order_details not found or invalid, using fallback logic.');

        // Create a simple list with the workshops we already know about
        const itemsList: { name: string; price: number }[] = [];

        // Add symposium ticket if available
        if (registrationDetails.tickets) {
          participantsArray.forEach((participant: any) => {
            const ticketInfo = registrationDetails.tickets;
            if (ticketInfo) {
              const priceKey = `price_${participant.participant_type}`;
              const price = ticketInfo[priceKey] || 0;
              if (price > 0) {
                itemsList.push({
                  name: ticketInfo.name || 'Symposium Ticket',
                  price: price
                });
              }
            }
          });
        }

        // Add workshops from our related workshops list
        relatedWorkshops.forEach(workshop => {
          // Try to find the workshop in the workshops list to get the price
          const workshopInfo = workshopList.find(w => w.title === workshop.name);
          if (workshopInfo) {
            itemsList.push({
              name: workshop.name,
              price: 0 // We don't have the price in this fallback scenario
            });
          }
        });

        displayOrderDetails = {
          registrationNumber: registrationDetails.registration_number,
          participants: participantNames,
          items: itemsList,
          totalAmount: registrationDetails.final_amount || 0,
        };
      }

      setOrderDetails(displayOrderDetails);

    } catch (err: any) {
      console.error("Error fetching order details:", err);
      setFetchError(err.message || 'Gagal memuat detail pesanan.');
      toast({ 
        title: "Error", 
        description: err.message || 'Gagal memuat detail pesanan.', 
        variant: "destructive" 
      });
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const handleResendEmail = async (participantId: string, email: string) => {
    // ... (Keep existing logic, verify relevance/backend support) ...
    console.warn("Resend email logic needs review for workshop context.");
    // ... rest of resend email logic ...
  };

  const handleResendPaidInvoice = async (participant: WsParticipantData) => {
    // ... (Keep existing logic, verify relevance/backend support) ...
    console.warn("Resend paid invoice logic needs review for workshop context.");
    // ... rest of resend paid invoice logic ...
  };

  // --- JSX Rendering ---
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Changed Title */}
        <h2 className="text-2xl font-bold tracking-tight">Daftar Peserta Workshop</h2>
        <div className="flex flex-col gap-2 md:flex-row">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari nama, email, NIK, workshop..."
              className="w-full pl-8 md:w-[250px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {/* Workshop Filter Dropdown */}
          <Select value={selectedWorkshopId} onValueChange={setSelectedWorkshopId}>
            <SelectTrigger className="w-full md:w-[250px]">
              <SelectValue placeholder="Filter Berdasarkan Workshop" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Workshop</SelectItem>
              {workshopList.map((workshop) => (
                <SelectItem key={workshop.id} value={workshop.id}>{workshop.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Export Button */}
          <Button variant="outline" size="icon" onClick={exportToExcel} disabled={participants.length === 0}>
            <Download className="h-4 w-4" />
            <span className="sr-only">Export</span>
          </Button>
          {/* Refresh Button */}
          <Button variant="outline" size="icon" onClick={fetchWsParticipants} disabled={loading}>
            {loading ? <ReloadIcon className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Workshop Summary Statistics - Only shown when a specific workshop is selected */}
      {selectedWorkshopId !== 'all' && (
        <div className="mt-4 mb-2 p-4 bg-muted rounded-md">
          <h3 className="text-lg font-medium mb-2">
            {workshopList.find(w => w.id === selectedWorkshopId)?.title || 'Workshop'} - Ringkasan
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-background p-3 rounded-md border">
              <p className="text-sm text-muted-foreground">Total Pendaftar</p>
              <p className="text-2xl font-bold">{participants.length}</p>
            </div>
            <div className="bg-background p-3 rounded-md border">
              <p className="text-sm text-muted-foreground">Terverifikasi</p>
              <p className="text-2xl font-bold">
                {participants.filter(p => p.registration_status === 'verified').length}
              </p>
            </div>
            <div className="bg-background p-3 rounded-md border">
              <p className="text-sm text-muted-foreground">Terbayar</p>
              <p className="text-2xl font-bold">
                {participants.filter(p => p.registration_status === 'paid').length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Participants Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow><TableHead>No. Registrasi</TableHead><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>NIK</TableHead><TableHead>Telepon</TableHead><TableHead>Workshop</TableHead><TableHead>Status</TableHead><TableHead>QR Code</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={`loading-${i}`}><TableCell colSpan={9} className="h-12 animate-pulse bg-muted"></TableCell></TableRow>
              ))
            ) : participants.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="h-24 text-center">Tidak ada data peserta workshop {selectedWorkshopId !== 'all' ? `untuk workshop terpilih` : ''}.</TableCell></TableRow>
            ) : (
              participants.map((p) => {
                // Determine badge variant based on status (adjust logic if needed)
                const badgeVariant = p.registration_status === 'verified' || p.registration_status === 'paid' 
                  ? 'success' 
                  : (p.registration_status === 'pending' || p.registration_status === 'pending verification' 
                      ? 'secondary' 
                      : 'destructive');

                return (
                  <TableRow key={p.workshop_registration_id}><TableCell>{p.registration_number ?? 'N/A'}</TableCell><TableCell>{p.participant_name ?? 'N/A'}</TableCell><TableCell>{p.participant_email ?? 'N/A'}</TableCell><TableCell>{p.nik ?? 'N/A'}</TableCell><TableCell>{p.participant_phone ?? 'N/A'}</TableCell><TableCell>{p.workshop_name ?? 'N/A'}</TableCell><TableCell><Badge variant={badgeVariant === 'success' ? 'default' : badgeVariant}>{p.registration_status ?? 'N/A'}</Badge></TableCell><TableCell>{p.qr_code_id ?? 'N/A'}</TableCell><TableCell className="text-right">{(() => {
                         if (p.registration_status === 'paid') {
                           return (
                             <Button variant="outline" size="sm" onClick={() => handleResendPaidInvoice(p)} disabled={isResending === p.participant_id}>
                               {isResending === p.participant_id ? <ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> : null} Kirim Ulang Tiket WS
                             </Button>
                           );
                         } else if (p.registration_status === 'pending' || p.registration_status === 'pending verification') {
                            return (
                                <Button variant="outline" size="sm" onClick={() => { 
                                  setSelectedParticipant(p); 
                                  fetchRelatedItems(p);
                                  setShowManualVerifyModal(true); 
                                }} disabled={isVerifying || p.registration_status === 'verified' || p.registration_status === 'paid'}>
                                Verifikasi Manual WS
                                </Button>
                            );
                         } else if (p.registration_status === 'verified') {
                            const canResendVerification = p.participant_id && p.participant_email;
                            return (
                                <Button variant="outline" size="sm" onClick={() => canResendVerification && handleResendEmail(p.participant_id!, p.participant_email!)} disabled={!canResendVerification || resendingEmail[p.participant_id!]}>
                                {resendingEmail[p.participant_id!] ? "Mengirim..." : "Kirim Ulang Email WS"}
                                </Button>
                            );
                         } else {
                            return <span>-</span>;
                         }
                      })()}</TableCell></TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modals (Manual Verification, Resend Email) - Keep if needed */}
      <Dialog open={showManualVerifyModal} onOpenChange={setShowManualVerifyModal}>
          <DialogContent className="max-w-2xl">
              <DialogHeader>
                  <DialogTitle>Verifikasi Manual Pembayaran Workshop</DialogTitle>
              </DialogHeader>
              
              {/* Replace DialogDescription with div to avoid nesting errors */}
              <div className="text-sm text-muted-foreground py-4">
                {/* Display order details from registrations.order_details */}
                <div className="p-4 border rounded bg-muted/40 min-h-[150px]">
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
                    </div>
                  ) : (
                    <p className="text-sm text-center text-muted-foreground">Detail pesanan akan muncul di sini.</p>
                  )}
                </div>

                <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 rounded-md">
                  <div className="font-medium">Perhatian:</div>
                  <div className="text-sm">Verifikasi manual akan mengubah status menjadi <strong>PAID</strong> untuk semua item dalam registrasi ini.</div>
                </div>
              </div>
              
              <DialogFooter>
                  <Button variant="outline" onClick={() => setShowManualVerifyModal(false)} disabled={isVerifying}>Batal</Button>
                  <Button onClick={handleManualVerification} disabled={isVerifying}> 
                    {isVerifying ? <><ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> Memverifikasi...</> : "Konfirmasi Pembayaran"}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
       
      {/* Resend Email Modal logic might need adaptation */}
      {/* <Dialog open={showResendEmailModal} onOpenChange={setShowResendEmailModal}> ... </Dialog> */}

    </div>
  );
}
