import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, Calendar, FileText, Briefcase, MessageSquare, Bell, Settings, Search, ChevronDown, User, Lock, LogOut, X, Target, History as HistoryIcon, ClipboardCheck } from 'lucide-react';
import FloatingChat from './FloatingChat';
import NotificationCenter from './NotificationCenter';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { Menu as MenuIcon } from 'lucide-react';

const Sidebar = ({ isOpen, onClose, isMobile }) => {
  const { userRole } = useAuth();
  const { unreadRooms } = useChat();
  const location = useLocation();

  const menuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={22} />, path: '/dashboard' },
    { name: 'Client', icon: <Users size={22} />, path: '/clients' },
    { name: 'Leads', icon: <UserPlus size={22} />, path: '/leads' },
    { name: 'Calendar', icon: <Calendar size={22} />, path: '/calendar' },
    { name: 'Documents', icon: <FileText size={22} />, path: '/documents' },
    { name: 'Projects', icon: <Briefcase size={22} />, path: '/projects' },
    ...(!isMobile ? [{ name: 'Chat', icon: <MessageSquare size={22} />, path: '/chat', hasBadge: unreadRooms.length > 0 }] : []),
  ];

  return (
    <aside style={{
      width: isMobile ? '280px' : '90px',
      backgroundColor: 'var(--surface)',
      borderRight: isMobile ? '1px solid var(--border)' : 'none',
      boxShadow: '4px 0 24px rgba(0,0,0,0.02)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: isMobile ? 'flex-start' : 'center',
      height: '100vh',
      position: 'fixed',
      left: isMobile ? (isOpen ? '0' : '-280px') : '0',
      top: 0,
      padding: isMobile ? '24px' : '24px 0',
      zIndex: 100,
      transition: 'left 0.3s ease, width 0.3s ease'
    }}>
      {isMobile && (
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', right: '20px', top: '24px', backgroundColor: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
        >
          <X size={24} />
        </button>
      )}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'center', width: '100%', gap: '12px' }}>
        <div style={{
          width: '48px', height: '48px', backgroundColor: 'var(--primary-soft)',
          borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--primary)',
          boxShadow: '0 8px 16px rgba(122, 132, 156, 0.1)'
        }}>
          <Target size={28} strokeWidth={2.5} />
        </div>
        {isMobile && <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--primary)' }}>MCKUADRAT</span>}
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', alignItems: 'center' }}>
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            title={item.name}
            onClick={() => isMobile && onClose()}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: isMobile ? 'flex-start' : 'center',
              width: isMobile ? '100%' : '48px',
              gap: isMobile ? '16px' : '0',
              padding: isMobile ? '0 16px' : '0',
              height: '48px',
              borderRadius: '16px',
              color: isActive ? 'white' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--primary)' : 'transparent',
              boxShadow: isActive ? '0 6px 16px rgba(82,0,0,0.25)' : 'none',
              transition: 'all 0.2s',
              position: 'relative'
            })}
          >
            {item.icon}
            {isMobile && <span style={{ fontWeight: 600, fontSize: '15px' }}>{item.name}</span>}
            {item.hasBadge && (
              <span style={{ position: 'absolute', top: '10px', right: '10px', width: '14px', height: '14px', backgroundColor: '#FF5252', borderRadius: '50%', border: '2px solid white' }}></span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: 'auto' }}>
        <NavLink
          to="/settings"
          title="Settings"
          onClick={() => isMobile && onClose()}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'flex-start' : 'center',
            width: isMobile ? '100%' : '48px',
            height: '48px',
            borderRadius: isMobile ? '12px' : '50%',
            padding: isMobile ? '0 16px' : '0',
            gap: isMobile ? '16px' : '0',
            color: isActive ? 'white' : 'var(--text-secondary)',
            backgroundColor: isActive ? 'var(--primary)' : 'transparent',
            boxShadow: isActive ? '0 6px 16px rgba(82,0,0,0.25)' : 'none',
            transition: 'all 0.2s',
          })}
        >
          <Settings size={22} />
          {isMobile && <span style={{ fontWeight: 600, fontSize: '15px' }}>Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
};

