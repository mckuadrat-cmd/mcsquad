import { terbilang, formatRupiah, formatTanggalIndo } from "./terbilang.ts";
import { reserveDocumentNumber } from "./numbering.ts";
import { scanPlaceholders, fillDocxTemplate } from "./docx-render.ts";
import { convertDocxToPdf } from "./pdf-render.ts";
import {
  BUCKET_TEMPLATES,
  BUCKET_GENERATED,
  uploadFileToStorage,
  downloadFileFromStorage,
  getSignedFileUrl
} from "./storage.ts";
import {
  advanceLeadAndClientStatus,
  determineStatusFromPaymentDate,
  syncCalendarEvent,
  removeCalendarSchedule
} from "./crm-sync.service.ts";

export const REQUIRED_PLACEHOLDERS: Record<string, string[]> = {
  SPH: ["nomor", "tanggal", "sekolah"],
  SKK: ["nomor", "tanggal", "sekolah"],
  INV: ["nomor", "tanggal", "sekolah"],
  KUI: ["nomor", "tanggal", "sekolah"]
};

export function buildDescriptiveFilename(type: string, docNo: string, clientName: string, dateStr: string, ext: 'pdf' | 'docx'): string {
  const cleanDocNo = (docNo || 'NO_NUM').replace(/[\/\\?%*:|"<>]/g, '_').trim();
  const cleanClient = (clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').trim();
  const cleanDate = (dateStr || new Date().toISOString().split('T')[0]).replace(/[^0-9-]/g, '');
  return `${cleanDocNo}_${cleanClient}_${cleanDate}.${ext}`;
}

export const OPTIONAL_PLACEHOLDERS: Record<string, string[]> = {
  SPH: ["program", "deskripsi", "sesi", "normal", "harga", "terbilang", "fasilitas", "konfirmasi", "catatan"],
  SKK: ["program", "trainer", "waktu", "peserta", "harga", "terbilang", "bayar", "bank", "fasilitas", "persiapan", "pic", "jabatan", "catatan"],
  INV: ["program", "waktu", "harga", "terbilang", "bayar", "bank", "catatan"],
  KUI: ["harga", "terbilang", "pembayaran", "catatan"]
};

export const SAMPLE_DUMMY_DATA: Record<string, any> = {
  SPH: {
    nomor: "01/SPH/MCC/IX/2026",
    tanggal: "1 September 2026",
    sekolah: "SMP Contoh Indonesia",
    program: "Leadership Character Program",
    deskripsi: "Program pelatihan pengembangan karakter dan kepemimpinan generasi muda.",
    sesi: "One Day",
    normal: "Rp 15.000.000",
    harga: "Rp 12.500.000",
    fasilitas: "Expert Trainer, Tim Support training, Fasilitator, Customized Content, Sound System Set",
    konfirmasi: "10 September 2026",
    catatan: "Penawaran harga berlaku selama 10 hari sejak terbit."
  },
  SKK: {
    nomor: "02/SKK/MCC/IX/2026",
    tanggal: "1 September 2026",
    sekolah: "SMA Unggulan Nusantara",
    program: "Motivation & Team Building",
    trainer: "Anrio Marfizal",
    waktu: "15 September 2026 (08:00 - 16:00 WIB)",
    peserta: "150 Siswa",
    harga: "Rp 18.000.000",
    terbilang: "Delapan Belas Juta Rupiah",
    bayar: "DP 50% saat SKK ditandatangani, Pelunasan H-3",
    bank: "Bank Mandiri 1234567890 a/n MCKuadrat",
    fasilitas: "Expert Trainer, Tim Support training, Fasilitator, Sound System Set",
    persiapan: "Tempat training yang kondusif, Sound Sistem, LCD Proyektor, Kabel HDMI, Kabel Audio",
    pic: "Bpk. Ahmad Fauzi",
    jabatan: "Kepala Wakasek Kesiswaan",
    catatan: "Jadwal dan peserta telah dikonfirmasi."
  },
  INV: {
    nomor: "03/INV/MCC/IX/2026",
    tanggal: "1 September 2026",
    sekolah: "SMP Plus Cendekia",
    program: "Character Building Workshop",
    waktu: "12 September 2026",
    harga: "Rp 10.000.000",
    terbilang: "Sepuluh Juta Rupiah",
    bank: "Bank Mandiri 1234567890 a/n MCKuadrat",
    bayar: "Transfer Bank sebelum 20 September 2026",
    catatan: "Mohon melampirkan bukti transfer via WhatsApp."
  },
  KUI: {
    nomor: "04/KUI/MCC/IX/2026",
    tanggal: "1 September 2026",
    sekolah: "SMP Plus Cendekia",
    harga: "Rp 10.000.000",
    terbilang: "Sepuluh Juta Rupiah",
    pembayaran: "Pelunasan Kegiatan Character Building Workshop",
    catatan: "Pembayaran telah diterima lunas."
  }
};



/**
 * Handle document management requests
 */
export async function handleDocumentApi(
  req: Request,
  supabase: any,
  userRole: string,
  user: any
): Promise<Response | null> {
  const url = new URL(req.url);
  const pathname = url.pathname.replace(/^\/functions\/v1\/server/, '').replace(/^\/server/, '');
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  };

  // Helper to fetch Business Settings for default Bank Account
  const getBusinessBank = async () => {
    try {
      const { data } = await supabase.from('settings').select('value').eq('id', 'business').maybeSingle();
      if (data?.value?.bankAccount) {
        return data.value.bankAccount;
      }
      if (data?.value?.bank) {
        return data.value.bank;
      }
    } catch {}
    return "Bank Mandiri 1234567890 a/n MCKuadrat";
  };

  // Route: GET /generated_documents
  if (pathname.startsWith('/generated_documents') && req.method === 'GET') {
    const { data, error } = await supabase.from('generated_documents').select('*');
    if (error) {
      console.error("Error fetching generated_documents:", error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
    }
    const sorted = (data || []).sort((a: any, b: any) => {
      const timeA = new Date(a.created_at || a.createdAt || a.date || a.updated_at || 0).getTime();
      const timeB = new Date(b.created_at || b.createdAt || b.date || b.updated_at || 0).getTime();
      return timeB - timeA;
    });
    return new Response(JSON.stringify(sorted), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  // Route: GET /document-templates-overview
  if (pathname === '/document-templates-overview' && req.method === 'GET') {
    const { data: templates } = await supabase.from('document_templates').select('*');
    return new Response(JSON.stringify(templates || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  // Route: POST /document-templates/:type/upload
  const uploadMatch = pathname.match(/^\/document-templates\/([A-Z]+)\/upload$/);
  if (uploadMatch && req.method === 'POST') {
    if (userRole !== 'owner' && userRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Hanya Admin/Owner yang dapat meng-upload template Word.' }), {
        status: 403,
        headers: corsHeaders
      });
    }

    const docType = uploadMatch[1];
    if (!['SPH', 'SKK', 'INV', 'KUI'].includes(docType)) {
      return new Response(JSON.stringify({ error: 'Tipe dokumen tidak valid.' }), { status: 400, headers: corsHeaders });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file || !file.name.endsWith('.docx')) {
      return new Response(JSON.stringify({ error: 'File harus berformat .docx' }), { status: 400, headers: corsHeaders });
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // 1. Scan placeholders inside docx
    const foundPlaceholders = scanPlaceholders(bytes);
    const mandatory = MANDATORY_PLACEHOLDERS[docType] || [];
    const missingMandatory = mandatory.filter(m => !foundPlaceholders.includes(m));

    // 2. Upload raw master template directly to Supabase Storage
    const storagePath = `${docType}/master_template.docx`;
    await uploadFileToStorage(supabase, BUCKET_TEMPLATES, storagePath, bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    const manifest = {
      found: foundPlaceholders,
      mandatory,
      missingMandatory,
      isValid: missingMandatory.length === 0
    };

    // 3. Upsert document_templates master record directly
    const { data: updatedTpl, error: updateErr } = await supabase
      .from('document_templates')
      .upsert({
        id: docType,
        code: docType,
        name: docType === 'SPH' ? 'Surat Penawaran Harga' : docType === 'SKK' ? 'Surat Kerjasama dan Konfirmasi Penjadwalan' : docType === 'INV' ? 'Invoice' : 'Kuitansi',
        file_path: storagePath,
        original_filename: file.name,
        placeholder_manifest: manifest,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({
      template: updatedTpl,
      foundPlaceholders,
      missingMandatory,
      isValid: missingMandatory.length === 0,
      message: `Template ${docType} berhasil di-upload dan langsung menggantikan template master.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  // Route: GET /document-templates/:type/signed-url
  const tplSignedUrlMatch = pathname.match(/^\/document-templates\/([A-Z]+)\/signed-url$/);
  if (tplSignedUrlMatch && req.method === 'GET') {
    const docType = tplSignedUrlMatch[1];
    const { data: tpl } = await supabase.from('document_templates').select('*').eq('id', docType).maybeSingle();
    if (!tpl || !tpl.file_path) {
      return new Response(JSON.stringify({ error: `Master template ${docType} belum di-upload.` }), { status: 404, headers: corsHeaders });
    }

    try {
      const signedUrl = await getSignedFileUrl(supabase, BUCKET_TEMPLATES, tpl.file_path, 3600, tpl.original_filename || `Master_Template_${docType}.docx`);
      return new Response(JSON.stringify({ signedUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: corsHeaders });
    }
  }

  // Route: POST /documents/generate-v2
  if (pathname === '/documents/generate-v2' && req.method === 'POST') {
    const payload = await req.json();
    let { docType, date, clientName, schoolId, linkedLeadId, inputFields, authorName, authorId } = payload;

    if (!['SPH', 'SKK', 'INV', 'KUI', 'MOU', 'GEN'].includes(docType)) {
      return new Response(JSON.stringify({ error: 'Tipe dokumen tidak valid' }), { status: 400, headers: corsHeaders });
    }

    // Default bank account from Business Settings if not provided
    if (!inputFields?.bank) {
      inputFields = inputFields || {};
      inputFields.bank = await getBusinessBank();
    }

    // 1. Reserve Atomic Document Number
    const numberRes = await reserveDocumentNumber(supabase, docType, date || new Date());
    const docNo = numberRes.fullNo;

    // Handle MOU and GEN (No file generation, number reservation only)
    if (docType === 'MOU' || docType === 'GEN') {
      const { data: numberOnlyDoc, error: insertErr } = await supabase
        .from('generated_documents')
        .insert({
          type: docType,
          doc_no: docNo,
          monthly_serial: numberRes.serial,
          client_name: clientName || inputFields?.penerima || 'Umum',
          title: inputFields?.perihal || inputFields?.program || 'Dokumen Nomor Administrasi',
          date: date || new Date().toISOString().split('T')[0],
          status: 'FINALIZED',
          data_snapshot: inputFields || {},
          linked_lead_id: linkedLeadId || null,
          school_id: schoolId || null,
          author_name: authorName || 'Staff',
          author_id: authorId || user?.id,
          finalized_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({
        success: true,
        document: numberOnlyDoc,
        message: `Nomor ${docType} ${docNo} berhasil diregistrasi.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // 2. Fetch Master Template for SPH/SKK/INV/KUI
    const { data: tplMaster } = await supabase.from('document_templates').select('*').eq('id', docType).maybeSingle();
    if (!tplMaster || !tplMaster.file_path) {
      return new Response(JSON.stringify({ error: `Belum ada master template ${docType}. Silakan upload file template .docx di Template Manager.` }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // 3. Build complete data snapshot & mapping
    const rawVal = parseFloat(String(inputFields?.harga || inputFields?.specialPrice || inputFields?.value || inputFields?.nilai || 0).replace(/[^0-9.-]+/g, '')) || 0;
    const formattedHarga = formatRupiah(rawVal);
    const textTerbilang = terbilang(rawVal);
    const formattedTanggal = formatTanggalIndo(date || new Date());

    // Auto format checklist facilities if array
    let facilitiesStr = inputFields?.facilities || "";
    if (Array.isArray(facilitiesStr)) {
      facilitiesStr = facilitiesStr.join(", ");
    }

    const targetClientName = clientName || inputFields?.sekolah || 'Client';
    const dateStr = date || new Date().toISOString().split('T')[0];

    // Format any YYYY-MM-DD date inputs into Full Indonesian Date (e.g., 2 September 2026)
    const formattedSnapshotInput: Record<string, any> = {};
    if (inputFields && typeof inputFields === 'object') {
      for (const [key, val] of Object.entries(inputFields)) {
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
          formattedSnapshotInput[key] = formatTanggalIndo(val);
        } else {
          formattedSnapshotInput[key] = val;
        }
      }
    }

    const snapshot: Record<string, any> = {
      nomor: docNo,
      tanggal: formattedTanggal,
      sekolah: targetClientName,
      program: inputFields?.program || 'Program Activity',
      harga: formattedHarga,
      terbilang: textTerbilang,
      rawHarga: rawVal,
      ...formattedSnapshotInput,
      fasilitas: facilitiesStr
    };

    // 4. Load template DOCX binary from Supabase Storage
    const templateBytes = await downloadFileFromStorage(supabase, BUCKET_TEMPLATES, tplMaster.file_path);

    // 5. Fill placeholders via docxtemplater
    const generatedDocxBytes = fillDocxTemplate(templateBytes, snapshot);

    // 6. Save generated DOCX with descriptive filename (Jenis_NoSurat_Sekolah_Tanggal.docx)
    const docUuid = crypto.randomUUID();
    const yearStr = String(numberRes.year);
    const monthStr = String(numberRes.month).padStart(2, '0');
    const docxFilename = buildDescriptiveFilename(docType, docNo, targetClientName, dateStr, 'docx');
    const pdfFilename = buildDescriptiveFilename(docType, docNo, targetClientName, dateStr, 'pdf');

    const docxStoragePath = `${yearStr}/${monthStr}/${docUuid}/${docxFilename}`;

    await uploadFileToStorage(
      supabase,
      BUCKET_GENERATED,
      docxStoragePath,
      generatedDocxBytes,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    // 7. Convert DOCX to PDF
    let pdfStoragePath: string | null = null;
    let pdfStatusMsg = "";
    const pdfRes = await convertDocxToPdf(generatedDocxBytes, docxFilename);

    if (pdfRes.success && pdfRes.pdfBuffer) {
      pdfStoragePath = `${yearStr}/${monthStr}/${docUuid}/${pdfFilename}`;
      await uploadFileToStorage(supabase, BUCKET_GENERATED, pdfStoragePath, pdfRes.pdfBuffer, 'application/pdf');
    } else {
      pdfStatusMsg = pdfRes.error || "PDF conversion offline";
    }

    // 8. Insert record to generated_documents
    const docStatus = pdfStoragePath ? 'GENERATED' : 'DRAFT';

    const { data: newDoc, error: docErr } = await supabase
      .from('generated_documents')
      .insert({
        id: docUuid,
        type: docType,
        doc_no: docNo,
        monthly_serial: numberRes.serial,
        client_name: targetClientName,
        title: snapshot.program,
        date: dateStr,
        status: docStatus,
        data_snapshot: snapshot,
        docx_path: docxStoragePath,
        pdf_path: pdfStoragePath,
        linked_lead_id: linkedLeadId || null,
        school_id: schoolId || null,
        author_name: authorName || 'Staff',
        author_id: authorId || user?.id
      })
      .select()
      .single();

    if (docErr) throw docErr;

    // 9. AUTOMATION BUSINESS RULES SYNC (CRM & CALENDAR)
    try {
      if (docType === 'SPH') {
        // SPH -> Advance status to PROSPEK (safe transition)
        await advanceLeadAndClientStatus(supabase, linkedLeadId, schoolId, 'PROSPEK', `Membuat SPH #${docNo}`);
      } else if (docType === 'SKK') {
        // SKK created -> Sync Calendar if schedule provided, status stays PROSPEK until CONFIRMED
        if (inputFields?.startDate && linkedLeadId) {
          await syncCalendarEvent(
            supabase,
            linkedLeadId,
            schoolId,
            clientName || snapshot.sekolah,
            snapshot.program,
            inputFields.startDate,
            inputFields.endDate || inputFields.startDate,
            inputFields.startTime || "08:00",
            inputFields.endTime || "16:00"
          );
        }
      } else if (docType === 'KUI') {
        // Kuitansi created/finalized -> Advance status to BUYER
        await advanceLeadAndClientStatus(supabase, linkedLeadId, schoolId, 'BUYER', `Kuitansi terbit #${docNo}`);
      }
    } catch (crmSyncErr: any) {
      console.error("CRM Sync notice:", crmSyncErr.message);
    }

    return new Response(JSON.stringify({
      success: true,
      document: newDoc,
      pdfCreated: !!pdfStoragePath,
      pdfNotice: pdfStatusMsg ? `DOCX berhasil dibuat. ${pdfStatusMsg}` : null,
      docxUrl: await getSignedFileUrl(supabase, BUCKET_GENERATED, docxStoragePath, 3600),
      pdfUrl: pdfStoragePath ? await getSignedFileUrl(supabase, BUCKET_GENERATED, pdfStoragePath, 3600) : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  // Route: POST /documents/:id/confirm-skk
  const confirmSkkMatch = pathname.match(/^\/documents\/([a-f0-9-]+)\/confirm-skk$/);
  if (confirmSkkMatch && req.method === 'POST') {
    const docId = confirmSkkMatch[1];
    const payload = await req.json().catch(() => ({}));
    let { paymentDate } = payload;

    const { data: doc } = await supabase.from('generated_documents').select('*').eq('id', docId).single();
    if (!doc || doc.type !== 'SKK') {
      return new Response(JSON.stringify({ error: 'Dokumen SKK tidak ditemukan.' }), { status: 404, headers: corsHeaders });
    }

    const snapshot = doc.data_snapshot || {};
    if (!paymentDate) {
      paymentDate = snapshot.paymentDate || snapshot.validUntil || snapshot.tanggalPembayaran;
    }

    if (!paymentDate) {
      return new Response(JSON.stringify({ error: 'Masukkan estimasi tanggal pembayaran terlebih dahulu sebelum mengonfirmasi SKK.' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Calculate status (DEAL vs CONFIRM)
    const targetStatus = determineStatusFromPaymentDate(paymentDate);

    // Safely advance Lead & Client status
    await advanceLeadAndClientStatus(
      supabase,
      doc.linked_lead_id,
      doc.school_id,
      targetStatus,
      `SKK #${doc.doc_no} Dikonfirmasi (Status: ${targetStatus})`
    );

    // Update document status to FINALIZED
    const { data: updatedDoc, error: updateErr } = await supabase
      .from('generated_documents')
      .update({
        status: 'FINALIZED',
        finalized_at: new Date().toISOString(),
        data_snapshot: {
          ...snapshot,
          paymentDate,
          skkConfirmedAt: new Date().toISOString(),
          skkResultStatus: targetStatus
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', docId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({
      success: true,
      document: updatedDoc,
      newStatus: targetStatus,
      message: `SKK ${doc.doc_no} berhasil dikonfirmasi. Status Sales: ${targetStatus}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  // Route: POST /documents/:id/remove-schedule
  const removeSchedMatch = pathname.match(/^\/documents\/([a-f0-9-]+)\/remove-schedule$/);
  if (removeSchedMatch && req.method === 'POST') {
    const docId = removeSchedMatch[1];
    const { data: doc } = await supabase.from('generated_documents').select('*').eq('id', docId).single();
    if (!doc || !doc.linked_lead_id) {
      return new Response(JSON.stringify({ error: 'Dokumen atau Lead terkait tidak ditemukan.' }), { status: 404, headers: corsHeaders });
    }

    await removeCalendarSchedule(supabase, doc.linked_lead_id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Jadwal kegiatan berhasil dihapus dari Kalender.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  // Route: POST /documents/:id/regenerate-pdf
  const regenPdfMatch = pathname.match(/^\/documents\/([a-f0-9-]+)\/regenerate-pdf$/);
  if (regenPdfMatch && req.method === 'POST') {
    const docId = regenPdfMatch[1];
    const { data: doc } = await supabase.from('generated_documents').select('*').eq('id', docId).single();
    if (!doc || !doc.docx_path) {
      return new Response(JSON.stringify({ error: 'Dokumen atau file DOCX tidak ditemukan.' }), { status: 404, headers: corsHeaders });
    }

    const docxBytes = await downloadFileFromStorage(supabase, BUCKET_GENERATED, doc.docx_path);
    const pdfRes = await convertDocxToPdf(docxBytes, `document_${doc.doc_no.replace(/\//g, '_')}.docx`);

    if (!pdfRes.success || !pdfRes.pdfBuffer) {
      return new Response(JSON.stringify({ error: `Gagal membuat PDF: ${pdfRes.error}` }), { status: 400, headers: corsHeaders });
    }

    const pathParts = doc.docx_path.split('/');
    pathParts.pop();
    const pdfStoragePath = `${pathParts.join('/')}/document.pdf`;

    await uploadFileToStorage(supabase, BUCKET_GENERATED, pdfStoragePath, pdfRes.pdfBuffer, 'application/pdf');

    const { data: updatedDoc, error: updateErr } = await supabase
      .from('generated_documents')
      .update({
        pdf_path: pdfStoragePath,
        status: 'GENERATED',
        updated_at: new Date().toISOString()
      })
      .eq('id', docId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({
      success: true,
      document: updatedDoc,
      pdfUrl: await getSignedFileUrl(supabase, BUCKET_GENERATED, pdfStoragePath, 3600)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  // Route: GET /documents/:id/signed-url
  const docSignedUrlMatch = pathname.match(/^\/documents\/([a-f0-9-]+)\/signed-url$/);
  if (docSignedUrlMatch && req.method === 'GET') {
    const docId = docSignedUrlMatch[1];
    const fileType = url.searchParams.get('type') || 'pdf';
    const dispositionParam = url.searchParams.get('disposition');
    const disposition = (dispositionParam === 'attachment' || dispositionParam === 'download') ? 'attachment' : 'inline';

    const { data: doc } = await supabase.from('generated_documents').select('*').eq('id', docId).single();
    if (!doc) {
      return new Response(JSON.stringify({ error: 'Dokumen tidak ditemukan' }), { status: 404, headers: corsHeaders });
    }

    const filePath = fileType === 'pdf' ? doc.pdf_path : doc.docx_path;
    if (!filePath) {
      return new Response(JSON.stringify({ error: `File ${fileType.toUpperCase()} belum tersedia untuk dokumen ini.` }), { status: 404, headers: corsHeaders });
    }

    const descriptiveFilename = buildDescriptiveFilename(doc.type, doc.doc_no, doc.client_name, doc.date, fileType as 'pdf' | 'docx');
    const signedUrl = await getSignedFileUrl(supabase, BUCKET_GENERATED, filePath, 3600, descriptiveFilename, disposition);
    return new Response(JSON.stringify({ signedUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  // Route: DELETE /documents/:id (Full Delete & Rollback Sync)
  const deleteDocMatch = pathname.match(/^\/documents\/([a-f0-9-]+)$/);
  if (deleteDocMatch && req.method === 'DELETE') {
    const docId = deleteDocMatch[1];
    
    // 1. Get document details
    const { data: doc } = await supabase.from('generated_documents').select('*').eq('id', docId).maybeSingle();
    if (doc) {
      // 2. Only remove calendar schedule if the document being deleted is SKK
      if (doc.type === 'SKK' && doc.linked_lead_id) {
        try {
          await removeCalendarSchedule(supabase, doc.linked_lead_id);
        } catch (calErr: any) {
          console.warn("Calendar schedule removal notice:", calErr.message);
        }
      }

      // 3. Remove files from storage
      if (doc.docx_path) {
        try { await supabase.storage.from(BUCKET_GENERATED).remove([doc.docx_path]); } catch {}
      }
      if (doc.pdf_path) {
        try { await supabase.storage.from(BUCKET_GENERATED).remove([doc.pdf_path]); } catch {}
      }

      // 4. Delete database row
      const { error: delErr } = await supabase.from('generated_documents').delete().eq('id', docId);
      if (delErr) throw delErr;
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Dokumen dan seluruh data tersinkron berhasil dihapus.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  return null;
}
