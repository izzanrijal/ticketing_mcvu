// lib/notifications.ts
import { supabaseAdmin } from "@/lib/supabase";
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import { Resend } from 'resend';
import QRCode from 'qrcode'; // <<< IMPORT QRCODE

const resend = new Resend(process.env.RESEND_API_KEY);

// Define participant type mapping
const participantTypeMap: { [key: string]: string } = {
    gp: 'Dokter Umum',
    specialist_doctor: 'Dokter Spesialis',
    general_doctor: 'Dokter Umum',
    resident: 'Dokter Residen',
    nurse: 'Perawat',
    student: 'Mahasiswa', // Corrected mapping
    other: 'Dokter Residen',
};

interface ContactPerson {
    name?: string; 
    email?: string; 
    phone?: string; 
}

interface Participant {
    id: string;
    full_name: string; 
    participant_type: string;
    attendSymposium?: boolean; 
    workshop_registrations?: { workshop_id: string }[]; 
}

interface Registration {
    id: string;
    registration_number: string;
    created_at: string | Date;
    payment_type?: string;
    ticket_id?: string;
    participants: Participant[]; 
    contact_persons: ContactPerson[]; 
}

interface Ticket {
    id: string;
    title: string; 
    [priceField: string]: any; 
}

interface BankAccount {
    bank_name: string;
    account_number: string;
    account_holder_name: string; // Updated from account_name
}

interface WorkshopDetail {
    name: string;
    price: number;
}

interface GenerateInvoiceParams {
    registrationId: string;
    registrationNumber: string;
    registrationCreationTime: Date;
    paymentDeadline: Date;
    contactPerson: ContactPerson | null;
    paymentType: string;
    originalAmount: number;
    discountAmount: number;
    uniqueDeduction: number;
    uniqueAmount: number;
    participants: Participant[];
    ticketData: Ticket | null;
    workshopDetailsMap: Map<string, WorkshopDetail>;
    participantTypeMap: { [key: string]: string }; 
    bankAccount: BankAccount | null;
}

interface GeneratePaidInvoiceParams extends GenerateInvoiceParams {
    qrCodeData: string;
}

// Helper function for currency formatting
function formatCurrency(amount: number): string {
    // Ensure amount is a number, handle potential null/undefined
    const numAmount = Number(amount);
    if (isNaN(numAmount)) {
        return "0"; // Or handle as an error
    }
    return numAmount.toLocaleString('id-ID');
}

