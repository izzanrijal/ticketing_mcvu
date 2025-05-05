import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend';
import PDFDocument from 'https://esm.sh/pdfkit'; 
import QRCode from 'https://esm.sh/qrcode';       

// --- BEGIN Copied Types from lib/notifications.ts --- 
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
    email?: string; 
    qr_code_url?: string; 
}

interface Registration {
    id: string;
    registration_number: string;
    created_at: string | Date;
    payment_type?: string;
    ticket_id?: string;
    event_id?: string; 
    total_amount: number;
    discount_amount: number;
    unique_amount: number;
    participants: Participant[]; 
    contact_persons: ContactPerson[]; 
}

interface Ticket {
    id: string;
    name: string; 
    price_specialist_doctor?: number;
    price_general_doctor?: number;
    price_nurse?: number;
    price_student?: number;
    price_other?: number;
    [priceField: string]: any; 
}

interface Workshop {
    id: string;
    name: string; 
    price: number;
}

interface WorkshopRegistration {
    workshop_id: string;
}

interface WorkshopDetail {
    name: string;
    price: number;
}

interface GeneratePdfParams {
    registrationNumber: string;
    registrationCreationTime: Date;
    contactPerson: ContactPerson | null;
    originalAmount: number;
    discountAmount: number;
    uniqueAmount: number; 
    participants: Participant[]; 
    ticketData: Ticket | null;
    workshopDetailsMap: Map<string, WorkshopDetail>;
    participantTypeMap: { [key: string]: string }; 
    qrCodeData: string; 
}
// --- END Copied Types --- 

