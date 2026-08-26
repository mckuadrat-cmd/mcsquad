import React from 'react';
import { X, AlertTriangle, CheckCircle, Info, HelpCircle } from 'lucide-react';

const Popup = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Peringatan", 
  message = "", 
  type = "warning", // 'warning', 'success', 'info', 'confirm'
  confirmText = "Ya, Lanjutkan",
  cancelText = "Batal"
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch(type) {
      case 'success': return { icon: <CheckCircle color="#2ED47A" size={48} />, color: '#2ED47A' };
      case 'info': return { icon: <Info color="#4680FF" size={48} />, color: '#4680FF' };
      case 'confirm': return { icon: <HelpCircle color="#FFB020" size={48} />, color: '#FFB020' };
      default: return { icon: <AlertTriangle color="#FF5252" size={48} />, color: '#FF5252' };
    }
  };

  const currentType = getTypeStyles();

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
      
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '32px',
        width: '400px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        textAlign: 'center',
        position: 'relative',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '20px', right: '20px', color: '#7A849C', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
          {currentType.icon}
        </div>

        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
          {title}
        </h3>
        
        <p style={{ fontSize: '15px', color: '#7A849C', lineHeight: '1.6', marginBottom: '32px' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          {type === 'confirm' || type === 'warning' ? (
            <>
              <button 
                onClick={onClose}
                className="btn btn-outline"
                style={{ flex: 1, borderRadius: '12px', padding: '12px' }}
              >
                {cancelText}
              </button>
              <button 
                onClick={() => { onConfirm(); onClose(); }}
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: '12px', padding: '12px', backgroundColor: currentType.color, borderColor: currentType.color, justifyContent: 'center' }}
              >
                {confirmText}
              </button>
            </>
          ) : (
            <button 
              onClick={onClose}
              className="btn btn-primary"
              style={{ width: '100%', borderRadius: '12px', padding: '12px', backgroundColor: currentType.color, borderColor: currentType.color, justifyContent: 'center' }}
            >
              Oke, Mengerti
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Popup;
