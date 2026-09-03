import React, { useState, useEffect } from 'react';
import { Download, Upload, CheckCircle2, Info, Copy, Check, Loader2 } from 'lucide-react';
import { DOCUMENT_TYPES } from '../config/documentTypes';
import { ALL_FORM_PLACEHOLDERS, PLACEHOLDER_DESCRIPTIONS } from '../config/placeholders';
import TemplateUploaderModal from './TemplateUploaderModal';
import { invokeApi } from '../../../lib/supabase';
import { useNotification } from '../../../context/NotificationContext';

let cachedTemplateOverview = null;

const TemplateManager = () => {
  const { showAlert } = useNotification();
  const [templateOverview, setTemplateOverview] = useState(() => cachedTemplateOverview || []);
  const [loading, setLoading] = useState(() => !cachedTemplateOverview);
  const [selectedUploadType, setSelectedUploadType] = useState(null);
  const [copiedTag, setCopiedTag] = useState(null);

  const fetchOverview = async (forceRefresh = false) => {
    try {
      if (!cachedTemplateOverview || forceRefresh) {
        if (!cachedTemplateOverview) setLoading(true);
        const res = await invokeApi('/document-templates-overview');
        if (res.data) {
          cachedTemplateOverview = res.data;
          setTemplateOverview(res.data);
        }
      }
    } catch (err) {
      console.error("Error loading template overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleDownloadTemplate = async (docType) => {
    try {
      const res = await invokeApi(`/document-templates/${docType}/signed-url?type=docx`);
      if (res.data?.signedUrl) {
        window.open(res.data.signedUrl, '_blank');
      } else {
        showAlert('Gagal Download', 'Url file template tidak ditemukan.', 'error');
      }
    } catch (err) {
      showAlert('Gagal Download', err.message, 'error');
    }
  };

  const handleCopyTag = (tag) => {
    const textToCopy = `{${tag}}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedTag(tag);
    showAlert('Tag Disalin', `Placeholder ${textToCopy} berhasil dicopy ke clipboard.`, 'success');
    setTimeout(() => setCopiedTag(null), 2000);
  };

  const docTypesWordOnly = ['SPH', 'SKK', 'INV', 'KUI'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Table Format Template Manager */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>
              Daftar Template Dokumen
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Gunakan tag placeholder di bawah ini pada file Word Anda, <strong style={{ color: 'var(--text-primary)' }}>Klik pada tag placeholder</strong> untuk menyalin.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '15px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Jenis Dokumen</th>
                <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Status Template</th>
                <th style={{ padding: '16px 20px' }}>Semua Placeholder Form yang Tersedia</th>
                <th style={{ padding: '16px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {docTypesWordOnly.map((code, idx) => {
                const typeDef = DOCUMENT_TYPES[code];
                const tplItem = (templateOverview || []).find(t => t.id === code);
                const hasMaster = Boolean(tplItem && tplItem.file_path);
                const allPlaceholders = ALL_FORM_PLACEHOLDERS[code] || [];

                return (
                  <tr
                    key={code}
                    style={{
                      borderBottom: idx === docTypesWordOnly.length - 1 ? 'none' : '1px solid var(--border)',
                      backgroundColor: 'var(--surface)'
                    }}
                    className="doc-table-row"
                  >
                    {/* Jenis Dokumen */}
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '100px',
                          fontSize: '13px',
                          fontWeight: '700',
                          backgroundColor: '#E5EFFF',
                          color: '#4680FF',
                          border: '1px solid #B8D4FF'
                        }}>
                          {typeDef.code}
                        </span>
                        <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>{typeDef.name}</span>
                      </div>
                    </td>

                    {/* Status Active */}
                    <td style={{ padding: '20px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {loading ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '100px',
                          fontSize: '13px',
                          fontWeight: '600',
                          backgroundColor: '#F1F5F9',
                          color: '#64748B',
                          border: '1px solid #CBD5E1'
                        }}>
                          <Loader2 size={14} className="animate-spin" /> Memuat...
                        </span>
                      ) : hasMaster ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '100px',
                          fontSize: '13px',
                          fontWeight: '600',
                          backgroundColor: '#EBFBEE',
                          color: '#2B8A3E',
                          border: '1px solid #B2F2BB'
                        }}>
                          <CheckCircle2 size={16} /> Template Tersimpan
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '100px',
                          fontSize: '13px',
                          fontWeight: '600',
                          backgroundColor: '#FFFBEB',
                          color: '#B45309',
                          border: '1px solid #FDE68A'
                        }}>
                          Belum Ada Template
                        </span>
                      )}
                    </td>

                    {/* Placeholder yang Tersedia */}
                    <td style={{ padding: '20px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxWidth: '580px' }}>
                        {allPlaceholders.map((ph, pIdx) => {
                          const desc = PLACEHOLDER_DESCRIPTIONS[ph] || ph;
                          return (
                            <span
                              key={pIdx}
                              onClick={() => handleCopyTag(ph)}
                              title={`Klik untuk salin {${ph}} • ${desc}`}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: copiedTag === ph ? '#DBEAFE' : '#F1F5F9',
                                border: '1px solid #CBD5E1',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontFamily: 'monospace',
                                fontWeight: '600',
                                color: copiedTag === ph ? '#1D4ED8' : '#334155',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              className="hover:border-primary hover:text-primary transition-all"
                            >
                              {'{' + ph + '}'}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Aksi */}
                    <td style={{ padding: '20px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        {hasMaster && (
                          <button
                            onClick={() => handleDownloadTemplate(code)}
                            className="btn btn-outline"
                            style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '8px' }}
                            title="Download master Word yang sedang aktif"
                          >
                            <Download size={15} /> Download Master
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedUploadType(code)}
                          className="btn btn-primary"
                          style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
                        >
                          <Upload size={15} /> {hasMaster ? 'Ganti Template' : 'Upload Template'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panduan & Glosarium Placeholder */}
      <div className="card" style={{ padding: '24px', backgroundColor: '#F8FAFC', border: '1px solid var(--border)', borderRadius: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1E293B', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={20} color="#2563EB" />
          Kamus & Panduan Penggunaan Placeholder
        </h3>
        <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: '1.5' }}>
          Gunakan <strong>SATU kurung kurawal</strong> (contoh: <code style={{ backgroundColor: '#E2E8F0', padding: '2px 6px', borderRadius: '4px' }}>{'{nomor}'}</code>, <code style={{ backgroundColor: '#E2E8F0', padding: '2px 6px', borderRadius: '4px' }}>{'{sekolah}'}</code>) di dalam file Microsoft Word template Anda:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {Object.entries(PLACEHOLDER_DESCRIPTIONS).map(([tag, desc]) => (
            <div
              key={tag}
              onClick={() => handleCopyTag(tag)}
              style={{
                backgroundColor: 'white',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
              className="hover:border-primary transition-all"
            >
              <div>
                <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#2563EB', fontSize: '14px' }}>
                  {'{' + tag + '}'}
                </span>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>{desc}</p>
              </div>
              {copiedTag === tag ? <Check size={16} color="#16A34A" /> : <Copy size={14} color="#94A3B8" />}
            </div>
          ))}
        </div>
      </div>

      {/* Modal Upload Master Template */}
      {selectedUploadType && (
        <TemplateUploaderModal
          docType={selectedUploadType}
          onClose={() => setSelectedUploadType(null)}
          onUploadedSuccess={() => fetchOverview(true)}
        />
      )}

    </div>
  );
};

export default TemplateManager;
