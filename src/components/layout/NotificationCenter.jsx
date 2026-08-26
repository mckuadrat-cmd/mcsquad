import React, { useState, useEffect, useRef } from 'react';
import { Bell, CreditCard, Calendar, UserPlus, FileText, CheckCircle, Clock, X } from 'lucide-react';
import { supabase, parseDates, invokeApi } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const NotificationCenter = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const userName = (userProfile?.nickname?.trim() || userProfile?.name) || currentUser?.displayName || 'Staff';
  
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    let persistentChannel;

    // 1. Fetch Dynamic notifications (computed from calendar events)
    const fetchDynamicNotifs = async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: calEvents, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('start', todayStr)
        .eq('extendedProps->>pic', userName);

      if (error) {
        console.error("Error fetching dynamic events:", error);
        return [];
      }
      
      const dynamicItems = (calEvents || []).map(d => {
        const isPayment = d.title?.includes('[PAYMENT]');
        return {
          id: d.id,
          title: isPayment ? 'Tagihan Hari Ini' : 'Event Hari Ini',
          text: d.title,
          type: isPayment ? 'payment' : 'event',
          createdAt: new Date(), // Virtual
          read: false,
          isDynamic: true
        };
      });
      return dynamicItems;
    };

    // 2. Fetch and Subscribe Persistent notifications
    const fetchInitialData = async () => {
      try {
        const { data: initNotifs } = await invokeApi(`/user_notifications?userId=eq.${currentUser.uid}`);

        let persistentItems = parseDates(initNotifs || []);
        persistentItems.sort((a, b) => {
          const timeA = a.createdAt?.getTime() || 0;
          const timeB = b.createdAt?.getTime() || 0;
          return timeB - timeA;
        });
        persistentItems = persistentItems.slice(0, 20);

        const dynamicItems = await fetchDynamicNotifs();
        const allNotifs = [...dynamicItems, ...persistentItems];
        setNotifications(allNotifs);
        setUnreadCount(allNotifs.filter(n => !n.read).length);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };

    fetchInitialData();

    // Subscribe to changes
    const channelName = `user_notifications_user_${currentUser.uid}`;
    const existingChannel = supabase.getChannels().find(c => c.name === channelName);
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    persistentChannel = supabase.channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'user_notifications',
        filter: `userId=eq.${currentUser.uid}` 
      }, async () => {
        try {
          // Re-fetch all notifications on change
          const { data: updatedNotifs } = await invokeApi(`/user_notifications?userId=eq.${currentUser.uid}`);

          let parsedNotifs = parseDates(updatedNotifs || []);
          parsedNotifs.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
          parsedNotifs = parsedNotifs.slice(0, 20);

          const latestDyn = await fetchDynamicNotifs();
          const merged = [...latestDyn, ...parsedNotifs];
          setNotifications(merged);
          setUnreadCount(merged.filter(n => !n.read).length);
        } catch (err) {
          console.error("Error updating notifications on realtime change:", err);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(persistentChannel);
    };
  }, [currentUser, userName]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read && !n.isDynamic);
    if (unread.length === 0) return;

    const ids = unread.map(n => n.id);
    try {
      await invokeApi(`/user_notifications?id=in.(${ids.join(',')})`, {
        method: 'PUT',
        body: { read: true }
      });

      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n));
      setUnreadCount(notifications.filter(n => !n.read && n.isDynamic).length);
    } catch (err) {
      console.error("Error marking notifications as read:", err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'payment': return <div style={{ backgroundColor: '#FFF4E5', color: '#FFB020', padding: '8px', borderRadius: '10px' }}><CreditCard size={16} /></div>;
      case 'event': return <div style={{ backgroundColor: '#E5EFFF', color: '#4680FF', padding: '8px', borderRadius: '10px' }}><Calendar size={16} /></div>;
      case 'assign': return <div style={{ backgroundColor: '#E5F6EB', color: '#2ED47A', padding: '8px', borderRadius: '10px' }}><UserPlus size={16} /></div>;
      case 'document': return <div style={{ backgroundColor: '#F0F2F5', color: 'var(--text-secondary)', padding: '8px', borderRadius: '10px' }}><FileText size={16} /></div>;
      default: return <div style={{ backgroundColor: '#F0F2F5', color: 'var(--text-secondary)', padding: '8px', borderRadius: '10px' }}><Bell size={16} /></div>;
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        className="icon-btn" 
        style={{ position: 'relative', width: '42px', height: '42px' }} 
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) markAllAsRead();
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{ 
            position: 'absolute', top: '8px', right: '8px', 
            width: '18px', height: '18px', backgroundColor: '#FF5252', 
            borderRadius: '50%', border: '2px solid white',
            color: 'white', fontSize: '14px', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={isMobile ? {
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          width: 'calc(100vw - 32px)', backgroundColor: 'var(--surface)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)', borderRadius: '16px', zIndex: 1000,
          border: '1px solid var(--border)', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out',
          maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column'
        } : {
          position: 'absolute', 
          right: '-10px', 
          top: 'calc(100% + 8px)', 
          width: '360px', 
          backgroundColor: 'var(--surface)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.15)', borderRadius: '16px', zIndex: 1000,
          border: '1px solid var(--border)', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out'
        }}>
          {isMobile && (
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Notifikasi</h3>
               <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)' }}><X size={24} /></button>
            </div>
          )}
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Notifikasi Anda</h3>
            <span style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }} onClick={markAllAsRead}>Tandai semua dibaca</span>
          </div>

          <div style={{ flex: 1, maxHeight: isMobile ? 'none' : '400px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <CheckCircle size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: '14px' }}>Semua beres! Belum ada notifikasi.</p>
              </div>
            ) : (
              notifications.map((n, i) => (
                <div 
                  key={n.id || i}
                  onClick={() => {
                    if (n.link) navigate(n.link);
                    setIsOpen(false);
                  }}
                  style={{ 
                    padding: '16px 20px', display: 'flex', gap: '16px', cursor: 'pointer',
                    borderBottom: i === notifications.length - 1 ? 'none' : '1px solid var(--border)',
                    backgroundColor: n.read ? 'transparent' : '#F8F9FB',
                    transition: 'background-color 0.2s'
                  }}
                  className="hover:bg-gray-50"
                >
                  {getIcon(n.type)}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</p>
                      {!n.read && <div style={{ width: '8px', height: '8px', backgroundColor: 'var(--primary)', borderRadius: '50%', marginTop: '4px' }}></div>}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{n.text}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      <Clock size={10} />
                      {n.isDynamic ? 'Hari ini' : n.createdAt?.toDate ? new Date(n.createdAt.toDate()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div 
            onClick={() => { navigate('/activity'); setIsOpen(false); }}
            style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--border)', color: 'var(--primary)', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
            className="hover:bg-primary-soft"
          >
            Lihat Semua Riwayat Aktivitas
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
