import React, { useState, useEffect, useMemo } from 'react';
import { Search, Calendar as CalIcon, Plus, CheckCircle2, Circle, Clock, User, Filter, Trash2, Send, History as HistoryIcon, ListTodo, AlertCircle, Building2, UserCircle2, Info, X } from 'lucide-react';
import { supabase, parseDates, invokeApi } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAppData } from '../../context/AppDataContext';

const CATEGORIES = [
  "General",
  "Follow-up",
  "Administrasi",
  "Koordinasi",
  "Leads",
  "Project",
  "Reminder"
];

const DailyActivity = () => {
  const { userProfile, currentUser, userRole } = useAuth();
  const { clients, leads, projects, uniqueSchools } = useAppData();
  const [selectedUserId, setSelectedUserId] = useState(currentUser?.uid);
  const [team, setTeam] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    text: '',
    extraInfo: '',
    category: 'General',
    schoolId: '',
    picId: '',
    customCategory: ''
  });

  const [planActivity, setPlanActivity] = useState('');
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch Team for Admin/Owner
  useEffect(() => {
    if (userRole === 'owner' || userRole === 'admin') {
      const fetchTeam = async () => {
        const { data } = await invokeApi('/profiles');
        setTeam(data || []);
      };
      fetchTeam();
    }
  }, [userRole]);

  // Sync Daily Activities (Fetch both current and next day for plans)
  useEffect(() => {
    if (!selectedUserId) return;

    // Get next day string
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const tmrStr = d.toISOString().split('T')[0];

    let dailyChannel;

    const fetchActivities = async () => {
      try {
        const { data } = await invokeApi(`/daily_activities?userId=eq.${selectedUserId}&date=in.(${selectedDate},${tmrStr})&order=createdAt.asc`);
        setActivities(parseDates(data || []));
        setLoading(false);

        // Realtime Subscription
        dailyChannel = supabase.channel(`public:daily_activities:${selectedUserId}`)
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'daily_activities', 
            filter: `userId=eq.${selectedUserId}` 
          }, (payload) => {
            const parsedNew = parseDates(payload.new);
            if (payload.eventType === 'INSERT') {
              if ([selectedDate, tmrStr].includes(parsedNew.date)) {
                setActivities(prev => [...prev, parsedNew]);
              }
            } else if (payload.eventType === 'UPDATE') {
              setActivities(prev => prev.map(item => item.id === parsedNew.id ? parsedNew : item));
            } else if (payload.eventType === 'DELETE') {
              setActivities(prev => prev.filter(item => item.id !== payload.old.id));
            }
          }).subscribe();

      } catch (err) {
        console.error("Error fetching daily activities in DailyActivity.jsx:", err);
        setLoading(false);
      }
    };

    fetchActivities();

    return () => {
      if (dailyChannel) dailyChannel.unsubscribe();
    };
  }, [selectedUserId, selectedDate]);



  // Filter PICs based on selected school
  const picsForSelectedSchool = useMemo(() => {
    if (!formData.schoolId) return [];
    return clients.filter(c => c.schoolId === formData.schoolId);
  }, [clients, formData.schoolId]);

  const handleAddManual = async (e) => {
    e.preventDefault();
    if (!formData.text.trim()) return;

    const finalCategory = showCustomCat ? formData.customCategory : formData.category;
    const selectedPIC = clients.find(c => c.id === formData.picId);

    await invokeApi('/daily_activities', {
      method: 'POST',
      body: {
        userId: currentUser.uid,
        userName: (userProfile?.nickname?.trim() || userProfile?.name) || currentUser.displayName,
        date: selectedDate,
        text: formData.text,
        extraInfo: formData.extraInfo,
        type: 'manual',
        refId: formData.picId || '',
        refType: 'Client',
        category: finalCategory || 'General',
        schoolName: uniqueSchools.find(s => s.id === formData.schoolId)?.name || '',
        schoolId: formData.schoolId || '',
        picName: selectedPIC?.name || '',
        isDone: true,
        createdAt: new Date().toISOString()
      }
    });

    // Update client last activity if PIC is selected
    if (formData.picId) {
      await invokeApi(`/clients?id=eq.${formData.picId}`, {
        method: 'PUT',
        body: {
          lastActivityAt: new Date().toISOString(),
          lastActivityDesc: formData.text
        }
      });
    }

    setFormData({ text: '', extraInfo: '', category: 'General', schoolId: '', picId: '', customCategory: '' });
    setShowCustomCat(false);
    setShowAddModal(false);
  };

  const handleAddPlan = async (e) => {
    e.preventDefault();
    if (!planActivity.trim()) return;

    const todayStr = new Date().toISOString().split('T')[0];
    let targetDate = selectedDate;
    if (selectedDate === todayStr) {
      const tmr = new Date();
      tmr.setDate(tmr.getDate() + 1);
      targetDate = tmr.toISOString().split('T')[0];
    }

    await invokeApi('/daily_activities', {
      method: 'POST',
      body: {
        userId: currentUser.uid,
        userName: (userProfile?.nickname?.trim() || userProfile?.name) || currentUser.displayName,
        date: targetDate,
        text: planActivity,
        type: 'plan',
        category: 'Reminder',
        isDone: false,
        createdAt: new Date().toISOString()
      }
    });
    setPlanActivity('');
  };

  const deleteActivity = async (id) => {
    if (window.confirm('Hapus aktivitas ini?')) {
      await invokeApi(`/daily_activities?id=eq.${id}`, { method: 'DELETE' });
    }
  };

  const toggleDone = async (id, currentStatus) => {
    await invokeApi(`/daily_activities?id=eq.${id}`, { method: 'PUT', body: { isDone: !currentStatus } });
  };

  const doneActivities = activities.filter(a => a.type !== 'plan' && a.date === selectedDate);

  // Plans that were scheduled FOR today
  const todayPlans = activities.filter(a => a.type === 'plan' && a.date === selectedDate);

  // Plans scheduled FOR tomorrow
  const tomorrowDate = (() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  const tomorrowPlans = activities.filter(a => a.type === 'plan' && a.date === tomorrowDate);

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'Administrasi': return { bg: '#E5F6EB', text: '#2ED47A' };
      case 'Leads': return { bg: '#E5EFFF', text: '#4680FF' };
      case 'Project': return { bg: '#F1F1FD', text: '#7C3AED' };
      case 'Follow-up': return { bg: '#FFF4E5', text: '#FFB020' };
      case 'Reminder': return { bg: '#FFF1F1', text: '#FF5252' };
      default: return { bg: '#F4F6F9', text: '#7A849C' };
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '32px', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '24px' : '30px' }} className="font-semibold mb-1">Daily Activity</h1>
          <p className="text-secondary text-sm">Lacak produktivitas harian dan rencana kerja tim MCKuadrat.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', width: isMobile ? '100%' : 'auto' }}>
          {(userRole === 'owner' || userRole === 'admin') && (
            <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{ appearance: 'none', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0 40px 0 16px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', height: '42px', width: isMobile ? '100%' : '220px' }}
              >
                <option value={currentUser.uid}>Aktivitas Saya</option>
                {team.filter(t => t.id !== currentUser.uid).map(member => (
                  <option key={member.id} value={member.id}>{member.name} ({member.division || 'Staff'})</option>
                ))}
              </select>
              <User size={16} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--surface)', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border)', height: '42px', boxSizing: 'border-box', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CalIcon size={18} color="var(--primary)" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ border: 'none', backgroundColor: 'transparent', outline: 'none', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', padding: 0, height: 'auto' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '32px' }}>

        {/* Actual Activities Done */}
        <div className="card" style={{ flex: 1.2, padding: isMobile ? '20px' : '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
                <HistoryIcon size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Aktivitas yang Dilakukan</h2>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Log otomatis & input manual pekerjaan hari ini.</p>
              </div>
            </div>
            {(selectedUserId === currentUser.uid || userRole === 'owner') && (
              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary"
                style={{ height: '40px', padding: '0 16px', borderRadius: '10px', fontSize: '14px' }}
              >
                <Plus size={16} style={{ marginRight: '6px' }} />
                Tambah Aktivitas
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {doneActivities.length > 0 ? doneActivities.map((activity) => {
              const catStyle = getCategoryColor(activity.category);

              return (
                <div key={activity.id} style={{ display: 'flex', gap: isMobile ? '12px' : '16px', padding: isMobile ? '16px' : '24px', backgroundColor: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', transition: 'all 0.2s', position: 'relative' }} className="hover:shadow-md">
                  <div style={{ marginTop: '2px' }}>
                    {activity.type === 'manual' ? <CheckCircle2 size={18} color="var(--primary)" /> : <Clock size={18} color="#FFB020" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.5' }}>{activity.text}</p>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {activity.createdAt?.toDate ? new Date(activity.createdAt.toDate()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    {activity.extraInfo && (
                      <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Info size={12} /> {activity.extraInfo}
                      </p>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', backgroundColor: catStyle.bg, color: catStyle.text, padding: '2px 8px', borderRadius: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                        {activity.category || 'General'}
                      </span>
                      {activity.schoolName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: 'var(--text-secondary)', backgroundColor: '#F4F6F9', padding: '2px 8px', borderRadius: '6px' }}>
                          <Building2 size={10} /> {activity.schoolName}
                        </div>
                      )}
                      {activity.picName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: 'var(--text-secondary)', backgroundColor: '#F4F6F9', padding: '2px 8px', borderRadius: '6px' }}>
                          <UserCircle2 size={10} /> {activity.picName}
                        </div>
                      )}
                    </div>
                  </div>
                  {(selectedUserId === currentUser.uid || userRole === 'owner') && activity.type === 'manual' && (
                    <button onClick={() => deleteActivity(activity.id)} style={{ color: '#FF5252', padding: '4px', opacity: 0.5 }} className="hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            }) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                <p>Belum ada log aktivitas untuk tanggal ini.</p>
              </div>
            )}
          </div>
        </div>

        {/* Future Plans Section */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* Section 1: Today's Agenda (Plans from Yesterday) */}
          <div className="card" style={{ padding: isMobile ? '20px' : '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: '#E8F5EB', color: '#2ED47A', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Agenda Hari Ini</h2>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Rencana yang disiapkan sebelumnya.</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {todayPlans.length > 0 ? todayPlans.map((plan) => (
                <div key={plan.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', backgroundColor: plan.isDone ? '#F4F6F9' : 'rgb(248, 250, 252)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => (selectedUserId === currentUser.uid || userRole === 'owner') && toggleDone(plan.id, plan.isDone)}
                    style={{ border: 'none', backgroundColor: 'transparent', cursor: (selectedUserId === currentUser.uid || userRole === 'owner') ? 'pointer' : 'default' }}
                  >
                    {plan.isDone ? <CheckCircle2 size={20} color="#2ED47A" /> : <Circle size={20} color="var(--border)" />}
                  </button>
                  <p style={{ flex: 1, margin: 0, fontSize: '14px', color: plan.isDone ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: plan.isDone ? 'line-through' : 'none' }}>
                    {plan.text}
                  </p>
                  {(selectedUserId === currentUser.uid || userRole === 'owner') && (
                    <button onClick={() => deleteActivity(plan.id)} style={{ color: '#FF5252', opacity: 0.5 }} className="hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', border: '2px dashed var(--border)', borderRadius: '16px' }}>
                  <p style={{ margin: 0, fontSize: '14px' }}>Tidak ada agenda khusus hari ini.</p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Planning for Tomorrow */}
          <div className="card" style={{ padding: isMobile ? '20px' : '32px', border: '1px solid var(--primary-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
                <ListTodo size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Rencana Besok</h2>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Persiapan untuk hari berikutnya.</p>
              </div>
            </div>

            {(selectedUserId === currentUser.uid || userRole === 'owner') && (
              <form onSubmit={handleAddPlan} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <input
                  type="text"
                  placeholder="Apa rencana Anda untuk besok?"
                  value={planActivity}
                  onChange={(e) => setPlanActivity(e.target.value)}
                  style={{ flex: 1, backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', padding: '12px 16px' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0 16px', height: '48px' }}>
                  <Send size={18} />
                </button>
              </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tomorrowPlans.length > 0 ? tomorrowPlans.map((plan) => (
                <div key={plan.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', opacity: 0.3 }}></div>
                  <p style={{ flex: 1, margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {plan.text}
                  </p>
                  {(selectedUserId === currentUser.uid || userRole === 'owner') && (
                    <button onClick={() => deleteActivity(plan.id)} style={{ color: '#FF5252', opacity: 0.5 }} className="hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )) : (
                <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>Belum ada rencana besok.</p>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: '24px', backgroundColor: 'var(--primary)', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertCircle size={18} color="white" />
              <h4 style={{ margin: 0, fontSize: '15px', color: 'white' }}>Tips Produktivitas</h4>
            </div>
            <p style={{ margin: 0, fontSize: '14px', opacity: 0.9, lineHeight: '1.5' }}>
              "Fokus pada 3 tugas utama setiap hari untuk hasil maksimal. Catat rencana Anda malam sebelumnya agar besok tinggal eksekusi."
            </p>
          </div>
        </div>
      </div>

      {/* Add Activity Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: isMobile ? '16px' : '0' }}>
          <div className="card" style={{ width: isMobile ? '100%' : '600px', padding: isMobile ? '24px' : '40px', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxHeight: isMobile ? '90vh' : 'auto', overflowY: isMobile ? 'auto' : 'visible' }}>
            <button onClick={() => setShowAddModal(false)} style={{ position: 'absolute', right: '24px', top: '24px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={24} />
            </button>

            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Tambah Aktivitas</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Catat apa yang telah Anda selesaikan hari ini.</p>
            </div>

            <form onSubmit={handleAddManual} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <label className="text-sm font-bold text-secondary mb-2 block uppercase tracking-wider">Apa yang anda kerjakan?</label>
                <input
                  type="text"
                  placeholder="e.g. Follow up penawaran SPH..."
                  required
                  autoFocus
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', fontSize: '15px' }}
                />
              </div>

              <div>
                <label className="text-sm font-bold text-secondary mb-2 block uppercase tracking-wider">Informasi Tambahan</label>
                <textarea
                  placeholder="Tuliskan detail pekerjaan (opsional)..."
                  rows={3}
                  value={formData.extraInfo}
                  onChange={(e) => setFormData({ ...formData, extraInfo: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', fontSize: '15px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.8fr 1.1fr 1.1fr', gap: '16px' }}>
                <div>
                  <label className="text-sm font-bold text-secondary mb-2 block uppercase tracking-wider">Kategori</label>
                  {!showCustomCat ? (
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        if (e.target.value === 'Add new') {
                          setShowCustomCat(true);
                        } else {
                          setFormData({ ...formData, category: e.target.value });
                        }
                      }}
                      style={{ width: '100%', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', fontSize: '15px' }}
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      <option value="Add new">+ Tambah Baru</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        autoFocus
                        placeholder="Kategori baru..."
                        value={formData.customCategory}
                        onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                        style={{ flex: 1, backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', fontSize: '15px' }}
                      />
                      <button onClick={() => setShowCustomCat(false)} type="button" style={{ border: 'none', backgroundColor: '#FEE2E2', color: '#EF4444', borderRadius: '12px', padding: '0 16px' }}>✕</button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-bold text-secondary mb-2 block uppercase tracking-wider">Sekolah (Client)</label>
                  <select
                    value={formData.schoolId}
                    onChange={(e) => setFormData({ ...formData, schoolId: e.target.value, picId: '' })}
                    style={{ width: '100%', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', fontSize: '15px' }}
                  >
                    <option value="">-- Pilih Sekolah --</option>
                    {uniqueSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {formData.schoolId && (
                  <div>
                    <label className="text-sm font-bold text-secondary mb-2 block uppercase tracking-wider">PIC Sekolah</label>
                    <select
                      value={formData.picId}
                      onChange={(e) => setFormData({ ...formData, picId: e.target.value })}
                      style={{ width: '100%', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', fontSize: '15px' }}
                    >
                      <option value="">-- Pilih PIC --</option>
                      {picsForSelectedSchool.map(p => <option key={p.id} value={p.id}>{p.salutation} {p.nickname}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn" style={{ flex: 1, height: '52px', backgroundColor: '#F1F5F9', color: 'var(--text-primary)' }}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, height: '52px' }}>
                  Simpan Aktivitas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyActivity;
