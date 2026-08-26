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
    // 1. Initial Session Check
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user || null;
        if (user) {
          user.uid = user.id; // Map uid to id for legacy firebase components compatibility
        }
        setCurrentUser(user);
        if (user) {
          let profile = null;
          try {
            const { data } = await invokeApi(`/profiles?id=eq.${user.id}&single=true`);
            profile = data;
          } catch (e) {
            console.error("Error fetching user profile via api:", e);
          }
            
          if (profile) {
            setUserProfile(profile);
            setUserRole(profile.role || 'staff');
            try {
              await invokeApi(`/profiles?id=eq.${user.id}`, {
                method: 'PUT',
                body: { isOnline: true, lastSeen: new Date().toISOString() }
              });
            } catch (err) {}
          } else {
            setUserProfile(null);
            setUserRole('staff');
          }
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
        user.uid = user.id; // Map uid to id
      }
      setCurrentUser(user);
      
      if (user) {
        try {
          let profile = null;
          try {
            const { data } = await invokeApi(`/profiles?id=eq.${user.id}&single=true`);
            profile = data;
          } catch (e) {
            console.error("Error fetching user profile via api:", e);
          }

          if (profile) {
            setUserProfile(profile);
            setUserRole(profile.role || 'staff');
            try {
              await invokeApi(`/profiles?id=eq.${user.id}`, {
                method: 'PUT',
                body: { isOnline: true, lastSeen: new Date().toISOString() }
              });
            } catch (err) {}
          } else {
            setUserProfile(null);
            setUserRole('staff');
          }
        } catch (e) {
          console.error("Error fetching user profile:", e);
          setUserProfile(null);
          setUserRole('staff');
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    // 3. Visibility Change Heartbeat
    const handleVisibilityChange = async () => {
      const user = (await supabase.auth.getSession()).data.session?.user;
      if (!user) return;
      try {
        const isOnline = document.visibilityState === 'visible';
        await invokeApi(`/profiles?id=eq.${user.id}`, {
          method: 'PUT',
          body: { isOnline: isOnline, lastSeen: new Date().toISOString() }
        });
      } catch (err) {
        console.error("Visibility update failed:", err);
      }
    };

    // Heartbeat to keep lastSeen fresh
    const heartbeatInterval = setInterval(async () => {
      const user = (await supabase.auth.getSession()).data.session?.user;
      if (user && document.visibilityState === 'visible') {
        try {
          await invokeApi(`/profiles?id=eq.${user.id}`, {
            method: 'PUT',
            body: { isOnline: true, lastSeen: new Date().toISOString() }
          });
        } catch (e) {}
      }
    }, 60000); // Every 1 minute

    window.addEventListener('visibilitychange', handleVisibilityChange);

    const handleBeforeUnload = async () => {
      const user = (await supabase.auth.getSession()).data.session?.user;
      if (user) {
        await invokeApi(`/profiles?id=eq.${user.id}`, {
          method: 'PUT',
          body: { isOnline: false, lastSeen: new Date().toISOString() }
        });
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

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
