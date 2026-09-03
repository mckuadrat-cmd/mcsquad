import React, { useState } from 'react';
import { Search, Eye, Download, FileText, Send, Copy, Trash2, Edit2, RefreshCw, CheckCircle2, AlertCircle, Check, Loader2 } from 'lucide-react';
import { DOCUMENT_TYPES } from '../config/documentTypes';
import { generateWaMeLink } from '../../../utils/whatsappUtils';
import { invokeApi } from '../../../lib/supabase';
import { useNotification } from '../../../context/NotificationContext';

const DocumentList = ({
  documents,
  clients = [],
  searchQuery,
  setSearchQuery,
  selectedMonth,
  setSelectedMonth,
  selectedType,
  setSelectedType,
  onOpenEditDrawer,
  onOpenPreviewModal,
  onDeleteDocument,
  fetchDocuments
}) => {
  const { showAlert, showConfirm } = useNotification();
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [confirmingSkkId, setConfirmingSkkId] = useState(null);
  const [downloadingKey, setDownloadingKey] = useState(null);

  // Filter documents by search query, month, and type
  const filteredDocs = (documents || []).filter(doc => {
    const searchLower = searchQuery.toLowerCase();
    const docNoStr = (doc.doc_no || doc.docNo || '').toLowerCase();
    const clientStr = (doc.client_name || doc.client || '').toLowerCase();
    const titleStr = (doc.title || doc.program || '').toLowerCase();

    const matchesSearch = !searchQuery || docNoStr.includes(searchLower) || clientStr.includes(searchLower) || titleStr.includes(searchLower);

    const docDateStr = (doc.date || doc.createdAt || '').substring(0, 7);
    const matchesMonth = !selectedMonth || docDateStr === selectedMonth;

    const docTypeStr = doc.type || 'SPH';
    const matchesType = !selectedType || selectedType === 'ALL' || docTypeStr === selectedType;

    return matchesSearch && matchesMonth && matchesType;
  });

  const handleDownloadDoc = async (docId, fileType) => {
    const key = `${docId}_${fileType}`;
    try {
      setDownloadingKey(key);
      const res = await invokeApi(`/documents/${docId}/signed-url?type=${fileType}&disposition=attachment`);
      if (res.data?.signedUrl) {
        window.open(res.data.signedUrl, '_blank');
      } else {
        showAlert('File Tidak Ditemukan', `File ${fileType.toUpperCase()} belum tersedia untuk dokumen ini.`, 'error');
      }
    } catch (err) {
      showAlert('Gagal Download', err.message, 'error');
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleConfirmSkk = (doc) => {
    const paymentDate = doc.data_snapshot?.paymentDate || doc.data_snapshot?.validUntil;
    if (!paymentDate) {
      showAlert('Estimasi Pembayaran Diperlukan', 'Masukkan estimasi tanggal pembayaran terlebih dahulu sebelum mengonfirmasi SKK.', 'warning');
      onOpenEditDrawer(doc);
      return;
    }

    showConfirm(
      `Konfirmasi SKK ${doc.doc_no || doc.docNo}?`,
      `Konfirmasi SKK ini akan secara otomatis memperbarui status Lead & Client CRM sesuai tanggal estimasi pembayaran (${paymentDate}).`,
      async () => {
        try {
          setConfirmingSkkId(doc.id);
          const res = await invokeApi(`/documents/${doc.id}/confirm-skk`, {
            method: 'POST',
            body: { paymentDate }
          });

          if (res.error) throw new Error(res.error);

          showAlert('SKK Dikonfirmasi', res.data?.message || `Status Sales diperbarui ke ${res.data?.newStatus}`, 'success');
          fetchDocuments();
        } catch (err) {
          showAlert('Gagal Konfirmasi', err.message, 'error');
        } finally {
          setConfirmingSkkId(null);
        }
      }
    );
  };

  const handleRegeneratePdf = async (docId) => {
    try {
      setRegeneratingId(docId);
      const res = await invokeApi(`/documents/${docId}/regenerate-pdf`, { method: 'POST' });
      if (res.error) throw new Error(res.error);

      showAlert('Berhasil', 'PDF berhasil di-regenerate dari file DOCX.', 'success');
      fetchDocuments();
    } catch (err) {
      showAlert('Gagal Regenerate', err.message, 'error');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleCopyNumber = (docNo) => {
    navigator.clipboard.writeText(docNo);
    showAlert('Berhasil Copy', `Nomor surat ${docNo} telah dicopy ke clipboard.`, 'success');
  };

  const formatRupiah = (val) => {
    if (!val && val !== 0) return '-';
    if (typeof val === 'string' && val.startsWith('Rp')) return val;
    const num = parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || 0;
    if (num === 0) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num).replace('IDR', 'Rp').trim();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Table Card Container */}
      <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Search & Filter Header */}
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>

          {/* Search Input */}
          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Cari nomor dokumen, client, perihal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '40px', borderRadius: '10px' }}
            />
          </div>

          {/* Filter Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <select
              className="form-input"
              style={{ width: 'auto', borderRadius: '10px', fontWeight: '600', padding: '10px 14px' }}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="ALL">Semua Dokumen</option>
              {Object.keys(DOCUMENT_TYPES).map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>

            <input
              type="month"
              className="form-input"
              style={{ width: 'auto', borderRadius: '10px', fontWeight: '600', padding: '10px 14px' }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

        </div>

        {/* Table View */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600' }}>
                <th style={{ padding: '14px 20px' }}>Tanggal / Jenis</th>
                <th style={{ padding: '14px 20px' }}>Nomor Surat</th>
                <th style={{ padding: '14px 20px' }}>Client / Perihal</th>
                <th style={{ padding: '14px 20px' }}>Nilai</th>
                <th style={{ padding: '14px 20px' }}>Status File / CRM</th>
                <th style={{ padding: '14px 20px' }}>Dibuat Oleh</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                      <FileText size={48} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
                      <span style={{ fontSize: '15px', fontWeight: '500' }}>Tidak ada dokumen yang ditemukan.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc, idx) => {
                  const typeCode = doc.type || 'SPH';
                  const typeDef = DOCUMENT_TYPES[typeCode] || DOCUMENT_TYPES.SPH;
                  const isNumberOnly = !typeDef.usesWordTemplate;
                  const docNo = doc.doc_no || doc.docNo || '-';
                  const clientName = doc.client_name || doc.client || 'Umum';
                  const titleStr = doc.title || doc.program || doc.perihal || '-';
                  const docValue = doc.data_snapshot?.harga || doc.data_snapshot?.specialPrice || doc.rawValue || doc.value;
                  const isLegacy = doc.legacy || (!doc.docx_path && !doc.pdf_path && !isNumberOnly);

                  const isSkk = typeCode === 'SKK';
                  const isSkkConfirmed = isSkk && (doc.status === 'FINALIZED' || doc.data_snapshot?.skkConfirmedAt);

                  return (
                    <tr
                      key={doc.id}
                      style={{
                        borderBottom: idx === filteredDocs.length - 1 ? 'none' : '1px solid var(--border)',
                        whiteSpace: 'nowrap'
                      }}
                      className="hover:bg-gray-50"
                    >
                      {/* Tanggal & Jenis */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: '#E5EFFF',
                            color: '#4680FF',
                            border: '1px solid #B8D4FF',
                            width: 'fit-content'
                          }}>
                            {typeCode}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{doc.date || doc.createdAt?.substring(0, 10)}</span>
                        </div>
                      </td>

                      {/* Nomor Surat */}
                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {docNo}
                      </td>

                      {/* Client / Perihal */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{clientName}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titleStr}</div>
                      </td>

                      {/* Nilai */}
                      <td style={{ padding: '14px 20px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {isNumberOnly ? '-' : formatRupiah(docValue)}
                      </td>

                      {/* Status File / CRM */}
                      <td style={{ padding: '14px 20px' }}>
                        {isNumberOnly ? (
                          <span style={{ padding: '4px 10px', backgroundColor: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', fontSize: '11px', fontWeight: '700', borderRadius: '100px' }}>
                            NO. REGISTRASI
                          </span>
                        ) : isSkkConfirmed ? (
                          <span style={{ padding: '4px 10px', backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: '11px', fontWeight: '700', borderRadius: '100px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={12} /> CONFIRMED ({doc.data_snapshot?.skkResultStatus || 'DEAL'})
                          </span>
                        ) : isLegacy ? (
                          <span style={{ padding: '4px 10px', backgroundColor: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', fontSize: '11px', fontWeight: '700', borderRadius: '100px' }}>
                            LEGACY (HTML)
                          </span>
                        ) : doc.pdf_path ? (
                          <span style={{ padding: '4px 10px', backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: '11px', fontWeight: '700', borderRadius: '100px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> DOCX & PDF
                          </span>
                        ) : doc.docx_path ? (
                          <span style={{ padding: '4px 10px', backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: '11px', fontWeight: '700', borderRadius: '100px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> READY (PDF)
                          </span>
                        ) : (
                          <span style={{ padding: '4px 10px', backgroundColor: '#F1F3F5', color: '#4B5563', fontSize: '11px', fontWeight: '700', borderRadius: '100px' }}>
                            {doc.status || 'DRAFT'}
                          </span>
                        )}
                      </td>

                      {/* Author */}
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {doc.author_name || doc.author || 'Staff'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>

                          {/* SKK Confirm Button (Poin 5 & 6) */}
                          {isSkk && !isSkkConfirmed && (
                            <button
                              onClick={() => handleConfirmSkk(doc)}
                              disabled={confirmingSkkId === doc.id}
                              className="btn btn-primary"
                              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', backgroundColor: '#2563EB' }}
                              title="Konfirmasi SKK dan update status Lead"
                            >
                              <Check size={14} /> Confirm SKK
                            </button>
                          )}

                          {isNumberOnly ? (
                            <>
                              <button
                                onClick={() => handleCopyNumber(docNo)}
                                className="btn btn-outline"
                                style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '8px' }}
                              >
                                <Copy size={14} /> Copy No
                              </button>
                              <button
                                onClick={() => onOpenEditDrawer(doc)}
                                className="icon-btn"
                                title="Edit Metadata"
                              >
                                <Edit2 size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => onOpenPreviewModal(doc)}
                                className="btn btn-soft"
                                style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}
                                title="Preview PDF"
                              >
                                <Eye size={14} /> Preview
                              </button>

                              {doc.pdf_path && (
                                <button
                                  onClick={() => handleDownloadDoc(doc.id, 'pdf')}
                                  disabled={downloadingKey === `${doc.id}_pdf`}
                                  className="btn btn-outline"
                                  style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '8px', backgroundColor: '#EBFBEE', color: '#2B8A3E' }}
                                  title="Download PDF"
                                >
                                  {downloadingKey === `${doc.id}_pdf` ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Download size={14} />
                                  )} PDF
                                </button>
                              )}

                              {doc.docx_path && (
                                <button
                                  onClick={() => handleDownloadDoc(doc.id, 'docx')}
                                  disabled={downloadingKey === `${doc.id}_docx`}
                                  className="btn btn-outline"
                                  style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '8px', backgroundColor: '#F3E8FF', color: '#7E22CE' }}
                                  title="Download DOCX"
                                >
                                  {downloadingKey === `${doc.id}_docx` ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Download size={14} />
                                  )} DOCX
                                </button>
                              )}

                              {doc.docx_path && !doc.pdf_path && (
                                <button
                                  onClick={() => handleRegeneratePdf(doc.id)}
                                  disabled={regeneratingId === doc.id}
                                  className="btn btn-outline"
                                  style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '8px', backgroundColor: '#FFFBEB', color: '#B45309' }}
                                  title="Regenerate PDF"
                                >
                                  <RefreshCw size={14} className={regeneratingId === doc.id ? 'animate-spin' : ''} /> PDF Retry
                                </button>
                              )}

                              {(() => {
                                const docSchoolId = doc.school_id || doc.schoolId || doc.data_snapshot?.schoolId;
                                const docClientName = (doc.client_name || doc.client || '').toLowerCase().trim();

                                const clientObj = (clients || []).find(c => {
                                  if (docSchoolId && (c.schoolId === docSchoolId || c.id === docSchoolId)) return true;
                                  const cSekolah = (c.sekolah || c.school || '').toLowerCase().trim();
                                  if (cSekolah && cSekolah === docClientName) return true;
                                  const cNama = (c.nama || c.name || '').toLowerCase().trim();
                                  if (cNama && cNama === docClientName) return true;
                                  return false;
                                });

                                const targetPhone = clientObj?.whatsapp || clientObj?.phone || doc.data_snapshot?.whatsapp || doc.data_snapshot?.phone || doc.data_snapshot?.picPhone || '';

                                const buildHumanizedMessage = () => {
                                  const typeCode = (doc.type || 'SPH').toUpperCase();
                                  const docNo = doc.doc_no || doc.docNo || doc.id || '-';
                                  const displayClient = doc.client_name || doc.client || clientObj?.sekolah || clientObj?.school || 'Sekolah';
                                  const displayTitle = doc.title || doc.program || doc.perihal || 'Kegiatan';

                                  const salutation = clientObj?.sapaan || clientObj?.salutation || doc.data_snapshot?.sapaan || doc.data_snapshot?.salutation || 'Bapak/Ibu';
                                  const rawName = clientObj?.nama || clientObj?.name || doc.data_snapshot?.penerima || doc.data_snapshot?.client || '';
                                  const nickname = clientObj?.panggilan || clientObj?.nickname || (rawName ? rawName.split(' ')[0] : 'Bapak/Ibu');

                                  switch (typeCode) {
                                    case 'SPH':
                                      return `Assalamualaikum ${salutation} ${nickname}, semoga ${salutation} dan tim di ${displayClient} senantiasa dalam keadaan sehat.

Menindaklanjuti rencana kegiatan ${displayClient}, berikut kami kirimkan dokumen *Surat Penawaran Harga (SPH)* nomor *${docNo}* terkait *${displayTitle}*.

Mohon dapat dipelajari terlebih dahulu nggih ${salutation}. Apabila ada hal yang ingin didiskusikan atau disesuaikan, kami siap membantu dengan senang hati. Terima kasih.`;

                                    case 'SKK':
                                      return `Assalamualaikum ${salutation} ${nickname}, semoga harinya menyenangkan.

Terima kasih banyak atas kepercayaan ${displayClient} memilih MCKuadrat sebagai mitra kegiatan *${displayTitle}*.

Berikut kami sampaikan dokumen *Surat Kesepakatan Kerjasama (SKK)* nomor *${docNo}* untuk penandatanganan dan konfirmasi agenda. Apabila ada detail yang perlu diselaraskan, silakan kabari kami nggih. Terima kasih banyak.`;

                                    case 'INV':
                                    case 'INVOICE':
                                      return `Assalamualaikum ${salutation} ${nickname}, salam hangat dari tim MCKuadrat.

Menindaklanjuti pelaksanaan program *${displayTitle}* di ${displayClient}, berikut kami lampirkan dokumen *Invoice/Tagihan* resmi nomor *${docNo}*.

Mohon dapat dicek kembali detail pembayarannya ${salutation}. Jika ada berkas pendukung administrasi lain yang dibutuhkan, silakan beritahu kami. Terima kasih atas kerjasamanya.`;

                                    case 'KUI':
                                    case 'KUITANSI':
                                    case 'RECEIPT':
                                      return `Assalamualaikum ${salutation} ${nickname}, terima kasih banyak.

Konfirmasi pembayaran untuk program *${displayTitle}* telah kami terima dengan baik. Berikut kami lampirkan bukti *Kuitansi Pembayaran Resmi* nomor *${docNo}* untuk ${displayClient}.

Senang sekali dapat berkolaborasi dengan ${salutation} dan seluruh keluarga besar ${displayClient}. Semoga kegiatan ini memberikan keberkahan dan manfaat terbaik untuk semua. Terima kasih banyak.`;

                                    default:
                                      return `Assalamualaikum ${salutation} ${nickname}, semoga sehat selalu.

Berikut kami sampaikan dokumen resmi nomor *${docNo}* (${typeCode}) terkait *${displayTitle}* untuk ${displayClient}.

Apabila ada hal yang ingin ditanyakan, jangan ragu untuk menghubungi kami nggih ${salutation}. Terima kasih.`;
                                  }
                                };

                                const waMessage = buildHumanizedMessage();
                                return (
                                  <a
                                    href={generateWaMeLink(targetPhone, waMessage)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="icon-btn"
                                    style={{ color: '#2B8A3E' }}
                                    title={targetPhone ? `Kirim WA Dokumen ${doc.type} ke ${targetPhone}` : 'Kirim WA (Nomor Belum Diisi)'}
                                  >
                                    <Send size={16} />
                                  </a>
                                );
                              })()}

                              <button
                                onClick={() => onOpenEditDrawer(doc)}
                                className="icon-btn"
                                title="Edit Data"
                              >
                                <Edit2 size={16} />
                              </button>
                            </>
                          )}

                          {(() => {
                            const createdAtTime = new Date(doc.created_at || doc.createdAt || Date.now()).getTime();
                            const minutesPassed = (Date.now() - createdAtTime) / (1000 * 60);
                            const canDelete = minutesPassed <= 30;
                            return (
                              <button
                                onClick={() => onDeleteDocument(doc)}
                                className="icon-btn"
                                style={{ color: canDelete ? '#E03131' : '#CBD5E1', cursor: canDelete ? 'pointer' : 'not-allowed' }}
                                title={canDelete ? "Hapus Dokumen (Tersedia dalam 30 menit sejak dibuat)" : "Batas waktu 30 menit terlampaui. Dokumen hanya dapat diedit."}
                              >
                                <Trash2 size={16} />
                              </button>
                            );
                          })()}

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default DocumentList;
