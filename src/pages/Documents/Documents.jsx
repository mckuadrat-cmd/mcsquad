import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Filter, FileText, Download, Eye, Printer, X, FileSignature, Settings, FileCheck, Landmark, Receipt, FileStack, Calendar as CalIcon, Save, ChevronDown, Trash2, Edit2, Undo, RotateCcw, Info } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { supabase, parseDates, invokeApi } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAppData } from '../../context/AppDataContext';
import { logActivity } from '../../utils/activityLogger';
import { updateClientActivity } from '../../utils/clientUtils';
import { useNotification } from '../../context/NotificationContext';

const Documents = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, currentUser, userRole } = useAuth();
  const { clients, uniqueSchools } = useAppData();
  const { showAlert, showConfirm } = useNotification();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('documentsTab') || 'list';
  });

  useEffect(() => {
    localStorage.setItem('documentsTab', activeTab);
  }, [activeTab]);
  const [templates, setTemplates] = useState({});
  const [selectedTemplateType, setSelectedTemplateType] = useState('SPH');
  const [editorContent, setEditorContent] = useState('');
  const quillRef = useRef(null);

  const isAdminOrOwner = userRole === 'owner' || userRole === 'admin' || userProfile?.role === 'owner' || userProfile?.role === 'admin';

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch custom templates from Firestore
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const { data } = await invokeApi('/document_templates');
        const tmps = {};
        (data || []).forEach(doc => {
          tmps[doc.id] = doc.html;
        });
        setTemplates(tmps);
      } catch (e) {
        console.error("Error fetching templates", e);
      }
    };
    fetchTemplates();
  }, []);

  // Update editor content when template type or templates list changes
  useEffect(() => {
    if (activeTab === 'templates') {
      const savedHtml = templates[selectedTemplateType] || DEFAULT_TEMPLATES[selectedTemplateType] || '';
      setEditorContent(savedHtml);
    }
  }, [selectedTemplateType, templates, activeTab]);

  const handleSaveTemplate = async (type, htmlContent) => {
    try {
      await invokeApi('/document_templates', {
        method: 'PUT',
        body: { id: type, html: htmlContent, updatedAt: new Date().toISOString() }
      });
      setTemplates(prev => ({ ...prev, [type]: htmlContent }));
      showAlert("Berhasil", "Template berhasil disimpan.", "success");
    } catch (err) {
      console.error(err);
      showAlert("Gagal", "Gagal menyimpan template: " + err.message, "error");
    }
  };

  const handleResetTemplate = (type) => {
    showConfirm(
      "Kembalikan ke Default?",
      "Apakah Anda yakin ingin menghapus kustomisasi dan kembali ke template bawaan?",
      async () => {
        try {
          await invokeApi(`/document_templates?id=eq.${type}`, { method: 'DELETE' });
          setTemplates(prev => {
            const next = { ...prev };
            delete next[type];
            return next;
          });
          setEditorContent(DEFAULT_TEMPLATES[type] || '');
          showAlert("Berhasil", "Template dikembalikan ke bawaan sistem.", "success");
        } catch (err) {
          console.error(err);
          showAlert("Gagal", "Gagal merestet template: " + err.message, "error");
        }
      }
    );
  };

  const insertPlaceholder = (placeholder) => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const range = quill.getSelection();
      if (range) {
        quill.insertText(range.index, placeholder);
        quill.setSelection(range.index + placeholder.length);
      } else {
        quill.insertText(quill.getLength() - 1, placeholder);
      }
    }
  };
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // "YYYY-MM"
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [businessData, setBusinessData] = useState(null);

  // Drawer state for Generator
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: 'SPH',
    client: '',
    program: '',
    value: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    description: '', // SPH
    session: '1 Sesi', // Global (SPH & SKK)
    specialPrice: '', // SPH
    facilities: [], // SPH
    validUntil: '', // SPH
    extraNotes: '', // Catatan Umum
    penyelenggara: '', // SKK
    jabatan: '', // SKK
    trainer: '', // SKK
    waktu: '', // Legacy SKK text
    startDate: '', // New SKK Date
    endDate: '', // New SKK Date
    startTime: '08:00', // New SKK Time
    endTime: '16:00', // New SKK Time
    peserta: '', // SKK
    disiapkanPenyelenggara: [], // SKK
    items: [{ desc: '', qty: 1, price: '' }], // untuk Invoice
    bank: 'Bank Mandiri - 1234567890 a/n MCKuadrat', // Default Bank
    linkedLeadId: '', // Context from Leads page
    schoolId: '', // Unique ID for sync
  });

  const [googleDocsSettings, setGoogleDocsSettings] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');

  useEffect(() => {
    const fetchBusinessSettings = async () => {
      try {
        const { data } = await invokeApi('/settings?id=eq.business&single=true');
        if (data && data.value) {
          setBusinessData(data.value);
        }
      } catch (e) {
        console.error("Error fetching business settings", e);
      }
    };
    const fetchGoogleDocsSettings = async () => {
      try {
        const { data } = await invokeApi('/settings?id=eq.google_docs&single=true');
        if (data && data.value) {
          setGoogleDocsSettings(data.value);
        }
      } catch (e) {
        console.error("Error fetching google docs settings", e);
      }
    };
    fetchBusinessSettings();
    fetchGoogleDocsSettings();
  }, []);

  // Handle pre-fill from Leads page
  useEffect(() => {
    if (location.state?.preFill) {
      const data = location.state.preFill;
      setIsEditing(false);
      setEditingId(null);
      setFormData(prev => ({
        ...prev,
        type: data.type || 'SPH',
        client: data.client || '',
        program: data.program || '',
        value: data.value || '',
        linkedLeadId: data.linkedLeadId || '',
        schoolId: data.schoolId || '',
        startDate: data.startDate || prev.startDate
      }));
      setIsGeneratorOpen(true);

      // Clear state after handling to prevent re-triggering on manual refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Print Preview state
  const [previewDoc, setPreviewDoc] = useState(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync Documents
  useEffect(() => {
    let documentsChannel;

    const fetchDocs = async () => {
      try {
        const { data } = await invokeApi('/generated_documents?order=createdAt.desc');
        setDocuments(parseDates(data || []));

        // Subscribe to changes
        documentsChannel = supabase.channel('public:generated_documents')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'generated_documents' }, (payload) => {
            const parsedNew = parseDates(payload.new);
            if (payload.eventType === 'INSERT') {
              setDocuments(prev => [parsedNew, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setDocuments(prev => prev.map(item => item.id === parsedNew.id ? parsedNew : item));
            } else if (payload.eventType === 'DELETE') {
              setDocuments(prev => prev.filter(item => item.id !== payload.old.id));
            }
          }).subscribe();

      } catch (err) {
        console.error("Error loading generated_documents:", err);
      }
    };

    fetchDocs();

    return () => {
      if (documentsChannel) documentsChannel.unsubscribe();
    };
  }, []);

  const formatRupiah = (number) => {
    if (!number) return 'Rp 0';
    const val = number.toString().replace(/[^0-9]/g, '');
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(val || 0);
  };

  const toRoman = (num) => {
    const romanMap = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    return romanMap[num] || num.toString();
  };

  const getPdfPreviewUrl = (viewUrl) => {
    if (!viewUrl) return '';
    if (viewUrl.includes('drive.google.com')) {
      return viewUrl.replace('/view', '/preview').replace(/\?usp=.*/, '');
    }
    return viewUrl;
  };

  const getDocNumber = async (type) => {
    const now = new Date();
    const mm = now.getMonth() + 1;
    const romanMonth = toRoman(mm);
    const yyyy = now.getFullYear();

    // Global counter reset monthly
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    const { data: lastDocs } = await invokeApi(`/generated_documents?createdAt=gte.${startOfMonth}&order=createdAt.desc&limit=1`);

    let nextNo = 1;
    if (lastDocs && lastDocs.length > 0) {
      const lastDoc = lastDocs[0];
      nextNo = (lastDoc.monthlySerial || 0) + 1;
    }

    // Format: (No Urut/MCC/Bulan/Tahun) for GEN, else (No Urut/TYPE/MCC/Bulan/Tahun)
    const fullNo = type === 'GEN'
      ? `${nextNo.toString().padStart(2, '0')}/MCC/${romanMonth}/${yyyy}`
      : `${nextNo.toString().padStart(2, '0')}/${type}/MCC/${romanMonth}/${yyyy}`;

    return {
      full: fullNo,
      serial: nextNo
    };
  };

  const handleGenerate = async (e) => {
    e.preventDefault();

    try {
      let finalDocId = '';
      let finalDocNo = '';
      let currentLinkedLeadId = '';
      let docToUpdate = null;

      const val = formData.type === 'SPH' && formData.specialPrice ? formatRupiah(formData.specialPrice) : (formData.value ? formatRupiah(formData.value) : '-');
      const rawVal = formData.type === 'SPH' && formData.specialPrice ? formData.specialPrice : (formData.value || 0);

      if (isEditing) {
        docToUpdate = documents.find(d => d.id === editingId);
        if (!docToUpdate) throw new Error("Document not found");

        finalDocId = editingId;
        finalDocNo = docToUpdate.docNo;
        currentLinkedLeadId = docToUpdate.linkedLeadId;
      } else {
        const num = await getDocNumber(formData.type);
        finalDocNo = num.full;
      }

      // Check Google Docs Integration
      const templateId = googleDocsSettings?.templates?.[formData.type];
      const scriptUrl = googleDocsSettings?.googleAppsScriptUrl;
      const folderId = googleDocsSettings?.googleDriveFolderId;
      const useGoogleDocs = !!(scriptUrl && templateId);

      let pdfUrl = '';
      let pdfViewUrl = '';

      if (useGoogleDocs) {
        setIsGeneratingPdf(true);
        setGenerationProgress("Menyiapkan parameter dokumen...");

        // Format parameters
        let waktuHtmlText = '';
        if (formData.startDate) {
          waktuHtmlText = formatIndonesianDate(formData.startDate);
          if (formData.endDate) waktuHtmlText += ` s/d ${formatIndonesianDate(formData.endDate)}`;
          if (formData.startTime) waktuHtmlText += ` | Pukul ${formData.startTime} - ${formData.endTime || 'Selesai'} WIB`;
        } else {
          waktuHtmlText = 'Jadwal menyesuaikan kemudian';
        }

        let bankAccountDetailsText = formData.bank || 'BCA dengan Nomor Rekening 4730 904 571 a.n. ANRIO MARFIZAL S PSI';
        if (businessData?.bankAccounts && businessData.bankAccounts.length > 0) {
          bankAccountDetailsText = `${businessData.bankAccounts[0].bankName} Rek. ${businessData.bankAccounts[0].accountNo} a.n. ${businessData.bankAccounts[0].accountName}`;
        }

        let facilitiesText = '';
        if (formData.facilities && formData.facilities.length > 0) {
          facilitiesText = '- ' + formData.facilities.join('\n- ');
        }

        const replacements = {
          '{{NOMOR_SURAT}}': finalDocNo || '',
          '{{TANGGAL_SURAT}}': formatIndonesianDate(formData.date) || '',
          '{{NAMA_KLIEN}}': formData.client || formData.penerima || 'Umum',
          '{{NAMA_PROGRAM}}': formData.program || '',
          '{{DESKRIPSI_PROGRAM}}': formData.description || 'Training Pengembangan Mental & Karakter',
          '{{SESI_KEGIATAN}}': formData.session || '1 Sesi',
          '{{NILAI_INVESTASI}}': val || '',
          '{{INVESTASI_TERBILANG}}': terbilang(rawVal) + ' Rupiah',
          '{{BATAS_KONFIRMASI}}': formatIndonesianDate(formData.validUntil || formData.paymentDate) || '',
          '{{PIC_PENYELENGGARA}}': formData.penyelenggara || '',
          '{{JABATAN_PIC}}': formData.jabatan || '',
          '{{NAMA_TRAINER}}': formData.trainer || 'Kak Rio (Expert Trainer & Founder mckuadrat)',
          '{{WAKTU_PELAKSANAAN}}': waktuHtmlText,
          '{{TARGET_PESERTA}}': formData.peserta || `Siswa/Guru ${formData.client || formData.penerima || 'Umum'}`,
          '{{REKENING_BANK}}': bankAccountDetailsText,
          '{{FASILITAS_INCLUDED}}': facilitiesText,
          '{{PERSIAPAN_PENYELENGGARA}}': formData.disiapkanPenyelenggara && formData.disiapkanPenyelenggara.length > 0
            ? formData.disiapkanPenyelenggara.join(', ')
            : 'Ruangan Training, Sound System, Infokus, Kursi-Meja Trainer, Flipchart & spidol',
          '{{CATATAN_TAMBAHAN}}': formData.extraNotes || formData.notes || '-',
        };

        setGenerationProgress("Men-generate file PDF di Google Drive...");
        try {
          const response = await fetch(scriptUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
              templateId: templateId,
              folderId: folderId,
              outputFileName: `${formData.type} - ${formData.client || formData.penerima || 'Umum'} - ${finalDocNo.replace(/\//g, '-')}`,
              replacements: replacements
            })
          });
          const resData = await response.json();
          if (!resData.success) {
            throw new Error(resData.error || "Gagal membuat PDF dari Google Docs");
          }
          pdfUrl = resData.pdfUrl || '';
          pdfViewUrl = resData.pdfViewUrl || '';
        } catch (gasErr) {
          console.error("Apps Script Error:", gasErr);
          throw new Error("Gagal memproses Google Docs: " + gasErr.message);
        } finally {
          setIsGeneratingPdf(false);
        }
      }

      if (isEditing) {
        await invokeApi(`/generated_documents?id=eq.${editingId}`, {
          method: 'PUT',
          body: {
            client: formData.client || formData.penerima || 'Umum',
            value: val, rawValue: rawVal, date: formData.date,
            status: formData.type === 'SKK' ? 'Pending' : (docToUpdate?.status || 'Draft'),
            details: formData,
            updatedAt: new Date().toISOString(),
            extraNotes: formData.extraNotes || '',
            schoolId: formData.schoolId || '',
            pdfUrl: pdfUrl,
            pdfViewUrl: pdfViewUrl,
            useGoogleDocs: useGoogleDocs
          }
        });

        logActivity(currentUser, `Memperbarui Dokumen ${formData.type}: ${finalDocNo}`, editingId, 'Document', 'Administrasi');
      } else {
        const num = await getDocNumber(formData.type); // Fetch sequence serial
        const newDoc = {
          id: `DOC-${Math.floor(Math.random() * 90000) + 10000}`,
          docNo: finalDocNo, monthlySerial: num.serial, type: formData.type,
          title: formData.program || formData.notes || formData.perihal || 'Document',
          client: formData.client || formData.penerima || 'Umum',
          date: formData.date, value: val, rawValue: rawVal,
          status: formData.type === 'SKK' ? 'Pending' : 'Draft',
          details: formData, 
          createdAt: new Date().toISOString(), 
          updatedAt: new Date().toISOString(),
          author: (userProfile?.nickname?.trim() || userProfile?.name) || 'Staff', 
          authorId: currentUser?.uid,
          extraNotes: formData.extraNotes || '',
          linkedLeadId: formData.linkedLeadId || '',
          schoolId: formData.schoolId || '',
          pdfUrl: pdfUrl,
          pdfViewUrl: pdfViewUrl,
          useGoogleDocs: useGoogleDocs
        };

        const { data: newDocResArr } = await invokeApi('/generated_documents', {
          method: 'POST',
          body: newDoc
        });
        const newDocRes = newDocResArr?.[0] || newDoc;

        finalDocId = newDocRes.id;
        logActivity(currentUser, `Membuat Dokumen ${formData.type}: ${finalDocNo}`, finalDocId, 'Document', 'Administrasi');
      }

      // Update Client Last Activity
      if (formData.client && formData.client !== 'Internal Tim') {
        await updateClientActivity(formData.client, `${isEditing ? 'Update' : 'Generate'} ${formData.type}: ${formData.program || formData.perihal || 'Doc'}`);
      }

      // --- BI LOGIC: INTEGRATION WITH LEADS ---
      if (formData.client && ['SPH', 'SKK', 'KUI'].includes(formData.type)) {
        let leadsUrl = '/leads';
        if (formData.schoolId) {
          leadsUrl += `?schoolId=eq.${formData.schoolId}`;
        } else {
          leadsUrl += `?schoolName=eq.${encodeURIComponent(formData.client)}`;
        }
        const { data: leadSnap } = await invokeApi(leadsUrl);

        let targetStatus = 'suspect';
        if (formData.type === 'SPH') targetStatus = 'prospek';
        if (formData.type === 'KUI') targetStatus = 'buyer';
        if (formData.type === 'SKK') targetStatus = 'prospek';

        let targetLeadId = '';
        const leadDataToUpdate = {
          status: targetStatus,
          updatedAt: new Date().toISOString(),
          isRealPrice: ['confirm', 'deal', 'buyer'].includes(targetStatus),
          lastActivity: `Otomatis: ${isEditing ? 'Update' : 'Generate'} ${formData.type} (#${finalDocNo})`
        };

        if (formData.startDate) leadDataToUpdate.date = formData.startDate;
        if (formData.value) leadDataToUpdate.price = formData.value;
        if (formData.program) leadDataToUpdate.program = formData.program;

        // Prioritize linkedLeadId from pre-fill or existing doc link
        if (formData.linkedLeadId || currentLinkedLeadId) {
          targetLeadId = formData.linkedLeadId || currentLinkedLeadId;
          await invokeApi(`/leads?id=eq.${targetLeadId}`, { method: 'PUT', body: leadDataToUpdate });
        } else if (leadSnap && leadSnap.length > 0) {
          targetLeadId = leadSnap[0].id;
          await invokeApi(`/leads?id=eq.${targetLeadId}`, { method: 'PUT', body: leadDataToUpdate });
        } else {
          targetLeadId = `L-${Math.floor(Math.random() * 9000) + 1000}`;
          await invokeApi('/leads', {
            method: 'POST',
            body: {
              id: targetLeadId,
              schoolId: formData.schoolId || '',
              schoolName: formData.client,
              status: targetStatus,
              program: formData.program || '',
              price: formData.value || 0,
              date: formData.startDate || 'TBD',
              pic: (userProfile?.nickname?.trim() || userProfile?.name) || 'Staff',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastActivity: `Otomatis: Lead from ${formData.type} created`
            }
          });
        }

        // CALENDAR SYNC (SKK)
        if (formData.type === 'SKK' && formData.startDate) {
          const evId = `EVL-${targetLeadId}`;
          const existingEvent = calendarEvents.find(e => e.id === evId);
          const updatedProps = {
            ...(existingEvent?.extendedProps || {}),
            type: 'event',
            leadId: targetLeadId,
            schoolName: formData.client,
            pic: (userProfile?.nickname?.trim() || userProfile?.name) || 'Staff',
            isEstimasi: false
          };

          await invokeApi('/calendar_events', {
            method: 'PUT',
            body: {
              id: evId,
              title: `${formData.program} - ${formData.client}`,
              start: formData.startDate,
              end: formData.endDate || formData.startDate,
              allDay: true,
              backgroundColor: '#E5EFFF',
              borderColor: '#4680FF',
              textColor: '#4680FF',
              extendedProps: updatedProps,
              updatedAt: new Date().toISOString()
            }
          });

          await invokeApi(`/leads?id=eq.${targetLeadId}`, { method: 'PUT', body: { calendarEventId: evId } });
        }

        // Link back to document
        await invokeApi(`/generated_documents?id=eq.${finalDocId}`, { method: 'PUT', body: { linkedLeadId: targetLeadId } });
      }

      setIsGeneratorOpen(false);
      showAlert("Berhasil", isEditing ? "Dokumen telah diperbarui." : "Dokumen telah dibuat.", "success");

      if (formData.type !== 'GEN' || useGoogleDocs) {
        const val = formData.type === 'SPH' && formData.specialPrice ? formatRupiah(formData.specialPrice) : (formData.value ? formatRupiah(formData.value) : '-');
        setPreviewDoc({ 
          docNo: finalDocNo, 
          type: formData.type, 
          client: formData.client || formData.penerima || 'Umum', 
          value: val, 
          details: { ...formData }, 
          id: finalDocId,
          pdfUrl: pdfUrl,
          pdfViewUrl: pdfViewUrl,
          useGoogleDocs: useGoogleDocs
        });
      }

      setIsEditing(false);
      setEditingId(null);
    } catch (err) {
      console.error(err);
      showAlert("Gagal", "Gagal memproses dokumen: " + err.message, "error");
    }
  };

  const handleConfirmSKK = async (docId, schoolName) => {
    const docData = documents.find(d => d.id === docId);
    const paymentDate = docData?.details?.paymentDate;

    showConfirm(
      "Konfirmasi Deal?",
      "Konfirmasi dokumen ini akan memindahkan sekolah ke status DEAL atau CONFIRM berdasarkan tanggal pembayaran.",
      async () => {
        try {
          // 1. Update Document Status
          await invokeApi(`/generated_documents?id=eq.${docId}`, { method: 'PUT', body: { status: 'Confirmed' } });

          // 2. Determine Target Status
          let targetStatus = 'deal';
          if (paymentDate) {
            const now = new Date();
            const pay = new Date(paymentDate);
            const isThisMonth = pay.getMonth() === now.getMonth() && pay.getFullYear() === now.getFullYear();
            if (!isThisMonth) targetStatus = 'confirm';
          }

          // 3. Update Lead Status using linked ID
          const targetLeadId = docData?.linkedLeadId;
          if (targetLeadId) {
            await invokeApi(`/leads?id=eq.${targetLeadId}`, {
              method: 'PUT',
              body: {
                status: targetStatus,
                isRealPrice: true,
                updatedAt: new Date().toISOString(),
                lastActivity: `Otomatis: SKK Confirmed - Move to ${targetStatus.toUpperCase()}`
              }
            });
          } else {
            // Fallback to ID or name search if no linked ID
            let leadsUrl = '/leads';
            if (docData?.schoolId) {
              leadsUrl += `?schoolId=eq.${docData.schoolId}`;
            } else {
              leadsUrl += `?schoolName=eq.${encodeURIComponent(schoolName)}`;
            }
            const { data: leadSnap } = await invokeApi(leadsUrl);
            if (leadSnap && leadSnap.length > 0) {
              await invokeApi(`/leads?id=eq.${leadSnap[0].id}`, {
                method: 'PUT',
                body: {
                  status: targetStatus,
                  isRealPrice: true,
                  updatedAt: new Date().toISOString(),
                  lastActivity: `Otomatis: SKK Confirmed (Search) - Move to ${targetStatus.toUpperCase()}`
                }
              });
            }
          }

          // Update Client Last Activity
          await updateClientActivity(schoolName, "SKK Confirmed - Deal");

          showAlert("Berhasil", `Data telah dikonfirmasi dan Lead dipindahkan ke ${targetStatus.toUpperCase()}.`, "success");
        } catch (err) {
          showAlert("Gagal", "Error: " + err.message, "error");
        }
      }
    );
  };
  const handleEdit = (docItem) => {
    if (docItem.authorId && docItem.authorId !== currentUser?.uid && userProfile?.role !== 'owner') {
      showAlert("Akses Ditolak", "Anda tidak memiliki izin untuk mengedit dokumen ini.", "error");
      return;
    }
    setFormData({ ...docItem.details, type: docItem.type });
    setIsEditing(true);
    setEditingId(docItem.id);
    setIsGeneratorOpen(true);
  };

  const handleDelete = (docId, authorId) => {
    if (authorId && authorId !== currentUser?.uid && userProfile?.role !== 'owner') {
      showAlert("Akses Ditolak", "Anda tidak memiliki izin untuk menghapus dokumen ini.", "error");
      return;
    }
    showConfirm(
      "Hapus Dokumen",
      "Apakah Anda yakin ingin menghapus dokumen ini? Tindakan ini tidak dapat dibatalkan.",
      async () => {
        try {
          const docToDelete = documents.find(d => d.id === docId);
          await invokeApi(`/generated_documents?id=eq.${docId}`, { method: 'DELETE' });

          // Cascading delete the lead and its calendar event if linked
          if (docToDelete?.linkedLeadId) {
            const { data: leadSnap } = await invokeApi(`/leads?id=eq.${docToDelete.linkedLeadId}&single=true`);

            if (leadSnap) {
              // Delete associated calendar event if exists
              if (leadSnap.calendarEventId) {
                await invokeApi(`/calendar_events?id=eq.${leadSnap.calendarEventId}`, { method: 'DELETE' });
              }
              // Delete the lead itself
              await invokeApi(`/leads?id=eq.${docToDelete.linkedLeadId}`, { method: 'DELETE' });
            }
          }

          showAlert("Terhapus", "Dokumen, Lead, dan Jadwal Kalender terkait telah berhasil dihapus.", "success");
        } catch (err) {
          showAlert("Gagal", "Gagal menghapus dokumen: " + err.message, "error");
        }
      }
    );
  };

  const filteredDocs = documents.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.docNo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMonth = d.date.startsWith(selectedMonth);
    return matchesSearch && matchesMonth;
  });

  const getDocTypeInfo = (type) => {
    switch (type) {
      case 'SPH': return { label: 'Surat Penawaran Harga', color: '#4680FF', icon: <FileText size={14} /> };
      case 'SKK': return { label: 'Surat Kerjasama dan Konfirmasi Penjadwalan', color: '#2ED47A', icon: <FileCheck size={14} /> };
      case 'MOU': return { label: 'Memorandum of Understanding', color: '#7C3AED', icon: <FileSignature size={14} /> };
      case 'INV': return { label: 'Invoice', color: '#FFB020', icon: <Landmark size={14} /> };
      case 'KUI': return { label: 'Kuitansi', color: '#FF5252', icon: <Receipt size={14} /> };
      case 'GEN': return { label: 'Surat Umum', color: '#7A849C', icon: <FileText size={14} /> };
      default: return { label: type, color: 'gray', icon: <FileText size={14} /> };
    }
  };

  const openForm = (type) => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      type, client: '', program: '', value: '',
      date: new Date().toISOString().split('T')[0],
      notes: '', penerima: '', perihal: '',
      description: '', session: '1 Sesi', specialPrice: '', facilities: [], validUntil: '',
      extraNotes: '',
      penyelenggara: '', jabatan: '', trainer: '', waktu: '',
      startDate: '', endDate: '', startTime: '', endTime: '',
      peserta: '', disiapkanPenyelenggara: [],
      items: [{ desc: '', qty: 1, price: '' }],
      bank: 'Bank Mandiri - 1234567890 a/n MCKuadrat'
    });
    setIsDropdownOpen(false);
    setIsGeneratorOpen(true);
  };

  return (
    <div style={{ position: 'relative', height: '100%', paddingBottom: '20px' }}>

      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: isMobile ? '20px' : '32px', flexDirection: isMobile ? 'column' : 'row', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '24px' : '30px', fontWeight: 700, margin: 0 }}>Administrasi Dokumen</h1>
          {!isMobile && <p className="text-secondary text-sm">Kelola surat penawaran, invoice, dan kuitansi dalam satu sistem.</p>}
        </div>

        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="btn btn-primary"
            style={{ borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }}
          >
            <Plus size={18} /> Tambah Dokumen <ChevronDown size={16} />
          </button>

          {isDropdownOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '8px',
              backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
              border: '1px solid var(--border)', zIndex: 100, width: '240px', overflow: 'hidden'
            }}>
              {[
                { type: 'SPH', label: 'Surat Penawaran Harga' },
                { type: 'SKK', label: 'Surat Kerjasama dan Konfirmasi Penjadwalan' },
                { type: 'MOU', label: 'MOU' },
                { type: 'INV', label: 'Invoice' },
                { type: 'KUI', label: 'Kuitansi' },
                { type: 'GEN', label: 'Surat Umum' }
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => openForm(item.type)}
                  style={{
                    width: '100%', padding: '12px 16px', textAlign: 'left', border: 'none',
                    backgroundColor: 'transparent', cursor: 'pointer', fontSize: '15px', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: '10px'
                  }}
                  className="hover:bg-primary-soft transition-colors"
                >
                  <div style={{ color: getDocTypeInfo(item.type).color }}>{getDocTypeInfo(item.type).icon}</div>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      {isAdminOrOwner && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '2px' }}>
          <button
            onClick={() => setActiveTab('list')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === 'list' ? '3px solid var(--primary)' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'list' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              borderRadius: '0',
              transition: 'all 0.2s',
              outline: 'none'
            }}
          >
            Daftar Dokumen
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === 'templates' ? '3px solid var(--primary)' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'templates' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              borderRadius: '0',
              transition: 'all 0.2s',
              outline: 'none'
            }}
          >
            Edit Template Surat
          </button>
        </div>
      )}

      {activeTab === 'list' ? (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: isMobile ? '16px' : '20px 24px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', borderBottom: '1px solid var(--border)', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
            <div style={{ position: 'relative', width: isMobile ? '100%' : '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Cari No. Surat atau Klien..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ borderRadius: '12px', paddingLeft: '44px', backgroundColor: 'var(--bg)', border: '1px solid transparent', width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg)', padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border)', width: isMobile ? '100%' : 'auto' }}>
              <CalIcon size={16} color="var(--primary)" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ border: 'none', backgroundColor: 'transparent', outline: 'none', fontWeight: 600, fontSize: '15px', flex: 1 }}
              />
            </div>
          </div>
          <p className="text-sm text-secondary font-medium">Total {filteredDocs.length} Dokumen</p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8F9FB', color: 'var(--text-secondary)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Tanggal</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Nomor Surat</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Jenis / Perihal</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Penerima</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Nilai Transaksi</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Catatan</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>Dibuat Oleh</th>
                <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc, idx) => (
                <tr key={doc.id} style={{ borderBottom: idx === filteredDocs.length - 1 ? 'none' : '1px solid var(--border)' }} className="hover:bg-gray-50 transition-colors">
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '15px', whiteSpace: 'nowrap' }}>{new Date(doc.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                  <td style={{ padding: '16px 24px', maxWidth: '140px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.docNo}>{doc.docNo}</div>
                  </td>
                  <td style={{ padding: '16px 24px', maxWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', overflow: 'hidden' }}>
                      <span style={{ backgroundColor: `${getDocTypeInfo(doc.type).color}15`, color: getDocTypeInfo(doc.type).color, padding: '2px 6px', borderRadius: '4px', fontSize: '14px', fontWeight: 800, flexShrink: 0 }}>
                        {doc.type}
                      </span>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.title}>
                        {doc.title.replace(/^[A-Z]{3,4}\s*-\s*/, '')}
                      </p>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <p
                      onClick={() => navigate(`/clients/dashboard/${doc.client}`)}
                      style={{ fontWeight: 600, color: 'var(--primary)', margin: 0, cursor: 'pointer', fontSize: '15px' }}
                      className="hover:underline"
                    >
                      {doc.client}
                    </p>
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--primary)', fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap' }}>
                    {doc.type === 'SPH'
                      ? (doc.details?.specialPrice ? formatRupiah(doc.details.specialPrice) : doc.value)
                      : (doc.value || '-')}
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.extraNotes}>
                    {doc.extraNotes || '-'}
                  </td>
                  <td style={{ padding: '16px 24px', maxWidth: '140px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>
                        {(doc.author || 'A').charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.author?.includes('@') ? doc.author.split('@')[0] : doc.author}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {/* Konfirmasi DEAL khusus SKK */}
                      {doc.type === 'SKK' && (
                        doc.status === 'Pending' ? (
                          <button
                            onClick={() => handleConfirmSKK(doc.id, doc.client)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '14px',
                              fontWeight: 700,
                              backgroundColor: '#E5F6EB',
                              color: '#2ED47A',
                              border: '1px solid #2ED47A',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Save size={12} /> Confirm
                          </button>
                        ) : (
                          <div
                            style={{
                              padding: '6px 12px',
                              fontSize: '14px',
                              fontWeight: 700,
                              backgroundColor: '#E5EFFF',
                              color: '#4680FF',
                              border: '1px solid #4680FF',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <FileCheck size={12} /> Confirmed
                          </div>
                        )
                      )}

                      <button onClick={() => setPreviewDoc(doc)} className="btn btn-outline" style={{ padding: '6px 10px', fontSize: '14px' }}>
                        <Eye size={14} style={{ marginRight: '4px' }} /> Preview
                      </button>

                      {(doc.authorId === currentUser?.uid || !doc.authorId || userProfile?.role === 'owner') && (
                        <button onClick={() => handleEdit(doc)} className="btn btn-outline" style={{ padding: '6px 10px', fontSize: '14px', color: '#FFB020', borderColor: '#FFB020' }}>
                          <Edit2 size={14} style={{ marginRight: '4px' }} /> Edit
                        </button>
                      )}
                      {(doc.authorId === currentUser?.uid || !doc.authorId || userProfile?.role === 'owner') && (
                        <button onClick={() => handleDelete(doc.id, doc.authorId)} className="btn btn-outline" style={{ padding: '6px', color: '#FF5252' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDocs.length === 0 && (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Tidak ada dokumen untuk bulan ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
        /* Template Editor Tab UI */
        <div style={{ display: 'flex', gap: '24px', flexDirection: isMobile ? 'column' : 'row' }}>
          {/* Sidebar selector */}
          <div style={{ width: isMobile ? '100%' : '250px', flexShrink: 0 }}>
            <div className="card" style={{ padding: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '16px', paddingLeft: '8px' }}>Jenis Dokumen</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[
                  { type: 'SPH', label: 'Surat Penawaran Harga' },
                  { type: 'SKK', label: 'Surat Kerjasama & Jadwal' },
                  { type: 'MOU', label: 'MoU Kerjasama' },
                  { type: 'INV', label: 'Invoice Tagihan' },
                  { type: 'KUI', label: 'Kuitansi Pembayaran' },
                  { type: 'GEN', label: 'Surat Umum (GEN)' }
                ].map(item => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setSelectedTemplateType(item.type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: selectedTemplateType === item.type ? 'var(--primary-soft)' : 'transparent',
                      color: selectedTemplateType === item.type ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: '0.2s'
                    }}
                  >
                    <div style={{ color: getDocTypeInfo(item.type).color }}>{getDocTypeInfo(item.type).icon}</div>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Editor & Placeholder Side Panel */}
          <div style={{ flex: 1, display: 'flex', gap: '20px', flexDirection: isMobile ? 'column' : 'row' }}>
            {/* Editor Area */}
            <div className="card" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Template Editor: {getDocTypeInfo(selectedTemplateType).label}</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Ubah susunan teks, tabel, dan logo tanda tangan. Gunakan placeholder di sebelah kanan.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleResetTemplate(selectedTemplateType)}
                    className="btn btn-outline"
                    style={{ color: '#FF5252', borderColor: '#FF5252', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px' }}
                  >
                    <Undo size={14} /> Revert Default
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveTemplate(selectedTemplateType, editorContent)}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px' }}
                  >
                    <Save size={14} /> Simpan Template
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: '450px' }}>
                <ReactQuill
                  ref={quillRef}
                  value={editorContent}
                  onChange={setEditorContent}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ 'color': [] }, { 'background': [] }],
                      [{ 'align': [] }],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      ['link', 'image', 'table'],
                      ['clean']
                    ]
                  }}
                  style={{ height: '380px' }}
                />
              </div>
            </div>

            {/* Placeholders Guide Panel */}
            <div className="card" style={{ width: isMobile ? '100%' : '280px', padding: '20px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}><Info size={16} color="var(--primary)" /> Placeholder Variabel</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Klik tombol di bawah untuk menyisipkan variabel dinamis pada kursor editor.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                {[
                  { tag: '{{NOMOR_SURAT}}', label: 'Nomor Surat' },
                  { tag: '{{TANGGAL_SURAT}}', label: 'Tanggal Dokumen' },
                  { tag: '{{NAMA_KLIEN}}', label: 'Nama Klien / Sekolah' },
                  { tag: '{{NAMA_PROGRAM}}', label: 'Nama Program' },
                  { tag: '{{DESKRIPSI_PROGRAM}}', label: 'Deskripsi Program' },
                  { tag: '{{SESI_KEGIATAN}}', label: 'Sesi (Cth: Half Day)' },
                  { tag: '{{NILAI_INVESTASI}}', label: 'Nilai Transaksi (Rp)' },
                  { tag: '{{INVESTASI_TERBILANG}}', label: 'Nilai (Terbilang)' },
                  { tag: '{{BATAS_KONFIRMASI}}', label: 'Batas Konfirmasi/Pay' },
                  { tag: '{{PIC_PENYELENGGARA}}', label: 'Nama PIC (Klien)' },
                  { tag: '{{JABATAN_PIC}}', label: 'Jabatan PIC' },
                  { tag: '{{NAMA_TRAINER}}', label: 'Nama Trainer' },
                  { tag: '{{WAKTU_PELAKSANAAN}}', label: 'Waktu Pelaksanaan' },
                  { tag: '{{TARGET_PESERTA}}', label: 'Target Peserta' },
                  { tag: '{{REKENING_BANK}}', label: 'Detail Bank Transaksi' },
                  { tag: '{{FASILITAS_INCLUDED}}', label: 'Daftar Fasilitas (List)' },
                  { tag: '{{PERSIAPAN_PENYELENGGARA}}', label: 'Syarat Sarpras Klien' },
                  { tag: '{{CATATAN_TAMBAHAN}}', label: 'Catatan Bebas' },
                  { tag: '{{TTD_DIREKTUR}}', label: 'Gambar TTD Direktur' },
                  { tag: '{{TTD_FINANCE}}', label: 'Gambar TTD Finance' },
                  { tag: '{{STEMPEL_PERUSAHAAN}}', label: 'Gambar Cap Perusahaan' }
                ].map(p => (
                  <button
                    key={p.tag}
                    type="button"
                    onClick={() => insertPlaceholder(p.tag)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: '0.2s',
                      width: '100%'
                    }}
                    className="hover:border-primary hover:bg-primary-soft"
                  >
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>{p.label}</span>
                    <strong style={{ fontSize: '13px', color: 'var(--primary)', fontFamily: 'monospace' }}>{p.tag}</strong>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generator Drawer */}
      {isGeneratorOpen && (
        <>
          <div onClick={() => setIsGeneratorOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000 }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, width: isMobile ? '100%' : '500px', height: '100vh',
            backgroundColor: 'white', boxShadow: '-8px 0 32px rgba(0,0,0,0.1)', zIndex: 1001,
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="text-xl font-bold">Input Data {getDocTypeInfo(formData.type).label}</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Nomor akan dibuat otomatis sesuai urutan bulan ini.</p>
              </div>
              <button onClick={() => setIsGeneratorOpen(false)} style={{ color: 'var(--text-secondary)' }}><X size={24} /></button>
            </div>

            <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
              <form id="gen-form" onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Form Field: SPH Specific */}
                {formData.type === 'SPH' && (
                  <>
                    <div>
                      <label className="text-sm font-bold mb-2 block">Cari & Pilih Client <span style={{ color: 'red' }}>*</span></label>
                      <select
                        value={formData.client}
                        onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'pointer' }}
                        required
                      >
                        <option value="">-- Pilih Sekolah --</option>
                        {clients.map(c => <option key={c.id} value={c.school}>{c.school}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-bold mb-2 block">Nama Program <span style={{ color: 'red' }}>*</span></label>
                      <input
                        type="text" required placeholder="Contoh: LDKS Mandiri Jaya"
                        value={formData.program} onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold mb-2 block">Deskripsi Singkat Program</label>
                      <textarea
                        rows={2} placeholder="Penjelasan singkat tujuan program..."
                        value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', resize: 'none' }}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold mb-2 block">Pilih Sesi Kegiatan</label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {['1 Sesi (2 Jam)', 'Half Day', 'Full Day', '2 Hari', '2 H 1 M', '3 H 2M'].map(s => (
                          <button
                            key={s} type="button"
                            onClick={() => setFormData({ ...formData, session: s })}
                            style={{
                              padding: '8px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 600, border: '1px solid var(--border)',
                              backgroundColor: formData.session === s ? 'var(--primary)' : 'white',
                              color: formData.session === s ? 'white' : 'var(--text-secondary)',
                              cursor: 'pointer', transition: '0.2s'
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="text-sm font-bold mb-2 block">Harga Normal</label>
                        <input
                          type="text"
                          value={formData.value}
                          onChange={(e) => setFormData({ ...formData, value: formatRupiah(e.target.value) })}
                          placeholder="Rp 15.000.000"
                          style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-bold mb-2 block">Special Price</label>
                        <input
                          type="text"
                          value={formData.specialPrice}
                          onChange={(e) => setFormData({ ...formData, specialPrice: formatRupiah(e.target.value) })}
                          placeholder="Rp 12.500.000"
                          style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold mb-2 block">Pilih Fasilitas Included</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {[
                          'Expert Trainer', 'Tim Training', 'Fasilitator', 'Customized Content',
                          'Sound System Set', 'Transport', 'Akomodasi'
                        ].map(f => {
                          const isSelected = formData.facilities.includes(f);
                          return (
                            <div
                              key={f}
                              onClick={() => {
                                const next = isSelected
                                  ? formData.facilities.filter(item => item !== f)
                                  : [...formData.facilities, f];
                                setFormData({ ...formData, facilities: next });
                              }}
                              style={{
                                padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                                fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                backgroundColor: isSelected ? 'var(--primary-soft)' : 'white',
                                color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: isSelected ? 700 : 400
                              }}
                            >
                              <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '1px', backgroundColor: 'currentColor' }} />}
                              </div>
                              {f}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold mb-2 block">Batas Akhir Penawaran</label>
                      <input
                        type="date"
                        value={formData.validUntil}
                        onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                      />
                    </div>
                  </>
                )}



                {/* Form Field: Tipe SKK */}
                {formData.type === 'SKK' && (
                  <>
                    <div>
                      <label className="text-sm font-bold mb-2 block">Pilih Client Sekolah <span style={{ color: 'red' }}>*</span></label>
                      <select
                        value={formData.client}
                        onChange={(e) => {
                          const selectedName = e.target.value;
                          const schoolData = uniqueSchools.find(s => s.name === selectedName);
                          setFormData({ ...formData, client: selectedName, schoolId: schoolData?.id || '', penyelenggara: '', jabatan: '' });
                        }}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'pointer' }}
                        required
                      >
                        <option value="">-- Pilih Sekolah --</option>
                        {uniqueSchools.sort((a,b) => a.name.localeCompare(b.name)).map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <label className="text-sm font-bold mb-2 block">Penyelenggara (PIC) <span style={{ color: 'red' }}>*</span></label>
                        <select
                          value={formData.penyelenggara}
                          onChange={(e) => {
                            const selectedPic = e.target.value;
                            const clientData = clients.find(c =>
                              c.school.toLowerCase().trim() === formData.client.toLowerCase().trim() &&
                              c.name === selectedPic
                            );
                            setFormData({ ...formData, penyelenggara: selectedPic, jabatan: clientData?.position || '' });
                          }}
                          disabled={!formData.client}
                          style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'pointer' }}
                          required
                        >
                          <option value="">-- Pilih PIC --</option>
                          {clients.filter(c => c.school.toLowerCase().trim() === formData.client.toLowerCase().trim()).map((c, i) => (
                            <option key={i} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="text-sm font-bold mb-2 block">Jabatan</label>
                        <input
                          type="text" readOnly value={formData.jabatan}
                          placeholder="Otomatis..."
                          style={{ backgroundColor: '#F0F0F0', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold mb-2 block">Nama Program <span style={{ color: 'red' }}>*</span></label>
                      <input
                        type="text" required placeholder="Contoh: Latihan Dasar Kepemimpinan"
                        value={formData.program} onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold mb-2 block">Pilih Sesi</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {['1 Sesi', 'Half Day', 'Full Day', '2 Hari', '2H 1M', '3H 2M'].map(s => (
                          <button
                            key={s} type="button"
                            onClick={() => setFormData({ ...formData, session: s })}
                            style={{
                              padding: '8px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 600, border: '1px solid var(--border)',
                              backgroundColor: formData.session === s ? 'var(--primary)' : 'white',
                              color: formData.session === s ? 'white' : 'var(--text-secondary)',
                              cursor: 'pointer', transition: '0.2s'
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <label className="text-sm font-bold mb-2 block">Trainer / Speaker</label>
                        <input
                          type="text" placeholder="Nama Trainer..."
                          value={formData.trainer} onChange={(e) => setFormData({ ...formData, trainer: e.target.value })}
                          style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="text-sm font-bold mb-2 block">Peserta</label>
                        <input
                          type="text" placeholder="Contoh: 120 Siswa / Guru / Karyawan"
                          value={formData.peserta} onChange={(e) => setFormData({ ...formData, peserta: e.target.value })}
                          style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold mb-2 block">Tanggal Pelaksanaan <span style={{ color: 'red' }}>*</span></label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px', backgroundColor: 'var(--bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div>
                          <label style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tanggal Mulai</label>
                          <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tanggal Selesai (Opsional)</label>
                          <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Jam Mulai</label>
                          <input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Jam Selesai</label>
                          <input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Estimasi Tanggal Pembayaran</label>
                          <input
                            type="date"
                            value={formData.paymentDate || ''}
                            onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                            style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', width: '100%' }}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold mb-2 block">Fasilitas</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {['Expert Trainer', 'Tim Training', 'Fasilitator', 'Customized Content', 'Sound System Set', 'Transport', 'Akomodasi'].map(f => {
                          const isSelected = formData.facilities.includes(f);
                          return (
                            <div
                              key={f}
                              onClick={() => {
                                const next = isSelected
                                  ? formData.facilities.filter(item => item !== f)
                                  : [...formData.facilities, f];
                                setFormData({ ...formData, facilities: next });
                              }}
                              style={{
                                padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                                fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                backgroundColor: isSelected ? 'var(--primary-soft)' : 'white',
                                color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: isSelected ? 700 : 400
                              }}
                            >
                              <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '1px', backgroundColor: 'currentColor' }} />}
                              </div>
                              {f}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold mb-2 block">Disiapkan Penyelenggara</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {[
                          'Ruangan Training yang kondusif', 'Sound System', 'Infokus /LCD Proyektor /LED TV /Videotron',
                          'Kabel HDMI', 'Kursi-Meja Trainer', 'Papan Flipchart & spidol',
                          'Konsumsi Peserta', 'Konsumsi Trainer', 'Perizinan', 'Kesehatan/P3K'
                        ].map(f => {
                          const isSelected = formData.disiapkanPenyelenggara.includes(f);
                          return (
                            <div
                              key={f}
                              onClick={() => {
                                const next = isSelected
                                  ? formData.disiapkanPenyelenggara.filter(item => item !== f)
                                  : [...formData.disiapkanPenyelenggara, f];
                                setFormData({ ...formData, disiapkanPenyelenggara: next });
                              }}
                              style={{
                                padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                                fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                backgroundColor: isSelected ? '#E5F6EB' : 'white',
                                color: isSelected ? '#2ED47A' : 'var(--text-secondary)',
                                fontWeight: isSelected ? 700 : 400
                              }}
                            >
                              <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '1px', backgroundColor: 'currentColor' }} />}
                              </div>
                              {f}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Form Field: Tipe MOU */}
                {(formData.type === 'MOU' || formData.type === 'MoU') && (
                  <>
                    <div>
                      <label className="text-sm font-bold mb-2 block">Pilih Client Sekolah <span style={{ color: 'red' }}>*</span></label>
                      <select
                        value={formData.client}
                        onChange={(e) => {
                          const selectedName = e.target.value;
                          const schoolData = uniqueSchools.find(s => s.name === selectedName);
                          setFormData({ ...formData, client: selectedName, schoolId: schoolData?.id || '', penyelenggara: '', jabatan: '' });
                        }}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'pointer' }}
                        required
                      >
                        <option value="">-- Pilih Sekolah --</option>
                        {uniqueSchools.sort((a,b) => a.name.localeCompare(b.name)).map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-bold mb-2 block">Nama Program <span style={{ color: 'red' }}>*</span></label>
                      <input
                        type="text" required placeholder="Contoh: Kerjasama Program Tahunan 2026"
                        value={formData.program} onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                      />
                    </div>
                  </>
                )}

                {/* Form Field: INV Specific */}
                {(formData.type === 'INV' || formData.type === 'Invoice') && (
                  <>
                    <div>
                      <label className="text-sm font-bold mb-2 block">Pilih Client Sekolah <span style={{ color: 'red' }}>*</span></label>
                      <select
                        value={formData.client}
                        onChange={(e) => {
                          const selectedName = e.target.value;
                          const schoolData = uniqueSchools.find(s => s.name === selectedName);
                          setFormData({ ...formData, client: selectedName, schoolId: schoolData?.id || '', penyelenggara: '', jabatan: '' });
                        }}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'pointer' }}
                        required
                      >
                        <option value="">-- Pilih Sekolah --</option>
                        {uniqueSchools.sort((a,b) => a.name.localeCompare(b.name)).map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-bold mb-2 block">Nama Program <span style={{ color: 'red' }}>*</span></label>
                      <input
                        type="text" required placeholder="Contoh: Tryout Akbar 2026"
                        value={formData.program} onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                      />
                    </div>
                  </>
                )}

                {/* Form Field: KUI Specific */}
                {(formData.type === 'KUI' || formData.type === 'Kuitansi') && (
                  <>
                    <div>
                      <label className="text-sm font-bold mb-2 block">Pilih Client (Pembayar) <span style={{ color: 'red' }}>*</span></label>
                      <select
                        value={formData.client}
                        onChange={(e) => {
                          const selectedName = e.target.value;
                          const schoolData = uniqueSchools.find(s => s.name === selectedName);
                          setFormData({ ...formData, client: selectedName, schoolId: schoolData?.id || '', penyelenggara: '', jabatan: '' });
                        }}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'pointer' }}
                        required
                      >
                        <option value="">-- Pilih Sekolah --</option>
                        {uniqueSchools.sort((a,b) => a.name.localeCompare(b.name)).map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-bold mb-2 block">Untuk Pembayaran <span style={{ color: 'red' }}>*</span></label>
                      <textarea
                        rows={3} required placeholder="Contoh: Pelunasan Program LDKS Mandiri Jaya"
                        value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', resize: 'none' }}
                      />
                    </div>
                  </>
                )}

                {/* Form Field: GEN Specific */}
                {(formData.type === 'GEN' || formData.type === 'Umum') && (
                  <>
                    <div>
                      <label className="text-sm font-bold mb-2 block">Pilih Client <span style={{ color: 'red' }}>*</span></label>
                      <select
                        value={formData.client}
                        onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'pointer', width: '100%' }}
                        required
                      >
                        <option value="">-- Pilih Client --</option>
                        {Array.from(new Set(clients.map(c => c.school))).map((s, i) => <option key={i} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-bold mb-2 block">Perihal <span style={{ color: 'red' }}>*</span></label>
                      <input
                        type="text" required placeholder="Contoh: Pemberitahuan Hari Libur"
                        value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', width: '100%' }}
                      />
                    </div>
                  </>
                )}

                {/* SELESAI BLOK SPESIFIK: SEMUA TIPE SUDAH HANDLED DI ATAS */}

                {/* Form Field: Value (Harga) - Hidden for Umum and SPH */}
                {['SKK', 'INV', 'KUI', 'MOU'].includes(formData.type) && (
                  <div>
                    <label className="text-sm font-bold mb-2 block">Nilai Transaksi (Rp)</label>
                    <input
                      type="text"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: formatRupiah(e.target.value) })}
                      placeholder="Contoh: Rp 10.000.000"
                      style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                    />
                  </div>
                )}

                {/* Notes as General Catatan Field (Global for all types) */}
                <div>
                  <label className="text-sm font-bold mb-2 block">Catatan [Opsional]</label>
                  <textarea
                    rows={3}
                    value={formData.extraNotes}
                    onChange={(e) => setFormData({ ...formData, extraNotes: e.target.value })}
                    placeholder="Masukkan catatan tambahan di sini..."
                    style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', resize: 'none' }}
                  />
                </div>
              </form>
            </div>

            <div style={{ padding: '24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', backgroundColor: '#F8F9FB' }}>
              <button onClick={() => setIsGeneratorOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
              <button type="submit" form="gen-form" className="btn btn-primary" style={{ flex: 1 }}>Buat Dokumen</button>
            </div>
          </div>
        </>
      )}

      {previewDoc && (() => {
        const isGoogleDocPdf = previewDoc.pdfViewUrl || previewDoc.pdfUrl || previewDoc.details?.pdfViewUrl || previewDoc.details?.pdfUrl || previewDoc.useGoogleDocs;
        const pdfUrl = previewDoc.pdfUrl || previewDoc.details?.pdfUrl;
        const pdfViewUrl = previewDoc.pdfViewUrl || previewDoc.details?.pdfViewUrl;
        const previewUrl = getPdfPreviewUrl(pdfViewUrl || pdfUrl);

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '90%', height: '90%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontWeight: 700, margin: 0 }}>Preview: {previewDoc.docNo}</h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {isGoogleDocPdf ? (
                    <>
                      {pdfViewUrl && (
                        <a href={pdfViewUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>
                          <Eye size={16} /> Buka di Drive
                        </a>
                      )}
                      {pdfUrl && (
                        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>
                          <Download size={16} /> Download PDF
                        </a>
                      )}
                    </>
                  ) : (
                    <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} style={{ marginRight: '6px' }} /> Print / PDF</button>
                  )}
                  <button className="btn btn-outline" onClick={() => setPreviewDoc(null)} style={{ padding: '8px', borderRadius: '8px' }}><X size={16} /></button>
                </div>
              </div>
              <div style={{ flex: 1, backgroundColor: '#525659', padding: isGoogleDocPdf ? '0' : '40px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'stretch' }}>
                {isGoogleDocPdf ? (
                  <iframe 
                    src={previewUrl} 
                    title="PDF Preview" 
                    style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white' }}
                  />
                ) : (
                  <div style={{ width: '210mm', minHeight: '297mm', backgroundColor: 'white', padding: '1in', boxShadow: '0 0 10px rgba(0,0,0,0.5)', position: 'relative', boxSizing: 'border-box' }} className="print-safe">
                    <DocumentRenderer doc={previewDoc} businessData={businessData} templates={templates} />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {isGeneratingPdf && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 3000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: 'white', gap: '16px'
        }}>
          <div style={{
            width: '50px', height: '50px',
            border: '5px solid rgba(255,255,255,0.3)',
            borderTop: '5px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <h3 style={{ margin: 0, fontWeight: 700 }}>Memproses Google Docs</h3>
          <p style={{ margin: 0, opacity: 0.8 }}>{generationProgress}</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      <style>{`
        @media print {
          @page { margin: 0; size: A4 portrait; }
          body { margin: 0; background-color: white; }
          body * { visibility: hidden; }
          .print-safe, .print-safe * { visibility: visible; }
          .print-safe { position: absolute; left: 0; top: 0; box-shadow: none !important; width: 210mm; min-height: 297mm; padding: 1in !important; box-sizing: border-box !important; }
        }
      `}</style>
    </div>
  );
};

// --- HELPER: Terbilang (Terjemahan Angka ke Teks Bahasa Indonesia) ---
const terbilang = (n) => {
  if (!n) return "";
  const cleanNum = n.toString().replace(/[^0-9]/g, '');
  const angka = parseInt(cleanNum);
  if (isNaN(angka)) return "";
  const words = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  if (angka < 12) return words[angka];
  if (angka < 20) return terbilang(angka - 10) + " Belas";
  if (angka < 100) return terbilang(Math.floor(angka / 10)) + " Puluh " + terbilang(angka % 10);
  if (angka < 200) return "Seratus " + terbilang(angka - 100);
  if (angka < 1000) return terbilang(Math.floor(angka / 100)) + " Ratus " + terbilang(angka % 100);
  if (angka < 2000) return "Seribu " + terbilang(angka - 100);
  if (angka < 1000000) return terbilang(Math.floor(angka / 1000)) + " Ribu " + terbilang(angka % 1000);
  if (angka < 1000000000) return terbilang(Math.floor(angka / 1000000)) + " Juta " + terbilang(angka % 1000000);
  return "";
};

// --- HELPER: Format Indonesian Date ---
const formatIndonesianDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

// --- COMPONENT: Document Renderer ---
const DocumentRenderer = ({ doc, businessData, templates = {} }) => {
  if (!doc) return null;
  const d = doc.details || {};

  // Styles
  const headerStyle = { borderBottom: '3px solid #333', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px' };
  const h1Style = { fontSize: '24px', fontWeight: 800, margin: '0 0 5px 0', color: '#1A233A' };
  const contentStyle = { fontSize: '14px', lineHeight: '1.5', color: '#000', fontFamily: "'Times New Roman', Times, serif" };

  const customTemplateHtml = templates[doc.type];

  if (customTemplateHtml) {
    const compiledHtml = renderCustomTemplate(customTemplateHtml, doc, businessData);
    return (
      <div style={{ fontFamily: "'Times New Roman', Times, serif", color: '#000' }}>
        {/* KOP SURAT (FULL DOCUMENT & BEHIND TEXT) */}
        {businessData?.kopSuratUrl && (
          <>
            <img 
              src={businessData.kopSuratUrl} 
              alt="Kop Surat" 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '210mm', 
                zIndex: 0 
              }} 
            />
            {/* Spacer to push text below the header area */}
            <div style={{ height: '35mm' }}></div>
          </>
        )}

        {/* DEFAULT HEADER (If no Kop Surat) */}
        {!businessData?.kopSuratUrl && (
          <div style={{ ...headerStyle, position: 'relative', zIndex: 1 }}>
            <div style={{ width: '60px', height: '60px', backgroundColor: '#4680FF', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <FileText size={32} />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={h1Style}>{businessData?.name || 'MCKUADRAT INDONESIA'}</h1>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>{businessData?.slogan || "Building Tomorrow's Leaders Today"}</p>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>{businessData?.address || 'Tangerang, Banten, Indonesia'} | Email: {businessData?.email || 'mckuadratid@gmail.com'} | WA: {businessData?.phone || '+62 821-1360-0071'}</p>
            </div>
          </div>
        )}

        {/* TEXT CONTENT WRAPPER */}
        <div style={{ position: 'relative', zIndex: 1, padding: '0 10px' }}>
          {/* Render Title for non-Kuitansi and non-Invoice which have custom title layout */}
          {!['INV', 'Invoice', 'KUI', 'Kuitansi'].includes(doc.type) && (
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <h2 style={{ fontSize: '18px', textDecoration: 'underline', marginBottom: '5px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                {doc.type === 'SPH' ? 'Surat Penawaran Harga' :
                  doc.type === 'SKK' ? 'Surat Kerjasama & Konfirmasi Penjadwalan' :
                    doc.type === 'MOU' || doc.type === 'MoU' ? 'Memorandum of Understanding' : 'Surat Perihal'}
              </h2>
              <p style={{ margin: 0, fontSize: '14px' }}>Nomor: {doc.docNo}</p>
            </div>
          )}
          <div style={contentStyle} dangerouslySetInnerHTML={{ __html: compiledHtml }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", color: '#000' }}>
      {/* KOP SURAT (FULL DOCUMENT & BEHIND TEXT) */}
      {businessData?.kopSuratUrl && (
        <>
          <img 
            src={businessData.kopSuratUrl} 
            alt="Kop Surat" 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '210mm', 
              zIndex: 0 
            }} 
          />
          {/* Spacer to push text below the header area */}
          <div style={{ height: '35mm' }}></div>
        </>
      )}

      {/* DEFAULT HEADER (If no Kop Surat) */}
      {!businessData?.kopSuratUrl && (
        <div style={{ ...headerStyle, position: 'relative', zIndex: 1 }}>
          <div style={{ width: '60px', height: '60px', backgroundColor: '#4680FF', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <FileText size={32} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={h1Style}>{businessData?.name || 'MCKUADRAT INDONESIA'}</h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>{businessData?.slogan || "Building Tomorrow's Leaders Today"}</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>{businessData?.address || 'Tangerang, Banten, Indonesia'} | Email: {businessData?.email || 'mckuadratid@gmail.com'} | WA: {businessData?.phone || '+62 821-1360-0071'}</p>
          </div>
        </div>
      )}

      {/* TEXT CONTENT WRAPPER */}
      <div style={{ position: 'relative', zIndex: 1, padding: '0 10px' }}>
        {/* Render Title for non-Kuitansi and non-Invoice which have custom title layout */}
        {!['INV', 'Invoice', 'KUI', 'Kuitansi'].includes(doc.type) && (
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ fontSize: '18px', textDecoration: 'underline', marginBottom: '5px', textTransform: 'uppercase', fontWeight: 'bold' }}>
              {doc.type === 'SPH' ? 'Surat Penawaran Harga' :
                doc.type === 'SKK' ? 'Surat Kerjasama & Konfirmasi Penjadwalan' :
                  doc.type === 'MOU' || doc.type === 'MoU' ? 'Memorandum of Understanding' : 'Surat Perihal'}
            </h2>
            <p style={{ margin: 0, fontSize: '14px' }}>Nomor: {doc.docNo}</p>
          </div>
        )}

        <div style={contentStyle}>
          {/* TEMPLATE: SPH */}
          {doc.type === 'SPH' && (
            <>
              <p style={{ margin: '0 0 15px 0' }}>Tangerang Selatan, {formatIndonesianDate(doc.date)}</p>
              <p style={{ margin: '0 0 5px 0' }}>No. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <strong>{doc.docNo}</strong></p>
              <p style={{ margin: '0 0 20px 0' }}>Perihal&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <strong>Penawaran Program</strong></p>
              
              <p style={{ margin: '0 0 15px 0' }}>
                Kepada Yth :<br />
                <strong>{doc.client}</strong><br />
                di tempat
              </p>
              
              <p style={{ margin: '0 0 10px 0' }}>Assalamualaikum Wr.Wb</p>
              <p style={{ margin: '0 0 15px 0' }}>Dengan Hormat,</p>
              <p style={{ margin: '0 0 15px 0' }}>Dalam rangka mensupport sekolah untuk menyelenggarakan program pengembangan mental dan karakter, berikut kami sampaikan informasi program dan investasi yang dapat kita sinergikan :</p>

              <table style={{ width: '100%', borderCollapse: 'collapse', margin: '15px 0' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '12px', verticalAlign: 'top', width: '60%' }}>
                      <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>Program :</p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '15px', fontWeight: 'bold' }}>{d.program}</p>
                      <p style={{ margin: 0 }}>{d.description || 'Training Pengembangan Mental & Karakter (Guru/Siswa/Orang tua)'}</p>
                    </td>
                    <td style={{ border: '1px solid #000', padding: '12px', textAlign: 'center', verticalAlign: 'middle', width: '40%' }}>
                      {d.value && <p style={{ margin: '0 0 5px 0', textDecoration: 'line-through', color: '#777' }}>Rp {d.value}</p>}
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{doc.value}/sesi</p>
                    </td>
                  </tr>
                </tbody>
              </table>

              <table style={{ width: '100%', borderCollapse: 'collapse', margin: '15px 0' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '15px' }}>
                      <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'square' }}>
                        <li style={{ marginBottom: '6px' }}><strong>{d.session || '1 Sesi'} inhouse Training</strong> (2 jam/sesi)</li>
                        <li style={{ marginBottom: '6px' }}>Tanggal penyelenggaraan training dapat disesuaikan</li>
                        {d.facilities && d.facilities.map((fac, idx) => (
                          <li key={idx} style={{ marginBottom: '6px' }}><strong>{fac}</strong></li>
                        ))}
                        {(!d.facilities || d.facilities.length === 0) && (
                          <>
                            <li style={{ marginBottom: '6px' }}><strong>Expert Trainer</strong> | Ka Rio (Founder mckuadrat)</li>
                            <li style={{ marginBottom: '6px' }}><strong>Tim Training</strong> (Asisten Trainer & Tim Support)</li>
                            <li style={{ marginBottom: '6px' }}><strong>Customized Content</strong> (Materi Training disesuaikan dengan tema, peserta & kebutuhan)</li>
                          </>
                        )}
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>

              <p style={{ margin: '20px 0 15px 0' }}><strong><em>Adapun batas akhir konfirmasi tanggal {formatIndonesianDate(d.validUntil)}</em></strong></p>
              <p style={{ margin: '0 0 15px 0' }}>Semoga dengan kegiatan ini mendatangkan kemaslahatan & kebermanfaatan bagi kita semua. Aamiin.</p>
              <p style={{ margin: '0 0 25px 0' }}>Wassalamualaikum.Wr.Wb</p>

              <div style={{ marginTop: '30px', float: 'right', textAlign: 'center', width: '250px' }}>
                <p style={{ margin: 0 }}>Hormat Kami,</p>
                <div style={{ height: '90px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '5px 0' }}>
                  {businessData?.direkturTtdUrl && <img src={businessData.direkturTtdUrl} alt="TTD Direktur" style={{ maxHeight: '75px', zIndex: 10 }} />}
                  {businessData?.capUrl && <img src={businessData.capUrl} alt="Cap" style={{ maxHeight: '95px', position: 'absolute', zIndex: 1, opacity: 0.8, right: '20px' }} />}
                </div>
                <p style={{ margin: 0, fontWeight: 'bold', textDecoration: 'underline' }}>{businessData?.direkturName || 'Anrio Marfizal, S.Psi'}</p>
                <p style={{ margin: 0, fontSize: '13px' }}>Direktur mckuadrat</p>
              </div>
              <div style={{ clear: 'both' }}></div>
            </>
          )}

          {/* TEMPLATE: SKK */}
          {doc.type === 'SKK' && (
            <>
              <p style={{ margin: '0 0 15px 0' }}>Tangerang Selatan, {formatIndonesianDate(doc.date)}</p>
              <p style={{ margin: '0 0 5px 0' }}>No&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {doc.docNo}</p>
              <p style={{ margin: '0 0 5px 0' }}>Lampiran&nbsp;&nbsp;: -</p>
              <p style={{ margin: '0 0 20px 0' }}>Perihal&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: Surat Kerjasama dan Konfirmasi Penjadwalan</p>
              
              <p style={{ margin: '0 0 15px 0' }}>
                Kepada Yth.<br />
                <strong>{doc.client}</strong><br />
                Di tempat
              </p>

              <p style={{ margin: '0 0 15px 0' }}>Dengan hormat, berdasarkan kesepakatan pelaksanaan kegiatan, berikut ini kami akan menyampaikan informasi terkait penyelenggaraan kegiatan tersebut:</p>

              <table style={{ width: '100%', borderCollapse: 'collapse', margin: '15px 0', fontSize: '13px' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', width: '25%' }}>Nama Program</td>
                    <td style={{ border: '1px solid #000', padding: '8px', width: '5%', textAlign: 'center' }}>:</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>{d.program}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Trainer</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>:</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>{d.trainer || 'Kak Rio (Expert Trainer & Founder mckuadrat)'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Waktu</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>:</td>
                    <td style={{ border: '1px solid #000', padding: '8px' }}>
                      {d.startDate ? (
                        <>
                          {formatIndonesianDate(d.startDate)}
                          {d.endDate && ` s/d ${formatIndonesianDate(d.endDate)}`}
                          {d.startTime && ` | Pukul ${d.startTime} - ${d.endTime || 'Selesai'} WIB`}
                        </>
                      ) : (
                        <em>Adapun jadwal dapat menyesuaikan kemudian</em>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Peserta</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>:</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>{d.peserta || `Siswa/Guru ${doc.client}`}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Investasi</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>:</td>
                    <td style={{ border: '1px solid #000', padding: '8px' }}>
                      Investasi untuk kegiatan tersebut sejumlah <strong>{doc.value}</strong><br/>
                      <strong>[ Terbilang: {terbilang(doc.rawValue)} Rupiah ]</strong><br/>
                      Adapun batas akhir pembayaran tanggal <strong>{d.paymentDate ? formatIndonesianDate(d.paymentDate) : '-'}</strong><br/>
                      melalui transfer ke rekening: <strong>{d.bank || 'BCA dengan Nomor Rekening 4730 904 571 a.n. ANRIO MARFIZAL S PSI'}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Fasilitas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>:</td>
                    <td style={{ border: '1px solid #000', padding: '8px' }}>
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {d.facilities?.map((f, i) => <li key={i} style={{ fontWeight: 'bold' }}>{f}</li>)}
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Disiapkan Penyelenggara</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>:</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>
                      {d.disiapkanPenyelenggara && d.disiapkanPenyelenggara.length > 0
                        ? d.disiapkanPenyelenggara.join(', ')
                        : 'Ruangan Training yang kondusif, Sound System, Infokus /LCD Proyektor /LED TV /Videotron, Kabel HDMI, Kursi-Meja Trainer, Papan Flipchart & spidol.'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Syarat & Ketentuan</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>:</td>
                    <td style={{ border: '1px solid #000', padding: '8px' }}>
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        <li><strong>Surat ini dibuat untuk konfirmasi penjadwalan yang disepakati oleh kedua belah pihak dengan penuh kesadaran dan dibuktikan dengan tanda tangan.</strong></li>
                        <li>Penyelenggara akan mendapatkan fasilitas serupa atau digantikan dengan program lain dengan fasilitas yang sama bila pihak mckuadrat tidak memenuhi fasilitas yang telah disepakati</li>
                        <li><strong>Pembatalan </strong>setelah surat ini ditandatangani, maka penyelenggara akan dikenakan <strong>biaya pembatalan sebesar 50% </strong>dari total pembayaran program.</li>
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>

              <p style={{ margin: '15px 0' }}>Untuk kelancaran acara, kami menghimbau <strong>15 menit</strong> sebelum acara dimulai peserta sudah memasuki ruangan training. Terima kasih kami sampaikan atas kepercayaannya bekerjasama dengan kami.</p>

              <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center', width: '220px' }}>
                  <p style={{ margin: 0 }}>Pelaksana</p>
                  <div style={{ height: '80px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '5px 0' }}>
                    {businessData?.direkturTtdUrl && <img src={businessData.direkturTtdUrl} alt="TTD Direktur" style={{ maxHeight: '70px', zIndex: 10 }} />}
                    {businessData?.capUrl && <img src={businessData.capUrl} alt="Cap" style={{ maxHeight: '90px', position: 'absolute', zIndex: 1, opacity: 0.8, right: '10px' }} />}
                  </div>
                  <p style={{ margin: 0, fontWeight: 'bold', textDecoration: 'underline' }}>{businessData?.direkturName || 'Anrio Marfizal, S.Psi'}</p>
                  <p style={{ margin: 0, fontSize: '13px' }}>Direktur mckuadrat</p>
                </div>
                <div style={{ textAlign: 'center', width: '220px' }}>
                  <p style={{ margin: 0 }}>Menyetujui Penyelenggara</p>
                  <div style={{ height: '95px' }}></div>
                  <p style={{ margin: 0, fontWeight: 'bold', textDecoration: 'underline' }}>{d.penyelenggara || '( ................................... )'}</p>
                  <p style={{ margin: 0, fontSize: '13px' }}>{d.jabatan || 'Kepala Sekolah'}</p>
                </div>
              </div>
            </>
          )}

          {/* TEMPLATE: Invoice */}
          {(doc.type === 'INV' || doc.type === 'Invoice') && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                <h2 style={{ fontSize: '22px', textDecoration: 'underline', marginBottom: '5px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '2px' }}>
                  I N V O I C E
                </h2>
                <p style={{ margin: 0, fontSize: '14px' }}>Nomor : {doc.docNo}</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px' }}>
                <div>
                  <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>Kepada Yth.</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{doc.client}</p>
                  <p style={{ margin: 0 }}>di Tempat</p>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', margin: '20px 0' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f2f2f2', borderBottom: '2px solid #000' }}>
                    <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', width: '8%', fontWeight: 'bold' }}>No.</th>
                    <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'left', width: '62%', fontWeight: 'bold' }}>Keterangan</th>
                    <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', width: '30%', fontWeight: 'bold' }}>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '12px', textAlign: 'center', verticalAlign: 'top' }}>1.</td>
                    <td style={{ border: '1px solid #000', padding: '12px', verticalAlign: 'top' }}>
                      <strong>Program {d.program}</strong><br/>
                      <strong>{doc.client}</strong><br/>
                      {d.startDate && <span><strong>{formatIndonesianDate(d.startDate)} {d.session ? `(${d.session})` : ''}</strong></span>}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '12px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top' }}>{doc.value}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '10px' }} colSpan="2"></td>
                    <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px' }}>{doc.value}</td>
                  </tr>
                </tbody>
              </table>

              <p style={{ margin: '0 0 15px 0' }}>Terbilang : <strong>#{terbilang(doc.rawValue)} Rupiah#</strong></p>
              
              <p style={{ margin: '0 0 25px 0', fontSize: '13px' }}>
                Pembayaran ditransfer melalui <strong>
                  {businessData?.bankAccounts && businessData.bankAccounts.length > 0 
                    ? `${businessData.bankAccounts[0].bankName} Rek. ${businessData.bankAccounts[0].accountNo} a.n. ${businessData.bankAccounts[0].accountName}`
                    : (d.bank || 'Bank BCA Nomor Rekening 4730 904 571 a.n. Anrio Marfizal S.Psi')}
                </strong>
                {d.paymentDate && <span> Pembayaran paling lambat <strong>{formatIndonesianDate(d.paymentDate)}</strong>.</span>}
              </p>

              <div style={{ marginTop: '30px', float: 'right', textAlign: 'center', width: '250px' }}>
                <p style={{ margin: 0 }}>Tangerang Selatan, {formatIndonesianDate(doc.date)}</p>
                <div style={{ height: '90px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '5px 0' }}>
                  {businessData?.direkturTtdUrl && <img src={businessData.direkturTtdUrl} alt="TTD Direktur" style={{ maxHeight: '75px', zIndex: 10 }} />}
                  {businessData?.capUrl && <img src={businessData.capUrl} alt="Cap" style={{ maxHeight: '95px', position: 'absolute', zIndex: 1, opacity: 0.8, right: '20px' }} />}
                </div>
                <p style={{ margin: 0, fontWeight: 'bold', textDecoration: 'underline' }}>{businessData?.direkturName || 'Anrio Marfizal, S.Psi'}</p>
                <p style={{ margin: 0, fontSize: '13px' }}>Direktur mckuadrat</p>
              </div>
              <div style={{ clear: 'both' }}></div>
            </>
          )}

          {/* TEMPLATE: Kuitansi */}
          {(doc.type === 'KUI' || doc.type === 'Kuitansi') && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '22px', textDecoration: 'underline', marginBottom: '3px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  KUITANSI
                </h2>
                <p style={{ margin: 0, fontSize: '14px' }}>No : {doc.docNo}</p>
              </div>

              <div style={{ border: '2px solid #000', padding: '25px', fontSize: '14px', position: 'relative' }}>
                <div style={{ marginBottom: '15px', display: 'flex', borderBottom: '1px dashed #777', paddingBottom: '5px' }}>
                  <span style={{ width: '150px', fontWeight: 'bold', flexShrink: 0 }}>Sudah Terima Dari</span>
                  <span style={{ width: '20px', fontWeight: 'bold', flexShrink: 0 }}>:</span>
                  <span style={{ flexGrow: 1, fontWeight: 'bold' }}>{doc.client}</span>
                </div>
                <div style={{ marginBottom: '15px', display: 'flex', borderBottom: '1px dashed #777', paddingBottom: '5px', alignItems: 'center' }}>
                  <span style={{ width: '150px', fontWeight: 'bold', flexShrink: 0 }}>Banyaknya Uang</span>
                  <span style={{ width: '20px', fontweight: 'bold', flexShrink: 0 }}>:</span>
                  <span style={{ flexGrow: 1, fontStyle: 'italic', backgroundColor: '#f0f0f0', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold' }}>
                    * {terbilang(doc.rawValue)} Rupiah *
                  </span>
                </div>
                <div style={{ marginBottom: '30px', display: 'flex', borderBottom: '1px dashed #777', paddingBottom: '5px' }}>
                  <span style={{ width: '150px', fontWeight: 'bold', flexShrink: 0 }}>Untuk Pembayaran</span>
                  <span style={{ width: '20px', fontWeight: 'bold', flexShrink: 0 }}>:</span>
                  <span style={{ flexGrow: 1, fontWeight: 'bold' }}>{d.notes || d.program || 'Pembayaran Program'}</span>
                </div>

                <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    border: '3px double #000',
                    padding: '10px 25px',
                    backgroundColor: '#f9f9f9',
                    display: 'inline-block'
                  }}>
                    {doc.value}
                  </div>
                  
                  <div style={{ textAlign: 'center', width: '240px' }}>
                    <p style={{ margin: 0, fontSize: '13px' }}>Tangerang Selatan, {formatIndonesianDate(doc.date)}</p>
                    <p style={{ margin: '3px 0 0 0', fontWeight: 'bold', fontSize: '13px' }}>Finance</p>
                    <div style={{ height: '75px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '5px 0' }}>
                      {businessData?.financeTtdUrl && <img src={businessData.financeTtdUrl} alt="TTD Finance" style={{ maxHeight: '65px', zIndex: 10 }} />}
                      {businessData?.capUrl && <img src={businessData.capUrl} alt="Cap" style={{ maxHeight: '85px', position: 'absolute', zIndex: 1, opacity: 0.8, right: '10px' }} />}
                    </div>
                    <p style={{ margin: 0, fontWeight: 'bold', textDecoration: 'underline' }}>{businessData?.financeName || '( ................................... )'}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TEMPLATE: MoU & GEN */}
          {(doc.type === 'MOU' || doc.type === 'MoU' || doc.type === 'GEN') && (
            <>
              <p style={{ textAlign: 'right' }}>Tangerang Selatan, {formatIndonesianDate(doc.date)}</p>
              <p>Lamp: -<br />Hal: {d.notes || d.perihal || 'Memorandum of Understanding'}</p>
              <p>Kepada Yth,<br /><strong>{doc.client}</strong><br />Di Tempat</p>
              <p>Dengan hormat,</p>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {doc.type === 'MOU' || doc.type === 'MoU'
                  ? `Melalui surat ini kami sampaikan kesepakatan kerjasama untuk program ${d.program} dengan total nilai kerjasama sebesar ${doc.value}. Detail kerjasama akan dituangkan dalam lampiran terpisah.`
                  : (d.notes || 'Isi surat belum ditentukan.')}
              </div>
            </>
          )}
        </div>

        {/* SIGNATURE (Only for MoU, MoU, and GEN since others have custom signatures inline) */}
        {['MOU', 'MoU', 'GEN'].includes(doc.type) && (
          <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'center', width: '250px' }}>
              <p style={{ margin: 0 }}>Hormat kami,</p>
              <p style={{ margin: 0, fontWeight: 700 }}>{businessData?.name || 'MCKuadrat Indonesia'}</p>
              <div style={{ height: '90px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '10px 0' }}>
                {doc.type === 'INV' || doc.type === 'Invoice' ? (
                  <>
                    {businessData?.financeTtdUrl && <img src={businessData.financeTtdUrl} alt="TTD Finance" style={{ maxHeight: '75px', position: 'absolute', zIndex: 10 }} />}
                    {businessData?.capUrl && <img src={businessData.capUrl} alt="Cap" style={{ maxHeight: '95px', position: 'absolute', zIndex: 1, opacity: 0.8, right: '20px' }} />}
                  </>
                ) : (
                  <>
                    {businessData?.direkturTtdUrl && <img src={businessData.direkturTtdUrl} alt="TTD Direktur" style={{ maxHeight: '75px', position: 'absolute', zIndex: 10 }} />}
                    {businessData?.capUrl && <img src={businessData.capUrl} alt="Cap" style={{ maxHeight: '95px', position: 'absolute', zIndex: 1, opacity: 0.8, right: '20px' }} />}
                  </>
                )}
              </div>
              <p style={{ margin: 0, fontWeight: 700, textDecoration: 'underline' }}>
                {doc.type === 'INV' || doc.type === 'Invoice' ? (businessData?.financeName || 'Finance') : (businessData?.direkturName || 'Direktur')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- CONSTANTS: Default HTML Templates ---
const DEFAULT_TEMPLATES = {
  SPH: `
    <p>Tangerang Selatan, {{TANGGAL_SURAT}}</p>
    <p>No. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <strong>{{NOMOR_SURAT}}</strong></p>
    <p>Perihal&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <strong>Penawaran Program</strong></p>
    <br>
    <p>Kepada Yth :<br>
    <strong>{{NAMA_KLIEN}}</strong><br>
    di tempat</p>
    <br>
    <p>Assalamualaikum Wr.Wb</p>
    <p>Dengan Hormat,</p>
    <p>Dalam rangka mensupport sekolah untuk menyelenggarakan program pengembangan mental dan karakter, berikut kami sampaikan informasi program dan investasi yang dapat kita sinergikan :</p>

    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tbody>
        <tr>
          <td style="border: 1px solid #000; padding: 12px; vertical-align: top; width: 60%;">
            <p style="margin: 0 0 5px 0; font-weight: bold;">Program :</p>
            <p style="margin: 0 0 5px 0; font-size: 15px; font-weight: bold;">{{NAMA_PROGRAM}}</p>
            <p style="margin: 0;">{{DESKRIPSI_PROGRAM}}</p>
          </td>
          <td style="border: 1px solid #000; padding: 12px; text-align: center; vertical-align: middle; width: 40%;">
            <p style="margin: 0; font-size: 18px; font-weight: bold;">{{NILAI_INVESTASI}}/sesi</p>
          </td>
        </tr>
      </tbody>
    </table>

    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tbody>
        <tr>
          <td style="border: 1px solid #000; padding: 15px;">
            <ul style="margin: 0; padding-left: 20px; list-style-type: square;">
              <li style="margin-bottom: 6px;"><strong>{{SESI_KEGIATAN}} inhouse Training</strong> (2 jam/sesi)</li>
              <li style="margin-bottom: 6px;">Tanggal penyelenggaraan training dapat disesuaikan</li>
              <li style="margin-bottom: 6px;"><strong>Fasilitas Included:</strong>{{FASILITAS_INCLUDED}}</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>

    <p style="margin: 20px 0 15px 0;"><strong><em>Adapun batas akhir konfirmasi tanggal {{BATAS_KONFIRMASI}}</em></strong></p>
    <p style="margin: 0 0 15px 0;">Semoga dengan kegiatan ini mendatangkan kemaslahatan & kebermanfaatan bagi kita semua. Aamiin.</p>
    <p style="margin: 0 0 25px 0;">Wassalamualaikum.Wr.Wb</p>

    <div style="margin-top: 30px; float: right; text-align: center; width: 250px; position: relative;">
      <p style="margin: 0;">Hormat Kami,</p>
      <div style="height: 90px; margin: 5px 0; display: flex; justify-content: center; align-items: center; position: relative;">
        {{TTD_DIREKTUR}}
        {{STEMPEL_PERUSAHAAN}}
      </div>
      <p style="margin: 0; font-weight: bold; text-decoration: underline;">Anrio Marfizal, S.Psi</p>
      <p style="margin: 0; font-size: 13px;">Direktur mckuadrat</p>
    </div>
    <div style="clear: both;"></div>
  `,
  SKK: `
    <p>Tangerang Selatan, {{TANGGAL_SURAT}}</p>
    <p>No&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {{NOMOR_SURAT}}</p>
    <p>Lampiran&nbsp;&nbsp;: -</p>
    <p>Perihal&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: Surat Kerjasama dan Konfirmasi Penjadwalan</p>
    <br>
    <p>Kepada Yth.<br>
    <strong>{{NAMA_KLIEN}}</strong><br>
    Di tempat</p>
    <br>
    <p>Dengan hormat, berdasarkan kesepakatan pelaksanaan kegiatan, berikut ini kami akan menyampaikan informasi terkait penyelenggaraan kegiatan tersebut:</p>

    <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px;">
      <tbody>
        <tr>
          <td style="border: 1px solid #000; padding: 8px; font-weight: bold; width: 25%;">Nama Program</td>
          <td style="border: 1px solid #000; padding: 8px; width: 5%; text-align: center;">:</td>
          <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">{{NAMA_PROGRAM}}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Trainer</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: center;">:</td>
          <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">{{NAMA_TRAINER}}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Waktu Pelaksanaan</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: center;">:</td>
          <td style="border: 1px solid #000; padding: 8px;">{{WAKTU_PELAKSANAAN}}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Peserta</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: center;">:</td>
          <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">{{TARGET_PESERTA}}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Investasi</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: center;">:</td>
          <td style="border: 1px solid #000; padding: 8px;">
            Investasi untuk kegiatan tersebut sejumlah <strong>{{NILAI_INVESTASI}}</strong><br>
            <strong>[ Terbilang: {{INVESTASI_TERBILANG}} ]</strong><br>
            Adapun batas akhir pembayaran tanggal <strong>{{BATAS_KONFIRMASI}}</strong><br>
            melalui transfer ke rekening: <strong>{{REKENING_BANK}}</strong>
          </td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Fasilitas</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: center;">:</td>
          <td style="border: 1px solid #000; padding: 8px;">{{FASILITAS_INCLUDED}}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Disiapkan Penyelenggara</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: center;">:</td>
          <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">{{PERSIAPAN_PENYELENGGARA}}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Syarat &amp; Ketentuan</td>
          <td style="border: 1px solid #000; padding: 8px; text-align: center;">:</td>
          <td style="border: 1px solid #000; padding: 8px;">
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>Surat ini dibuat untuk konfirmasi penjadwalan yang disepakati oleh kedua belah pihak dengan penuh kesadaran dan dibuktikan dengan tanda tangan.</strong></li>
              <li>Penyelenggara akan mendapatkan fasilitas serupa atau digantikan dengan program lain dengan fasilitas yang sama bila pihak mckuadrat tidak memenuhi fasilitas yang telah disepakati</li>
              <li><strong>Pembatalan </strong>setelah surat ini ditandatangani, maka penyelenggara akan dikenakan <strong>biaya pembatalan sebesar 50% </strong>dari total pembayaran program.</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>

    <p style="margin: 15px 0;">Untuk kelancaran acara, kami menghimbau <strong>15 menit</strong> sebelum acara dimulai peserta sudah memasuki ruangan training. Terima kasih kami sampaikan atas kepercayaannya bekerjasama dengan kami.</p>

    <div style="margin-top: 40px; display: flex; justify-content: space-between;">
      <div style="text-align: center; width: 220px; position: relative;">
        <p style="margin: 0;">Pelaksana</p>
        <div style="height: 80px; margin: 5px 0; display: flex; justify-content: center; align-items: center; position: relative;">
          {{TTD_DIREKTUR}}
          {{STEMPEL_PERUSAHAAN}}
        </div>
        <p style="margin: 0; font-weight: bold; text-decoration: underline;">Anrio Marfizal, S.Psi</p>
        <p style="margin: 0; font-size: 13px;">Direktur mckuadrat</p>
      </div>
      <div style="text-align: center; width: 220px;">
        <p style="margin: 0;">Menyetujui Penyelenggara</p>
        <div style="height: 95px;"></div>
        <p style="margin: 0; font-weight: bold; text-decoration: underline;">{{PIC_PENYELENGGARA}}</p>
        <p style="margin: 0; font-size: 13px;">{{JABATAN_PIC}}</p>
      </div>
    </div>
  `,
  INV: `
    <div style="text-align: center; margin-bottom: 25px;">
      <h2 style="font-size: 22px; text-decoration: underline; margin-bottom: 5px; text-transform: uppercase; font-weight: bold; letter-spacing: 2px;">
        I N V O I C E
      </h2>
      <p style="margin: 0; font-size: 14px;">Nomor : {{NOMOR_SURAT}}</p>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 25px;">
      <div>
        <p style="margin: 0 0 5px 0; font-weight: bold;">Kepada Yth.</p>
        <p style="margin: 0; font-size: 16px; font-weight: bold;">{{NAMA_KLIEN}}</p>
        <p style="margin: 0;">di Tempat</p>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #f2f2f2; border-bottom: 2px solid #000;">
          <th style="border: 1px solid #000; padding: 10px; text-align: center; width: 8%; font-weight: bold;">No.</th>
          <th style="border: 1px solid #000; padding: 10px; text-align: left; width: 62%; font-weight: bold;">Keterangan</th>
          <th style="border: 1px solid #000; padding: 10px; text-align: right; width: 30%; font-weight: bold;">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="border: 1px solid #000; padding: 12px; text-align: center; vertical-align: top;">1.</td>
          <td style="border: 1px solid #000; padding: 12px; vertical-align: top;">
            <strong>Program {{NAMA_PROGRAM}}</strong><br>
            <strong>{{NAMA_KLIEN}}</strong><br>
            <strong>{{WAKTU_PELAKSANAAN}}</strong>
          </td>
          <td style="border: 1px solid #000; padding: 12px; text-align: right; font-weight: bold; vertical-align: top;">{{NILAI_INVESTASI}}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 10px;" colSpan="2"></td>
          <td style="border: 1px solid #000; padding: 10px; text-align: right; font-weight: bold; font-size: 15px;">{{NILAI_INVESTASI}}</td>
        </tr>
      </tbody>
    </table>

    <p style="margin: 0 0 15px 0;">Terbilang : <strong>#{{INVESTASI_TERBILANG}}#</strong></p>

    <p style="margin: 0 0 25px 0; font-size: 13px;">
      Pembayaran ditransfer melalui <strong>{{REKENING_BANK}}</strong> paling lambat tanggal <strong>{{BATAS_KONFIRMASI}}</strong>.
    </p>

    <div style="margin-top: 30px; float: right; text-align: center; width: 250px; position: relative;">
      <p style="margin: 0;">Tangerang Selatan, {{TANGGAL_SURAT}}</p>
      <div style="height: 90px; margin: 5px 0; display: flex; justify-content: center; align-items: center; position: relative;">
        {{TTD_DIREKTUR}}
        {{STEMPEL_PERUSAHAAN}}
      </div>
      <p style="margin: 0; font-weight: bold; text-decoration: underline;">Anrio Marfizal, S.Psi</p>
      <p style="margin: 0; font-size: 13px;">Direktur mckuadrat</p>
    </div>
    <div style="clear: both;"></div>
  `,
  KUI: `
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="font-size: 22px; text-decoration: underline; margin-bottom: 3px; text-transform: uppercase; font-weight: bold;">
        KUITANSI
      </h2>
      <p style="margin: 0; font-size: 14px;">No : {{NOMOR_SURAT}}</p>
    </div>

    <div style="border: 2px solid #000; padding: 25px; font-size: 14px; position: relative;">
      <div style="margin-bottom: 15px; display: flex; border-bottom: 1px dashed #777; padding-bottom: 5px;">
        <span style="width: 150px; font-weight: bold; flex-shrink: 0;">Sudah Terima Dari</span>
        <span style="width: 20px; font-weight: bold; flex-shrink: 0;">:</span>
        <span style="flex-grow: 1; font-weight: bold;">{{NAMA_KLIEN}}</span>
      </div>
      <div style="margin-bottom: 15px; display: flex; border-bottom: 1px dashed #777; padding-bottom: 5px; align-items: center;">
        <span style="width: 150px; font-weight: bold; flex-shrink: 0;">Banyaknya Uang</span>
        <span style="width: 20px; font-weight: bold; flex-shrink: 0;">:</span>
        <span style="flex-grow: 1; font-style: italic; background-color: #f0f0f0; padding: 6px 12px; border-radius: 4px; font-weight: bold;">
          * {{INVESTASI_TERBILANG}} *
        </span>
      </div>
      <div style="margin-bottom: 30px; display: flex; border-bottom: 1px dashed #777; padding-bottom: 5px;">
        <span style="width: 150px; font-weight: bold; flex-shrink: 0;">Untuk Pembayaran</span>
        <span style="width: 20px; font-weight: bold; flex-shrink: 0;">:</span>
        <span style="flex-grow: 1; font-weight: bold;">{{CATATAN_TAMBAHAN}}</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: flex-end;">
        <div style="font-size: 20px; font-weight: bold; border: 3px double #000; padding: 10px 25px; background-color: #f9f9f9; display: inline-block;">
          {{NILAI_INVESTASI}}
        </div>
        
        <div style="text-align: center; width: 240px; position: relative;">
          <p style="margin: 0; font-size: 13px;">Tangerang Selatan, {{TANGGAL_SURAT}}</p>
          <p style="margin: 3px 0 0 0; font-weight: bold; font-size: 13px;">Finance</p>
          <div style="height: 75px; margin: 5px 0; display: flex; justify-content: center; align-items: center; position: relative;">
            {{TTD_FINANCE}}
            {{STEMPEL_PERUSAHAAN}}
          </div>
          <p style="margin: 0; font-weight: bold; text-decoration: underline;">( ................................... )</p>
        </div>
      </div>
    </div>
  `,
  MOU: `
    <p style="text-align: right;">Tangerang Selatan, {{TANGGAL_SURAT}}</p>
    <p>Lamp: -<br>Hal: Memorandum of Understanding</p>
    <p>Kepada Yth,<br><strong>{{NAMA_KLIEN}}</strong><br>Di Tempat</p>
    <br>
    <p>Dengan hormat,</p>
    <p>Melalui surat ini kami sampaikan kesepakatan kerjasama untuk program {{NAMA_PROGRAM}} dengan total nilai kerjasama sebesar {{NILAI_INVESTASI}}.</p>
    <div style="line-height: 1.6;">
      {{CATATAN_TAMBAHAN}}
    </div>

    <div style="margin-top: 50px; display: flex; justify-content: flex-end;">
      <div style="text-align: center; width: 250px; position: relative;">
        <p style="margin: 0;">Hormat kami,</p>
        <p style="margin: 0; font-weight: 700;">MCKuadrat Indonesia</p>
        <div style="height: 90px; margin: 10px 0; display: flex; justify-content: center; align-items: center; position: relative;">
          {{TTD_DIREKTUR}}
          {{STEMPEL_PERUSAHAAN}}
        </div>
        <p style="margin: 0; font-weight: 700; text-decoration: underline;">Direktur</p>
      </div>
    </div>
  `,
  GEN: `
    <p style="text-align: right;">Tangerang Selatan, {{TANGGAL_SURAT}}</p>
    <p>Lamp: -<br>Hal: {{NAMA_PROGRAM}}</p>
    <p>Kepada Yth,<br><strong>{{NAMA_KLIEN}}</strong><br>Di Tempat</p>
    <br>
    <p>Dengan hormat,</p>
    <div style="line-height: 1.6;">
      {{CATATAN_TAMBAHAN}}
    </div>

    <div style="margin-top: 50px; display: flex; justify-content: flex-end;">
      <div style="text-align: center; width: 250px; position: relative;">
        <p style="margin: 0;">Hormat kami,</p>
        <p style="margin: 0; font-weight: 700;">MCKuadrat Indonesia</p>
        <div style="height: 90px; margin: 10px 0; display: flex; justify-content: center; align-items: center; position: relative;">
          {{TTD_DIREKTUR}}
          {{STEMPEL_PERUSAHAAN}}
        </div>
        <p style="margin: 0; font-weight: 700; text-decoration: underline;">Direktur</p>
      </div>
    </div>
  `
};

// --- HELPER: Render Custom Template HTML ---
const renderCustomTemplate = (htmlTemplate, docData, businessData) => {
  if (!htmlTemplate) return '';
  const d = docData.details || {};

  const formatRupiah = (number) => {
    if (!number) return 'Rp 0';
    const val = number.toString().replace(/[^0-9]/g, '');
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(val || 0);
  };

  const val = docData.type === 'SPH' && d.specialPrice ? formatRupiah(d.specialPrice) : (docData.value || '-');
  const rawVal = docData.type === 'SPH' && d.specialPrice ? d.specialPrice : (docData.rawValue || 0);

  const ttdDirekturHtml = businessData?.direkturTtdUrl 
    ? `<img src="${businessData.direkturTtdUrl}" alt="TTD Direktur" style="max-height: 70px; z-index: 10; position: relative;" />` 
    : '__________________';
  
  const ttdFinanceHtml = businessData?.financeTtdUrl 
    ? `<img src="${businessData.financeTtdUrl}" alt="TTD Finance" style="max-height: 65px; z-index: 10; position: relative;" />` 
    : '__________________';

  const stempelHtml = businessData?.capUrl 
    ? `<img src="${businessData.capUrl}" alt="Cap" style="max-height: 85px; position: absolute; z-index: 1; opacity: 0.8; margin-left: -50px; margin-top: -30px;" />` 
    : '';

  let facilitiesHtml = '';
  if (d.facilities && d.facilities.length > 0) {
    facilitiesHtml = `<ul style="margin: 5px 0; padding-left: 20px;">` + 
      d.facilities.map(f => `<li><strong>${f}</strong></li>`).join('') + 
      `</ul>`;
  }

  let waktuHtml = '';
  if (d.startDate) {
    waktuHtml = formatIndonesianDate(d.startDate);
    if (d.endDate) waktuHtml += ` s/d ${formatIndonesianDate(d.endDate)}`;
    if (d.startTime) waktuHtml += ` | Pukul ${d.startTime} - ${d.endTime || 'Selesai'} WIB`;
  } else {
    waktuHtml = '<em>Jadwal menyesuaikan kemudian</em>';
  }

  let bankAccountDetails = d.bank || 'BCA dengan Nomor Rekening 4730 904 571 a.n. ANRIO MARFIZAL S PSI';
  if (businessData?.bankAccounts && businessData.bankAccounts.length > 0) {
    bankAccountDetails = `${businessData.bankAccounts[0].bankName} Rek. ${businessData.bankAccounts[0].accountNo} a.n. ${businessData.bankAccounts[0].accountName}`;
  }

  const replacements = {
    '{{NOMOR_SURAT}}': docData.docNo || '',
    '{{TANGGAL_SURAT}}': formatIndonesianDate(docData.date) || '',
    '{{NAMA_KLIEN}}': docData.client || '',
    '{{NAMA_PROGRAM}}': d.program || '',
    '{{DESKRIPSI_PROGRAM}}': d.description || 'Training Pengembangan Mental & Karakter',
    '{{SESI_KEGIATAN}}': d.session || '1 Sesi',
    '{{NILAI_INVESTASI}}': val || '',
    '{{INVESTASI_TERBILANG}}': terbilang(rawVal) + ' Rupiah',
    '{{BATAS_KONFIRMASI}}': formatIndonesianDate(d.validUntil || d.paymentDate) || '',
    '{{PIC_PENYELENGGARA}}': d.penyelenggara || '',
    '{{JABATAN_PIC}}': d.jabatan || '',
    '{{NAMA_TRAINER}}': d.trainer || 'Kak Rio (Expert Trainer & Founder mckuadrat)',
    '{{WAKTU_PELAKSANAAN}}': waktuHtml,
    '{{TARGET_PESERTA}}': d.peserta || `Siswa/Guru ${docData.client}`,
    '{{REKENING_BANK}}': bankAccountDetails,
    '{{FASILITAS_INCLUDED}}': facilitiesHtml,
    '{{PERSIAPAN_PENYELENGGARA}}': d.disiapkanPenyelenggara && d.disiapkanPenyelenggara.length > 0
      ? d.disiapkanPenyelenggara.join(', ')
      : 'Ruangan Training, Sound System, Infokus, Kursi-Meja Trainer, Flipchart & spidol',
    '{{CATATAN_TAMBAHAN}}': docData.extraNotes || d.notes || '-',
    '{{TTD_DIREKTUR}}': ttdDirekturHtml,
    '{{TTD_FINANCE}}': ttdFinanceHtml,
    '{{STEMPEL_PERUSAHAAN}}': stempelHtml
  };

  let rendered = htmlTemplate;
  Object.keys(replacements).forEach(key => {
    rendered = rendered.replaceAll(key, replacements[key]);
  });
  return rendered;
};

export default Documents;