export async function sendRegistrationInvoice(
    registrationId: string,
    registrationNumber: string, 
    originalAmount: number,
    discountAmount: number,
    uniqueDeduction: number,
    paymentType: string,
    originalParticipantsData: any[]
): Promise<void> {
    console.log(`Starting invoice generation for registration ${registrationNumber} (ID: ${registrationId})...`);

    try {
        // --- Fetch necessary data upfront ---

        // 1. Fetch Full Registration Data (including participants, contact person, and workshop registrations)
        const { data: fullRegistrationData, error: regError } = await supabaseAdmin
            .from('registrations')
            .select(`
                *,
                participants(*, workshop_registrations(workshop_id)),
                contact_persons(*),
                tickets(*)
            `)
            .eq('id', registrationId)
            .single(); 

        if (regError) {
            console.error(`CRITICAL: Error fetching registration details for ${registrationId}:`, regError);
            throw new Error(`Failed to fetch registration details for ${registrationNumber}`);
        }

        // Extract necessary info from fetched data
        const registrationCreationTime = new Date(fullRegistrationData.created_at);
        const fetchedParticipants = fullRegistrationData.participants || [];
        const contactPerson = fullRegistrationData.contact_persons && fullRegistrationData.contact_persons.length > 0 
                               ? fullRegistrationData.contact_persons[0] 
                               : {} as ContactPerson; 

        // --- Merge attendSymposium flag from original form data ---
        const participantsWithAttendStatus: Participant[] = fetchedParticipants.map((fp: any, index: number) => {
            // Assuming the order of participants in originalParticipantsData matches fetchedParticipants
            const originalParticipant = originalParticipantsData[index];
            return {
                ...fp,
                attendSymposium: originalParticipant?.attendSymposium ?? false // Add the flag back
            };
        });

        // 2. Fetch Workshop Details
        // Extract workshop IDs from the fetched workshop_registrations
        const allWorkshopIds = participantsWithAttendStatus.flatMap((p: Participant) => 
            p.workshop_registrations?.map(wr => wr.workshop_id) || []
        );
        let workshopDetailsMap: Map<string, WorkshopDetail> = new Map();
        if (allWorkshopIds.length > 0) {
            // Filter out any potential undefined/null values just in case
            const validWorkshopIds = allWorkshopIds.filter((id: string | null | undefined): id is string => id != null);
            
            // *** ADDED WORKSHOP DEBUG LOG 1 ***
            console.log(`--- DEBUG: Workshop Fetch - Using valid IDs: ${JSON.stringify(validWorkshopIds)}`);

            if (validWorkshopIds.length > 0) {
                const { data: workshops, error: workshopError } = await supabaseAdmin
                    .from('workshops')
                    .select('id, title, price') 
                    .in('id', validWorkshopIds); 
                    
                // *** ADDED WORKSHOP DEBUG LOG 2 ***
                console.log(`--- DEBUG: Workshop Fetch - Raw Supabase Result: data=${JSON.stringify(workshops)}, error=${JSON.stringify(workshopError)}`);

                if (workshopError) console.error(`Error fetching workshop details for ${registrationNumber}:`, workshopError);
                else if (workshops && Array.isArray(workshops)) { 
                    workshops.forEach(ws => {
                        if (ws && ws.id) {
                            workshopDetailsMap.set(ws.id, { name: ws.title, price: ws.price }); 
                        }
                    });
                }
            } else {
                 console.log(`No valid workshop IDs found after filtering for registration ${registrationNumber}`);
            }
        } else {
            console.log(`No workshop registrations found for participants in registration ${registrationNumber}`);
        }
        console.log(`Fetched workshop details for ${registrationNumber}`);
        // *** ADDED DEBUG LOG for Workshop Details ***
        console.log('--- DEBUG: Workshop Details Map immediately after fetch ---');
        console.log('Map Size:', workshopDetailsMap.size);
        console.log('Map Content:', JSON.stringify(Array.from(workshopDetailsMap.entries()), null, 2));
        console.log('--- END DEBUG ---');

        // 3. Fetch Ticket Details (for symposium title and prices)
        let ticketData: Ticket | null = null;
        const ticketId = fullRegistrationData.ticket_id; // Assuming ticket_id is on registration data
        
        // *** ADDED Check for ticketId ***
        if (!ticketId) {
            console.warn(`Registration ${registrationNumber} (ID: ${registrationId}) does not have a ticket_id. Cannot fetch ticket details.`);
        } else {
            console.log(`Fetching ticket details for ID: ${ticketId}`);
            const { data, error } = await supabaseAdmin
                .from('tickets')
                .select('*') 
                .eq('id', fullRegistrationData.ticket_id)
                .single();
            if (error) console.error(`Error fetching ticket details for ${registrationNumber}:`, error);
            else ticketData = data as Ticket;
        }
        console.log(`Fetched ticket details for ${registrationNumber}`);
        // *** ADDED DEBUG LOG for Ticket Details ***
        console.log('--- DEBUG: Ticket Data immediately after fetch ---');
        console.log('Ticket ID used:', fullRegistrationData.ticket_id);
        console.log('Fetched Ticket Data:', JSON.stringify(ticketData, null, 2));
        console.log('--- END DEBUG ---');

        // --- Fetch Bank Account Details ---
        let activeBankAccounts: BankAccount[] = [];
        try {
            const { data: bankData, error: bankError } = await supabaseAdmin
                .from('bank_accounts')
                // Select correct columns
                .select('bank_name, account_number, account_holder_name') 
                .eq('is_active', true);

            if (bankError) throw bankError;
            activeBankAccounts = bankData || [];
        } catch (error) {
            console.error(`CRITICAL: Error fetching active bank account details:`, error);
            // Continue without bank details, the functions handle null
        }
        console.log(`Fetched bank account details for ${registrationNumber}`);

        // --- Prepare Data for Generation --- 
        const paymentDeadline = new Date(registrationCreationTime.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days deadline

        // *** CORRECT VARIABLE ASSIGNMENTS ***
        const paymentType = fullRegistrationData.payment_type ?? 'bank_transfer'; // Get from registration data
        const originalAmount = fullRegistrationData.total_amount ?? 0;           // Get from registration data
        const discountAmount = fullRegistrationData.discount_amount ?? 0;        // Get from registration data
        const uniqueAmount = fullRegistrationData.final_amount ?? 0;            // Get from registration data
        const uniqueDeduction = originalAmount - uniqueAmount;                 // Calculate deduction

        // Ensure workshopDetailsMap is correctly populated (assuming fetch logic above is correct)
        // Ensure ticketData is correctly populated (assuming fetch logic above is correct)
        const bankAccount = activeBankAccounts.length > 0 ? activeBankAccounts[0] : null;

        // Check if essential data is missing
        if (!contactPerson) {
            console.error(`CRITICAL: No contact person found for registration ${registrationNumber}. Cannot send invoice.`);
            return; 
        }

        // --- Calculate Payment Deadline ---
        // const paymentDeadline = new Date(registrationCreationTime.getTime() + 3 * 24 * 60 * 60 * 1000); 

        // --- Generate Content ---

        // *** DEBUG LOGGING START ***
        console.log('\n--- DEBUG: Data before calling generateInvoiceHtml/Pdf ---');
        console.log('Registration ID:', registrationId);
        console.log('Registration Number:', registrationNumber);
        console.log('Registration Creation Time:', registrationCreationTime);
        console.log('Payment Deadline:', paymentDeadline);
        console.log('Contact Person:', JSON.stringify(contactPerson, null, 2));
        console.log('Payment Type:', paymentType); // Corrected
        console.log('Original Amount:', originalAmount, '(Type:', typeof originalAmount, ')'); // Corrected
        console.log('Discount Amount:', discountAmount, '(Type:', typeof discountAmount, ')'); // Corrected
        console.log('Unique Deduction:', uniqueDeduction, '(Type:', typeof uniqueDeduction, ')'); // Corrected
        console.log('Unique Amount:', uniqueAmount, '(Type:', typeof uniqueAmount, ')'); // Corrected
        console.log('Participants Array Length:', participantsWithAttendStatus.length);
        console.log('Participants Data:', JSON.stringify(participantsWithAttendStatus, null, 2));
        console.log('Ticket Data:', JSON.stringify(ticketData, null, 2));
        console.log('Workshop Details Map Size:', workshopDetailsMap.size);
        console.log('Workshop Details Map Content:', JSON.stringify(Array.from(workshopDetailsMap.entries()), null, 2));
        console.log('Participant Type Map:', JSON.stringify(participantTypeMap, null, 2));
        console.log('Selected Bank Account:', JSON.stringify(bankAccount, null, 2));
        console.log('--- DEBUG LOGGING END ---\n');
        // *** DEBUG LOGGING END ***

        const generationParams: GenerateInvoiceParams = {
            registrationId,
            registrationNumber,
            registrationCreationTime,
            paymentDeadline,
            contactPerson,
            paymentType,
            originalAmount,
            discountAmount,
            uniqueDeduction,
            uniqueAmount,
            participants: participantsWithAttendStatus,
            ticketData,
            workshopDetailsMap,
            participantTypeMap,
            bankAccount
        };

        const htmlContent = generateInvoiceHtml(generationParams);
        const pdfBuffer = await generateInvoicePdf(generationParams);

        console.log(`Generated HTML and PDF for ${registrationNumber}`);

        // --- Send Email --- 
        const emailSubject = `Invoice Pendaftaran MVCU 2025 - ${registrationNumber}`;
        const recipientEmail = contactPerson?.email; 

        if (!recipientEmail) {
             console.error(`CRITICAL: No recipient email found for registration ${registrationNumber}. Cannot send invoice.`);
             return; 
        }

        try {
            await resend.emails.send({
                from: 'Panitia MVCU 2025 <panitia.mcvu@perkimakassar.com>',
                to: [recipientEmail],
                cc: ['mcvu2025@gmail.com'], // <<< ADDED CC
                subject: emailSubject,
                html: htmlContent,
                attachments: [ { filename: `Invoice_MVCU2025_${registrationNumber}.pdf`, content: pdfBuffer } ], 
            });
            console.log(`Invoice email successfully sent for ${registrationNumber} to ${recipientEmail}.`);
        } catch (emailError) {
            console.error(`Failed to send invoice email for ${registrationNumber} to ${recipientEmail}:`, emailError);
        }

    } catch (error) {
        console.error(`Unhandled error during invoice generation/sending for ${registrationNumber}:`, error);
    }

    console.log(`Invoice generation and sending process complete for ${registrationNumber}.`);
}

// --- Helper Functions --- 

function generateInvoiceHtml(params: GenerateInvoiceParams): string {
    const {
        registrationNumber,
        registrationCreationTime,
        paymentDeadline, 
        contactPerson,
        paymentType,
        originalAmount,
        discountAmount,
        uniqueDeduction,
        uniqueAmount,
        participants, // Destructured here
        ticketData,
        workshopDetailsMap,
        participantTypeMap, 
        bankAccount,
    } = params;

    console.log(`Generating HTML for ${registrationNumber}`);

    // Safely get symposium title
    const symposiumTitle = ticketData?.name ?? 'Symposium'; // Use title from ticketData, fallback

    // --- Generate Order Details Table --- 
    let orderDetailsHtmlRows = '';
    participants.forEach((p) => {
        const participantTypeDisplay = participantTypeMap[p.participant_type] || p.participant_type;
        let firstItem = true; // Flag to only show name on the first row for this participant

        // Add Symposium Row if attending
        if (p.attendSymposium && ticketData) { // Ensure ticketData exists
            let symposiumPrice = 0;

            // --- Refactored Price Lookup --- 
            switch (p.participant_type) {
                case 'specialist_doctor':
                    symposiumPrice = ticketData.price_specialist_doctor ?? 0;
                    break;
                case 'general_doctor':
                    symposiumPrice = ticketData.price_general_doctor ?? 0;
                    break;
                case 'nurse':
                    symposiumPrice = ticketData.price_nurse ?? 0;
                    break;
                case 'student':
                    symposiumPrice = ticketData.price_student ?? 0;
                    break;
                case 'resident': // Assuming resident uses general_doctor price if not specified
                    symposiumPrice = ticketData.price_general_doctor ?? 0; 
                    break;
                case 'other':
                    symposiumPrice = ticketData.price_other ?? 0;
                    break;
                default:
                    console.warn(`Unknown participant type for price lookup: ${p.participant_type}`);
                    symposiumPrice = 0; // Default to 0 if type not found
            }
            // --- End Refactor ---

            orderDetailsHtmlRows += `
            <tr>
                <td style="padding: 5px 0;">${firstItem ? p.full_name : ''}</td> 
                <td style="padding: 5px 0;">${symposiumTitle}</td> 
                <td style="padding: 5px 0;">${participantTypeDisplay}</td>
                <td style="padding: 5px 0; text-align: right;">${symposiumPrice > 0 ? formatCurrency(symposiumPrice) : 'N/A'}</td>
            </tr>`;
            firstItem = false; // Reset flag after first row
        }

        if (p.workshop_registrations && p.workshop_registrations.length > 0) {
            p.workshop_registrations.forEach(ws => {
                const workshop = workshopDetailsMap.get(ws.workshop_id);
                const wsName = workshop?.name || `Workshop ${ws.workshop_id}`; // Use workshop.name
                const wsPrice = workshop?.price ?? 0;
                orderDetailsHtmlRows += `
                <tr>
                    <td style="padding: 5px 0;">${firstItem ? p.full_name : ''}</td> 
                    <td style="padding: 5px 0;">${wsName}</td>
                    <td style="padding: 5px 0;">${participantTypeDisplay}</td>
                    <td style="padding: 5px 0; text-align: right;">${wsPrice > 0 ? formatCurrency(wsPrice) : 'N/A'}</td>
                </tr>`;
                firstItem = false; // Reset flag after first row
            });
        }
    });

    const orderDetailsTableHtml = `
     <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.95em;">
         <thead>
             <tr style="border-bottom: 1px solid #ddd; text-align: left; font-weight: bold;">
                 <th style="padding: 8px 0;">Peserta</th>
                 <th style="padding: 8px 0;">Item</th>
                 <th style="padding: 8px 0;">Kategori</th>
                 <th style="padding: 8px 0; text-align: right;">Harga (IDR)</th>
             </tr>
         </thead>
         <tbody>
             ${orderDetailsHtmlRows}
         </tbody>
     </table>`;

    // --- Generate Payment Details Section --- 
    let paymentDetailsHtml = '';
    // Use the passed paymentType parameter
    if (paymentType === 'sponsor') { 
         paymentDetailsHtml = '<p>Pembayaran akan diproses melalui sponsor.</p>';
     } else {
        paymentDetailsHtml = `
            <table style="width: 100%; max-width: 400px; margin-left: auto; margin-bottom: 20px; text-align: right;">
                 <tr>
                     <td>Subtotal:</td>
                     <td style="padding-left: 15px;">Rp ${formatCurrency(originalAmount)},-</td>
                 </tr>
                 ${discountAmount > 0 ? `
                 <tr>
                     <td>Diskon:</td>
                     <td style="padding-left: 15px;">- Rp ${formatCurrency(discountAmount)},-</td>
                 </tr>
                 ` : ''}
                 <tr>
                     <td>Kode Unik Pengurang:</td>
                     <td style="padding-left: 15px;">- Rp ${(originalAmount - discountAmount - uniqueAmount).toLocaleString('id-ID')},-</td>
                 </tr>
                 <tr style="border-top: 1px solid #ddd; font-weight: bold; font-size: 1.1em;">
                     <td style="padding-top: 8px;">Total Tagihan:</td>
                     <td style="padding-left: 15px; padding-top: 8px;">Rp ${formatCurrency(uniqueAmount)},-</td>
                 </tr>
            </table>

            <p style="text-align: center; font-size: 1.1em;">Mohon transfer sejumlah <strong>Rp ${formatCurrency(uniqueAmount)},-</strong> (persis) untuk mempercepat proses verifikasi otomatis.</p>
            
            <div style="margin-top: 20px; padding: 15px; border: 1px solid #ddd; background-color: #f9f9f9;">
                 <h4>Instruksi Pembayaran:</h4>
                 <p>Silakan lakukan transfer ke rekening berikut:</p>
                 ${bankAccount ? `
                 <p style="margin-left: 15px;">
                     <strong>${bankAccount.bank_name}</strong><br>
                     Nomor Rekening: <strong>${bankAccount.account_number}</strong><br>
                     Atas Nama: <strong>${bankAccount.account_holder_name}</strong>
                 </p>
                 ` : `
                 <p style="margin-left: 15px; color: red;">Informasi Rekening Bank tidak tersedia. Silakan hubungi panitia.</p>
                 `}
                 <p>Batas waktu pembayaran: <strong>${paymentDeadline.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} pukul ${paymentDeadline.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })} WITA</strong></p> 
            </div>
            
            <p style="margin-top: 20px; font-style: italic; color: #555;">
                Pembayaran Anda akan diverifikasi secara otomatis dalam 1x24 jam hari kerja setelah transfer (pastikan jumlah sesuai kode unik). Anda akan menerima email konfirmasi beserta tiket elektronik terpisah setelah pembayaran berhasil diverifikasi.
            </p>
        `;
    }

    // Construct the full HTML email
    return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice Pendaftaran MVCU 2025 - ${registrationNumber}</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
            .email-wrapper { background-color: #f4f4f4; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            h1, h2, h3, h4 { color: #0d47a1; } /* Darker Blue */
            h1 { font-size: 1.8em; text-align: center; margin-bottom: 25px; color: #0d47a1; }
            h2 { font-size: 1.4em; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px; margin-top: 30px; margin-bottom: 15px; }
            h3 { font-size: 1.2em; margin-top: 25px; margin-bottom: 10px; }
            h4 { margin-bottom: 5px; color: #1565c0; } /* Lighter Blue */
            p { margin: 10px 0; font-size: 1em; }
            strong { font-weight: 600; }
            table { width: 100%; border-collapse: collapse; font-size: 0.95em; }
            th, td { text-align: left; padding: 8px 5px; }
            th { border-bottom: 1px solid #ccc; font-weight: 600; }
            td { border-bottom: 1px solid #eee; }
            .footer { margin-top: 30px; text-align: center; font-size: 0.9em; color: #777; border-top: 1px solid #eee; padding-top: 15px; }
            .bank-info { margin-top: 20px; padding: 15px; border: 1px solid #e0e0e0; background-color: #f9f9f9; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="container">
                <h1>Invoice Pendaftaran MVCU 2025</h1>
                <div style="text-align: right; margin-bottom: 20px;">
                    No: ${registrationNumber}<br>
                    Tanggal Dibuat: ${registrationCreationTime instanceof Date && !isNaN(registrationCreationTime.getTime()) ? registrationCreationTime.toLocaleDateString('id-ID') : 'N/A'}<br>
                    <strong style="color: orange;">Status: Belum Lunas</strong><br>
                    ${paymentType !== 'sponsor' ? `Batas Pembayaran: ${paymentDeadline instanceof Date && !isNaN(paymentDeadline.getTime()) ? paymentDeadline.toLocaleDateString('id-ID') : 'N/A'}` : ''}
                </div>
                <div style="margin-bottom: 20px;">
                <p>Yth. <strong>${contactPerson?.name ?? 'Peserta'}</strong>,</p>
                <p>Terima kasih telah melakukan pendaftaran untuk The 1st Makassar Vascular Conference Update (MVCU) 2025. Berikut adalah detail pendaftaran dan instruksi pembayaran Anda:</p>
                <p>Nomor Pendaftaran: <strong>${registrationNumber}</strong></p>
                <p>Tanggal Pendaftaran: <strong>${registrationCreationTime instanceof Date && !isNaN(registrationCreationTime.getTime()) ? registrationCreationTime.toLocaleDateString('id-ID') : 'N/A'}</strong></p>
                
                <h2>Detail Kontak Pendaftar</h2>
                <p>Nama: ${contactPerson?.name ?? 'N/A'}</p>
                <p>Email: ${contactPerson?.email ?? 'N/A'}</p>
                <p>Telepon: ${contactPerson?.phone ?? 'N/A'}</p>

                <h2>Rincian Pemesanan</h2>
                ${orderDetailsTableHtml}
                
                <h2>Detail Pembayaran</h2>
                <p>Metode Pembayaran: ${paymentType === 'sponsor' ? 'Sponsor' : 'Transfer Bank'}</p>
                ${paymentDetailsHtml}

                <p style="margin-top: 25px;">Invoice ini juga terlampir dalam format PDF untuk referensi Anda.</p>
                <p>Jika Anda memiliki pertanyaan, jangan ragu untuk menghubungi panitia melalui email [email panitia] atau WhatsApp [nomor WA panitia].</p>

                <div class="footer">
                    Hormat kami,<br>
                    Panitia MVCU 2025<br>
                    [Informasi Kontak Panitia Tambahan Jika Ada]
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

export async function generateInvoicePdf(
    params: GenerateInvoiceParams
): Promise<Buffer> {
    const {
        registrationNumber,
        registrationCreationTime,
        paymentDeadline,
        contactPerson,
        paymentType,
        originalAmount,
        discountAmount,
        uniqueDeduction,
        uniqueAmount,
        participants, // Destructured here
        ticketData,
        workshopDetailsMap,
        participantTypeMap,
        bankAccount
    } = params;

    console.log(`Generating PDF for ${registrationNumber}`);
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // --- Define Layout Constants ---
    const leftMargin = 50;
    const rightMargin = 50;
    const topMargin = 50;
    const bottomMargin = 50;
    const contentWidth = width - leftMargin - rightMargin;
    const defaultFontSize = 10;
    const smallFontSize = 8;
    const largeFontSize = 14;
    const lineSpacing = 14; // Base spacing between lines
    const sectionSpacing = 20; // Space between major sections
    const tableHeaderFontSize = 9;
    const tableCellFontSize = 9;
    const grayColor = rgb(0.3, 0.3, 0.3);
    const lightGrayColor = rgb(0.9, 0.9, 0.9);
    const tableBorderColor = rgb(0.8, 0.8, 0.8);

    let yPosition = height - topMargin;

    // --- Helper Functions (scoped within generateInvoicePdf) ---
    const drawText = (text: string, x: number, y: number, size = defaultFontSize, useBold = false, color = grayColor, align: 'left' | 'right' | 'center' = 'left') => {
        const selectedFont = useBold ? boldFont : font;
        let textWidth = 0;
        if (align !== 'left') {
            textWidth = selectedFont.widthOfTextAtSize(text, size);
        }
        let adjustedX = x;
        if (align === 'right') {
            adjustedX = x - textWidth;
        } else if (align === 'center') {
            adjustedX = x - textWidth / 2;
        }

        page.drawText(text, {
            x: adjustedX,
            y: y,
            font: selectedFont,
            size: size,
            color: color,
        });
        return y; // Return current y for chaining
    };

    const moveYDown = (currentY: number, spacing = lineSpacing) => {
        return currentY - spacing;
    };

    // --- Helper: Truncate text if too wide ---
    const truncateText = (text: string, maxWidth: number, fontInstance: PDFFont, size: number): string => {
        let textWidth = fontInstance.widthOfTextAtSize(text, size);
        if (textWidth <= maxWidth) {
            return text;
        }
        // Simple truncation with ellipsis
        let truncated = text;
        while (textWidth > maxWidth && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
            textWidth = fontInstance.widthOfTextAtSize(truncated + '...', size);
        }
        return truncated + '...';
    };

    // --- Header Section ---
    // Logo Placeholder (Top Left)
    const logoHeight = 40;
    const logoWidth = 120;
    page.drawRectangle({ 
        x: leftMargin, 
        y: yPosition - logoHeight, 
        width: logoWidth, 
        height: logoHeight, 
        borderColor: lightGrayColor, 
        borderWidth: 1 
    });
    drawText('Logo', leftMargin + logoWidth / 2, yPosition - logoHeight / 2 - 6, defaultFontSize, false, rgb(0.6, 0.6, 0.6), 'center');

    // Invoice Title (Top Right)
    drawText('INVOICE', width - rightMargin, yPosition - 10, largeFontSize, true, grayColor, 'right');
    yPosition = moveYDown(yPosition, logoHeight + 5); // Move below logo/title area

    // Invoice Details (Below Title, Right Aligned)
    let infoY = yPosition + 25; // Align near where Title was
    infoY = moveYDown(drawText(`No: ${registrationNumber}`, width - rightMargin, infoY, defaultFontSize, false, grayColor, 'right'), lineSpacing * 0.8);
    infoY = moveYDown(drawText(`Tanggal Dibuat: ${registrationCreationTime instanceof Date && !isNaN(registrationCreationTime.getTime()) ? registrationCreationTime.toLocaleDateString('id-ID') : 'N/A'}`, width - rightMargin, infoY, defaultFontSize, false, grayColor, 'right'), lineSpacing * 0.8);
    if (paymentType !== 'sponsor') {
        infoY = moveYDown(drawText(`Batas Pembayaran: ${paymentDeadline instanceof Date && !isNaN(paymentDeadline.getTime()) ? paymentDeadline.toLocaleDateString('id-ID') : 'N/A'}`, width - rightMargin, infoY, defaultFontSize, false, grayColor, 'right'), lineSpacing * 0.8);
    }
    drawText('Status: Belum Lunas', width - rightMargin, infoY, defaultFontSize, true, rgb(1, 0.5, 0), 'right'); // <<< ADDED STATUS

    yPosition = moveYDown(yPosition, sectionSpacing); // Space before next section

    // --- Billing Information ---
    drawText('Ditagihkan Kepada:', leftMargin, yPosition, defaultFontSize, true);
    yPosition = moveYDown(yPosition, lineSpacing * 0.8);
    if (contactPerson) {
        yPosition = moveYDown(drawText(contactPerson.name || 'Nama Kontak Tidak Tersedia', leftMargin + 10, yPosition), lineSpacing * 0.8);
        yPosition = moveYDown(drawText(contactPerson.email || 'Email Tidak Tersedia', leftMargin + 10, yPosition), lineSpacing * 0.8);
        yPosition = moveYDown(drawText(contactPerson.phone || 'Telepon Tidak Tersedia', leftMargin + 10, yPosition), lineSpacing * 0.8);
    } else {
        yPosition = moveYDown(drawText('Informasi Kontak Tidak Ditemukan', leftMargin + 10, yPosition, defaultFontSize, false, rgb(0.8, 0, 0)), lineSpacing * 0.8);
    }
    yPosition = moveYDown(yPosition, sectionSpacing);

    // --- Order Details Table ---
    drawText('Rincian Pemesanan:', leftMargin, yPosition, defaultFontSize, true);
    yPosition = moveYDown(yPosition, lineSpacing * 1.2);

    // Table Header
    const tableTopY = yPosition;
    const nameX = 50;
    const itemX = 155; // Start Item column further right
    const categoryX = 350; // Start Category column further right
    const priceX = 455; // Start Price column
    const nameMaxWidth = itemX - nameX - 5; // Approx 100
    const itemMaxWidth = categoryX - itemX - 5; // Approx 190
    const categoryMaxWidth = (width - rightMargin) - categoryX - 5; // Approx 190
    const priceWidth = 90; // Width for price column (right aligned)
    
    page.drawRectangle({ // Header Background
        x: leftMargin,
        y: yPosition - tableHeaderFontSize - 4, 
        width: contentWidth,
        height: tableHeaderFontSize + 8,
        color: lightGrayColor,
        opacity: 0.5,
    });
    drawText('Item', itemX, yPosition, tableHeaderFontSize, true);
    drawText('Kategori Peserta', categoryX, yPosition, tableHeaderFontSize, true);
    drawText('Harga (IDR)', width - rightMargin, yPosition, tableHeaderFontSize, true, grayColor, 'right');
    yPosition = moveYDown(yPosition, tableHeaderFontSize + 8 + 5); // Space after header

    let participantNameForCurrentRow = ''; // Name for the current participant being processed

    const drawRow = (item: string, category: string, price: number | string) => {
        const priceString = typeof price === 'number' ? (price > 0 ? `Rp ${formatCurrency(price)}` : 'N/A') : price;
        const rowStartY = yPosition;
        
        // Use helper to draw text, adjusting y slightly for vertical center
        const truncatedName = truncateText(participantNameForCurrentRow, nameMaxWidth, font, tableCellFontSize);
        const truncatedItem = truncateText(item, itemMaxWidth, font, tableCellFontSize);
        const truncatedCategory = truncateText(category, categoryMaxWidth, font, tableCellFontSize);

        drawText(truncatedName, nameX, rowStartY - tableCellFontSize * 0.7, tableCellFontSize, false);
        drawText(truncatedItem, itemX, rowStartY - tableCellFontSize * 0.7, tableCellFontSize, false);
        drawText(truncatedCategory, categoryX, rowStartY - tableCellFontSize * 0.7, tableCellFontSize, false);
        drawText(priceString, width - rightMargin, rowStartY - tableCellFontSize * 0.7, tableCellFontSize, false, grayColor, 'right');

        // Draw horizontal line after row content
        const lineY = moveYDown(rowStartY, lineSpacing) + 5; // Position line below text
        page.drawLine({ 
            start: { x: leftMargin, y: lineY }, 
            end: { x: width - rightMargin, y: lineY }, 
            thickness: 0.5, 
            color: tableBorderColor 
        });

        yPosition = moveYDown(rowStartY, lineSpacing); // Move Y down for next potential row
        participantNameForCurrentRow = ''; // Clear name after drawing the row
    };

    // Iterate through participants and draw rows
    participants.forEach((p: Participant) => {
        const participantTypeDisplay = participantTypeMap[p.participant_type] || p.participant_type;
        participantNameForCurrentRow = p.full_name; // Set name for the first item

        // Add Symposium Row if attending
        if (p.attendSymposium && ticketData) {
            const symposiumTitle = ticketData?.name ?? 'Symposium';
            let symposiumPrice = 0;

            // --- Refactored Price Lookup --- 
            switch (p.participant_type) {
                case 'specialist_doctor':
                    symposiumPrice = ticketData.price_specialist_doctor ?? 0;
                    break;
                case 'general_doctor':
                    symposiumPrice = ticketData.price_general_doctor ?? 0;
                    break;
                case 'nurse':
                    symposiumPrice = ticketData.price_nurse ?? 0;
                    break;
                case 'student':
                    symposiumPrice = ticketData.price_student ?? 0;
                    break;
                case 'resident': // Assuming resident uses general_doctor price if not specified
                    symposiumPrice = ticketData.price_general_doctor ?? 0; 
                    break;
                case 'other':
                    symposiumPrice = ticketData.price_other ?? 0;
                    break;
                default:
                    console.warn(`Unknown participant type for price lookup: ${p.participant_type}`);
                    symposiumPrice = 0; // Default to 0 if type not found
            }
            // --- End Refactor ---

            drawRow(symposiumTitle, participantTypeDisplay, symposiumPrice);
        }

        // Workshop Entries
        if (p.workshop_registrations && p.workshop_registrations.length > 0) {
            p.workshop_registrations.forEach((ws: { workshop_id: string }) => {
                const workshop = workshopDetailsMap.get(ws.workshop_id);
                const wsName = workshop?.name || `Workshop ${ws.workshop_id}`;
                const wsPrice = workshop?.price ?? 0;
                drawRow(wsName, participantTypeDisplay, wsPrice);
            });
        }
        // Ensure name is cleared if participant had no items (edge case)
        if (participantNameForCurrentRow === p.full_name) { 
             participantNameForCurrentRow = '';
        }
    });

    yPosition = moveYDown(yPosition, 5); // Add a small padding after the last row's line

    // --- Totals Section --- (Right Aligned)
    if (paymentType !== 'sponsor') {
        const totalLabelX = 300;
        const totalValueX = width - rightMargin; // Align values to actual right margin
        let totalY = yPosition;

        totalY = moveYDown(totalY, lineSpacing * 0.5); // Space before totals

        totalY = moveYDown(drawText('Subtotal:', totalLabelX, totalY, defaultFontSize, false), lineSpacing);
        drawText(`Rp ${formatCurrency(originalAmount)}`, totalValueX, totalY + lineSpacing, defaultFontSize, false, grayColor, 'right'); 

        totalY = moveYDown(drawText('Diskon:', totalLabelX, totalY, defaultFontSize, false), lineSpacing);
        drawText(`- Rp ${formatCurrency(discountAmount)}`, totalValueX, totalY + lineSpacing, defaultFontSize, false, grayColor, 'right');

        totalY = moveYDown(drawText('Kode Unik Pengurang:', totalLabelX, totalY, defaultFontSize, false), lineSpacing);
        const actualUniqueDeduction = (originalAmount - discountAmount) - uniqueAmount; // Calculate actual deduction
        const displayDeduction = Math.abs(actualUniqueDeduction) < 0.01 ? 0 : actualUniqueDeduction;
        drawText(`- Rp ${formatCurrency(displayDeduction)}`, totalValueX, totalY + lineSpacing, defaultFontSize, false, grayColor, 'right');

        totalY = moveYDown(totalY, lineSpacing * 0.5); // Space before line
        page.drawLine({ start: { x: totalLabelX - 10, y: totalY }, end: { x: width - rightMargin, y: totalY }, thickness: 1, color: grayColor });
        totalY = moveYDown(totalY, lineSpacing * 0.7); // Space after line

        drawText('Total Tagihan:', totalLabelX, totalY, defaultFontSize, true, grayColor, 'right');
        drawText(`Rp ${formatCurrency(uniqueAmount)}`, totalValueX, totalY, defaultFontSize, true, grayColor, 'right');
        yPosition = moveYDown(totalY, sectionSpacing); // Move main Y down past totals
    } else {
         yPosition = moveYDown(yPosition, lineSpacing); // Add some space even if sponsor
    }

    // --- Payment Instructions / Sponsor Note ---
    drawText('Instruksi Pembayaran:', leftMargin, yPosition, defaultFontSize, true);
    yPosition = moveYDown(yPosition, lineSpacing * 0.8);

    if (paymentType !== 'sponsor') {
        yPosition = moveYDown(drawText(`Mohon transfer SEJUMLAH PERSIS: Rp ${formatCurrency(uniqueAmount)}`, leftMargin + 10, yPosition), lineSpacing * 0.8);
        yPosition = moveYDown(drawText(`Batas Waktu Pembayaran: ${paymentDeadline instanceof Date && !isNaN(paymentDeadline.getTime()) ? paymentDeadline.toLocaleDateString('id-ID') : 'N/A'}`, leftMargin + 10, yPosition), lineSpacing * 0.8);
        if (bankAccount) {
             yPosition = moveYDown(drawText(`Ke Rekening Bank ${bankAccount.bank_name}:`, leftMargin + 10, yPosition), lineSpacing * 0.8);
             yPosition = moveYDown(drawText(`No. Rek: ${bankAccount.account_number}`, leftMargin + 25, yPosition, defaultFontSize, true), lineSpacing * 0.8);
             yPosition = moveYDown(drawText(`A/N: ${bankAccount.account_holder_name}`, leftMargin + 25, yPosition, defaultFontSize, true), lineSpacing * 0.8);
        } else {
             yPosition = moveYDown(drawText('Informasi Rekening Bank Tidak Tersedia. Hubungi panitia.', leftMargin + 10, yPosition, defaultFontSize, false, rgb(0.8, 0, 0)), lineSpacing * 0.8);
        }
    } else {
         yPosition = moveYDown(drawText('Pembayaran akan diproses oleh sponsor.', leftMargin + 10, yPosition), lineSpacing * 0.8);
    }
    yPosition = moveYDown(yPosition, sectionSpacing);

    // --- Footer Notes --- 
    drawText('Catatan:', leftMargin, yPosition, smallFontSize, true);
    yPosition = moveYDown(yPosition, lineSpacing * 0.7);
    if (paymentType !== 'sponsor') { 
        yPosition = moveYDown(drawText('- Pastikan jumlah transfer sesuai hingga digit terakhir untuk verifikasi otomatis.', leftMargin + 10, yPosition, smallFontSize), lineSpacing * 0.7);
        yPosition = moveYDown(drawText('- Pembayaran diverifikasi dalam 1x24 jam hari kerja.', leftMargin + 10, yPosition, smallFontSize), lineSpacing * 0.7);
        yPosition = moveYDown(drawText('- Anda akan menerima email konfirmasi & tiket elektronik setelah pembayaran berhasil diverifikasi.', leftMargin + 10, yPosition, smallFontSize), lineSpacing * 0.7);
    } else {
        yPosition = moveYDown(drawText('- Konfirmasi pendaftaran akan dikirim setelah sponsor melakukan pembayaran.', leftMargin + 10, yPosition, smallFontSize), lineSpacing * 0.7);
    }
    yPosition = moveYDown(drawText('- Hubungi panitia jika ada pertanyaan.', leftMargin+10, yPosition, smallFontSize), lineSpacing * 0.7);

    // --- Footer --- (Centered at bottom)
    const footerText = "Panitia MVCU 2025 - Invoice ini sah tanpa tanda tangan.";
    drawText(footerText, width / 2, bottomMargin, smallFontSize, false, rgb(0.5, 0.5, 0.5), 'center');

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes); // Ensure return type is Buffer
}

export async function generatePaidInvoicePdf(
    params: GeneratePaidInvoiceParams
): Promise<Buffer> {
    const {
        registrationNumber,
        registrationCreationTime,
        // paymentDeadline, // Not needed for paid invoice
        contactPerson,
        // paymentType, // Not strictly needed, but keep for context?
        originalAmount,
        discountAmount,
        // uniqueDeduction, // Not relevant for paid invoice display
        uniqueAmount, // Final paid amount
        participants,
        ticketData,
        workshopDetailsMap,
        participantTypeMap, 
        qrCodeData, // <<< New parameter
        // bankAccount // Not needed for paid invoice
    } = params;

    console.log(`Generating PAID PDF Invoice for ${registrationNumber}`);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const lightGrayColor = '#D3D3D3';
    const grayColor = '#555555';
    const greenColor = '#008000'; // Green for 'Lunas'
    const defaultFontSize = 10;
    const titleFontSize = 18;
    const headerFontSize = 12;
    const lineSpacing = 15;
    const sectionSpacing = 25;
    const leftMargin = 50;
    const rightMargin = 50;
    const width = doc.page.width;

    // --- Header --- (Logo Placeholder, Invoice Details)
    // Placeholder for Logo
    doc.rect(leftMargin, leftMargin, 150, 50).stroke(lightGrayColor);
    doc.fontSize(10).fillColor(grayColor).text('Logo', leftMargin + 55, leftMargin + 20);

    // Invoice Details (Right Aligned)
    let yPosition = leftMargin;
    doc.fillColor('black').font('Helvetica-Bold').fontSize(titleFontSize).text('INVOICE', { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(defaultFontSize);
    doc.text(`No: ${registrationNumber}`, { align: 'right' });
    doc.text(`Tanggal Dibuat: ${registrationCreationTime instanceof Date && !isNaN(registrationCreationTime.getTime()) ? registrationCreationTime.toLocaleDateString('id-ID') : 'N/A'}`, { align: 'right' });
    doc.font('Helvetica-Bold').fillColor(greenColor).text('Status: Lunas', { align: 'right' }); // <<< LUNAS STATUS
    doc.fillColor('black').font('Helvetica'); // Reset color
    yPosition = doc.y + sectionSpacing; // Update Y position

    // --- Billing Info --- (Ditagihkan Kepada)
    doc.font('Helvetica-Bold').fontSize(headerFontSize).text('Ditagihkan Kepada:', leftMargin, yPosition);
    doc.font('Helvetica').fontSize(defaultFontSize);
    doc.text(contactPerson?.name ?? 'N/A', leftMargin);
    doc.text(contactPerson?.email ?? 'N/A', leftMargin);
    doc.text(contactPerson?.phone ?? 'N/A', leftMargin);
    yPosition = doc.y + sectionSpacing;

    // --- Rincian Pemesanan Table ---
    doc.font('Helvetica-Bold').fontSize(headerFontSize).text('Rincian Pemesanan:', leftMargin, yPosition, { underline: true });
    doc.moveDown(1.5);
    yPosition = doc.y;

    const tableTop = yPosition;
    const nameX = 50;         const nameWidth = 100;
    const itemX = 155;        const itemWidth = 190;
    const categoryX = 350;    const categoryWidth = 100;
    const priceX = 455;       const priceWidth = 90;
    const rowHeight = 20;

    // Table Header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Nama Peserta', nameX, tableTop, { width: nameWidth });
    doc.text('Item', itemX, tableTop, { width: itemWidth });
    doc.text('Kategori', categoryX, tableTop, { width: categoryWidth });
    doc.text('Harga (IDR)', width - rightMargin, tableTop, { width: priceWidth, align: 'right' });
    doc.moveTo(nameX, doc.y).lineTo(priceX + priceWidth, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica');
    let currentY = doc.y;

    // Table Rows (Loop through participants and items)
    participants.forEach((p: Participant) => {
        const participantTypeDisplay = participantTypeMap[p.participant_type] || p.participant_type;
        let firstItem = true;

        // Add Symposium Row if attending
        if (p.attendSymposium && ticketData) {
            const symposiumTitle = ticketData?.name ?? 'Symposium';
            let symposiumPrice = 0;

            // --- Refactored Price Lookup --- 
            switch (p.participant_type) {
                case 'specialist_doctor':
                    symposiumPrice = ticketData.price_specialist_doctor ?? 0;
                    break;
                case 'general_doctor':
                    symposiumPrice = ticketData.price_general_doctor ?? 0;
                    break;
                case 'nurse':
                    symposiumPrice = ticketData.price_nurse ?? 0;
                    break;
                case 'student':
                    symposiumPrice = ticketData.price_student ?? 0;
                    break;
                case 'resident': // Assuming resident uses general_doctor price if not specified
                    symposiumPrice = ticketData.price_general_doctor ?? 0; 
                    break;
                case 'other':
                    symposiumPrice = ticketData.price_other ?? 0;
                    break;
                default:
                    console.warn(`Unknown participant type for price lookup: ${p.participant_type}`);
                    symposiumPrice = 0; // Default to 0 if type not found
            }
            // --- End Refactor ---

            const nameText = firstItem ? p.full_name || 'N/A' : '';
            const symposiumName = symposiumTitle;
            const categoryText = participantTypeDisplay;
            const priceText = symposiumPrice > 0 ? formatCurrency(symposiumPrice) : 'N/A';

            const nameHeight = doc.heightOfString(nameText, { width: nameWidth });
            const itemHeight = doc.heightOfString(symposiumName, { width: itemWidth });
            const categoryHeight = doc.heightOfString(categoryText, { width: categoryWidth });
            const currentActualRowHeight = Math.max(nameHeight, itemHeight, categoryHeight, rowHeight);

            doc.text(nameText, nameX, currentY, { width: nameWidth, lineBreak: true });
            doc.text(symposiumName, itemX, currentY, { width: itemWidth, lineBreak: true });
            doc.text(categoryText, categoryX, currentY, { width: categoryWidth, lineBreak: true });
            doc.text(priceText, width - rightMargin, currentY, { width: priceWidth, align: 'right' });

            currentY += currentActualRowHeight + 5;
            firstItem = false;
        }

        if (p.workshop_registrations && p.workshop_registrations.length > 0) {
            p.workshop_registrations.forEach((reg: { workshop_id: string }) => {
                const workshop = workshopDetailsMap.get(reg.workshop_id);
                const wsName = workshop?.name || `Workshop ${reg.workshop_id}`; // Use workshop.name
                const wsPrice = workshop?.price ?? 0;

                const nameText = firstItem ? p.full_name || 'N/A' : '';
                const workshopName = wsName;
                const categoryText = participantTypeDisplay;
                const priceText = formatCurrency(wsPrice);

                const nameHeight = doc.heightOfString(nameText, { width: nameWidth });
                const itemHeight = doc.heightOfString(workshopName, { width: itemWidth });
                const categoryHeight = doc.heightOfString(categoryText, { width: categoryWidth });
                const currentActualRowHeight = Math.max(nameHeight, itemHeight, categoryHeight, rowHeight);

                doc.text(nameText, nameX, currentY, { width: nameWidth, lineBreak: true });
                doc.text(workshopName, itemX, currentY, { width: itemWidth, lineBreak: true });
                doc.text(categoryText, categoryX, currentY, { width: categoryWidth, lineBreak: true });
                doc.text(priceText, width - rightMargin, currentY, { width: priceWidth, align: 'right' });

                currentY += currentActualRowHeight + 5;
                firstItem = false;
            });
        }
        // Add small gap between participants if needed
        currentY += 5;
    });

    yPosition = currentY + 10; // Update Y position after table

    // --- Summary Section ---
    const summaryLabelX = 300;
    const summaryValueX = width - rightMargin;
    let summaryCurrentY = yPosition;
    const lineSpacingSummary = 15;

    doc.font('Helvetica-Bold').text('Subtotal:', summaryLabelX, summaryCurrentY, { width: 140, align: 'right' });
    doc.font('Helvetica').text(`Rp ${formatCurrency(originalAmount)}`, summaryValueX, summaryCurrentY, { width: 90, align: 'right' });
    summaryCurrentY += lineSpacingSummary;

    if (discountAmount && discountAmount > 0) {
        doc.font('Helvetica-Bold').text('Diskon:', summaryLabelX, summaryCurrentY, { width: 140, align: 'right' });
        doc.font('Helvetica').text(`- Rp ${formatCurrency(discountAmount)}`, summaryValueX, summaryCurrentY, { width: 90, align: 'right' });
        summaryCurrentY += lineSpacingSummary;
    }

    // No unique deduction line for paid invoice

    doc.moveTo(summaryLabelX - 10, summaryCurrentY)
       .lineTo(summaryValueX + 90, summaryCurrentY)
       .stroke(grayColor);
    summaryCurrentY += 5;

    doc.font('Helvetica-Bold').fontSize(11).text('Total Dibayar:', summaryLabelX, summaryCurrentY, { width: 140, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(11).text(`Rp ${formatCurrency(uniqueAmount)}`, summaryValueX, summaryCurrentY, { width: 90, align: 'right' });
    summaryCurrentY += lineSpacingSummary + 10;
    yPosition = summaryCurrentY;

    // --- QR Code Section ---
    try {
        const qrCodeDataUrl = await QRCode.toDataURL(qrCodeData, { errorCorrectionLevel: 'H', margin: 2 });
        doc.addPage(); // Add new page for QR Code and ticket info
        yPosition = leftMargin;

        doc.font('Helvetica-Bold').fontSize(headerFontSize).text('Tiket Digital / QR Code Check-in', leftMargin, yPosition);
        doc.moveDown(1);
        yPosition = doc.y;

        // Embed QR code
        doc.image(qrCodeDataUrl, {
            fit: [150, 150], // Adjust size as needed
            align: 'center',
            valign: 'center'
        });
        yPosition = doc.y + 160; // Position below QR code image estimate

        // Optionally display the QR data (e.g., Ticket ID) below the code
        doc.font('Helvetica').fontSize(defaultFontSize).text(`Kode: ${qrCodeData}`, { align: 'center' });
        yPosition = doc.y + sectionSpacing;

        doc.font('Helvetica').fontSize(defaultFontSize).text(
            'Harap tunjukkan QR Code ini kepada petugas saat melakukan registrasi ulang (check-in) di lokasi acara. '
            + 'Simpan email ini atau screenshot halaman ini.', 
            leftMargin, 
            yPosition, 
            { align: 'left', width: width - leftMargin - rightMargin } 
        );

    } catch (err) {
        console.error('Failed to generate QR code:', err);
        // Optionally add text to PDF indicating QR generation failure
        doc.text('Gagal membuat QR Code.', { align: 'center' });
    }

    // Finalize PDF
    doc.end();

    // Wait for stream to finish and return buffer
    return new Promise((resolve, reject) => {
        doc.on('end', () => {
            resolve(Buffer.concat(chunks));
        });
        doc.on('error', reject);
    });
}
