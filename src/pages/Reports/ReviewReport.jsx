import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, X, ClipboardCheck, Users, BookOpen, Clock, FileText, Plus, Trash2, User } from 'lucide-react';
import { invokeApi } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useAppData } from '../../context/AppDataContext';
import { updateClientActivity } from '../../utils/clientUtils';

const ReviewReport = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile } = useAuth();
  const { showAlert } = useNotification();
  const { clients, uniqueSchools } = useAppData();

  const authorName = (userProfile?.nickname?.trim() || userProfile?.name) || currentUser?.displayName || 'Staff';

  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [formData, setFormData] = useState({
    schoolName: '',
    schoolId: '',
    programName: '',
    date: new Date().toISOString().split('T')[0],
    materials: [],
    rundown: [{ start: '', end: '', activity: '' }],
    facts: '',
    feedback: '',
    status: 'Completed'
  });

  const [materialInput, setMaterialInput] = useState('');
  const [dayEvents, setDayEvents] = useState([]);
  const [searching, setSearching] = useState(false);

  // Fetch events for the selected date to allow quick-fill
  useEffect(() => {
    const fetchDayEvents = async () => {
      if (!formData.date) return;
      setSearching(true);
      try {
        const { data } = await invokeApi(`/calendar_events?start=gte.${formData.date}&start=lte.${formData.date}T23:59:59`);
        const evs = (data || []).filter(ev => ev.extendedProps?.type === 'event' || ev.type === 'event');
        setDayEvents(evs);
      } catch (err) {
        console.error("Fetch day events error:", err);
      } finally {
        setSearching(false);
      }
    };
    fetchDayEvents();
  }, [formData.date]);

  // Pre-fill from Calendar/Lead if available
  useEffect(() => {
    if (location.state?.eventData) {
      const { schoolName, program, date } = location.state.eventData;
      setFormData(prev => ({
        ...prev,
        schoolName: schoolName || '',
        programName: program || '',
        date: date || new Date().toISOString().split('T')[0],
      }));
    }
  }, [location.state]);

  const handleSelectEvent = (evId) => {
    const ev = dayEvents.find(e => e.id === evId);
    if (!ev) return;

    // Attempt to find the school name from common field locations
    const foundSchool = ev.extendedProps?.schoolName || ev.extendedProps?.client || ev.schoolName || ev.client || ev.location || '';

    setFormData(prev => ({
      ...prev,
      schoolName: foundSchool,
      schoolId: ev.extendedProps?.schoolId || '',
      programName: ev.title || '',
    }));
  };

  const handleAddMaterial = (e) => {
    if (e.key === 'Enter' && materialInput.trim()) {
      e.preventDefault();
      setFormData(prev => ({
        ...prev,
        materials: [...prev.materials, materialInput.trim()]
      }));
      setMaterialInput('');
    }
  };

  const handleRemoveMaterial = (index) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index)
    }));
  };

  // Rundown Handlers
  const handleAddRundown = () => {
    setFormData(prev => ({
      ...prev,
      rundown: [...prev.rundown, { start: '', end: '', activity: '' }]
    }));
  };

  const handleRemoveRundown = (index) => {
    setFormData(prev => ({
      ...prev,
      rundown: prev.rundown.filter((_, i) => i !== index)
    }));
  };

  const updateRundown = (index, field, value) => {
    const newRundown = [...formData.rundown];
    newRundown[index][field] = value;
    setFormData({ ...formData, rundown: newRundown });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.schoolName || !formData.programName) {
      return showAlert("Peringatan", "Sekolah dan Nama Program wajib diisi", "warning");
    }

    setLoading(true);
    try {
      await invokeApi('/event_reports', {
        method: 'POST',
        body: {
          id: `REP-${Math.floor(Math.random() * 90000) + 10000}`,
          ...formData,
          author: authorName,
          authorId: currentUser?.uid,
          createdAt: new Date().toISOString()
        }
      });

      // Update Client Last Activity
      await updateClientActivity(formData.schoolName, `Laporan Event: ${formData.programName}`);

      showAlert("Berhasil", "Laporan event telah disimpan dan masuk ke riwayat client.", "success");
      navigate('/clients');
    } catch (err) {
      console.error("Save report error:", err);
      showAlert("Gagal", "Gagal menyimpan laporan: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', paddingBottom: '60px', padding: isMobile ? '12px' : '0' }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '32px', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '24px' : '30px' }} className="font-bold">Laporan After-Event</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <span style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} /> Auditor: {authorName}
            </span>
          </div>
        </div>
        <button onClick={() => navigate(-1)} className="icon-btn" style={{ marginLeft: isMobile ? 'auto' : '0' }}><X size={24} /></button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Basic Info Section */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><FileText size={20} color="var(--primary)" /> Informasi Utama</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '20px', alignItems: 'end' }}>
              <div>
                <label className="text-sm font-bold mb-2 block">Tanggal Event</label>
                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-sm font-bold mb-2 block">Pilih Program Terjadwal (Opsional Sync)</label>
                <select
                  onChange={(e) => handleSelectEvent(e.target.value)}
                  className="input"
                  style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
                >
                  <option value="">-- {searching ? 'Searching events...' : dayEvents.length > 0 ? `Tersedia ${dayEvents.length} Program` : 'Tidak ada jadwal di kalender'} --</option>
                  {dayEvents.map((ev, i) => {
                    const school = ev.extendedProps?.schoolName || ev.extendedProps?.client || ev.schoolName || ev.client || ev.location || 'Unknown School';
                    return <option key={i} value={ev.id}>{ev.title} @ {school}</option>;
                  })}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
              <div>
                <label className="text-sm font-bold mb-2 block">Client Sekolah <span style={{ color: 'red' }}>*</span></label>
                  <select
                    value={formData.schoolName}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      const schoolData = uniqueSchools.find(s => s.name === selectedName);
                      setFormData({ ...formData, schoolName: selectedName, schoolId: schoolData?.id || '' });
                    }}
                    className="input"
                    required
                    style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
                  >
                    <option value="">-- Pilih Sekolah --</option>
                    {uniqueSchools.sort((a,b) => a.name.localeCompare(b.name)).map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                  </select>
              </div>
              <div>
                <label className="text-sm font-bold mb-2 block">Nama Program <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text" required placeholder="Nama program yang terlaksana..."
                  value={formData.programName} onChange={(e) => setFormData({ ...formData, programName: e.target.value })}
                  style={{ backgroundColor: 'var(--bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Deliverables Section */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><BookOpen size={20} color="var(--primary)" /> Materi yang Disampaikan</h3>
          <div>
            <input
              type="text"
              value={materialInput}
              onChange={(e) => setMaterialInput(e.target.value)}
              onKeyDown={handleAddMaterial}
              placeholder="Ketik Materi (Tekan Enter untuk menambah)"
              className="input"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              {formData.materials.map((m, i) => (
                <span key={i} style={{
                  backgroundColor: '#F0F2F5', color: 'var(--text-primary)',
                  padding: '6px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border)'
                }}>
                  {m}
                  <X size={14} onClick={() => handleRemoveMaterial(i)} style={{ cursor: 'pointer', color: '#FF5252' }} />
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Rundown Refactor Section */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }} className="text-lg font-bold flex items-center gap-2"><Clock size={20} color="var(--primary)" /> Realisasi Rundown</h3>
            <button type="button" onClick={handleAddRundown} className="btn btn-outline" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px' }}>
              <Plus size={16} /> Tambah Baris
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!isMobile && (
              <div style={{ display: 'grid', gridTemplateColumns: '120px 120px 1fr 50px', gap: '16px', padding: '0 12px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 700, textTransform: 'uppercase' }}>
                <span>Mulai</span>
                <span>Selesai</span>
                <span>Keterangan Aktivitas</span>
                <span></span>
              </div>
            )}

            {formData.rundown.map((row, i) => (
              <div key={i} style={{ 
                display: isMobile ? 'flex' : 'grid', 
                flexDirection: 'column',
                gridTemplateColumns: '120px 120px 1fr 50px', 
                gap: '12px', 
                alignItems: isMobile ? 'stretch' : 'start',
                backgroundColor: isMobile ? '#F8F9FB' : 'transparent',
                padding: isMobile ? '16px' : '0',
                borderRadius: isMobile ? '12px' : '0',
                border: isMobile ? '1px solid var(--border)' : 'none'
              }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    {isMobile && <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>MULAI</label>}
                    <input type="time" value={row.start} onChange={(e) => updateRundown(i, 'start', e.target.value)} className="input" style={{ padding: '10px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    {isMobile && <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>SELESAI</label>}
                    <input type="time" value={row.end} onChange={(e) => updateRundown(i, 'end', e.target.value)} className="input" style={{ padding: '10px' }} />
                  </div>
                </div>
                <div>
                  {isMobile && <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>AKTIVITAS</label>}
                  <input type="text" value={row.activity} onChange={(e) => updateRundown(i, 'activity', e.target.value)} placeholder="e.g. Pembukaan & Ice Breaking" className="input" style={{ padding: '10px' }} />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveRundown(i)}
                  disabled={formData.rundown.length === 1}
                  style={{ 
                    height: isMobile ? '40px' : '42px', 
                    width: isMobile ? '100%' : '42px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: '#FF5252', 
                    backgroundColor: '#FFE5E5', 
                    border: 'none', 
                    borderRadius: '10px', 
                    cursor: 'pointer',
                    marginTop: isMobile ? '4px' : '0'
                  }}
                >
                  <Trash2 size={18} /> {isMobile && <span style={{ marginLeft: '8px', fontWeight: 600 }}>Hapus Baris</span>}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Observation Section */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><ClipboardCheck size={20} color="var(--primary)" /> Observasi & Fakta Lapangan</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label className="text-sm font-bold mb-2 block">Fakta Menarik / Kendala yang Terjadi</label>
              <textarea
                rows={4}
                value={formData.facts}
                onChange={(e) => setFormData({ ...formData, facts: e.target.value })}
                placeholder="Ceritakan kejadian di lapangan secara detail..."
                className="input"
                style={{ resize: 'none' }}
              />
            </div>
            <div>
              <label className="text-sm font-bold mb-2 block">Feedback Singkat dari Sekolah (Jika ada)</label>
              <textarea
                rows={3}
                value={formData.feedback}
                onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                placeholder="Apa kata PIC dan Peserta tentang event hari ini?"
                className="input"
                style={{ resize: 'none' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '16px' }}>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-outline" style={{ flex: 1, padding: isMobile ? '12px' : '16px' }}>Batal</button>
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2, padding: isMobile ? '12px' : '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <Save size={20} /> {loading ? 'Menyimpan...' : 'Simpan Laporan'}
          </button>
        </div>

      </form>
    </div>
  );
};

export default ReviewReport;
