// lib/notifications.ts
import { supabaseAdmin } from "@/lib/supabase";
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Define participant type mapping
const participantTypeMap: { [key: string]: string } = {
    gp: 'Dokter Umum',
    specialist: 'Dokter Spesialis',
    resident: 'Dokter Residen',
    nurse: 'Perawat',
    student: 'Mahasiswa Kedokteran',
    other: 'Lainnya',
};

interface ContactPerson {
    name: string;
    email: string;
    phone: string;
}

interface RegistrationDetails {
    ticket_id: string; // Make sure ticket_id is passed
    participants: Array<{ 
        name: string; 
        nik: string; 
        email: string; 
        phone: string;
        institution: string;
        participant_type: string; // e.g., 'gp', 'specialist'
        attendSymposium: boolean;
        workshops?: string[]; // Array of workshop IDs
    }>;
    payment_type: 'bank_transfer' | 'sponsor';
    promo_code?: string; // Optional: If promo code was applied
}

interface BankAccount {
    bank_name: string;
    account_number: string;
    account_name: string;
}

export async function sendRegistrationInvoice(
    registrationId: string,
    registrationNumber: string, // The human-readable registration number
    registrationCreationTime: Date, // Timestamp of registration creation
    contactPerson: ContactPerson,
    uniqueAmount: number,
    originalAmount: number, // This is the subtotal *before* unique deduction
    uniqueDeduction: number,
    registrationData: RegistrationDetails
): Promise<void> {
    console.log(`Starting invoice generation for registration ${registrationNumber} (ID: ${registrationId})...`);

    try {
        // --- Fetch necessary data upfront ---

        // 1. Fetch Workshop Details (already done)
        const allWorkshopIds = registrationData.participants.flatMap(p => p.workshops || []);
        let workshopDetailsMap: Map<string, { name: string; price: number }> = new Map();
        if (allWorkshopIds.length > 0) {
            const { data: workshops, error: workshopError } = await supabaseAdmin
                .from('workshops')
                // TODO: Verify 'title' is the correct column name for workshop names in your DB schema.
                .select('id, title, price') 
                .in('id', allWorkshopIds);
            if (workshopError) console.error(`Error fetching workshop details for ${registrationNumber}:`, workshopError);
            // Ensure workshops is an array and handle potential null case from select
            else if (workshops && Array.isArray(workshops)) { 
                workshops.forEach(ws => {
                    // Check if ws and ws.id exist before setting map
                    if (ws && ws.id) {
                        workshopDetailsMap.set(ws.id, { name: ws.title, price: ws.price }); // Use ws.title here
                    }
                });
            }
        }
        console.log(`Fetched workshop details for ${registrationNumber}`);

        // 2. Fetch Ticket Details (for symposium prices)
        let ticketData: any = null;
        if (registrationData.ticket_id) {
            const { data, error } = await supabaseAdmin
                .from('tickets')
                .select('*') // Select all price fields
                .eq('id', registrationData.ticket_id)
                .single();
            if (error) console.error(`Error fetching ticket details for ${registrationNumber}:`, error);
            else ticketData = data;
        }
        console.log(`Fetched ticket details for ${registrationNumber}`);

        // 3. Fetch Active Bank Account Details
        let bankAccount: BankAccount | null = null;
        try {
            // TODO: Ensure the 'bank_accounts' table exists in your Supabase public schema
            // and has columns 'bank_name', 'account_number', 'account_name', and 'is_active'.
            const { data: bankData, error: bankError } = await supabaseAdmin
                .from('bank_accounts') // Assuming table name is 'bank_accounts'
                .select('bank_name, account_number, account_name')
                .eq('is_active', true) // Assuming an 'is_active' flag
                .limit(1)
                .single();
            if (bankError) throw bankError;
            bankAccount = bankData;
        } catch (error) {
            console.error(`CRITICAL: Error fetching active bank account details:`, error);
            // Decide handling: throw error to stop email, or send without bank details?
            // For now, let's allow sending without bank details but log critically.
        }
        console.log(`Fetched bank account details for ${registrationNumber}`);

        // --- Calculate Payment Deadline ---
        const paymentDeadline = new Date(registrationCreationTime.getTime() + 3 * 24 * 60 * 60 * 1000); // + 3 days

        // --- Generate Content ---

        // Generate HTML
        const htmlContent = generateInvoiceHtml(
            registrationNumber,
            registrationCreationTime,
            paymentDeadline, // Pass deadline
            contactPerson,
            uniqueAmount,
            originalAmount,
            uniqueDeduction,
            registrationData,
            workshopDetailsMap,
            ticketData,       // Pass ticket data
            participantTypeMap, // Pass type map
            bankAccount       // Pass bank account
        );
        console.log(`Generated HTML content for ${registrationNumber}`);

        // Generate PDF
        const pdfBuffer = await generateInvoicePdf(
            registrationNumber,
            registrationCreationTime,
            paymentDeadline, // Pass deadline
            contactPerson,
            uniqueAmount,
            originalAmount,
            uniqueDeduction,
            registrationData,
            workshopDetailsMap,
            ticketData,       // Pass ticket data
            participantTypeMap, // Pass type map
            bankAccount       // Pass bank account
        );
        console.log(`Generated PDF buffer for ${registrationNumber}`);

        // --- Send Email ---
        if (!process.env.RESEND_API_KEY) { 
            console.warn(`RESEND_API_KEY not set. Skipping actual email send for registration ${registrationNumber}.`);
            return; // Exit if no API key is configured
        }
        try {
            await resend.emails.send({
                from: 'Panitia MVCU 2025 <panitia.mcvu@perkimakassar.com>',
                to: [contactPerson.email],
                subject: `Invoice Pendaftaran MVCU 2025 - ${registrationNumber}`, // Use Reg Number
                html: htmlContent,
                attachments: [ { filename: `Invoice_MVCU2025_${registrationNumber}.pdf`, content: pdfBuffer } ], // Use Reg Number in filename
            });
            console.log(`Invoice email successfully sent for ${registrationNumber} to ${contactPerson.email}.`);
        } catch (emailError) {
            console.error(`Failed to send email via Resend for registration ${registrationNumber}:`, emailError);
            throw emailError; // Re-throw to be caught by the outer try/catch
        }

        console.log(`Invoice generation and sending process complete for ${registrationNumber}.`);

    } catch (error) {
        console.error(`Failed to send registration invoice for ${registrationNumber} (ID: ${registrationId}):`, error);
        throw error;
    }
}

