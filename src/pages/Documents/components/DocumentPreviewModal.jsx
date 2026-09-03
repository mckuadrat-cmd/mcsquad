import React from 'react';
import { X, Download, FileText, RefreshCw, Loader2 } from 'lucide-react';

const DocumentPreviewModal = ({
  doc,
  pdfUrl,
  docxUrl,
  isLoadingPreview = false,
  onClose,
  onRegeneratePdf,
  isRegenerating
}) => {
  if (!doc) return null;

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
        maxWidth: '1000px',
        height: '88vh',
        padding: '0',
        borderRadius: '16px',
        backgroundColor: 'white',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Modal Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--primary)" />
              {doc.doc_no || doc.docNo} - {doc.client_name || doc.client}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
              {doc.title || doc.program} • Tanggal: {doc.date}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
                style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', backgroundColor: '#EBFBEE', color: '#2B8A3E', border: '1px solid #B2F2BB' }}
              >
                <Download size={14} /> Download PDF
              </a>
            )}
            {docxUrl && (
              <a
                href={docxUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
                style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', backgroundColor: '#F3E8FF', color: '#7E22CE', border: '1px solid #E9D5FF' }}
              >
                <Download size={14} /> Download DOCX
              </a>
            )}
            <button onClick={onClose} style={{ color: '#94A3B8', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div style={{ flex: 1, backgroundColor: '#F1F5F9', padding: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {isLoadingPreview || isRegenerating ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '14px', textAlign: 'center' }}>
              <Loader2 size={48} color="#2563EB" className="animate-spin" />
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#1E293B', marginBottom: '4px' }}>
                  {isRegenerating ? 'Sedang Memproses PDF Baru...' : 'Memuat Preview PDF...'}
                </h4>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                  Mengambil dokumen PDF dari server Supabase
                </p>
              </div>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=1`}
              style={{ width: '100%', height: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white' }}
              title="PDF Document Preview"
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '32px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', maxWidth: '420px', margin: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <FileText size={48} color="#D97706" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#1E293B', marginBottom: '4px' }}>Preview PDF Belum Tersedia</h4>
              <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px', lineHeight: '1.5' }}>
                Dokumen .DOCX berhasil di-generate, namun file PDF belum tersedia atau konversi PDF terganggu.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                {docxUrl && (
                  <a
                    href={docxUrl}
                    download
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '8px' }}
                  >
                    Download Master DOCX
                  </a>
                )}
                {onRegeneratePdf && (
                  <button
                    onClick={() => onRegeneratePdf(doc.id)}
                    disabled={isRegenerating}
                    className="btn btn-outline"
                    style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '8px', backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}
                  >
                    <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
                    {isRegenerating ? 'Generating PDF...' : 'Regenerate PDF'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DocumentPreviewModal;
