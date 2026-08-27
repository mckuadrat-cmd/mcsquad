import React, { createContext, useContext, useState } from 'react';
import Popup from '../components/common/Popup';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [popupConfig, setPopupConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {},
    onClose: () => {}
  });

  const [toastConfig, setToastConfig] = useState({
    isOpen: false,
    message: '',
    type: 'success'
  });

  const showAlert = (title, message, type = 'info') => {
    if (type === 'error' || type === 'warning') {
      setPopupConfig({
        isOpen: true,
        title,
        message,
        type,
        onConfirm: () => {},
      });
    } else {
      showToast(message, type === 'success' ? 'success' : 'info');
    }
  };

  const showConfirm = (title, message, onConfirm, type = 'confirm') => {
    setPopupConfig({
      isOpen: true,
      title,
      message,
      type,
      onConfirm
    });
  };

  const closePopup = () => {
    setPopupConfig(prev => ({ ...prev, isOpen: false }));
  };

  const showToast = (message, type = 'success') => {
    setToastConfig({
      isOpen: true,
      message,
      type
    });
    
    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToastConfig(prev => {
        if (prev.message === message) {
          return { ...prev, isOpen: false };
        }
        return prev;
      });
    }, 4000);
  };

  return (
    <NotificationContext.Provider value={{ showAlert, showConfirm, showToast }}>
      {children}
      <Popup 
        {...popupConfig} 
        onClose={closePopup}
      />
      {toastConfig.isOpen && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 10000,
          backgroundColor: toastConfig.type === 'error' ? '#FF5252' : toastConfig.type === 'info' ? 'var(--primary)' : '#2ED47A',
          color: 'white', padding: '12px 24px', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontWeight: 600,
          transition: 'all 0.3s ease'
        }}>
          {toastConfig.message}
        </div>
      )}
    </NotificationContext.Provider>
  );
};