const Topbar = ({ onMenuOpen, isMobile }) => {
  const { currentUser, userProfile, userRole, logout } = useAuth();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const navigate = useNavigate();

  const profileRef = React.useRef(null);
  const notifRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format target date: e.g. "Senin, 13 April 2026"
  const formattedDate = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <header style={{
      height: isMobile ? '70px' : '90px',
      backgroundColor: 'var(--bg)', // Match page background
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile ? '0 20px' : '0 40px',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      backdropFilter: 'blur(8px)', // optional glass effect
      transition: 'background-color 0.3s'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isMobile && (
          <button onClick={onMenuOpen} style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '4px' }}>
            <MenuIcon size={26} />
          </button>
        )}
        <img
          src="/mckuadrat.png"
          alt="MCKuadrat Logo"
          style={{ height: isMobile ? '20px' : '30px', width: 'auto', objectFit: 'contain' }}
        />
        {!isMobile && (
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search leads, projects..."
              className="search-input"
              style={{
                borderRadius: '12px',
                paddingTop: '10px',
                paddingBottom: '10px'
              }}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '32px' }}>
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>
            <Calendar size={18} className="text-secondary" />
            <span>{formattedDate}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          
          <NotificationCenter />

          <div style={{ position: 'relative' }} ref={profileRef}>
            <div
              onClick={() => setProfileOpen(!profileOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginLeft: '8px', padding: '8px', borderRadius: '12px' }}
              className="hover:bg-gray-100"
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-soft)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                fontWeight: 600,
                fontSize: '16px'
              }}>
                {userProfile?.photo_url || currentUser?.photoURL ? (
                  <img src={userProfile?.photo_url || currentUser?.photoURL} alt="User profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (userProfile?.nickname?.trim() || userProfile?.name)?.charAt(0) || currentUser?.email?.charAt(0) || 'U'
                )}
              </div>
              {!isMobile && (
                <div style={{ textAlign: 'left' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', lineHeight: '1', textTransform: 'capitalize' }}>
                    {(userProfile?.nickname?.trim() || userProfile?.name) || currentUser?.displayName || 'Admin User'}
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', textTransform: 'capitalize' }}>
                    {userProfile?.division || userRole || 'Staff'}
                  </p>
                </div>
              )}
              <ChevronDown size={16} className="text-secondary" />
            </div>

            {profileOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '60px', width: '220px', backgroundColor: 'var(--surface)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)', borderRadius: '12px', padding: '8px', zIndex: 100,
                border: '1px solid var(--border)'
              }}>
                <button
                  onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                  className="hover:bg-gray-100"
                  style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  <User size={16} color="var(--text-secondary)" /> Profil Saya
                </button>
                <button
                  onClick={() => { setProfileOpen(false); navigate('/activity'); }}
                  className="hover:bg-gray-100"
                  style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  <HistoryIcon size={16} color="var(--text-secondary)" /> Daily Activity
                </button>
                <button
                  onClick={() => { setProfileOpen(false); navigate('/reports/event'); }}
                  className="hover:bg-gray-100"
                  style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  <ClipboardCheck size={16} color="var(--text-secondary)" /> Input Laporan Event
                </button>
                <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '4px 0' }}></div>
                <button onClick={() => { setProfileOpen(false); logout(); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px', textAlign: 'left', borderRadius: '8px', color: '#FF5252', fontWeight: 500, fontSize: '14px' }} className="hover:bg-red-50">
                  <LogOut size={16} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

const Layout = () => {
  const { activeToast, setActiveToast } = useChat();
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      {/* Overlay for mobile drawer */}
      {isMobile && isMenuOpen && (
        <div 
          onClick={() => setIsMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 90, animation: 'fadeIn 0.2s ease' }}
        />
      )}

      <Sidebar isMobile={isMobile} isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      
      <main style={{ 
        marginLeft: isMobile ? '0' : '90px', 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        width: isMobile ? '100%' : 'calc(100% - 90px)'
      }}>
        <Topbar isMobile={isMobile} onMenuOpen={() => setIsMenuOpen(true)} />
        <div style={{ padding: isMobile ? '0 16px 40px' : '0 40px 40px', flex: 1 }}>
          <Outlet />
        </div>
      </main>
      <FloatingChat />

      {/* Floating Toast Notification */}
      {activeToast && (
        <div style={{
          position: 'fixed', bottom: isMobile ? '80px' : '24px', right: '24px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)', color: 'var(--text-primary)', padding: '14px 20px',
          borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '12px', zIndex: 9999,
          animation: 'slideUp 0.3s ease-out', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.6)',
          maxWidth: '320px'
        }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>
            {activeToast.sender.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 650 }}>
              Pesan baru dari <span style={{ color: 'var(--primary)' }}>{activeToast.sender}</span>
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeToast.text}
            </p>
          </div>
          <button onClick={() => setActiveToast(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: '6px' }} className="hover:text-primary">
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Layout;
