import React, { useState } from 'react';
import { X, FileText, Save, Loader2 } from 'lucide-react';
import SPHForm from '../forms/SPHForm';
import SKKForm from '../forms/SKKForm';
import InvoiceForm from '../forms/InvoiceForm';
import ReceiptForm from '../forms/ReceiptForm';
import NumberOnlyForm from '../forms/NumberOnlyForm';
import { DOCUMENT_TYPES } from '../config/documentTypes';
import { invokeApi } from '../../../lib/supabase';
import { useNotification } from '../../../context/NotificationContext';
import { logActivity } from '../../../utils/activityLogger';
import { updateClientActivity } from '../../../utils/clientUtils';

const DocumentFormDrawer = ({
  isOpen,
  onClose,
  isEditing,
  editingId,
  formData,
  setFormData,
  clients = [],
  leads = [],
  currentUser,
  userProfile,
  onSuccess
}) => {
  const { showAlert, showConfirm } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleRemoveScheduleFromForm = () => {
    showConfirm(
      'Hapus Jadwal dari Kalender?',
      'Jadwal kegiatan akan dihapus dari kalender. Lead dan Dokumen tetap tersimpan.',
      async () => {
        try {
          if (editingId) {
            await invokeApi(`/documents/${editingId}/remove-schedule`, { method: 'POST' });
          }
          setFormData(prev => ({ ...prev, startDate: '', startTime: '08:00', endTime: '16:00' }));
          showAlert('Jadwal Dihapus', 'Jadwal kegiatan telah dihapus.', 'success');
        } catch (err) {
          showAlert('Gagal', err.message, 'error');
        }
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);

      if (isEditing) {
        await invokeApi(`/generated_documents?id=eq.${editingId}`, {
          method: 'PUT',
          body: {
            client_name: formData.client || formData.penerima || 'Umum',
            title: formData.program || formData.perihal || 'Dokumen',
            date: formData.date,
            data_snapshot: formData,
            updated_at: new Date().toISOString(),
            extra_notes: formData.extraNotes || ''
          }
        });

        logActivity(currentUser, `Memperbarui Data Dokumen ${formData.type}: ${formData.docNo || editingId}`, editingId, 'Document', 'Administrasi');
        showAlert('Berhasil', 'Data dokumen berhasil diperbarui.', 'success');
        onSuccess();
        onClose();
        return;
      }

      const docDate = formData.date || new Date().toISOString().split('T')[0];

      // Generate New Document via Edge Function V2 API
      const res = await invokeApi('/documents/generate-v2', {
        method: 'POST',
        body: {
          docType: formData.type,
          date: docDate,
          clientName: formData.client || formData.penerima || 'Umum',
          schoolId: formData.schoolId || null,
          linkedLeadId: formData.linkedLeadId || null,
          inputFields: formData,
          authorName: userProfile?.nickname?.trim() || userProfile?.name || 'Staff',
          authorId: currentUser?.uid
        }
      });

      if (res.error) throw new Error(res.error);

      const generatedDoc = res.data?.document || res.document;
      const pdfNotice = res.data?.pdfNotice || res.pdfNotice;

      // --- LEAD STATUS SYNC UPON DOCUMENT CREATION (Point 14) ---
      const clientName = formData.client || formData.penerima;
      const targetLead = (leads || []).find(l => l.id === formData.linkedLeadId || (clientName && l.schoolName?.toLowerCase() === clientName.toLowerCase() && l.status !== 'cancel'));

      if (targetLead) {
        let newLeadStatus = null;
        const currentLeadStatus = targetLead.status?.toLowerCase();

        if (['SPH', 'SKK'].includes(formData.type) && currentLeadStatus === 'suspect') {
          newLeadStatus = 'prospek';
        } else if (formData.type === 'KUI' && currentLeadStatus !== 'buyer') {
          newLeadStatus = 'buyer';
        }

        if (newLeadStatus) {
          await invokeApi(`/leads?id=eq.${targetLead.id}`, {
            method: 'PUT',
            body: { status: newLeadStatus, updatedAt: new Date().toISOString() }
          });
          if (generatedDoc?.id) {
            await invokeApi(`/generated_documents?id=eq.${generatedDoc.id}`, {
              method: 'PUT',
              body: {
                data_snapshot: {
                  ...formData,
                  previousLeadStatus: currentLeadStatus,
                  linkedLeadId: targetLead.id
                }
              }
            });
          }
        }
      }

      // Update CRM client activity
      if (formData.client && formData.client !== 'Internal Tim') {
        await updateClientActivity(formData.client, `Generate ${formData.type}: ${formData.program || formData.perihal || 'Doc'}`);
      }

      logActivity(currentUser, `Membuat Dokumen ${formData.type}: ${generatedDoc?.doc_no || 'Baru'}`, generatedDoc?.id || 'Doc', 'Document', 'Administrasi');

      showAlert('Berhasil Generate Dokumen', `Dokumen ${formData.type} (${generatedDoc?.doc_no || ''}) berhasil dibuat dan siap di-preview/download.`, 'success');

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error generating document:", err);
      showAlert('Gagal Generate', err.message || 'Terjadi kesalahan saat generate dokumen.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        overflow: 'hidden',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        justifyContent: 'flex-end'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '580px',
          backgroundColor: 'white',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative'
        }}
      >

        {/* Loading Overlay Spinner */}
        {isSubmitting && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            backgroundColor: 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            padding: '24px',
            textAlign: 'center'
          }}>
            <Loader2 size={44} color="#2563EB" className="animate-spin" />
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#1E293B', marginBottom: '4px' }}>
                Sedang Memproses Dokumen & Konversi PDF...
              </h4>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0, maxWidth: '360px', lineHeight: '1.4' }}>
                Sistem sedang memproses nomor registrasi, mengisi template Word, dan menyiapkan file PDF. Mohon tunggu sebentar.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {isEditing ? `Edit Metadata Dokumen (${formData.type})` : `${DOCUMENT_TYPES[formData.type]?.name || formData.type}`}
            </h3>
          </div>
          <button onClick={onClose} style={{ color: '#94A3B8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Dynamic Form per Document Type */}
          {formData.type === 'SPH' && (
            <SPHForm formData={formData} setFormData={setFormData} clients={clients} leads={leads} />
          )}
          {formData.type === 'SKK' && (
            <SKKForm formData={formData} setFormData={setFormData} clients={clients} leads={leads} onRemoveSchedule={handleRemoveScheduleFromForm} />
          )}
          {formData.type === 'INV' && (
            <InvoiceForm formData={formData} setFormData={setFormData} clients={clients} leads={leads} />
          )}
          {formData.type === 'KUI' && (
            <ReceiptForm formData={formData} setFormData={setFormData} clients={clients} leads={leads} />
          )}
          {(formData.type === 'MOU' || formData.type === 'GEN') && (
            <NumberOnlyForm docType={formData.type} formData={formData} setFormData={setFormData} clients={clients} leads={leads} />
          )}

          {/* Footer buttons */}
          <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 'auto' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ padding: '8px 20px', fontSize: '13px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Memproses...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {isEditing ? 'Simpan Perubahan' : (formData.type === 'MOU' || formData.type === 'GEN' ? 'Generate Nomor' : 'Generate Dokumen')}
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default DocumentFormDrawer;
