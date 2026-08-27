import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh', width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', backgroundColor: '#FAFBFC', flexDirection: 'column', gap: '16px', padding: '24px', textAlign: 'center'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF', color: '#1E293B', padding: '24px 32px',
            borderRadius: '16px', maxWidth: '480px', border: '1px solid #E2E8F0',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>Terjadi Kendala Tampilan</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748B', lineHeight: '1.5' }}>
              Aplikasi mengalami kesalahan saat memuat tampilan. Silakan klik tombol di bawah untuk memuat ulang aplikasi.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#4680FF', color: 'white', border: 'none',
                padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer'
              }}
            >
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
