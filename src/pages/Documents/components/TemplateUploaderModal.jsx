import React, { useState } from 'react';
import { X, Upload, FileText, Loader2 } from 'lucide-react';
import { invokeApi } from '../../../lib/supabase';
import { useNotification } from '../../../context/NotificationContext';

const TemplateUploaderModal = ({
  docType,
  onClose,
  onUploadedSuccess
}) => {
  const { showAlert } = useNotification();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.docx')) {
        showAlert('Format Salah', 'File template harus berformat .docx', 'error');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await invokeApi(`/document-templates/${docType}/upload`, {
        method: 'POST',
        headers: {},
        body: formData
      });

      if (res.error) throw new Error(res.error);

      showAlert('Master Template Diperbarui', `Template ${docType} berhasil di-upload dan menggantikan template lama.`, 'success');
      onUploadedSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      showAlert('Gagal Upload', err.message || 'Gagal memproses template DOCX.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      padding: '16px'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '520px',
        padding: '0',
        borderRadius: '16px',
        backgroundColor: 'white',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        
        {/* Loading Overlay */}
        {isUploading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
                Meng-upload & Verifikasi Template...
              </h4>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                File .docx sedang disimpan ke storage dan menggantikan master template {docType}.
              </p>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
              Upload Master Template Word ({docType})
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Upload file .docx baru untuk langsung menggantikan master template {docType}
            </p>
          </div>
          <button onClick={onClose} style={{ color: '#94A3B8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* File Selector */}
          <div style={{
            border: '2px dashed #CBD5E1',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            backgroundColor: '#F8FAFC'
          }}>
            <input
              type="file"
              accept=".docx"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="docx-upload-input"
            />
            <label htmlFor="docx-upload-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <FileText size={40} color="#2563EB" style={{ marginBottom: '8px' }} />
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                {selectedFile ? selectedFile.name : 'Pilih file Word (.docx)'}
              </span>
              <span style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                Klik untuk menjelajah file dari komputer Anda
              </span>
            </label>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
          >
            Batal
          </button>
          
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: '13px', borderRadius: '8px' }}
          >
            <Upload size={16} />
            {isUploading ? 'Mengunggah & Mengganti Master...' : 'Upload & Ganti Master Template'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default TemplateUploaderModal;
