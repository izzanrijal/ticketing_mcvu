import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { NextResponse } from 'next/server';

// --- TODO: Copy relevant interfaces (Participant, Transaction, etc.) or import from shared types ---
interface Workshop {
    id: string;
}
interface WorkshopRegistration {
    workshop_id: string;
}
interface ContactPerson {
    id: string;
    full_name: string;
    email: string;
    phone: string;
}
interface Participant {
    participant_id: string; // Ensure this matches your actual participant identifier
    full_name: string;
    email: string;
    phone: string;
    institution: string;
    participant_type: string;
    nik: string;
    qr_code_id: string;
    workshop_registrations?: WorkshopRegistration[];
    // Add other relevant fields
}
interface RegistrationData {
    registration_id: string;
    registration_number: string;
    final_amount: number;
    unique_code: number;
    total_amount: number;
    discount_amount: number;
    status: string; // e.g., 'paid'
    payment_method: string;
    payment_confirmed_at: string;
    payment_notes: string;
    created_at: string;
    contact_persons: ContactPerson[] | null;
    participants: Participant[];
    // Add other relevant fields
}

// --- Supabase Client (SERVER-SIDE) ---
// Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in your .env.local
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    // Optionally throw an error during build/startup if preferred
}

const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: {
        persistSession: false // Disable session persistence for server-side
    }
});

// --- Resend Client ---
// Ensure RESEND_API_KEY is in your .env.local
const resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
    console.error('Missing Resend API Key environment variable');
}
const resend = new Resend(resendApiKey);

// --- Main POST Handler ---
export async function POST(request: Request) {
    try {
        const { registrationId, participantId } = await request.json(); // Expecting these IDs

        if (!registrationId) {
            return NextResponse.json({ error: 'Missing registrationId' }, { status: 400 });
        }

        console.log(`API Route: Processing request for registrationId: ${registrationId}, participantId: ${participantId || 'N/A'}`);

        // --- Fetch Data (Similar to Edge Function) ---
        const { data: registrationData, error: regError } = await supabaseAdmin
            .from('registrations')
            .select(`
                *,
                contact_persons ( * ),
                participants ( * )
            `)
            .eq('registration_id', registrationId)
            .single();

        if (regError) {
            console.error(`API Route: Supabase error fetching registration ${registrationId}:`, regError);
            return NextResponse.json({ error: `Failed to fetch registration data: ${regError.message}` }, { status: 500 });
        }

        if (!registrationData) {
            return NextResponse.json({ error: `Registration not found for ID: ${registrationId}` }, { status: 404 });
        }

        const contactPerson = registrationData.contact_persons?.[0] ?? null;

        if (!contactPerson) {
            return NextResponse.json({ error: 'Contact person not found for registration' }, { status: 404 });
        }

        // Verify registration status directly
        if (registrationData.status !== 'paid') {
            console.warn(`API Route: Attempted to send invoice for non-paid registration ${registrationId} (Status: ${registrationData.status})`);
            return NextResponse.json({ error: `Registration status is not 'paid' (Status: ${registrationData.status})` }, { status: 400 });
        }

        // --- Fetch Workshops (Similar to Edge Function) ---
        const participantWorkshopIds = registrationData.participants
            .flatMap((p: Participant) => p.workshop_registrations?.map((wr: WorkshopRegistration) => wr.workshop_id) || []);
        const uniqueWorkshopIds = [...new Set(participantWorkshopIds)];

        const workshopDetailsMap = new Map<string, Workshop>();
        if (uniqueWorkshopIds.length > 0) {
            const { data: workshops, error: wsError } = await supabaseAdmin
                .from('workshops')
                .select('*')
                .in('id', uniqueWorkshopIds);
            if (wsError) {
                console.error('API Route: Error fetching workshop details:', wsError);
                // Decide if this is critical - maybe proceed without workshop details?
            } else if (workshops) {
                workshops.forEach((ws: Workshop) => workshopDetailsMap.set(ws.id, ws));
            }
        }

        // --- Generate QR Code Data (Similar to Edge Function) ---
        const qrParticipant = participantId ? registrationData.participants.find((p: Participant) => p.participant_id === participantId) : registrationData.participants[0];
        if (!qrParticipant) {
             return NextResponse.json({ error: `Participant not found for QR Code generation (ID: ${participantId})` }, { status: 404 });
        }
        const qrDataPayload = JSON.stringify({
            nik: qrParticipant.nik,
            name: qrParticipant.full_name,
            registration_number: registrationData.registration_number,
            qr_code_id: qrParticipant.qr_code_id
        });
        const qrCodeDataUrl = await QRCode.toDataURL(qrDataPayload, { errorCorrectionLevel: 'H', margin: 2 });

        // --- Generate PDF (Similar to Edge Function) ---
        const pdfParams = {
            registrationData: registrationData, // Pass the whole object
            contactPerson: contactPerson,
            participants: registrationData.participants,
            workshopDetailsMap: workshopDetailsMap,
            participantTypeMap: { // Define or fetch this mapping
                'specialist_doctor': 'Dokter Spesialis',
                'general_doctor': 'Dokter Umum',
                'nurse': 'Perawat',
                'student': 'Mahasiswa',
                'other': 'Dokter Residen'
            },
            qrCodeData: qrCodeDataUrl
        };
        const pdfBuffer = await generatePaidInvoicePdfInternal(pdfParams);

        // Define sender email address from environment variable or use a default
        const senderEmail = process.env.SENDER_EMAIL || 'Event MVCU <noreply@example.com>';

        // --- Send Email (Similar to Edge Function) ---
        const { data: emailData, error: emailError } = await resend.emails.send({
            from: senderEmail,
            to: [contactPerson.email],
            subject: `Invoice Lunas: Registrasi ${registrationData.registration_number}`,
            html: `<p>Dear ${contactPerson.full_name},</p><p>Terima kasih atas pembayaran Anda. Terlampir adalah invoice lunas untuk registrasi ${registrationData.registration_number}.</p><p>Salam,</p><p>Panitia MVCU 2025</p>`, // Customize email body
            attachments: [
                {
                    filename: `Invoice-${registrationData.registration_number}.pdf`,
                    content: pdfBuffer,
                },
            ],
        });

        if (emailError) {
            console.error('API Route: Resend error:', emailError);
            return NextResponse.json({ error: `Failed to send email: ${emailError.message}` }, { status: 500 });
        }

        console.log(`API Route: Email sent successfully for registration ${registrationId}. Email ID: ${emailData?.id}`);
        return NextResponse.json({ success: true, message: 'Invoice sent successfully', emailId: emailData?.id });

    } catch (error: any) {
        console.error('API Route: Unhandled error in POST /api/send-paid-invoice:', error);
        return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
    }
}