// --- Helper Functions --- (Signatures need updating)

function generateInvoiceHtml(
    registrationNumber: string,
    registrationCreationTime: Date,
    paymentDeadline: Date, // Added
    contactPerson: ContactPerson,
    uniqueAmount: number,
    originalAmount: number,
    uniqueDeduction: number,
    registrationData: RegistrationDetails,
    workshopDetailsMap: Map<string, { name: string; price: number }>, 
    ticketData: any, // Added
    participantTypeMap: { [key: string]: string }, // Added
    bankAccount: BankAccount | null // Added
): string {
    console.log(`Generating HTML for ${registrationNumber}`);

    // --- Generate Order Details Table --- 
    let orderDetailsHtmlRows = '';
    registrationData.participants.forEach((p) => {
        const participantCategory = participantTypeMap[p.participant_type] || p.participant_type;
        const priceFieldName = `${p.participant_type}_price`;

        if (p.attendSymposium && ticketData) {
            const symposiumPrice = ticketData[priceFieldName] ?? 0;
            orderDetailsHtmlRows += `
            <tr>
                <td style="padding: 5px 0;">${p.name}</td>
                <td style="padding: 5px 0;">Simposium</td>
                <td style="padding: 5px 0;">${participantCategory}</td>
                <td style="padding: 5px 0; text-align: right;">${symposiumPrice.toLocaleString('id-ID')}</td>
            </tr>`;
        } else if (p.attendSymposium) {
             orderDetailsHtmlRows += `
            <tr>
                <td style="padding: 5px 0;">${p.name}</td>
                <td style="padding: 5px 0;">Simposium</td>
                <td style="padding: 5px 0;">${participantCategory}</td>
                <td style="padding: 5px 0; text-align: right;">N/A</td>
            </tr>`;
        }

        if (p.workshops && p.workshops.length > 0) {
            p.workshops.forEach(wsId => {
                const workshop = workshopDetailsMap.get(wsId);
                const wsName = workshop?.name || `Workshop ${wsId}`;
                const wsPrice = workshop?.price ?? 0;
                orderDetailsHtmlRows += `
                <tr>
                    <td style="padding: 5px 0;">${p.name}</td>
                    <td style="padding: 5px 0;">${wsName}</td>
                    <td style="padding: 5px 0;">${participantCategory}</td>
                    <td style="padding: 5px 0; text-align: right;">${wsPrice.toLocaleString('id-ID')}</td>
                </tr>`;
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
    if (registrationData.payment_type === 'sponsor') {
        paymentDetailsHtml = '<p>Pembayaran akan diproses melalui sponsor.</p>';
    } else {
        paymentDetailsHtml = `
            <table style="width: 100%; max-width: 400px; margin-left: auto; margin-bottom: 20px; text-align: right;">
                 <tr>
                     <td>Subtotal:</td>
                     <td style="padding-left: 15px;">Rp ${originalAmount.toLocaleString('id-ID')},-</td>
                 </tr>
                 <tr>
                     <td>Kode Unik Pengurang:</td>
                     <td style="padding-left: 15px;">- Rp ${uniqueDeduction.toLocaleString('id-ID')},-</td>
                 </tr>
                 <tr style="border-top: 1px solid #ddd; font-weight: bold; font-size: 1.1em;">
                     <td style="padding-top: 8px;">Total Tagihan:</td>
                     <td style="padding-left: 15px; padding-top: 8px;">Rp ${uniqueAmount.toLocaleString('id-ID')},-</td>
                 </tr>
            </table>

            <p style="text-align: center; font-size: 1.1em;">Mohon transfer sejumlah <strong>Rp ${uniqueAmount.toLocaleString('id-ID')},-</strong> (persis) untuk mempercepat proses verifikasi otomatis.</p>
            
            <div style="margin-top: 20px; padding: 15px; border: 1px solid #ddd; background-color: #f9f9f9;">
                 <h4>Instruksi Pembayaran:</h4>
                 <p>Silakan lakukan transfer ke rekening berikut:</p>
                 ${bankAccount ? `
                 <p style="margin-left: 15px;">
                     <strong>${bankAccount.bank_name}</strong><br>
                     Nomor Rekening: <strong>${bankAccount.account_number}</strong><br>
                     Atas Nama: <strong>${bankAccount.account_name}</strong>
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
    // Using backticks and ${} for interpolation
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
                
                <p>Yth. <strong>${contactPerson.name}</strong>,</p>
                <p>Terima kasih telah melakukan pendaftaran untuk The 1st Makassar Vascular Conference Update (MVCU) 2025. Berikut adalah detail pendaftaran dan instruksi pembayaran Anda:</p>
                <p>Nomor Pendaftaran: <strong>${registrationNumber}</strong></p>
                <p>Tanggal Pendaftaran: <strong>${registrationCreationTime.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
                
                <h2>Detail Kontak Pendaftar</h2>
                <p>Nama: ${contactPerson.name}</p>
                <p>Email: ${contactPerson.email}</p>
                <p>Telepon: ${contactPerson.phone}</p>

                <h2>Rincian Pemesanan</h2>
                ${orderDetailsTableHtml}
                
                <h2>Detail Pembayaran</h2>
                <p>Metode Pembayaran: ${registrationData.payment_type === 'sponsor' ? 'Sponsor' : 'Transfer Bank'}</p>
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

async function generateInvoicePdf(
    registrationNumber: string,
    registrationCreationTime: Date,
    paymentDeadline: Date, // Added
    contactPerson: ContactPerson,
    uniqueAmount: number,
    originalAmount: number,
    uniqueDeduction: number,
    registrationData: RegistrationDetails,
    workshopDetailsMap: Map<string, { name: string; price: number }>, 
    ticketData: any, // Added
    participantTypeMap: { [key: string]: string }, // Added
    bankAccount: BankAccount | null // Added
): Promise<Buffer> {
    console.log(`Generating PDF for ${registrationNumber}`);
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage(PageSizes.A4); // Use A4 size
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // --- Layout & Styling --- 
    const leftMargin = 50;
    const rightMargin = 50;
    const topMargin = 50; // Increased top margin for potential logo
    const bottomMargin = 50;
    const contentWidth = width - leftMargin - rightMargin;
    let yPosition = height - topMargin;
    const lineSpacing = 14;
    const sectionSpacing = 20;

    // Helper function for drawing text
    const drawText = (text: string, x: number, y: number, size = 10, bold = false, color = rgb(0, 0, 0)) => {
        // Add fallback for safety, although type checking should prevent undefined
        const textToDraw = text ?? ''; 
        page.drawText(textToDraw, {
            x: x,
            y: y,
            size: size,
            font: bold ? boldFont : font,
            color: color,
        });
        return y - size * 1.2; // Adjust Y position for next line
    };

    // --- Optional: Logo Placeholder --- 
    // Draw a light gray box where a logo could go
    page.drawRectangle({
        x: leftMargin, 
        y: height - topMargin - 40, // Position the box below the top margin
        width: 100, 
        height: 40,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
        opacity: 0.5,
    });
    yPosition = height - topMargin - 60; // Adjust starting yPosition below logo area

    // --- Header --- 
    yPosition = drawText('Invoice Pendaftaran MVCU 2025', leftMargin, yPosition, 18, true);
    yPosition -= sectionSpacing / 2;
    yPosition = drawText(`Nomor Pendaftaran: ${registrationNumber}`, leftMargin, yPosition, 12, true);
    yPosition = drawText(`Tanggal Pendaftaran: ${registrationCreationTime.toLocaleDateString('id-ID')}`, leftMargin, yPosition);
    yPosition -= sectionSpacing;

    // --- Contact Person --- 
    yPosition = drawText('Ditagihkan Kepada:', leftMargin, yPosition, 12, true);
    yPosition = drawText(contactPerson.name ?? 'Nama Kontak Tidak Tersedia', leftMargin + 10, yPosition);
    yPosition = drawText(contactPerson.email ?? 'Email Tidak Tersedia', leftMargin + 10, yPosition);
    yPosition = drawText(contactPerson.phone ?? 'Telepon Tidak Tersedia', leftMargin + 10, yPosition);
    yPosition -= sectionSpacing;

    // --- Order Details Table --- 
    yPosition = drawText('Rincian Pemesanan:', leftMargin, yPosition, 12, true);
    yPosition -= lineSpacing / 2;

    // Table Headers
    const col1X = leftMargin;
    const col2X = leftMargin + 180;
    const col3X = leftMargin + 300;
    const col4X = width - rightMargin - 80; // Align Price Right
    let headerY = yPosition;
    drawText('Peserta', col1X, headerY, 10, true);
    drawText('Item', col2X, headerY, 10, true);
    drawText('Kategori', col3X, headerY, 10, true);
    drawText('Harga (IDR)', col4X, headerY, 10, true);
    yPosition -= lineSpacing;
    page.drawLine({ start: { x: leftMargin, y: yPosition }, end: { x: width - rightMargin, y: yPosition }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    yPosition -= lineSpacing * 0.8;

    // Table Body
    registrationData.participants.forEach((p, index) => {
        // Add fallback for category, preferring map, then type itself, then default
        const participantCategory = participantTypeMap[p.participant_type] || p.participant_type || 'Kategori Tidak Diketahui'; 
        let startYParticipant = yPosition;
        const participantName = p.name ?? 'Nama Peserta Tidak Tersedia'; // Add fallback for name

        // Symposium Entry
        if (p.attendSymposium && ticketData) {
            // Construct price field name, e.g., 'gp_price'
            const priceFieldName = `${p.participant_type}_price`; 
            const symposiumPrice = ticketData[priceFieldName] ?? 0; // Default to 0 if price not found
            
            let currentY = drawText(participantName, col1X, yPosition); // Use fallback name
            drawText('Simposium', col2X, yPosition);
            drawText(participantCategory, col3X, yPosition); // Use fallback category
            drawText(symposiumPrice.toLocaleString('id-ID'), col4X, yPosition);
            yPosition = currentY; // Move y down
        } else if (p.attendSymposium) {
            let currentY = drawText(participantName, col1X, yPosition); // Use fallback name
            drawText('Simposium', col2X, yPosition);
            drawText(participantCategory, col3X, yPosition); // Use fallback category
            drawText('N/A', col4X, yPosition); // Price unavailable
            yPosition = currentY;
        }

        // Workshop Entries
        if (p.workshops && p.workshops.length > 0) {
            p.workshops.forEach(wsId => {
                const workshop = workshopDetailsMap.get(wsId);
                // Use 'title' from workshop data (fetched as title now) with fallback
                const wsName = workshop?.name || `Workshop ${wsId}`; // Keep using .name here as map stores it as 'name'
                const wsPrice = workshop?.price ?? 0;
                
                // Draw participant name only if it's the first item and symposium wasn't drawn
                // Check if this is the first line item drawn for this participant overall
                const isFirstLineForItem = !p.attendSymposium && (p.workshops!.indexOf(wsId) === 0);
                
                let currentY = drawText(isFirstLineForItem ? participantName : '', col1X, yPosition); // Use fallback name
                drawText(wsName, col2X, yPosition); // wsName has fallback
                drawText(participantCategory, col3X, yPosition); // Use fallback category
                drawText(wsPrice.toLocaleString('id-ID'), col4X, yPosition);
                yPosition = currentY;
            });
        }
        yPosition -= lineSpacing * 0.5; // Small gap between participants' items
    });

    page.drawLine({ start: { x: leftMargin, y: yPosition }, end: { x: width - rightMargin, y: yPosition }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    yPosition -= lineSpacing;

    // Totals Section
    const totalLabelX = col3X;
    const totalValueX = col4X;
    yPosition = drawText('Subtotal:', totalLabelX, yPosition);
    drawText(originalAmount.toLocaleString('id-ID'), totalValueX, yPosition);
    yPosition = drawText('Kode Unik Pengurang:', totalLabelX, yPosition);
    drawText(`- ${uniqueDeduction.toLocaleString('id-ID')}`, totalValueX, yPosition);
    yPosition -= lineSpacing * 0.5;
    
    page.drawLine({ start: { x: totalLabelX - 10, y: yPosition }, end: { x: width - rightMargin, y: yPosition }, thickness: 0.5 });
    yPosition -= lineSpacing * 0.8;

    yPosition = drawText('Total Tagihan (Harus Sesuai):', totalLabelX, yPosition, 11, true);
    drawText(uniqueAmount.toLocaleString('id-ID'), totalValueX, yPosition, 11, true);
    yPosition -= sectionSpacing;

    // --- Payment Details --- 
    yPosition = drawText('Detail Pembayaran:', leftMargin, yPosition, 12, true);
    yPosition = drawText(`Metode Pembayaran: ${registrationData.payment_type === 'sponsor' ? 'Sponsor' : 'Transfer Bank'}`, leftMargin + 10, yPosition);

    if (registrationData.payment_type === 'bank_transfer') {
        yPosition -= lineSpacing * 0.5;
        yPosition = drawText('Instruksi Pembayaran:', leftMargin + 10, yPosition, 11, true);
        yPosition = drawText(`Mohon transfer SEJUMLAH PERSIS Rp ${uniqueAmount.toLocaleString('id-ID')},-`, leftMargin + 20, yPosition);
        yPosition = drawText('Ke Rekening:', leftMargin + 20, yPosition);
        if (bankAccount) {
            yPosition = drawText(`${bankAccount.bank_name}`, leftMargin + 30, yPosition, 11, true); 
            yPosition = drawText(`Nomor Rekening: ${bankAccount.account_number}`, leftMargin + 30, yPosition);
            yPosition = drawText(`Atas Nama: ${bankAccount.account_name}`, leftMargin + 30, yPosition);
        } else {
            yPosition = drawText('Informasi Bank Tidak Tersedia', leftMargin + 30, yPosition, 10, false, rgb(0.8, 0, 0));
        }
        yPosition = drawText(`Batas Pembayaran: ${paymentDeadline.toLocaleDateString('id-ID')}`, leftMargin + 20, yPosition);
    } else {
        yPosition = drawText('Pembayaran akan diproses melalui sponsor.', leftMargin + 10, yPosition);
    }
    yPosition -= sectionSpacing;

    // --- Footer Notes --- 
    yPosition = drawText('Catatan:', leftMargin, yPosition, 10, true);
    if (registrationData.payment_type === 'bank_transfer') {
        yPosition = drawText('- Pastikan jumlah transfer sesuai hingga digit terakhir untuk verifikasi otomatis.', leftMargin + 10, yPosition, 10);
        yPosition = drawText('- Pembayaran diverifikasi dalam 1x24 jam hari kerja.', leftMargin + 10, yPosition, 10);
        yPosition = drawText('- Anda akan menerima email konfirmasi & tiket elektronik setelah pembayaran terverifikasi.', leftMargin + 10, yPosition, 10);
    }
    yPosition = drawText('- Hubungi panitia jika ada pertanyaan.', leftMargin+10, yPosition, 10)

    // --- Footer --- 
    // Example: Draw page number or committee name at bottom
    const footerText = "Panitia MVCU 2025 - Invoice generated on " + new Date().toLocaleDateString('id-ID');
    const footerTextWidth = font.widthOfTextAtSize(footerText, 8); // Use 'font' directly
    drawText(footerText, (width - footerTextWidth) / 2, bottomMargin, 8, false, rgb(0.5, 0.5, 0.5));

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}
