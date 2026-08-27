import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Radio, Calendar, FileText, CheckCircle2, Clock,
  AlertCircle, Plus, Search, Filter, Trash2, Edit3,
  Settings as SettingsIcon, Users, ExternalLink, Play, Square,
  Sparkles, RefreshCw, Layers, ShieldCheck, Eye, X, ChevronRight, Check
} from 'lucide-react';
import { useBroadcast } from '../../context/BroadcastContext';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { renderTemplateContent, formatPhoneNumber } from '../../utils/whatsappUtils';
import { invokeApi } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';

const Broadcast = () => {
  const { clients, users = [] } = useAppData();
  const { userRole, currentUser } = useAuth();
  const isAdminOrOwner = userRole === 'owner' || userRole === 'admin';
  const { showToast, showAlert, showConfirm } = useNotification();

  const {
    waSettings, templates, dripSequences, dripSteps = [],
    clientDrips, loading, refreshBroadcastData, updateSettings,
    saveTemplate, deleteTemplate, stopClientDrip, deleteClientDrip
  } = useBroadcast();

  console.log('DEBUG FRONTEND - templates:', templates);
  console.log('DEBUG FRONTEND - dripSteps:', dripSteps);

  // Set default tab to drip sequence (Proses Sapa)
  const [activeTab, setActiveTab] = useState('drip_sequence'); // 'drip_sequence', 'templates', 'settings'

  // Search & Filter State for Drips
  const [dripSearchQuery, setDripSearchQuery] = useState('');
  const [dripStatusFilter, setDripStatusFilter] = useState('all'); // 'all', 'active', 'stopped_replied', 'completed'

  const [isDispatching, setIsDispatching] = useState(false);

  const handleRunDispatcher = async () => {
    if (isDispatching) return;
    setIsDispatching(true);
    showToast('Memproses antrean pengiriman WhatsApp...', 'info');
    try {
      const { data, error } = await invokeApi('/wa-dispatch', { method: 'POST' });
      if (error) {
        showAlert('Gagal', error.message || 'Terjadi kesalahan saat memproses antrean.', 'error');
        return;
      }
      if (data && data.success) {
        showToast(`Berhasil mengirim ${data.processedCount || 0} pesan!`, 'success');
        refreshBroadcastData();
      } else {
        showAlert('Gagal', data?.error || 'Terjadi kesalahan saat memproses antrean.', 'error');
      }
    } catch (err) {
      console.error('Trigger dispatcher error:', err);
      showAlert('Kesalahan', `Gagal memicu dispatcher pengiriman: ${err.message || err}`, 'error');
    } finally {
      setIsDispatching(false);
    }
  };

  // Detail Modal State for Client Drip Logs
  const [isDripDetailModalOpen, setIsDripDetailModalOpen] = useState(false);
  const [selectedDrip, setSelectedDrip] = useState(null);
  const [dripLogsList, setDripLogsList] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', category: 'cold_outreach', content: '', step_number: '', delay_days: '' });

  // Settings State
  const [settingsForm, setSettingsForm] = useState({ ...waSettings });

  useEffect(() => {
    setSettingsForm({ ...waSettings });
  }, [waSettings]);

  // View detail logs of a specific client drip
  const handleOpenDripDetailModal = async (drip) => {
    setSelectedDrip(drip);
    setIsDripDetailModalOpen(true);
    setLoadingLogs(true);
    try {
      // Fetch wa_broadcast_items that match this client_id
      const { data } = await invokeApi(`/wa_broadcast_items?client_id=eq.${drip.client_id}&order=created_at.desc`);
      setDripLogsList(data || []);
    } catch (err) {
      console.error('Fetch drip logs error:', err);
      setDripLogsList([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Filter client drips list
  const filteredClientDrips = useMemo(() => {
    return clientDrips.filter(drip => {
      const matchesSearch =
        drip.client_name?.toLowerCase().includes(dripSearchQuery.toLowerCase()) ||
        drip.school_name?.toLowerCase().includes(dripSearchQuery.toLowerCase()) ||
        drip.phone?.includes(dripSearchQuery);

      const matchesStatus =
        dripStatusFilter === 'all' ||
        drip.status === dripStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [clientDrips, dripSearchQuery, dripStatusFilter]);

  const textareaRef = useRef(null);

  const toolbarBtnStyle = {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    backgroundColor: '#F8F9FA',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: 600,
    minWidth: '28px',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-main)'
  };

  const emojiBtnStyle = {
    padding: '4px 6px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '16px',
    cursor: 'pointer',
    lineHeight: 1
  };

  const insertFormat = (symbol) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = templateForm.content;
    const selected = text.substring(start, end);

    let replacement = '';
    if (symbol === '```') {
      replacement = `\`\`\`${selected}\`\`\``;
    } else {
      replacement = `${symbol}${selected}${symbol}`;
    }

    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setTemplateForm({ ...templateForm, content: newContent });

    setTimeout(() => {
      textarea.focus();
      const offset = symbol.length;
      textarea.setSelectionRange(start + offset, end + offset);
    }, 50);
  };

  const insertEmoji = (emoji) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = templateForm.content;

    const newContent = text.substring(0, start) + emoji + text.substring(end);
    setTemplateForm({ ...templateForm, content: newContent });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 50);
  };

  // Template Actions
  const handleOpenTemplateModal = (tpl = null) => {
    if (!isAdminOrOwner) return;
    if (tpl) {
      setEditingTemplate(tpl);
      const step = dripSteps.find(s => s.template_id === tpl.id);
      setTemplateForm({
        name: tpl.name,
        category: tpl.category || 'cold_outreach',
        content: tpl.content,
        step_number: step ? step.step_number : '',
        delay_days: step ? step.delay_days : ''
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm({
        name: '',
        category: 'cold_outreach',
        content: '',
        step_number: '',
        delay_days: ''
      });
    }
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplateSubmit = async (e) => {
    e.preventDefault();
    if (!isAdminOrOwner) return;
    const success = await saveTemplate({ ...templateForm, id: editingTemplate?.id });
    if (success) setIsTemplateModalOpen(false);
  };

  const handleSaveSettingsSubmit = async (e) => {
    e.preventDefault();
    if (!isAdminOrOwner) return;
    // Lock provider type to third_party
    await updateSettings({ ...settingsForm, provider_type: 'third_party' });
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '24px', flexWrap: 'wrap', gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={28} color="var(--primary)" />
            Proses Sapa Client Cold
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Otomatisasi sapaan dan follow-up bertahap via Gateway WhatsApp Pihak Ketiga.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{
            fontSize: '14px', fontWeight: 600, padding: '6px 14px', borderRadius: '20px',
            backgroundColor: '#E8F5E9', color: '#2E7D32',
            display: 'inline-flex', alignItems: 'center', gap: '6px'
          }}>
            <ShieldCheck size={16} /> Gateway: {waSettings.third_party_name || 'Gateway Pihak Ketiga'}
          </span>

          <button
            onClick={refreshBroadcastData}
            title="Refresh Data"
            style={{
              padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{
        display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)',
        marginBottom: '24px', overflowX: 'auto', paddingBottom: '2px'
      }}>
        {[
          { id: 'drip_sequence', label: 'Daftar Proses Sapa Aktif', icon: <Sparkles size={18} /> },
          { id: 'templates', label: 'Template Sapaan', icon: <FileText size={18} /> },
          ...(isAdminOrOwner ? [{ id: 'settings', label: 'Pengaturan Gateway', icon: <SettingsIcon size={18} /> }] : []),
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px', borderRadius: '10px 10px 0 0', border: 'none',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              backgroundColor: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- TAB 1: PROSES SAPA MONITORING (drip_sequence) --- */}
      {activeTab === 'drip_sequence' && (
        <div>
          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '20px', backgroundColor: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>Sedang Berjalan (Aktif)</span>
                <Clock size={22} color="var(--primary)" />
              </div>
              <p style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px' }}>
                {clientDrips.filter(cd => cd.status === 'active').length}
              </p>
            </div>

            <div style={{ padding: '20px', backgroundColor: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>Berhasil Disapa (Ada Balasan)</span>
                <CheckCircle2 size={22} color="#2ED47A" />
              </div>
              <p style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px' }}>
                {clientDrips.filter(cd => cd.status === 'stopped_replied').length}
              </p>
            </div>

            <div style={{ padding: '20px', backgroundColor: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>Selesai Tanpa Balasan</span>
                <Layers size={22} color="#4680FF" />
              </div>
              <p style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px' }}>
                {clientDrips.filter(cd => cd.status === 'completed').length}
              </p>
            </div>
          </div>

          {/* Drips Table Card */}
          <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Monitoring Antrean Proses Sapa</h3>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', rowGap: '12px' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    placeholder="Cari client/sekolah..."
                    value={dripSearchQuery}
                    onChange={e => setDripSearchQuery(e.target.value)}
                    style={{ padding: '8px 10px 8px 32px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', width: '100%', outline: 'none' }}
                  />
                </div>

                <select
                  value={dripStatusFilter}
                  onChange={e => setDripStatusFilter(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none', fontWeight: 600, width: '180px' }}
                >
                  <option value="all">Semua</option>
                  <option value="active">Aktif</option>
                  <option value="stopped_replied">Stopped</option>
                  <option value="completed">Completed</option>
                </select>

                {isAdminOrOwner && (
                  <button
                    onClick={handleRunDispatcher}
                    disabled={isDispatching}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', borderRadius: '8px', border: 'none',
                      backgroundColor: 'var(--primary)', color: 'white',
                      fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      transition: 'all 0.2s', opacity: isDispatching ? 0.6 : 1,
                      whiteSpace: 'nowrap', height: '38px'
                    }}
                    title="Kirim semua pesan antrean Proses Sapa yang jatuh tempo sekarang"
                  >
                    <RefreshCw size={14} className={isDispatching ? "animate-spin" : ""} />
                    {isDispatching ? 'Memproses...' : 'Proses Sekarang'}
                  </button>
                )}
              </div>
            </div>

            {filteredClientDrips.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                <Sparkles size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p style={{ fontWeight: 600 }}>Tidak ada data proses sapa ditemukan.</p>
                <p style={{ fontSize: '14px' }}>Anda dapat memasukkan client baru dari tabel Client menggunakan aksi "+ Proses Sapa".</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px' }}>Nama Client</th>
                      <th style={{ padding: '12px' }}>Sekolah</th>
                      <th style={{ padding: '12px' }}>No WhatsApp</th>
                      <th style={{ padding: '12px' }}>Tahap Saat Ini</th>
                      <th style={{ padding: '12px' }}>Jadwal Berikutnya</th>
                      <th style={{ padding: '12px' }}>Diproses Oleh</th>
                      <th style={{ padding: '12px' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClientDrips.map(cd => {
                      const isCreator = cd.created_by === currentUser?.email;
                      const canManage = isAdminOrOwner || isCreator;
                      return (
                        <tr key={cd.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{cd.client_name}</td>
                          <td style={{ padding: '12px' }}>{cd.school_name || '-'}</td>
                          <td style={{ padding: '12px' }}>{cd.phone}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                              ⚡ Tahap {cd.current_step_number}
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>
                            {cd.status === 'active' && cd.next_scheduled_at
                              ? new Date(cd.next_scheduled_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                              : '-'
                            }
                          </td>
                          <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {(() => {
                              if (!cd.created_by) return 'System';
                              const match = users.find(u => u.email === cd.created_by);
                              return match ? (match.nickname || match.name) : cd.created_by.split('@')[0];
                            })()}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {(() => {
                              let label = 'Aktif';
                              let bg = '#E5F6EB';
                              let color = '#2ED47A';

                              if (cd.status === 'stopped_replied') {
                                label = 'Ada Balasan';
                                bg = '#E5EFFF';
                                color = '#4680FF';
                              } else if (cd.status === 'stopped_manual' || cd.status === 'stopped' || (cd.stop_reason && cd.stop_reason.toLowerCase().includes('manual'))) {
                                label = 'Dihentikan';
                                bg = '#FFE5E5';
                                color = '#FF5252';
                              } else if (cd.status === 'paused') {
                                label = 'Ditangguhkan';
                                bg = '#FFF4E5';
                                color = '#FFB020';
                              } else if (cd.status === 'completed') {
                                label = 'Selesai';
                                bg = '#F4F5F7';
                                color = '#6B7280';
                              }

                              return (
                                <span
                                  title={cd.stop_reason || label}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    backgroundColor: bg,
                                    color: color,
                                    display: 'inline-block'
                                  }}
                                >
                                  {label}
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '12px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleOpenDripDetailModal(cd)}
                              style={{
                                padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)',
                                backgroundColor: 'white', color: 'var(--text-main)', fontSize: '13px',
                                fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}
                              title="Lihat Pesan Terkirim"
                            >
                              <Eye size={13} />
                            </button>

                            {cd.status === 'active' && canManage && (
                              <button
                                onClick={() => stopClientDrip(cd.id, 'Dihentikan manual oleh user')}
                                style={{
                                  padding: '5px 10px', borderRadius: '6px', border: '1px solid #FF5252',
                                  backgroundColor: '#FFE5E5', color: '#FF5252', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                                }}
                              >
                                Hentikan
                              </button>
                            )}

                            {cd.status !== 'active' && canManage && (
                              <button
                                onClick={() => {
                                  showConfirm(
                                    'Konfirmasi Hapus',
                                    'Apakah Anda yakin ingin menghapus data antrean Proses Sapa ini dari riwayat?',
                                    () => deleteClientDrip(cd.id)
                                  );
                                }}
                                style={{
                                  padding: '5px 10px', borderRadius: '6px', border: '1px solid #FF5252',
                                  backgroundColor: '#FFE5E5', color: '#FF5252', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                                }}
                              >
                                Hapus
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 2: TEMPLATE MANAGEMENT --- */}
      {activeTab === 'templates' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Template Sapaan</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                {isAdminOrOwner ? 'Buat dan modifikasi template pesan follow-up berjangka.' : 'Daftar template pesan follow-up berjangka.'}
              </p>
            </div>

            {isAdminOrOwner && (
              <button
                onClick={() => handleOpenTemplateModal()}
                style={{
                  padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white',
                  borderRadius: '10px', border: 'none', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Plus size={16} /> Buat Template Baru
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {templates.map(tpl => (
              <div key={tpl.id} style={{
                backgroundColor: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border)',
                padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ fontWeight: 700, fontSize: '15px', margin: 0 }}>{tpl.name}</h4>
                    {(() => {
                      const step = dripSteps.find(s => s.template_id === tpl.id);
                      if (step) {
                        return (
                          <span style={{
                            fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '10px',
                            backgroundColor: 'var(--primary-soft)', color: 'var(--primary)'
                          }}>
                            Tahap {step.step_number} (Delay {step.delay_days}d)
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <p style={{
                    fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap',
                    backgroundColor: '#FAFBFC', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)'
                  }}>
                    {tpl.content}
                  </p>
                </div>

                {isAdminOrOwner && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                    <button
                      onClick={() => handleOpenTemplateModal(tpl)}
                      style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: 'transparent', cursor: 'pointer' }}
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                    <button
                      onClick={() => deleteTemplate(tpl.id)}
                      style={{ padding: '6px 12px', border: '1px solid #FFE5E5', borderRadius: '6px', backgroundColor: '#FFE5E5', color: '#FF5252', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} /> Hapus
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 3: GATEWAY SETTINGS (ADMIN/OWNER ONLY) --- */}
      {activeTab === 'settings' && isAdminOrOwner && (
        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px', maxWidth: '800px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Pengaturan WhatsApp Gateway Pihak Ketiga</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Hubungkan CRM dengan gateway REST API penyedia pengiriman WhatsApp otomatis (seperti Fonnte, Wablas, Whacenter).
          </p>

          <form onSubmit={handleSaveSettingsSubmit}>
            <div style={{ padding: '16px', backgroundColor: '#F8F9FB', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border)' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Layanan Gateway *</label>
                <select
                  disabled={!isAdminOrOwner}
                  value={settingsForm.third_party_name || 'Fonnte'}
                  onChange={e => setSettingsForm({ ...settingsForm, third_party_name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 600, opacity: isAdminOrOwner ? 1 : 0.7 }}
                >
                  <option value="Fonnte">Fonnte (api.fonnte.com)</option>
                  <option value="Wablas">Wablas (wablas.com)</option>
                  <option value="Dripsender">Dripsender (api.dripsender.id)</option>
                  <option value="Whacenter">Whacenter</option>
                  <option value="Starsender">Starsender</option>
                  <option value="Custom">Custom REST API</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>API Token / Key *</label>
                <input
                  disabled={!isAdminOrOwner}
                  type="password"
                  value={settingsForm.third_party_api_key || ''}
                  onChange={e => setSettingsForm({ ...settingsForm, third_party_api_key: e.target.value })}
                  placeholder={isAdminOrOwner ? "Masukkan API Token Gateway Anda" : "••••••••••••••••"}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', opacity: isAdminOrOwner ? 1 : 0.7 }}
                />
              </div>

              <div style={{ marginBottom: '6px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Webhook Auto-Stop URL</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#FAFBFC', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <code style={{ fontSize: '13px', color: '#E65100', flex: 1, wordBreak: 'break-all' }}>
                    https://tknjjmzedidjzgmkljab.supabase.co/functions/v1/wa-webhook
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText("https://tknjjmzedidjzgmkljab.supabase.co/functions/v1/wa-webhook");
                      showToast('Webhook URL disalin ke clipboard!', 'success');
                    }}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Copy URL
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Tempelkan URL di atas pada kolom Webhook di dashboard layanan gateway Anda agar balasan otomatis (*auto-stop*) berfungsi.
                </p>
              </div>
            </div>

            {/* Default Salutation */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>Sapaan Default (Default Salutation)</label>
              <input
                disabled={!isAdminOrOwner}
                type="text"
                value={settingsForm.default_salutation || 'Bapak/Ibu'}
                onChange={e => setSettingsForm({ ...settingsForm, default_salutation: e.target.value })}
                placeholder="Bapak/Ibu"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', opacity: isAdminOrOwner ? 1 : 0.7 }}
              />
            </div>

            {isAdminOrOwner && (
              <button
                type="submit"
                style={{
                  padding: '12px 24px', backgroundColor: 'var(--primary)', color: 'white',
                  borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Simpan Pengaturan Gateway
              </button>
            )}
          </form>
        </div>
      )}

      {/* --- MODAL LOG PESAN TERKIRIM UNTUK CLIENT DRIP --- */}
      {isDripDetailModalOpen && selectedDrip && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', padding: '24px',
            width: '100%', maxWidth: '750px', maxHeight: '80vh', display: 'flex', flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                  Log Pesan: {selectedDrip.client_name}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Sekolah: <strong>{selectedDrip.school_name || '-'}</strong> | WhatsApp: {selectedDrip.phone}
                </p>
              </div>
              <button
                onClick={() => setIsDripDetailModalOpen(false)}
                style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* List Logs */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
              {loadingLogs ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                  <p>Memuat riwayat pesan...</p>
                </div>
              ) : dripLogsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  <p>Belum ada riwayat pesan keluar untuk client ini.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8F9FB', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 14px' }}>No</th>
                      <th style={{ padding: '10px 14px' }}>Isi Pesan Terkirim</th>
                      <th style={{ padding: '10px 14px' }}>Status</th>
                      <th style={{ padding: '10px 14px' }}>Waktu Kirim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dripLogsList.map((item, idx) => (
                      <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'pre-wrap', maxWidth: '360px' }}>
                          {item.rendered_message}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                            backgroundColor: item.status === 'sent' || item.status === 'delivered' ? '#E5F6EB' : item.status === 'failed' ? '#FFE5E5' : '#FFF4E5',
                            color: item.status === 'sent' || item.status === 'delivered' ? '#2ED47A' : item.status === 'failed' ? '#FF5252' : '#FFB020'
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {item.sent_at ? new Date(item.sent_at).toLocaleString('id-ID') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setIsDripDetailModalOpen(false)}
                style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#FAFBFC', cursor: 'pointer', fontWeight: 600 }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TEMPLATE MODAL (ADMIN/OWNER ONLY) --- */}
      {isTemplateModalOpen && isAdminOrOwner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '540px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              {editingTemplate ? 'Edit Template Sapaan' : 'Buat Template Baru'}
            </h3>

            <form onSubmit={handleSaveTemplateSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Nama Template *</label>
                <input
                  type="text"
                  required
                  value={templateForm.name}
                  onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="Contoh: Sapaan Awal Tahun"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Urutan Tahap *</label>
                  <input
                    type="number"
                    required
                    value={templateForm.step_number}
                    onChange={e => setTemplateForm({ ...templateForm, step_number: e.target.value })}
                    placeholder="Contoh: 1, 2, 3"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Nomor urutan tahap pengiriman (1, 2, 3, dst.)
                  </p>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Jeda Hari (Delay) *</label>
                  <input
                    type="number"
                    required
                    value={templateForm.delay_days}
                    onChange={e => setTemplateForm({ ...templateForm, delay_days: e.target.value })}
                    placeholder="Berapa hari delay"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Jeda hari setelah tahap sebelumnya dikirim.
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>Isi Template Pesan *</label>

                {/* WhatsApp Chat Box Wrapper */}
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  backgroundColor: '#F0F2F5',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <textarea
                    ref={textareaRef}
                    rows={5}
                    required
                    value={templateForm.content}
                    onChange={e => setTemplateForm({ ...templateForm, content: e.target.value })}
                    placeholder="Tulis pesan sapaan di sini..."
                    style={{
                      width: '100%',
                      padding: '8px 4px',
                      borderRadius: '0',
                      border: 'none',
                      outline: 'none',
                      resize: 'vertical',
                      backgroundColor: 'transparent',
                      fontSize: '15px',
                      fontFamily: 'Segoe UI, Helvetica Neue, Helvetica, Lucida Grande, Arial, Ubuntu, Cantarell, Fira Sans, sans-serif',
                      color: '#111b21',
                      lineHeight: '1.4'
                    }}
                  />

                  {/* Formatting buttons */}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button type="button" onClick={() => insertFormat('*')} title="Tebal (Bold)" style={{ ...toolbarBtnStyle, border: 'none', backgroundColor: 'transparent', padding: '4px', minWidth: '24px' }}><b>B</b></button>
                    <button type="button" onClick={() => insertFormat('_')} title="Miring (Italic)" style={{ ...toolbarBtnStyle, border: 'none', backgroundColor: 'transparent', padding: '4px', minWidth: '24px' }}><i>I</i></button>
                    <button type="button" onClick={() => insertFormat('~')} title="Coret (Strikethrough)" style={{ ...toolbarBtnStyle, border: 'none', backgroundColor: 'transparent', padding: '4px', minWidth: '24px' }}><strike>S</strike></button>
                    <button type="button" onClick={() => insertFormat('```')} title="Monospace" style={{ ...toolbarBtnStyle, border: 'none', backgroundColor: 'transparent', padding: '4px', minWidth: '24px' }}><code>M</code></button>
                  </div>

                  {/* WhatsApp-like Bottom Toolbar */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                    paddingTop: '6px'
                  }}>
                    {/* Emojis Grid */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {['👋', '😊', '🏫', '💼', '📞', '👍', '🙏', '💡', '📝', '✉️', '🌟'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => insertEmoji(emoji)}
                          style={emojiBtnStyle}
                          title={`Masukkan ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Gunakan penanda otomatis berikut: <code>{"{{sapaan}}"}</code>, <code>{"{{nama}}"}</code>, <code>{"{{sekolah}}"}</code>, <code>{"{{posisi}}"}</code>, <code>{"{{email}}"}</code>.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'transparent', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                >
                  Simpan Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDispatching && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white', padding: '30px', borderRadius: '16px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: '16px', maxWidth: '360px', textAlign: 'center',
            color: 'var(--text-primary)', border: '1px solid var(--border)'
          }}>
            <RefreshCw size={40} className="animate-spin" style={{ color: 'var(--primary)' }} />
            <h4 style={{ fontWeight: 700, margin: 0, fontSize: '16px' }}>Memproses Antrean</h4>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Sedang memproses antrean pesan WhatsApp dan menyinkronkan status CRM. Mohon tunggu beberapa saat, jangan menutup halaman ini...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Broadcast;