// --- PDF Generation Function (Copied & Adapted from Edge Function) ---
// TODO: Define types for params properly, perhaps import from shared types
async function generatePaidInvoicePdfInternal(params: any): Promise<Buffer> {
    const {
        registrationData,
        contactPerson,
        participants,
        workshopDetailsMap,
        participantTypeMap,
        qrCodeData
    } = params;

    // Extract relevant data from registrationData
    const { 
        registration_number: registrationNumber, 
        created_at: registrationCreationTimeStr,
        total_amount: originalAmount, // Use total_amount as base
        discount_amount: discountAmount,
        unique_code: uniqueAmount,
        final_amount: paidAmount, // final_amount is the amount actually paid
    } = registrationData;

    const registrationCreationTime = new Date(registrationCreationTimeStr);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

    // --- PDF Content (Similar to Edge Function) ---
    // Header
    doc.fontSize(20).text('Invoice Pembayaran Lunas', { align: 'center' });
    doc.moveDown();

    // Registration Details
    doc.fontSize(12).text(`Nomor Registrasi: ${registrationNumber}`);
    doc.text(`Tanggal Registrasi: ${registrationCreationTime.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    doc.moveDown();

    // Contact Person
    doc.fontSize(14).text('Informasi Kontak');
    doc.fontSize(10).text(`Nama: ${contactPerson.full_name}`);
    doc.text(`Email: ${contactPerson.email}`);
    doc.text(`Telepon: ${contactPerson.phone}`);
    doc.moveDown();

    // Participants
    doc.fontSize(14).text('Daftar Peserta');
    participants.forEach((p: Participant) => {
        const typeLabel = participantTypeMap[p.participant_type] || p.participant_type;
        doc.fontSize(10).text(`- ${p.full_name} (${typeLabel})`);
        // Add workshop details if needed
        p.workshop_registrations?.forEach(wr => {
            const workshop = workshopDetailsMap.get(wr.workshop_id);
            if (workshop) {
                doc.fontSize(8).text(`  * Workshop: ${workshop.name}`, { indent: 20 });
            }
        });
    });
    doc.moveDown();

    // Payment Summary
    doc.fontSize(14).text('Ringkasan Pembayaran');
    doc.fontSize(10).text(`Total Biaya: ${formatCurrency(originalAmount)}`);
    if (discountAmount > 0) {
        doc.text(`Diskon: ${formatCurrency(discountAmount)}`);
    }
    doc.text(`Kode Unik: ${formatCurrency(uniqueAmount)}`);
    doc.fontSize(12).font('Helvetica-Bold').text(`Jumlah Dibayar (Final): ${formatCurrency(paidAmount)}`);
    doc.font('Helvetica').moveDown();

    // QR Code
    if (qrCodeData) {
        doc.addPage();
        doc.fontSize(16).text('Tiket Akses (QR Code)', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text('Mohon tunjukkan QR code ini kepada panitia saat registrasi ulang di lokasi acara.', { align: 'center' });
        // Center QR Code
        const qrSize = 200;
        const qrX = (doc.page.width - qrSize) / 2;
        doc.image(qrCodeData, qrX, doc.y + 30, { fit: [qrSize, qrSize] });
        // Add participant name below QR?
        const qrParticipant = participants.find((p: Participant) => p.qr_code_id && qrCodeData.includes(p.qr_code_id)) || participants[0];
        if (qrParticipant) {
            const participantName = qrParticipant.full_name || 'Nama Peserta';
            doc.moveDown(15); // Adjust spacing based on QR size
            doc.fontSize(12).text(`Nama: ${participantName}`, { align: 'center' });
            doc.text(`Registrasi: ${registrationNumber}`, { align: 'center' });
        }
    }

    // Footer
    const bottomY = doc.page.height - 50;
    doc.fontSize(8).text('Invoice ini diterbitkan secara otomatis oleh sistem.', 50, bottomY, { align: 'center', width: doc.page.width - 100 });

    // Finalize PDF and return buffer
    return new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => {
            const resultBuffer = Buffer.concat(chunks);
            resolve(resultBuffer);
        });
        doc.on('error', (err: any) => {
            reject(err);
        });
        doc.end();
    });
}

// Helper function (consider moving to utils)
function formatCurrency(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}
