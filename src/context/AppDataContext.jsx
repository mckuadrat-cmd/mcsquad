import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, parseDates, invokeApi } from '../lib/supabase';
import { useAuth } from './AuthContext';

const AppDataContext = createContext();

export const AppDataProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [clients, setClients] = useState([]);
  const [flatLeads, setFlatLeads] = useState([]);
  const [leads, setLeads] = useState({
    suspect: { id: 'suspect', title: 'Suspect', color: '#4680FF', bgSoft: '#E5EFFF', items: [] },
    prospek: { id: 'prospek', title: 'Prospek', color: '#FFB020', bgSoft: '#FFF4E5', items: [] },
    confirm: { id: 'confirm', title: 'Confirm (Bayar Nanti)', color: '#7A849C', bgSoft: '#F4F6F9', items: [] },
    deal: { id: 'deal', title: 'Deal (Bayar Bln Ini)', color: '#2ED47A', bgSoft: '#E5F6EB', items: [] },
    buyer: { id: 'buyer', title: 'Buyer / Lunas', color: '#9C27B0', bgSoft: '#F3E5F5', items: [] },
    cancel: { id: 'cancel', title: 'Cancel', color: '#FF5252', bgSoft: '#FFE5E5', items: [] },
  });
  const [projects, setProjects] = useState([]);
  const [events, setEvents] = useState([]); // Roadmap plans
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Group flatLeads into Kanban state
  useEffect(() => {
    const newLeadsState = {
      suspect: { id: 'suspect', title: 'Suspect', color: '#4680FF', bgSoft: '#E5EFFF', items: [] },
      prospek: { id: 'prospek', title: 'Prospek', color: '#FFB020', bgSoft: '#FFF4E5', items: [] },
      confirm: { id: 'confirm', title: 'Confirm (Bayar Nanti)', color: '#7A849C', bgSoft: '#F4F6F9', items: [] },
      deal: { id: 'deal', title: 'Deal (Bayar Bln Ini)', color: '#2ED47A', bgSoft: '#E5F6EB', items: [] },
      buyer: { id: 'buyer', title: 'Buyer / Lunas', color: '#9C27B0', bgSoft: '#F3E5F5', items: [] },
      cancel: { id: 'cancel', title: 'Cancel', color: '#FF5252', bgSoft: '#FFE5E5', items: [] },
    };

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    flatLeads.forEach(lead => {
      const status = lead.status?.toLowerCase();
      
      // --- 1 Month Expiry for Cancel Column ---
      if (status === 'cancel') {
        const updatedDate = lead.updatedAt || new Date(0);
        if (updatedDate < thirtyDaysAgo) return; // Skip old cancelled leads
      }

      if (newLeadsState[status]) {
        newLeadsState[status].items.push(lead);
      } else {
        newLeadsState.suspect.items.push(lead);
      }
    });
    setLeads(newLeadsState);
  }, [flatLeads]);

  useEffect(() => {
    if (!currentUser) {
      setClients([]);
      setFlatLeads([]);
      setProjects([]);
      setUsers([]);
      setEvents([]);
      setCalendarEvents([]);
      setLoading(false);
      return;
    }

    let active = true;
    let clientsChannel, leadsChannel, projectsChannel, profilesChannel, eventsChannel, calendarChannel;

    const loadDataAndSubscribe = async () => {
      setLoading(true);
      try {
        // 1. Fetch initial data from Supabase via Edge Function API
        const [
          { data: clientsData },
          { data: leadsData },
          { data: projectsData },
          { data: profilesData },
          { data: eventsData },
          { data: calData }
        ] = await Promise.all([
          invokeApi('/clients'),
          invokeApi('/leads'),
          invokeApi('/projects?order=createdAt.desc'),
          invokeApi('/profiles'),
          invokeApi('/daily_activities?type=eq.plan&isDone=eq.false'),
          invokeApi('/calendar_events')
        ]);

        if (!active) return;

        setClients(parseDates(clientsData || []));
        setFlatLeads(parseDates(leadsData || []));
        setProjects(parseDates(projectsData || []));
        setUsers(parseDates(profilesData || []));
        setEvents(parseDates(eventsData || []));
        setCalendarEvents(parseDates(calData || []));

        // 2. Setup Real-time Subscriptions
        const suffix = Math.random().toString(36).substring(7);

        // A. Clients Channel
        clientsChannel = supabase.channel(`clients-channel-${suffix}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, (payload) => {
            const parsedNew = parseDates(payload.new);
            if (payload.eventType === 'INSERT') {
              setClients(prev => [...prev, parsedNew]);
            } else if (payload.eventType === 'UPDATE') {
              setClients(prev => prev.map(item => item.id === parsedNew.id ? parsedNew : item));
            } else if (payload.eventType === 'DELETE') {
              setClients(prev => prev.filter(item => item.id !== payload.old.id));
            }
          }).subscribe();

        // B. Leads Channel
        leadsChannel = supabase.channel(`leads-channel-${suffix}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
            const parsedNew = parseDates(payload.new);
            if (payload.eventType === 'INSERT') {
              setFlatLeads(prev => [...prev, parsedNew]);
            } else if (payload.eventType === 'UPDATE') {
              setFlatLeads(prev => prev.map(item => item.id === parsedNew.id ? parsedNew : item));
            } else if (payload.eventType === 'DELETE') {
              setFlatLeads(prev => prev.filter(item => item.id !== payload.old.id));
            }
          }).subscribe();

        // C. Projects Channel
        projectsChannel = supabase.channel(`projects-channel-${suffix}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
            const parsedNew = parseDates(payload.new);
            if (payload.eventType === 'INSERT') {
              setProjects(prev => [parsedNew, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setProjects(prev => prev.map(item => item.id === parsedNew.id ? parsedNew : item));
            } else if (payload.eventType === 'DELETE') {
              setProjects(prev => prev.filter(item => item.id !== payload.old.id));
            }
          }).subscribe();

        // D. Profiles Channel (Users)
        profilesChannel = supabase.channel(`profiles-channel-${suffix}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
            const parsedNew = parseDates(payload.new);
            if (payload.eventType === 'INSERT') {
              setUsers(prev => [...prev, parsedNew]);
            } else if (payload.eventType === 'UPDATE') {
              setUsers(prev => prev.map(item => item.id === parsedNew.id ? parsedNew : item));
            } else if (payload.eventType === 'DELETE') {
              setUsers(prev => prev.filter(item => item.id !== payload.old.id));
            }
          }).subscribe();

        // E. Daily Activities Channel (Roadmap Plans)
        eventsChannel = supabase.channel(`activities-channel-${suffix}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_activities' }, (payload) => {
            const parsedNew = parseDates(payload.new);
            if (payload.eventType === 'INSERT') {
              if (parsedNew.type === 'plan' && !parsedNew.isDone) {
                setEvents(prev => [...prev, parsedNew]);
              }
            } else if (payload.eventType === 'UPDATE') {
              if (parsedNew.type === 'plan' && !parsedNew.isDone) {
                setEvents(prev => {
                  const exists = prev.some(e => e.id === parsedNew.id);
                  if (exists) {
                    return prev.map(e => e.id === parsedNew.id ? parsedNew : e);
                  } else {
                    return [...prev, parsedNew];
                  }
                });
              } else {
                setEvents(prev => prev.filter(item => item.id !== parsedNew.id));
              }
            } else if (payload.eventType === 'DELETE') {
              setEvents(prev => prev.filter(item => item.id !== payload.old.id));
            }
          }).subscribe();

        // F. Calendar Events Channel
        calendarChannel = supabase.channel(`calendar-channel-${suffix}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, (payload) => {
            const parsedNew = parseDates(payload.new);
            if (payload.eventType === 'INSERT') {
              setCalendarEvents(prev => [...prev, parsedNew]);
            } else if (payload.eventType === 'UPDATE') {
              setCalendarEvents(prev => prev.map(item => item.id === parsedNew.id ? parsedNew : item));
            } else if (payload.eventType === 'DELETE') {
              setCalendarEvents(prev => prev.filter(item => item.id !== payload.old.id));
            }
          }).subscribe();

      } catch (err) {
        console.error("Error setting up Supabase data sync:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDataAndSubscribe();

    return () => {
      active = false;
      if (clientsChannel) supabase.removeChannel(clientsChannel);
      if (leadsChannel) supabase.removeChannel(leadsChannel);
      if (projectsChannel) supabase.removeChannel(projectsChannel);
      if (profilesChannel) supabase.removeChannel(profilesChannel);
      if (eventsChannel) supabase.removeChannel(eventsChannel);
      if (calendarChannel) supabase.removeChannel(calendarChannel);
    };
  }, [currentUser]);

  // Aggregated unique schools from all main sources (clients, leads, projects)
  const uniqueSchools = React.useMemo(() => {
    const map = new Map();
    
    // Helper to get latest activity
    const updateActivity = (schoolId, timestamp, text) => {
      const existing = map.get(schoolId);
      if (!existing) return;
      
      const currentTS = existing.lastActivityTS?.seconds || 0;
      const newTS = timestamp?.seconds || 0;
      
      if (newTS > currentTS) {
        map.set(schoolId, { 
          ...existing, 
          lastActivityTS: timestamp, 
          lastActivityText: text 
        });
      }
    };

    // 1. From Clients
    clients.forEach(c => {
      if (c.schoolId) {
        const existing = map.get(c.schoolId);
        map.set(c.schoolId, { 
          id: c.schoolId, 
          name: c.school, 
          address: c.schoolAddress || existing?.address || '',
          picCount: (existing?.picCount || 0) + 1,
          hasClient: true,
          lastActivityTS: c.updatedAt || c.createdAt || null,
          lastActivityText: c.lastActivity || 'Updated'
        });
        updateActivity(c.schoolId, c.updatedAt || c.createdAt, c.lastActivity || 'Updated');
      }
    });

    // 2. From Leads (Kanban)
    Object.values(leads).forEach(col => {
      col.items.forEach(l => {
        if (l.schoolId) {
          if (!map.has(l.schoolId)) {
            map.set(l.schoolId, { 
              id: l.schoolId, 
              name: l.schoolName, 
              address: l.schoolAddress || '', 
              picCount: 0, 
              hasClient: false,
              lastActivityTS: l.updatedAt || l.createdAt || null,
              lastActivityText: `Lead: ${l.status}`
            });
          } else {
            updateActivity(l.schoolId, l.updatedAt || l.createdAt, `Lead: ${l.status}`);
          }
        }
      });
    });

    // 3. From Projects
    projects.forEach(p => {
      if (p.schoolId) {
        if (!map.has(p.schoolId)) {
          map.set(p.schoolId, { 
            id: p.schoolId, 
            name: p.schoolName, 
            address: p.schoolAddress || '', 
            picCount: 0, 
            hasClient: false,
            lastActivityTS: p.updatedAt || p.createdAt || null,
            lastActivityText: `Project: ${p.status}`
          });
        } else {
          updateActivity(p.schoolId, p.updatedAt || p.createdAt, `Project: ${p.status}`);
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, leads, projects]);

  const value = {
    clients, setClients,
    leads, setLeads,
    projects, setProjects,
    events, setEvents,
    calendarEvents, setCalendarEvents,
    uniqueSchools,
    users, setUsers,
    loading
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => useContext(AppDataContext);
