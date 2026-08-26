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

  const showAlert = (title, message, type = 'info') => {
    setPopupConfig({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => {},
    });
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

  return (
    <NotificationContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <Popup 
        {...popupConfig} 
        onClose={closePopup}
      />
    </NotificationContext.Provider>
  );
};
