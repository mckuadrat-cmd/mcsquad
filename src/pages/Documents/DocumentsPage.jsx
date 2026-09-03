import React, { useState, useEffect, useRef } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import DocumentList from './components/DocumentList';
import DocumentFormDrawer from './components/DocumentFormDrawer';
import DocumentPreviewModal from './components/DocumentPreviewModal';
import TemplateManager from './components/TemplateManager';
import { DOCUMENT_TYPES } from './config/documentTypes';
import { supabase, parseDates, invokeApi } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAppData } from '../../context/AppDataContext';
import { useNotification } from '../../context/NotificationContext';
import { logActivity } from '../../utils/activityLogger';
const DocumentsPage = () => {
  const location = useLocation();
  const { userProfile, currentUser, userRole } = useAuth();
  const { clients, flatLeads } = useAppData();
  const { showAlert, showConfirm } = useNotification();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const isAdminOrOwner = userRole === 'owner' || userRole === 'admin' || userProfile?.role === 'owner' || userProfile?.role === 'admin';

  // Active Tab
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('documentsTab') || 'list';
  });

  useEffect(() => {
    localStorage.setItem('documentsTab', activeTab);
  }, [activeTab]);

  // Documents Data
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [selectedType, setSelectedType] = useState('ALL');

  // Drawer Form state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    type: 'SPH',
    client: '',
    program: '',
    value: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    session: '1 Sesi',
    duration: '2 Jam',
    method: 'Offline',
    specialPrice: '',
    facilities: '',
    validUntil: '',
    extraNotes: '',
    penyelenggara: '',
    jabatan: '',
    trainer: '',
    waktu: '',
    startDate: '',
    peserta: '',
    disiapkanPenyelenggara: '',
    bank: 'Bank Mandiri 1234567890 a/n MCKuadrat',
    pembayaran: '',
    perihal: '',
    linkedLeadId: '',
    schoolId: ''
  });

  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewDocxUrl, setPreviewDocxUrl] = useState(null);
  const [isRegeneratingPdf, setIsRegeneratingPdf] = useState(false);

  // Fetch & Subscribe Documents
  const fetchDocuments = async () => {
    try {
      const { data } = await invokeApi('/generated_documents');
      setDocuments(parseDates(data || []));
    } catch (err) {
      console.error("Error fetching generated_documents:", err);
    }
  };

  useEffect(() => {
    fetchDocuments();

    const channel = supabase.channel('public:generated_documents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generated_documents' }, (payload) => {
        const parsed = parseDates(payload.new);
        if (payload.eventType === 'INSERT') {
          setDocuments(prev => [parsed, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setDocuments(prev => prev.map(item => item.id === parsed.id ? parsed : item));
        } else if (payload.eventType === 'DELETE') {
          setDocuments(prev => prev.filter(item => item.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Handle pre-fill from Leads or Projects page navigation
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
      setIsDrawerOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSelectDocType = (docType) => {
    setIsDropdownOpen(false);
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      type: docType,
      client: '',
      program: '',
      value: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      session: '1 Sesi (Full Day)',
      specialPrice: '',
      facilities: '',
      validUntil: '',
      extraNotes: '',
      penyelenggara: '',
      jabatan: '',
      trainer: '',
      waktu: '',
      startDate: '',
      peserta: '',
      disiapkanPenyelenggara: 'Tempat training yang kondusif, Sound Sistem, LCD Proyektor, Kabel HDMI, Kabel Audio, Kursi-Meja Trainer & Flipchart-spidol',
      bank: 'Bank Mandiri 1234567890 a/n MCKuadrat',
      pembayaran: '',
      perihal: '',
      linkedLeadId: '',
      schoolId: ''
    });
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (doc) => {
    setIsEditing(true);
    setEditingId(doc.id);
    const snap = doc.data_snapshot || doc.details || {};
    setFormData({
      type: doc.type || 'SPH',
      docNo: doc.doc_no || doc.docNo,
      client: doc.client_name || doc.client || snap.client || '',
      program: doc.title || snap.program || '',
      value: doc.rawValue || snap.value || '',
      date: doc.date || new Date().toISOString().split('T')[0],
      extraNotes: doc.extra_notes || snap.extraNotes || '',
      ...snap
    });
    setIsDrawerOpen(true);
  };

  const [isLoadingPreviewPdf, setIsLoadingPreviewPdf] = useState(false);

  const handleOpenPreviewModal = async (doc) => {
    setPreviewDoc(doc);
    setPreviewPdfUrl(null);
    setPreviewDocxUrl(null);
    setIsLoadingPreviewPdf(true);

    try {
      if (doc.pdf_path) {
        const pdfRes = await invokeApi(`/documents/${doc.id}/signed-url?type=pdf&disposition=inline`);
        if (pdfRes.data?.signedUrl) setPreviewPdfUrl(pdfRes.data.signedUrl);
      }
      if (doc.docx_path) {
        const docxRes = await invokeApi(`/documents/${doc.id}/signed-url?type=docx&disposition=attachment`);
        if (docxRes.data?.signedUrl) setPreviewDocxUrl(docxRes.data.signedUrl);
      }
    } catch (err) {
      console.error("Error fetching preview signed url:", err);
    } finally {
      setIsLoadingPreviewPdf(false);
    }
  };

  const handleRegeneratePdfInModal = async (docId) => {
    try {
      setIsRegeneratingPdf(true);
      const res = await invokeApi(`/documents/${docId}/regenerate-pdf`, { method: 'POST' });
      if (res.error) throw new Error(res.error);

      showAlert('Berhasil', 'PDF berhasil di-regenerate.', 'success');
      fetchDocuments();
      if (res.data?.pdfUrl) setPreviewPdfUrl(res.data.pdfUrl);
    } catch (err) {
      showAlert('Gagal', err.message, 'error');
    } finally {
      setIsRegeneratingPdf(false);
    }
  };

  const handleDeleteDocument = (doc) => {
    const docNo = doc.doc_no || doc.docNo || doc.id;
    const createdAtTime = new Date(doc.created_at || doc.createdAt || Date.now()).getTime();
    const minutesPassed = (Date.now() - createdAtTime) / (1000 * 60);

    if (minutesPassed > 30 && userRole !== 'owner') {
      showAlert('Batas Waktu Hapus Terlampaui', `Dokumen ${docNo} dibuat lebih dari 30 menit yang lalu. Dokumen tidak dapat dihapus, hanya dapat diedit.`, 'warning');
      return;
    }

    showConfirm(
      `Hapus Dokumen ${docNo}?`,
      `Penghapusan dokumen dalam tenggat 30 menit akan mengembalikan status Lead & Kalender ke kondisi sebelum dokumen dibuat. Lanjutkan?`,
      async () => {
        try {
          await invokeApi(`/documents/${doc.id}`, { method: 'DELETE' });

          const linkedLeadId = doc.linked_lead_id || doc.data_snapshot?.linkedLeadId;
          const preStatus = doc.data_snapshot?.previousLeadStatus;
          if (linkedLeadId && preStatus) {
            await invokeApi(`/leads?id=eq.${linkedLeadId}`, {
              method: 'PUT',
              body: { status: preStatus, updatedAt: new Date().toISOString() }
            });
          }

          logActivity(currentUser, `Menghapus Dokumen ${doc.type || ''}: ${docNo} (Status di-rollback)`, doc.id, 'Document', 'Administrasi');
          showAlert('Dokumen Dihapus', `Dokumen ${docNo} berhasil dihapus dan status telah di-rollback.`, 'success');
          fetchDocuments();
        } catch (err) {
          showAlert('Gagal Hapus', err.message, 'error');
        }
      }
    );
  };

  return (
    <div style={{ position: 'relative', height: '100%', paddingBottom: '20px' }}>

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="text-3xl font-semibold">Dokumen Administrasi</h1>

        {userRole !== 'viewer' && (
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setIsDropdownOpen(prev => !prev)}
              className="btn btn-primary"
              style={{ borderRadius: '12px', padding: isMobile ? '10px 16px' : '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={18} /> {isMobile ? 'Buat' : 'Buat Dokumen'} <ChevronDown size={16} />
            </button>

            {/* Dropdown Menu List Surat */}
            {isDropdownOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                zIndex: 200,
                backgroundColor: 'white',
                borderRadius: '14px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.12)',
                border: '1px solid var(--border)',
                minWidth: '320px',
                padding: '6px 0',
                overflow: 'hidden',
                animation: 'fadeIn 0.2s ease-out'
              }}>

                {Object.keys(DOCUMENT_TYPES).map((code) => {
                  const item = DOCUMENT_TYPES[code];
                  return (
                    <button
                      key={code}
                      onClick={() => handleSelectDocType(code)}
                      className="doc-dropdown-item"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          className="doc-type-badge"
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: '#E5EFFF',
                            color: '#4680FF',
                            border: '1px solid #B8D4FF',
                            minWidth: '44px',
                            textAlign: 'center',
                            flexShrink: 0
                          }}
                        >
                          {item.code}
                        </span>
                        <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('list')}
          style={{
            padding: '12px 8px',
            fontSize: '15px',
            fontWeight: 600,
            color: activeTab === 'list' ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'list' ? '2px solid var(--primary)' : '2px solid transparent',
            backgroundColor: 'transparent',
            cursor: 'pointer'
          }}
        >
          Daftar Dokumen
        </button>

        {isAdminOrOwner && (
          <button
            onClick={() => setActiveTab('templates')}
            style={{
              padding: '12px 8px',
              fontSize: '15px',
              fontWeight: 600,
              color: activeTab === 'templates' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'templates' ? '2px solid var(--primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer'
            }}
          >
            Template Manager
          </button>
        )}
      </div>

      {/* Main Tab Content */}
      {activeTab === 'list' ? (
        <DocumentList
          documents={documents}
          clients={clients}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          onOpenCreateDrawer={() => setIsDropdownOpen(prev => !prev)}
          onOpenEditDrawer={handleOpenEditDrawer}
          onOpenPreviewModal={handleOpenPreviewModal}
          onDeleteDocument={handleDeleteDocument}
          fetchDocuments={fetchDocuments}
        />
      ) : (
        <TemplateManager />
      )}

      {/* Drawer Form Modal */}
      <DocumentFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        isEditing={isEditing}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        clients={clients}
        leads={flatLeads || []}
        currentUser={currentUser}
        userProfile={userProfile}
        onSuccess={fetchDocuments}
      />

      {/* PDF Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          pdfUrl={previewPdfUrl}
          docxUrl={previewDocxUrl}
          isLoadingPreview={isLoadingPreviewPdf}
          onClose={() => {
            setPreviewDoc(null);
            setPreviewPdfUrl(null);
            setPreviewDocxUrl(null);
          }}
          onRegeneratePdf={handleRegeneratePdfInModal}
          isRegenerating={isRegeneratingPdf}
        />
      )}

    </div>
  );
};

export default DocumentsPage;