// WARNING: Avoid exposing Supabase Admin Key directly in client-side code or Edge Functions if possible.
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const participantTypeMap: { [key: string]: string } = {
    'specialist_doctor': 'Dokter Spesialis',
    'general_doctor': 'Dokter Umum',
    'resident': 'PPDS',
    'nurse': 'Perawat',
    'student': 'Mahasiswa Kedokteran',
    'other': 'Dokter Residen',
};

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { registrationId, participantId } = await req.json();

    if (!registrationId || !participantId) {
      return new Response(JSON.stringify({ error: 'Missing registrationId or participantId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    console.log(`Processing paid invoice for registration: ${registrationId}, participant: ${participantId}`);

    const { data: registrationData, error: regError } = await supabaseAdmin
      .from('registrations')
      .select(`
        *,
        contact_persons(*),
        participants!inner(*, workshop_registrations(workshop_id))
      `)
      .eq('id', registrationId)
      .eq('participants.id', participantId) 
      .single();

    if (regError || !registrationData) {
      console.error('Error fetching registration/participant:', regError);
      return new Response(JSON.stringify({ error: 'Registration or Participant not found', details: regError?.message }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const participantData = registrationData.participants[0];
    const contactPerson = registrationData.contact_persons[0] as ContactPerson; 

    if (!participantData || !participantData.email) { 
        console.error('Participant data incomplete or missing email');
        return new Response(JSON.stringify({ error: 'Participant data incomplete' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: ticketData, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('event_id', registrationData.event_id) 
      .single(); 

    if (ticketError || !ticketData) {
      console.error('Error fetching ticket data:', ticketError);
      return new Response(JSON.stringify({ error: 'Ticket data not found', details: ticketError?.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const workshopIds = participantData.workshop_registrations?.map(wr => wr.workshop_id) || [];
    const workshopDetailsMap = new Map<string, WorkshopDetail>();
    if (workshopIds.length > 0) {
        const { data: workshops, error: wsError } = await supabaseAdmin
            .from('workshops')
            .select('*')
            .in('id', workshopIds);

        if (wsError) {
            console.error('Error fetching workshop details:', wsError);
        } else if (workshops) {
            workshops.forEach(ws => workshopDetailsMap.set(ws.id, ws));
        }
    }

    const participantWithWorkshops = participantData as Participant & { workshop_registrations?: WorkshopRegistration[] }; 

    const emailSubject = `Konfirmasi Pembayaran & Tiket MCVU XXIII 2025 - ${registrationData.registration_number}`;

    // --- Generate Correct QR Code Data URL --- (Define payload first)
    const qrDataPayload = JSON.stringify({
      id: participantData.id,
      name: participantData.full_name,
      registration_id: registrationData.id,
      registration_number: registrationData.registration_number,
      participant_type: participantData.participant_type
    });
    console.log(`Generating QR code image for payload: ${qrDataPayload}`); 
    const qrCodeDataUrl = await QRCode.toDataURL(qrDataPayload, { errorCorrectionLevel: 'H', margin: 2 });

    // --- Generate PDF Buffer --- 
    const pdfParams: GeneratePdfParams = {
      registrationNumber: registrationData.registration_number,
      registrationCreationTime: new Date(registrationData.created_at),
      contactPerson: contactPerson ?? null,
      originalAmount: registrationData.total_amount ?? 0,
      discountAmount: registrationData.discount_amount ?? 0,
      uniqueAmount: registrationData.final_amount ?? 0,
      participants: registrationData.participants, 
      ticketData: ticketData ?? null, 
      workshopDetailsMap: workshopDetailsMap, 
      participantTypeMap: participantTypeMap, 
      qrCodeData: qrCodeDataUrl 
    };
    console.log("Preparing to generate PDF with params:", pdfParams);
    const pdfBuffer = await generateInvoicePdf(pdfParams);
    console.log(`PDF Buffer generated, length: ${pdfBuffer.byteLength}`);
    // -------------------------

    const emailHtml = `
        <p>Yth. <strong>${participantData.full_name}</strong>,</p>
        <p>Terima kasih! Pembayaran Anda untuk registrasi Makassar Cardiovascular Update (MVCU) XXIII Tahun 2025 (${registrationData.registration_number}) telah kami terima.</p>
        <p>Terlampir adalah invoice lunas dan tiket digital Anda yang berisi QR Code untuk check-in di lokasi acara.</p>
        <p>Harap simpan email ini atau unduh lampiran untuk referensi Anda.</p>
        <p>Sampai jumpa di Makassar!</p>
        <br>
        <p>Hormat kami,</p>
        <p>Panitia MCVU XXIII 2025</p>
    `;

    await resend.emails.send({
        from: 'Panitia MCVU XXIII 2025 <panitia.mcvu@perkimakassar.com>', 
        to: [participantData.email], 
        subject: emailSubject,
        html: emailHtml,
        attachments: [
            {
                filename: `Invoice_Lunas_MVCU2025_${registrationData.registration_number}_${participantData.full_name.replace(/\s+/g, '_')}.pdf`,
                content: pdfBuffer, 
            },
            // --- Add QR Code Ticket as Separate Attachment ---
            {
                filename: `QRCode_Ticket_MVCU2025_${registrationData.registration_number}_${participantData.full_name.replace(/\s+/g, '_')}.png`,
                content: qrCodeDataUrl.split('base64,')[1], // Extract base64 content
                encoding: 'base64',
            },
            // -------------------------------------------
        ],
    });

    console.log(`Paid invoice email sent successfully to ${participantData.email}`);

    return new Response(JSON.stringify({ message: 'Paid invoice sent successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function generatePaidInvoicePdfInternal(params: GeneratePdfParams): Promise<Buffer> {
    const {
        registrationNumber,
        registrationCreationTime,
        contactPerson,
        originalAmount,
        discountAmount,
        uniqueAmount, 
        participants, 
        ticketData,
        workshopDetailsMap,
        participantTypeMap,
        qrCodeData, 
    } = params;

    console.log(`Generating PAID PDF Invoice for ${registrationNumber} (single participant)`);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const lightGrayColor = '#D3D3D3';
    const grayColor = '#555555';
    const greenColor = '#008000'; 
    const defaultFontSize = 10;
    const titleFontSize = 18;
    const headerFontSize = 12;
    const lineSpacing = 15;
    const sectionSpacing = 25;
    const leftMargin = 50;
    const rightMargin = 50;
    const width = doc.page.width;

    doc.rect(leftMargin, leftMargin, 150, 50).stroke(lightGrayColor);
    doc.fontSize(10).fillColor(grayColor).text('Logo', leftMargin + 55, leftMargin + 20);

    let yPosition = leftMargin;
    doc.fillColor('black').font('Helvetica-Bold').fontSize(titleFontSize).text('INVOICE LUNAS', { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(defaultFontSize);
    doc.text(`No: ${registrationNumber}`, { align: 'right' });
    doc.text(`Tanggal Dibuat: ${registrationCreationTime instanceof Date && !isNaN(registrationCreationTime.getTime()) ? registrationCreationTime.toLocaleDateString('id-ID') : 'N/A'}`, { align: 'right' });
    doc.font('Helvetica-Bold').fillColor(greenColor).text('Status: Lunas', { align: 'right' });
    doc.fillColor('black').font('Helvetica');
    yPosition = doc.y + sectionSpacing;

    doc.font('Helvetica-Bold').fontSize(headerFontSize).text('Ditagihkan Kepada:', leftMargin, yPosition);
    doc.font('Helvetica').fontSize(defaultFontSize);
    doc.text(contactPerson?.name ?? 'N/A', leftMargin);
    doc.text(contactPerson?.email ?? 'N/A', leftMargin);
    doc.text(contactPerson?.phone ?? 'N/A', leftMargin);
    yPosition = doc.y + sectionSpacing;

    doc.font('Helvetica-Bold').fontSize(headerFontSize).text('Rincian Peserta:', leftMargin, yPosition, { underline: true });
    doc.moveDown(1.5);
    yPosition = doc.y;

    const tableTop = yPosition;
    const nameX = 50;         const nameWidth = 100;
    const itemX = 155;        const itemWidth = 190;
    const categoryX = 350;    const categoryWidth = 100;
    const priceX = 455;       const priceWidth = 90;
    const rowHeight = 20;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Nama Peserta', nameX, tableTop, { width: nameWidth });
    doc.text('Item', itemX, tableTop, { width: itemWidth });
    doc.text('Kategori', categoryX, tableTop, { width: categoryWidth });
    doc.text('Harga (IDR)', priceX, tableTop, { width: priceWidth, align: 'right' });
    doc.moveTo(nameX, doc.y).lineTo(priceX + priceWidth, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica');
    let currentY = doc.y;

    const p = participants[0]; 
    const participantTypeDisplay = participantTypeMap[p.participant_type] || p.participant_type;
    let firstItem = true;
    const participantWithWorkshops = p as Participant & { workshop_registrations?: WorkshopRegistration[] }; 

    if (p.attendSymposium && ticketData) {
        let symposiumPrice = 0;
        switch (p.participant_type) {
            case 'specialist_doctor': symposiumPrice = ticketData.price_specialist_doctor ?? 0; break;
            case 'general_doctor': symposiumPrice = ticketData.price_general_doctor ?? 0; break;
            case 'nurse': symposiumPrice = ticketData.price_nurse ?? 0; break;
            case 'student': symposiumPrice = ticketData.price_student ?? 0; break;
            case 'other': symposiumPrice = ticketData.price_other ?? 0; break;
            default: symposiumPrice = ticketData.price_other ?? 0;
        }
        const symposiumTitle = ticketData?.name ?? 'Symposium';
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
        doc.text(priceText, priceX, currentY, { width: priceWidth, align: 'right' });

        currentY += currentActualRowHeight + 5;
        firstItem = false;
    }

    if (participantWithWorkshops.workshop_registrations && participantWithWorkshops.workshop_registrations.length > 0) {
        participantWithWorkshops.workshop_registrations.forEach((reg) => {
            const workshop = workshopDetailsMap.get(reg.workshop_id);
            const wsName = workshop?.name ?? 'Workshop Tidak Ditemukan';
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
            doc.text(priceText, priceX, currentY, { width: priceWidth, align: 'right' });

            currentY += currentActualRowHeight + 5;
            firstItem = false;
        });
    }

    yPosition = currentY + 10; 

    const summaryLabelX = 300;
    const summaryValueX = 455;
    let summaryCurrentY = yPosition;
    const lineSpacingSummary = 15;

    doc.font('Helvetica-Bold').text('Subtotal Reg.:', summaryLabelX, summaryCurrentY, { width: 140, align: 'right' });
    doc.font('Helvetica').text(`Rp ${formatCurrency(originalAmount)}`, summaryValueX, summaryCurrentY, { width: 90, align: 'right' });
    summaryCurrentY += lineSpacingSummary;

    if (discountAmount && discountAmount > 0) {
        doc.font('Helvetica-Bold').text('Diskon Reg.:', summaryLabelX, summaryCurrentY, { width: 140, align: 'right' });
        doc.font('Helvetica').text(`- Rp ${formatCurrency(discountAmount)}`, summaryValueX, summaryCurrentY, { width: 90, align: 'right' });
        summaryCurrentY += lineSpacingSummary;
    }

    doc.moveTo(summaryLabelX - 10, summaryCurrentY)
       .lineTo(summaryValueX + 90, summaryCurrentY)
       .stroke(grayColor);
    summaryCurrentY += 5;

    doc.font('Helvetica-Bold').fontSize(11).text('Total Dibayar Reg.:', summaryLabelX, summaryCurrentY, { width: 140, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(11).text(`Rp ${formatCurrency(uniqueAmount)}`, summaryValueX, summaryCurrentY, { width: 90, align: 'right' });
    summaryCurrentY += lineSpacingSummary + 10;
    yPosition = summaryCurrentY;

    doc.end();

    const pdfChunks = [];
    for await (const chunk of doc) {
      pdfChunks.push(chunk);
    }
    let totalLength = 0;
    for (const chunk of pdfChunks) {
      totalLength += chunk.length;
    }
    const resultBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of pdfChunks) {
      resultBuffer.set(chunk, offset);
      offset += chunk.length;
    }
    return Buffer.from(resultBuffer); 
}

async function generateInvoicePdf(params: GeneratePdfParams): Promise<Buffer> {
    return await generatePaidInvoicePdfInternal(params);
}
