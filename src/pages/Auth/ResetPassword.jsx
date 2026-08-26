import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Lock, Eye, EyeOff } from 'lucide-react';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Memeriksa apakah ada session yang aktif (terbentuk otomatis dari token hash di URL)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsValidSession(false);
        setError('Link reset password tidak valid, telah digunakan, atau kedaluwarsa.');
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError('Password baru dan konfirmasi password tidak cocok.');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password minimal harus terdiri dari 6 karakter.');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setSuccessMsg('Password berhasil diperbarui! Silakan masuk kembali.');
      
      // Logout secara otomatis setelah sukses memperbarui password agar sesi dibersihkan
      await supabase.auth.signOut();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Gagal memperbarui password. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg)', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        backgroundColor: 'var(--surface)',
        padding: '48px',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        width: '100%',
        maxWidth: '420px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/mckuadrat.png"
            alt="MCKUADRAT Logo"
            style={{ height: '30px', width: 'auto', objectFit: 'contain' }}
          />
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginTop: '16px', color: 'var(--text-primary)' }}>Setel Ulang Password</h2>
          <p className="text-secondary mt-2 text-sm">Masukkan password baru untuk akun Anda</p>
        </div>

        {error && (
          <div style={{ backgroundColor: '#FFE5E5', color: '#FF5252', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{error}</div>
        )}
        {successMsg && (
          <div style={{ backgroundColor: '#E5F6EE', color: '#00A650', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{successMsg}</div>
        )}

        {isValidSession && !successMsg ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-primary)' }}>Password Baru</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Password Baru"
                  style={{ width: '100%', paddingLeft: '44px', paddingRight: '44px', border: '1px solid var(--border)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    borderRadius: '4px'
                  }}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-primary)' }}>Konfirmasi Password Baru</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Konfirmasi Password Baru"
                  style={{ width: '100%', paddingLeft: '44px', paddingRight: '44px', border: '1px solid var(--border)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    borderRadius: '4px'
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '12px', padding: '14px', fontSize: '16px' }}
            >
              {loading ? 'Memproses...' : 'Simpan Password Baru'}
            </button>
          </form>
        ) : (
          <button
            onClick={() => navigate('/login')}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Kembali ke Halaman Login
          </button>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
