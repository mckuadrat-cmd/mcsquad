import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (isResetMode) {
      if (!email) {
        setError('Silakan masukkan email Anda.');
        setLoading(false);
        return;
      }
      try {
        await resetPassword(email);
        setSuccessMsg('Link reset password telah dikirim ke email Anda.');
        setIsResetMode(false);
      } catch (err) {
        setError('Gagal mengirim link reset password. Pastikan email terdaftar.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      // Logic for REAL Supabase login connected to AuthContext
      await login(email, password);
      // Wait for Supabase to handshake and dispatch onAuthStateChange event 
      // navigate('/dashboard') might not be strictly needed as ProtectedRoute handles it, but keeps UX smooth.
      navigate('/dashboard');
    } catch (err) {
      setError('Gagal masuk. Periksa email dan password.');
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
          {/* Logo Icon */}
          <img
            src="/mckuadrat.png"
            alt="MCKUADRAT Logo"
            style={{ height: '30px', width: 'auto', objectFit: 'contain' }}
          />
          <p className="text-secondary mt-2 text-sm">Masuk untuk akses sistem</p>
        </div>

        {error && (
          <div style={{ backgroundColor: '#FFE5E5', color: '#FF5252', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{error}</div>
        )}
        {successMsg && (
          <div style={{ backgroundColor: '#E5F6EE', color: '#00A650', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{successMsg}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-primary)' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mckuadrat.com"
                style={{ paddingLeft: '44px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>
          {!isResetMode && (
            <div>
              <div style={{ display: 'flex', border: 'none', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>Password</label>
                <button 
                  type="button" 
                  onClick={() => { setIsResetMode(true); setError(''); setSuccessMsg(''); }} 
                  style={{ 
                    background: 'none', border: 'none', padding: 0, 
                    color: 'var(--primary)', fontSize: '14px', 
                    cursor: 'pointer', fontWeight: 500,
                    textDecoration: 'none'
                  }}
                  onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                  onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                >
                  Lupa Password?
                </button>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required={!isResetMode}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', paddingLeft: '44px', paddingRight: '44px', border: '1px solid var(--border)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
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
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px', padding: '14px', fontSize: '16px' }}
          >
            {loading ? 'Memproses...' : (isResetMode ? 'Kirim Link Reset' : 'Masuk')}
          </button>
          
          {isResetMode && (
            <button
              type="button"
              onClick={() => { setIsResetMode(false); setError(''); setSuccessMsg(''); }}
              style={{ width: '100%', padding: '14px', fontSize: '16px', backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
              className="hover:bg-gray-50 transition-colors"
            >
              Kembali ke Login
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;
