import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, invokeApi } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState(null);

  useEffect(() => {
    let lastFetchedUserId = null;

    const fetchUserProfile = async (user) => {
      if (!user) {
        setUserProfile(null);
        setUserRole(null);
        return;
      }
      if (lastFetchedUserId === user.id) return;
      lastFetchedUserId = user.id;

      try {
        const { data: profile } = await invokeApi(`/profiles?id=eq.${user.id}&single=true`);
        if (profile) {
          setUserProfile(profile);
          setUserRole(profile.role || 'staff');
          invokeApi(`/profiles?id=eq.${user.id}`, {
            method: 'PUT',
            body: { isOnline: true, lastSeen: new Date().toISOString() }
          }).catch(() => {});
        } else {
          setUserProfile(null);
          setUserRole('staff');
        }
      } catch (e) {
        console.error("Error fetching user profile:", e);
        setUserProfile(null);
        setUserRole('staff');
      }
    };

    // 1. Initial Session Check
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user || null;
        if (user) {
          user.uid = user.id;
        }
        setCurrentUser(user);
        if (user) {
          await fetchUserProfile(user);
        }
      } catch (err) {
        console.error("Error during initial session check:", err);
      } finally {
        setLoading(false);
      }
    };
    checkSession();

    // 2. Listen to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      if (user) {
        user.uid = user.id;
      }
      setCurrentUser(user);
      
      if (user) {
        fetchUserProfile(user);
      } else {
        lastFetchedUserId = null;
        setCurrentUser(null);
        setUserProfile(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    // 3. Visibility Change & Heartbeat (non-blocking)
    const handleVisibilityChange = () => {
      if (!currentUser?.id) return;
      const isOnline = document.visibilityState === 'visible';
      invokeApi(`/profiles?id=eq.${currentUser.id}`, {
        method: 'PUT',
        body: { isOnline: isOnline, lastSeen: new Date().toISOString() }
      }).catch(() => {});
    };

    const heartbeatInterval = setInterval(() => {
      if (currentUser?.id && document.visibilityState === 'visible') {
        invokeApi(`/profiles?id=eq.${currentUser.id}`, {
          method: 'PUT',
          body: { isOnline: true, lastSeen: new Date().toISOString() }
        }).catch(() => {});
      }
    }, 120000); // Every 2 minutes non-blocking

    window.addEventListener('visibilitychange', handleVisibilityChange);

    const handleBeforeUnload = () => {
      if (currentUser?.id) {
        invokeApi(`/profiles?id=eq.${currentUser.id}`, {
          method: 'PUT',
          body: { isOnline: false, lastSeen: new Date().toISOString() }
        }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      subscription.unsubscribe();
      clearInterval(heartbeatInterval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    const uid = currentUser?.id;
    if (uid) {
      try { 
        await invokeApi(`/profiles?id=eq.${uid}`, {
          method: 'PUT',
          body: { isOnline: false, lastSeen: new Date().toISOString() }
        });
      } catch (e) {}
    }
    setGoogleAccessToken(null);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password'
    });
    if (error) throw error;
    return data;
  };

  const value = {
    currentUser,
    userProfile,
    setUserProfile,
    userRole,
    googleAccessToken,
    login,
    logout,
    resetPassword
  };

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', width: '100%', display: 'flex', alignItems: 'center', 
        justifyContent: 'center', backgroundColor: '#FAFBFC', flexDirection: 'column', gap: '16px'
      }}>
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #E5EFFF', borderTopColor: '#4680FF', borderRadius: '50%' }}></div>
        <p style={{ color: '#7A849C', fontSize: '14px', fontWeight: 600 }}>Memuat aplikasi...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
