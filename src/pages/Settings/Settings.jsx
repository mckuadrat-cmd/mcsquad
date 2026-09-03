import React, { useState, useEffect } from 'react';
import { User, Building, Users, Bell, Shield, Save, Camera, Mail, Lock, Eye, EyeOff, FileText, Plus, Trash2, Edit2, X, Phone, CheckCircle2 } from 'lucide-react';
import { supabase, invokeApi } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

const Settings = () => {
  const { currentUser, userProfile, setUserProfile, userRole } = useAuth();
  const { showAlert, showConfirm, showToast } = useNotification();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('settingsTab') || 'profile';
  });

  useEffect(() => {
    localStorage.setItem('settingsTab', activeTab);
  }, [activeTab]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Profile State ---
  const [profileData, setProfileData] = useState({
    name: '', nickname: '', email: '', division: '', photo_url: '', whatsapp: '', status: 'Aktif'
  });

  // --- Password State ---
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- Business State ---
  const [businessData, setBusinessData] = useState({
    name: 'MCKuadrat', slogan: 'Pusat Pelatihan & Bimbingan Belajar Tingkat Nasional',
    address: 'Jl. Jendral Sudirman No. 45, Jakarta Selatan 12190', phone: '(021) 555-0198', email: 'info@mckuadrat.com',
    website: 'www.mckuadrat.com', bankAccounts: [{ bankName: '', accountNo: '', accountName: '' }],
    kopSuratUrl: '', capUrl: '', direkturName: '', direkturTtdUrl: '', financeName: '', financeTtdUrl: ''
  });

  // --- Team State ---
  const [team, setTeam] = useState([]);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', email: '', role: 'staff', division: 'Consulting', status: 'Aktif', nickname: '', whatsapp: '' });

  useEffect(() => {
    if (userProfile || currentUser) {
      setProfileData({
        name: userProfile?.name || currentUser?.displayName || '',
        nickname: userProfile?.nickname || '',
        email: userProfile?.email || currentUser?.email || '',
        division: userProfile?.division || '',
        photo_url: userProfile?.photo_url || currentUser?.photoURL || '',
        whatsapp: userProfile?.phone || userProfile?.whatsapp || '',
        status: userProfile?.status || 'Aktif'
      });
    }
  }, [userProfile, currentUser]);

  useEffect(() => {
    if (activeTab === 'team' && (userRole === 'owner' || userRole === 'admin')) {
      const fetchTeam = async () => {
        try {
          const { data } = await invokeApi('/profiles');
          setTeam(data || []);
        } catch (e) {
          console.error("Error fetching team", e);
        }
      };
      fetchTeam();
    }
  }, [activeTab, userRole]);

  useEffect(() => {
    const fetchBusinessSettings = async () => {
      try {
        const { data } = await invokeApi('/settings?id=eq.business&single=true');
        if (data && data.value) {
          const val = data.value;
          if (!val.bankAccounts) val.bankAccounts = [{ bankName: '', accountNo: '', accountName: '' }];
          setBusinessData(prev => ({ ...prev, ...val }));
        }
      } catch (e) {
        console.error("Error fetching business settings", e);
      }
    };
    fetchBusinessSettings();
  }, []);

  const tabs = [
    { id: 'profile', label: 'Profil Saya', icon: <User size={18} /> },
    { id: 'business', label: 'Profil Instansi', icon: <Building size={18} />, hidden: userRole !== 'owner' && userRole !== 'admin' },
    { id: 'team', label: 'Tim & Akses', icon: <Users size={18} />, hidden: userRole !== 'owner' && userRole !== 'admin' },
    { id: 'security', label: 'Keamanan Data', icon: <Shield size={18} />, hidden: userRole !== 'owner' && userRole !== 'admin' },
  ];

  const triggerStatus = (msg, type = 'success') => {
    if (type === 'error' || type === 'warning') {
      const title = type === 'error' ? 'Gagal' : 'Peringatan';
      const alertType = type === 'error' ? 'error' : 'warning';
      showAlert(title, msg, alertType);
    } else {
      showToast(msg, type);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    if (file.size > 2 * 1024 * 1024) {
      triggerStatus('File terlalu besar! Maksimal 2MB.', 'error');
      return;
    }

    setUploading(true);
    triggerStatus('Sedang mengunggah foto profil...', 'info');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.uid}_${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('profiles')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(fileName);

      setProfileData(prev => ({ ...prev, photo_url: publicUrl }));
      triggerStatus('Foto profil terunggah! Ingat untuk klik Update Profil di bawah untuk menyimpan.', 'success');
    } catch (err) {
      console.error("Storage Error:", err);
      triggerStatus(`Gagal upload: ${err.message}`, 'error');
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const handleBusinessImageUpload = async (file, field) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      triggerStatus('File terlalu besar! Maksimal 2MB.', 'error');
      return;
    }
    setUploading(true);
    triggerStatus('Sedang mengunggah gambar...', 'info');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${field}_${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('settings')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('settings')
        .getPublicUrl(fileName);

      setBusinessData({ ...businessData, [field]: publicUrl });
      triggerStatus('Gambar berhasil diunggah!', 'success');
    } catch (err) {
      console.error(err);
      triggerStatus(`Gagal upload: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    try {
      await invokeApi(`/profiles?id=eq.${currentUser.uid}`, {
        method: 'PUT',
        body: {
          name: profileData.name,
          nickname: profileData.nickname,
          division: profileData.division,
          photo_url: profileData.photo_url,
          phone: profileData.whatsapp
        }
      });

      setUserProfile(prev => ({
        ...prev,
        name: profileData.name,
        nickname: profileData.nickname,
        division: profileData.division,
        photo_url: profileData.photo_url,
        phone: profileData.whatsapp
      }));
      triggerStatus('Profil berhasil diperbarui!');
    } catch (e) {
      console.error(e);
      triggerStatus('Gagal menyimpan profil.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      triggerStatus('Konfirmasi password tidak cocok!', 'error');
      return;
    }
    if (newPassword.length < 6) {
      triggerStatus('Password minimal 6 karakter!', 'error');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      triggerStatus('Password berhasil diganti!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      triggerStatus('Gagal ganti password. Mohon re-login.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBusiness = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await invokeApi('/settings', {
        method: 'PUT',
        body: { id: 'business', value: businessData, updatedAt: new Date().toISOString() }
      });
      triggerStatus('Profil bisnis berhasil disimpan!');
    } catch (e) {
      console.error(e);
      triggerStatus('Gagal menyimpan profil bisnis.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTeam = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newTeam.email,
        password: 'mckuadrat',
        options: {
          data: {
            name: newTeam.name,
            role: newTeam.role,
            division: newTeam.division
          }
        }
      });

      if (error) throw error;

      const newUser = data.user;

      // Force upsert the profile to ensure the role, name, and division are saved correctly
      // (bypassing any database trigger lag or default values)
      try {
        await invokeApi('/profiles', {
          method: 'PUT',
          body: {
            id: newUser.id,
            name: newTeam.name,
            nickname: newTeam.nickname || '',
            phone: newTeam.whatsapp || '',
            role: newTeam.role,
            division: newTeam.division,
            email: newTeam.email,
            status: 'Aktif'
          }
        });
      } catch (profileError) {
        console.error("Failed to upsert user profile:", profileError);
      }

      const teamItem = {
        id: newUser.id,
        name: newTeam.name,
        email: newTeam.email,
        role: newTeam.role,
        division: newTeam.division,
        status: 'Aktif',
        createdAt: new Date()
      };

      setTeam([...team, teamItem]);
      setIsAddTeamOpen(false);
      triggerStatus('Anggota tim berhasil diundang!');
      setNewTeam({ name: '', email: '', role: 'staff', division: 'Consulting', status: 'Aktif', nickname: '', whatsapp: '' });
    } catch (e) {
      console.error(e);
      triggerStatus('Gagal menambah tim: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = (id, memberName) => {
    showConfirm(
      "Hapus Akses Tim?",
      `Apakah Anda yakin ingin menghapus hak akses untuk ${memberName}? User ini tidak akan bisa login lagi ke sistem.`,
      async () => {
        try {
          await invokeApi(`/profiles?id=eq.${id}`, { method: 'DELETE' });
          setTeam(team.filter(t => t.id !== id));
          triggerStatus('Anggota tim dihapus dari sistem.');
        } catch (error) {
          triggerStatus('Gagal menghapus: ' + error.message, 'error');
        }
      }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>



      <div style={{ marginBottom: isMobile ? '16px' : '24px' }}>
        <h1 style={{ fontSize: isMobile ? '24px' : '30px', fontWeight: 700, margin: '0 0 4px' }}>System Settings</h1>
        {!isMobile && <p className="text-secondary text-sm">Kelola preferensi akun dan profil tim MCKuadrat.</p>}
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, gap: '24px' }}>

        <div style={{ width: isMobile ? '100%' : '280px', flexShrink: 0 }}>
          <div className="card" style={{ padding: isMobile ? '8px' : '16px 12px', overflowX: isMobile ? 'auto' : 'visible', backgroundColor: isMobile ? 'transparent' : 'var(--surface)', border: isMobile ? 'none' : '1px solid var(--border)', boxShadow: isMobile ? 'none' : '0 4px 12px rgba(0,0,0,0.02)' }}>
            {!isMobile && <p className="text-sm font-bold text-secondary mb-3 px-3 uppercase tracking-wider">Kategori Konfigurasi</p>}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? '8px' : '4px', minWidth: isMobile ? 'max-content' : 'auto', padding: isMobile ? '4px' : '0' }}>
              {tabs.filter(t => !t.hidden).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: isMobile ? '10px 16px' : '12px 16px',
                    borderRadius: '12px', width: isMobile ? 'auto' : '100%', textAlign: 'left',
                    backgroundColor: activeTab === tab.id ? 'var(--primary)' : (isMobile ? 'white' : 'transparent'),
                    color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                    fontWeight: 600,
                    transition: 'all 0.2s', cursor: 'pointer', border: isMobile ? '1px solid var(--border)' : 'none',
                    fontSize: isMobile ? '14px' : '15px',
                    boxShadow: (isMobile && activeTab === tab.id) ? '0 4px 12px rgba(70, 128, 255, 0.2)' : 'none'
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px' : '32px' }}>

          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
              <form onSubmit={handleSaveProfile}>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>Profil Saya</h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
                  <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'var(--primary-soft)', padding: '4px' }}>
                    {uploading ? (
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: '14px', fontWeight: 'bold' }}>
                        ...
                      </div>
                    ) : profileData.photo_url ? (
                      <img src={profileData.photo_url} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: '32px', fontWeight: 'bold' }}>
                        {(profileData.name?.charAt(0) || 'U').toUpperCase()}
                      </div>
                    )}

                    <input type="file" id="photo-upload" accept="image/png, image/jpeg" style={{ display: 'none' }} onChange={handlePhotoUpload} disabled={uploading} />
                    <label htmlFor="photo-upload" style={{ position: 'absolute', bottom: '0', right: '0', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', cursor: uploading ? 'not-allowed' : 'pointer' }}>
                      <Camera size={14} />
                    </label>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{profileData.name}</h3>
                      <span style={{ fontSize: '14px', backgroundColor: '#E8F5E9', color: '#2ED47A', padding: '2px 8px', borderRadius: '100px', fontWeight: 600 }}>{profileData.status}</span>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>Level Akses: <strong style={{ textTransform: 'capitalize' }}>{userRole}</strong></p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>ID Tim</label>
                    <input type="text" value={currentUser?.uid} disabled style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#E9ECEF', color: 'var(--text-secondary)', fontSize: '14px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Nama Lengkap</label>
                    <div style={{ position: 'relative' }}>
                      <User size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input type="text" value={profileData.name} onChange={(e) => setProfileData({ ...profileData, name: e.target.value })} style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Alamat Email</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input type="email" value={profileData.email} disabled style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#E9ECEF', color: 'var(--text-secondary)' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Nama Panggilan (Nickname)</label>
                    <div style={{ position: 'relative' }}>
                      <User size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input type="text" value={profileData.nickname} onChange={(e) => setProfileData({ ...profileData, nickname: e.target.value })} placeholder="Nama Panggilan" style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>No WhatsApp</label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input type="text" value={profileData.whatsapp} onChange={(e) => setProfileData({ ...profileData, whatsapp: e.target.value })} placeholder="6281xxxxxxxx" style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Role</label>
                    <input type="text" value={userRole} disabled style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#E9ECEF', color: 'var(--text-secondary)', textTransform: 'capitalize' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Divisi / Jabatan</label>
                    <input type="text" value={profileData.division} onChange={(e) => setProfileData({ ...profileData, division: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '8px' }}>
                    <Save size={16} style={{ marginRight: '8px' }} /> {saving ? 'Menyimpan...' : 'Update Profil'}
                  </button>
                </div>
              </form>

              <form onSubmit={handleChangePassword} style={{ borderTop: '1px solid var(--border)', paddingTop: '40px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Ganti Password</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Pastikan menggunakan password yang kuat untuk keamanan akun.</p>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Password Baru</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Lock size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        style={{ width: '100%', padding: '12px 42px 12px 42px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        aria-label={showNewPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-secondary)',
                          borderRadius: '4px'
                        }}
                        title={showNewPassword ? 'Sembunyikan password' : 'Lihat password'}
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Konfirmasi Password Baru</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Lock size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        style={{ width: '100%', padding: '12px 42px 12px 42px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-secondary)',
                          borderRadius: '4px'
                        }}
                        title={showConfirmPassword ? 'Sembunyikan password' : 'Lihat password'}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '8px', backgroundColor: '#7A849C', border: 'none' }}>
                    <Shield size={16} style={{ marginRight: '8px' }} /> {saving ? 'Memproses...' : 'Ubah Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'business' && (userRole === 'owner' || userRole === 'admin') && (
            <form onSubmit={handleSaveBusiness}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Profil Bisnis / Instansi</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                Data profil & rekening instansi resmi MCKuadrat yang digunakan di seluruh sistem.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Nama Bisnis Resmi</label>
                  <input type="text" value={businessData.name} onChange={e => setBusinessData({ ...businessData, name: e.target.value })} required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Slogan / Tagline Instansi</label>
                  <input type="text" value={businessData.slogan} onChange={e => setBusinessData({ ...businessData, slogan: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Alamat Kantor Pusat</label>
                  <textarea rows={3} value={businessData.address} onChange={e => setBusinessData({ ...businessData, address: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none', resize: 'none' }}></textarea>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Telepon Resmi</label>
                    <input type="text" value={businessData.phone} onChange={e => setBusinessData({ ...businessData, phone: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Email Instansi</label>
                    <input type="email" value={businessData.email} onChange={e => setBusinessData({ ...businessData, email: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Website Resmi</label>
                    <input type="text" value={businessData.website} onChange={e => setBusinessData({ ...businessData, website: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none' }} />
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed var(--border)', marginTop: '8px', paddingTop: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Informasi Rekening Perusahaan</label>
                    <button type="button" onClick={() => setBusinessData({ ...businessData, bankAccounts: [...(businessData.bankAccounts || []), { bankName: '', accountNo: '', accountName: '' }] })} style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--primary-soft)', padding: '6px 12px', borderRadius: '6px' }}><Plus size={14} /> Tambah Rekening</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(businessData.bankAccounts || []).map((acc, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', alignItems: isMobile ? 'stretch' : 'center', borderBottom: isMobile ? '1px solid var(--border)' : 'none', paddingBottom: isMobile ? '12px' : '0' }}>
                        <input type="text" placeholder="Nama Bank (cth: BCA)" value={acc.bankName} onChange={e => { const newAccs = [...businessData.bankAccounts]; newAccs[i].bankName = e.target.value; setBusinessData({ ...businessData, bankAccounts: newAccs }); }} style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none' }} />
                        <input type="text" placeholder="No Rekening" value={acc.accountNo} onChange={e => { const newAccs = [...businessData.bankAccounts]; newAccs[i].accountNo = e.target.value; setBusinessData({ ...businessData, bankAccounts: newAccs }); }} style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none' }} />
                        <input type="text" placeholder="Atas Nama" value={acc.accountName} onChange={e => { const newAccs = [...businessData.bankAccounts]; newAccs[i].accountName = e.target.value; setBusinessData({ ...businessData, bankAccounts: newAccs }); }} style={{ flex: 1.5, padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', outline: 'none' }} />
                        <button type="button" onClick={() => { const newAccs = [...businessData.bankAccounts]; newAccs.splice(i, 1); setBusinessData({ ...businessData, bankAccounts: newAccs }); }} style={{ color: '#FF5252', padding: '8px', textAlign: isMobile ? 'right' : 'center' }}><Trash2 size={16} /> {isMobile && 'Hapus Rekening'}</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '8px' }}>
                  <Save size={16} style={{ marginRight: '8px' }} /> {saving ? 'Menyimpan...' : 'Simpan Master Data'}
                </button>
              </div>
            </form>
          )}



          {activeTab === 'team' && (userRole === 'owner' || userRole === 'admin') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Tim & Hak Akses (Roles)</h2>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>Batasi hak fungsi karyawan pada CRM berdasarkan divisinya.</p>
                </div>
                <button onClick={() => setIsAddTeamOpen(true)} className="btn btn-primary" style={{ padding: '8px 16px', borderRadius: '8px' }}>
                  <Plus size={16} style={{ marginRight: '8px' }} /> Undang Anggota Tim
                </button>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: isMobile ? '600px' : 'auto', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8F9FB', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>USER</th>
                        <th style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>ROLE ACCESS</th>
                        <th style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>STATUS</th>
                        <th style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.map((member, idx) => (
                        <tr key={member.id} style={{ borderBottom: idx === team.length - 1 ? 'none' : '1px solid var(--border)' }}>
                          <td style={{ padding: '16px' }}>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{member.name}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>{member.email}</p>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ backgroundColor: '#E9ECEF', padding: '4px 10px', borderRadius: '6px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{member.role || 'staff'}</span>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: member.status === 'Aktif' || !member.status ? '#2ED47A' : '#7A849C' }}></span>
                              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{member.status || 'Aktif'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right' }}>
                            <button onClick={() => handleDeleteTeam(member.id, member.name)} className="icon-btn" style={{ color: '#FF5252' }}><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (userRole === 'owner' || userRole === 'admin') && (
            <div style={{ textAlign: 'center', margin: '60px 0', color: 'var(--text-secondary)' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Shield size={24} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Keamanan Data</h2>
              <p style={{ fontSize: '14px' }}>Modul pencadangan data otomatis akan tersedia segera.</p>
            </div>
          )}
        </div>
      </div>

      {isAddTeamOpen && (
        <>
          <div onClick={() => setIsAddTeamOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: isMobile ? '100%' : '400px', height: '100vh', backgroundColor: 'var(--surface)', boxShadow: '-8px 0 24px rgba(0,0,0,0.05)', zIndex: 101, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-xl font-semibold">Undang Anggota Tim</h2>
              <button onClick={() => setIsAddTeamOpen(false)} style={{ color: 'var(--text-secondary)' }}><X size={24} /></button>
            </div>
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              <form id="team-form" onSubmit={handleAddTeam} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className="text-sm font-medium mb-2 block">Nama Lengkap</label>
                  <input type="text" value={newTeam.name} onChange={e => setNewTeam({ ...newTeam, name: e.target.value })} required placeholder="John Doe" style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', outline: 'none' }} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Nama Panggilan (Nickname)</label>
                  <input type="text" value={newTeam.nickname} onChange={e => setNewTeam({ ...newTeam, nickname: e.target.value })} placeholder="John" style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', outline: 'none' }} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">No WhatsApp</label>
                  <input type="text" value={newTeam.whatsapp} onChange={e => setNewTeam({ ...newTeam, whatsapp: e.target.value })} placeholder="6281xxxxxxxx" style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', outline: 'none' }} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Alamat Email Karyawan</label>
                  <input type="email" value={newTeam.email} onChange={e => setNewTeam({ ...newTeam, email: e.target.value })} required placeholder="john@mckuadrat.com" style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', outline: 'none' }} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Level Akses</label>
                  <select value={newTeam.role} onChange={e => setNewTeam({ ...newTeam, role: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', outline: 'none' }}>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Divisi (Jabatan)</label>
                  <input type="text" value={newTeam.division} onChange={e => setNewTeam({ ...newTeam, division: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', outline: 'none' }} />
                </div>
              </form>
            </div>
            <div style={{ padding: '24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', backgroundColor: 'var(--surface)' }}>
              <button onClick={() => setIsAddTeamOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
              <button type="submit" form="team-form" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Loading...' : 'Beri Akses'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Settings;
