import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Plus, X, Calendar as CalendarIcon, Clock, Users, AlignLeft, Send, Trash2, Share2, RefreshCw, ClipboardCheck, Building2 } from 'lucide-react';
import { supabase, parseDates, invokeApi } from '../../lib/supabase';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { logActivity } from '../../utils/activityLogger';

const Calendar = () => {
  const navigate = useNavigate();
  const { events: contextEvents, clients, uniqueSchools } = useAppData();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userProfile, currentUser, googleAccessToken } = useAuth();
  const { showAlert, showConfirm } = useNotification();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const userName = (userProfile?.nickname?.trim() || userProfile?.name) || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Staff';

  // Autocomplete State
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target)) {
        setShowSchoolDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    let calendarChannel;

    const fetchEvents = async () => {
      try {
        const { data } = await invokeApi('/calendar_events');
        setEvents(parseDates(data || []));
        setLoading(false);

        // Realtime Subscription
        calendarChannel = supabase.channel('public:calendar_events:page')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, (payload) => {
            const parsedNew = parseDates(payload.new);
            if (payload.eventType === 'INSERT') {
              setEvents(prev => [...prev, parsedNew]);
            } else if (payload.eventType === 'UPDATE') {
              setEvents(prev => prev.map(item => item.id === parsedNew.id ? parsedNew : item));
            } else if (payload.eventType === 'DELETE') {
              setEvents(prev => prev.filter(item => item.id !== payload.old.id));
            }
          }).subscribe();
      } catch (err) {
        console.error("Error fetching calendar events in Calendar.jsx:", err);
        setLoading(false);
      }
    };

    fetchEvents();

    return () => {
      if (calendarChannel) calendarChannel.unsubscribe();
    };
  }, []);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const dateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(e => e.date === selectedDate || e.start?.split('T')[0] === selectedDate);
  }, [selectedDate, events]);

  const [formData, setFormData] = useState({
    title: '',
    schoolName: '',
    schoolId: '',
    date: '',
    startTime: '',
    endTime: '',
    type: 'task',
    pic: userName,
    desc: ''
  });

  // Update PIC when user loads
  useEffect(() => {
    if (userName && !selectedEvent) {
      setFormData(prev => ({ ...prev, pic: userName }));
    }
  }, [userName, selectedEvent]);

  const filteredSchoolSuggestions = uniqueSchools.filter(s =>
    s.name.toLowerCase().includes((formData.schoolName || '').toLowerCase())
  );

  const handleDateClick = (arg) => {
    if (selectedDate === arg.dateStr) {
      setSelectedDate(null);
    } else {
      setSelectedDate(arg.dateStr);
    }
  };

  const openAddEventDrawer = (dateStr) => {
    setSelectedEvent(null);
    setFormData({
      title: '',
      schoolName: '',
      schoolId: '',
      date: dateStr || selectedDate || new Date().toISOString().split('T')[0],
      startTime: '',
      endTime: '',
      type: 'task',
      pic: userName,
      desc: ''
    });
    setIsDrawerOpen(true);
  };

  const handleEventClick = (arg) => {
    const ev = arg.event;
    const dStr = ev.start ? ev.start.toISOString().split('T')[0] : '';
    const sTime = ev.start ? ev.start.toTimeString().split(' ')[0].substring(0, 5) : '';
    const eTime = ev.end ? ev.end.toTimeString().split(' ')[0].substring(0, 5) : '';

    setSelectedEvent(ev);
    setFormData({
      title: ev.title,
      schoolName: ev.extendedProps.schoolName || '',
      schoolId: ev.extendedProps.schoolId || '',
      date: dStr,
      startTime: sTime,
      endTime: eTime,
      type: ev.extendedProps.type || 'task',
      pic: ev.extendedProps.pic || '',
      desc: ev.extendedProps.desc || ''
    });
    setIsDrawerOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    let bg = '#F4F6F9', border = '#7A849C', text = '#7A849C';
    if (formData.type === 'event') { bg = '#E5EFFF'; border = '#4680FF'; text = '#4680FF'; }
    if (formData.type === 'reminder') { bg = '#FFF4E5'; border = '#FFB020'; text = '#FFB020'; }
    if (formData.type === 'deadline') { bg = '#FFE5E5'; border = '#FF5252'; text = '#FF5252'; }
    if (formData.type === 'task') { bg = '#E5F6EB'; border = '#2ED47A'; text = '#2ED47A'; }

    const isTimed = formData.startTime !== '';
    const startStr = isTimed ? `${formData.date}T${formData.startTime}:00` : formData.date;
    const endStr = formData.endTime ? `${formData.date}T${formData.endTime}:00` : null;

    const eventData = {
      title: formData.title,
      start: startStr,
      end: endStr,
      allDay: !isTimed,
      backgroundColor: bg, borderColor: border, textColor: text,
      extendedProps: {
        type: formData.type,
        isEstimasi: selectedEvent?.extendedProps?.isEstimasi || false,
        pic: userName,
        desc: formData.desc,
        schoolName: formData.schoolName,
        schoolId: formData.schoolId
      },
      updatedAt: new Date().toISOString()
    };

    // If it's an existing lead event (type: event), we might want to preserve the lead's color sync 
    // but the user said "masih belum sinkron untuk warna yg dihasilkan dari leads."
    // This handleSave is for MANUAL creation/edit in Calendar.
    // Leads events are updated in Leads.jsx.
    // So if the user edits a LEAD event in Calendar, it should ideally keep being an 'event' type.

    // Check if we already have colors (e.g. from lead sync)
    if (selectedEvent && selectedEvent.backgroundColor) {
      // if user didn't change category, keep original colors
      const originalType = selectedEvent.extendedProps.type;
      if (originalType === formData.type) {
        eventData.backgroundColor = selectedEvent.backgroundColor;
        eventData.borderColor = selectedEvent.borderColor;
        eventData.textColor = selectedEvent.textColor;
      }
    }

    try {
      if (selectedEvent) {
        await invokeApi(`/calendar_events?id=eq.${selectedEvent.id}`, { method: 'PUT', body: eventData });

        // SYNC BACK TO LEAD if it's a lead-linked event
        if (selectedEvent.id.startsWith('EVL-')) {
          const leadId = selectedEvent.id.replace('EVL-', '');
          try {
            await invokeApi(`/leads?id=eq.${leadId}`, {
              method: 'PUT',
              body: {
                program: formData.title,
                date: formData.date,
                pic: formData.pic,
                updatedAt: new Date().toISOString()
              }
            });
          } catch (leadErr) {
            console.warn("Sync back to lead failed (maybe lead deleted):", leadErr);
          }
        }
      } else {
        const newId = `E-${Date.now()}`;
        await invokeApi('/calendar_events', {
          method: 'POST',
          body: {
            ...eventData,
            id: newId,
            createdAt: new Date().toISOString()
          }
        });

        // Auto Log Activity
        logActivity(currentUser, `Menjadwalkan ${formData.type}: ${formData.title}`, newId, 'Event', 'Reminder');
      }
      setIsDrawerOpen(false);
    } catch (err) {
      console.error("Save event error:", err);
      showAlert("Kesalahan", "Gagal menyimpan event: " + err.message, "error");
    }
  };

  const handleSyncToGoogle = () => {
    if (!formData.title || !formData.date) return;

    if (selectedEvent?.extendedProps?.isEstimasi || formData.title.includes('[Estimasi]')) {
      showAlert("Jadwal Masih Estimasi", "Hanya jadwal yang sudah pasti (Status Confirm/Deal/Buyer) yang dapat di-sync ke Google Calendar.", "warning");
      return;
    }

    const title = encodeURIComponent(formData.title);
    const details = encodeURIComponent(`AO: ${formData.pic}\n\nDescription: ${formData.desc}`);
    const location = encodeURIComponent(formData.schoolName || '');

    // Helper to format date for Google (YYYYMMDDTHHmmSS)
    const formatGoogleDate = (d, t) => {
      const base = d.replace(/-/g, '');
      if (t) return `${base}T${t.replace(/:/g, '')}00`;
      return base;
    };

    const startObj = formatGoogleDate(formData.date, formData.startTime);
    let endObj = formatGoogleDate(formData.date, formData.endTime);

    if (startObj === endObj || !formData.endTime) {
      // If no end time, make it 1 hour after or same day
      if (formData.startTime) {
        const hour = parseInt(formData.startTime.split(':')[0]) + 1;
        const min = formData.startTime.split(':')[1];
        endObj = formatGoogleDate(formData.date, `${hour.toString().padStart(2, '0')}:${min}`);
      } else {
        endObj = startObj;
      }
    }

    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${startObj}/${endObj}`;
    window.open(url, '_blank');
  };

  const handleSyncAllToGoogle = async () => {
    if (!googleAccessToken) {
      showAlert("Akses Diperlukan", "Mohon Login ulang menggunakan Akun Google untuk sinkronisasi otomatis ke Google Calendar.", "info");
      return;
    }

    if (events.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    for (const ev of events) {
      // Logic to check if already synced (to avoid duplicates)
      if (ev.googleEventId) continue;

      try {
        const startStr = ev.start;
        const endStr = ev.end || ev.start;

        const googleEvent = {
          summary: ev.title,
          location: ev.extendedProps?.schoolName || '',
          description: `PIC: ${ev.extendedProps?.pic || ''}\n\n${ev.extendedProps?.desc || ''}`,
          start: {
            dateTime: startStr.includes('T') ? new Date(startStr).toISOString() : null,
            date: !startStr.includes('T') ? startStr : null
          },
          end: {
            dateTime: endStr.includes('T') ? new Date(endStr).toISOString() : null,
            date: !endStr.includes('T') ? endStr : null
          }
        };

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(googleEvent)
        });

        if (response.ok) {
          const resData = await response.json();
          // Save the ID back to Firestore to mark as synced
          await invokeApi(`/calendar_events?id=eq.${ev.id}`, {
            method: 'PUT',
            body: { googleEventId: resData.id }
          });
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error("Sync error for event", ev.id, err);
        failCount++;
      }
    }

    setIsSyncing(false);
    if (successCount > 0) {
      showAlert("Sinkronisasi Selesai", `${successCount} event berhasil dipindahkan to Google Calendar.${failCount > 0 ? ` (${failCount} gagal)` : ''}`, "success");
    } else if (failCount > 0) {
      showAlert("Gagal Sinkronisasi", "Pastikan koneksi internet stabil dan token Google masih berlaku.", "error");
    } else {
      showAlert("Info", "Semua jadwal sudah tersinkronisasi sebelumnya.", "info");
    }
  };

  const handleDelete = () => {
    showConfirm(
      "Hapus Event?",
      "Apakah Anda yakin ingin menghapus jadwal ini secara permanen?",
      async () => {
        try {
          await invokeApi(`/calendar_events?id=eq.${selectedEvent.id}`, { method: 'DELETE' });
          setIsDrawerOpen(false);
          showAlert("Terhapus", "Event telah berhasil dihapus.", "success");
        } catch (err) {
          console.error("Delete event error:", err);
          showAlert("Gagal", "Gagal menghapus event: " + err.message, "error");
        }
      }
    );
  };

  const handleEventDrop = async (info) => {
    try {
      await invokeApi(`/calendar_events?id=eq.${info.event.id}`, {
        method: 'PUT',
        body: {
          start: info.event.startStr,
          end: info.event.endStr || null,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error("Drop event error:", err);
    }
  };



  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '12px' : '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '24px' : '30px', fontWeight: 700, margin: 0 }}>Kalender Tim</h1>
          {!isMobile && <p className="text-secondary text-sm">Jadwal kegiatan dan penugasan personil.</p>}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-outline"
            style={{ borderRadius: '12px', borderColor: '#4285F4', color: '#4285F4', backgroundColor: 'white', padding: isMobile ? '8px 12px' : '10px 18px' }}
            onClick={handleSyncAllToGoogle}
            disabled={isSyncing}
          >
            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
            {!isMobile && (isSyncing ? 'Syncing...' : 'Sync All')}
          </button>
          <button className="btn btn-primary" style={{ borderRadius: '12px', padding: isMobile ? '8px 12px' : '10px 18px' }} onClick={() => openAddEventDrawer(new Date().toISOString().split('T')[0])}>
            <Plus size={18} /> {!isMobile && 'Scheduling Event'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: isMobile ? '12px' : '24px', marginBottom: '40px' }}>
        <style>{`
          .fc { font-family: 'Outfit', sans-serif !important; }
          .fc-theme-standard td, .fc-theme-standard th { border-color: var(--border) !important; }
          .fc-col-header-cell { padding: 12px 0; background-color: #F8F9FB; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 12px; border-bottom: 2px solid var(--primary-soft) !important; }
          .fc-daygrid-day-number { color: var(--text-primary); font-weight: 500; padding: 8px !important; }
          .fc-event { border-radius: 6px; padding: 2px 6px; font-weight: 600; font-size: 11px; cursor: pointer; transition: transform 0.2s; border-width: 1px; border-left-width: 4px; border-style: solid; }
          .fc-event:hover { transform: translateY(-2px); boxShadow: 0 4px 12px rgba(0,0,0,0.1); }
          .fc-h-event { border: 1px solid; border-left: 4px solid; } 
          .fc-daygrid-day.fc-day-today { background-color: var(--primary-soft) !important; }
          .fc-daygrid-day.selected-day { background-color: rgba(70, 128, 255, 0.15) !important; }
          .fc-day-today .fc-daygrid-day-number { 
            background-color: var(--primary); 
            color: white !important; 
            border-radius: 50%; 
            width: 28px; 
            height: 28px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            margin: 4px !important;
            font-weight: 700;
          }
          .fc .fc-toolbar-title { font-size: ${isMobile ? '16px' : '20px'} !important; font-weight: 700; color: var(--text-primary); }
          .fc .fc-button-primary { background-color: white !important; border: 1px solid var(--border) !important; color: var(--text-primary) !important; font-weight: 600 !important; text-transform: capitalize !important; font-size: ${isMobile ? '12px' : '14px'} !important; padding: ${isMobile ? '4px 8px' : '8px 16px'} !important; }
          .fc .fc-button-primary:hover { background-color: #f8f9fb !important; }
          .fc .fc-button-active { background-color: var(--primary) !important; color: white !important; border-color: var(--primary) !important; }
          .fc th { padding: ${isMobile ? '6px 0' : '12px 0'} !important; font-weight: 700 !important; font-size: ${isMobile ? '11px' : '13px'} !important; text-transform: uppercase !important; color: var(--text-secondary) !important; background: #f8f9fb !important; }
          .fc-daygrid-event { border-radius: 6px !important; padding: 2px 6px !important; font-weight: 600 !important; border: none !important; margin: 1px 4px !important; }
          .fc-event-title { font-size: ${isMobile ? '10px' : '12px'} !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
        `}</style>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: isMobile ? 'prev,next' : 'prev,next today',
            center: 'title',
            right: isMobile ? '' : 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          height="auto"
          editable={true}
          selectable={false}
          selectMirror={false}
          dayMaxEvents={true}
          events={events}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          dayCellClassNames={(arg) => {
            const year = arg.date.getFullYear();
            const month = String(arg.date.getMonth() + 1).padStart(2, '0');
            const day = String(arg.date.getDate()).padStart(2, '0');
            const cellDateStr = `${year}-${month}-${day}`;

            if (cellDateStr === selectedDate) {
              return ['selected-day'];
            }
            return [];
          }}
          eventContent={(eventInfo) => {
            const isEstimasi = eventInfo.event.extendedProps.isEstimasi;
            return (
              <div style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
                flexDirection: 'column',
                lineHeight: '1.2',
                padding: '2px 0'
              }}>
                {isEstimasi && (
                  <div style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    opacity: 0.8,
                    marginBottom: '1px'
                  }}>
                    • Estimasi
                  </div>
                )}
                <div style={{ fontWeight: 600 }}>{eventInfo.event.title}</div>
              </div>
            );
          }}
        />

        {/* Integrated Date Details Section */}
        {selectedDate && (
          <div style={{
            marginTop: '24px',
            paddingTop: '24px',
            borderTop: '2px solid var(--border)',
            animation: 'slideDown 0.3s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Agenda: {new Date(selectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>{dateEvents.length} kegiatan terjadwal.</p>
              </div>
              <button className="btn btn-primary" style={{ borderRadius: '10px' }} onClick={() => openAddEventDrawer(selectedDate)}>
                <Plus size={18} /> Tambah Agenda
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {dateEvents.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#F8F9FB', borderRadius: '12px', border: '1px dashed var(--border)', gridColumn: '1 / -1' }}>
                  <CalendarIcon size={32} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '15px' }}>Tidak ada agenda untuk tanggal ini.</p>
                </div>
              ) : (
                dateEvents.map((ev, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      handleEventClick({
                        event: {
                          title: ev.title,
                          start: ev.start ? new Date(ev.start) : new Date(ev.date),
                          end: ev.end ? new Date(ev.end) : null,
                          extendedProps: { ...ev },
                          id: ev.id
                        }
                      });
                    }}
                    style={{
                      padding: '16px', borderRadius: '12px', backgroundColor: 'white', border: '1px solid var(--border)',
                      borderLeft: `4px solid ${ev.type === 'task' ? '#FFBA08' : 'var(--primary)'}`,
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    className="hover:shadow-md"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: ev.type === 'task' ? '#FFBA08' : 'var(--primary)', textTransform: 'uppercase' }}>{ev.type || 'Event'}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{ev.startTime || '00:00'} - {ev.endTime || 'Selesai'}</span>
                    </div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>{ev.title}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      <Building2 size={14} style={{ marginRight: '4px' }} /> {ev.schoolName || 'Internal'}
                    </p>
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>
                        {ev.pic?.charAt(0) || 'U'}
                      </div>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>AO: {ev.pic || 'System'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Drawer Form for Add / Edit Event */}
      {isDrawerOpen && (
        <>
          <div
            onClick={() => setIsDrawerOpen(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 100 }}
          />
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: isMobile ? '100%' : '450px',
            height: '100vh',
            backgroundColor: 'var(--surface)',
            boxShadow: '-8px 0 24px rgba(0,0,0,0.05)',
            zIndex: 101,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-xl font-semibold">{selectedEvent ? 'Event Details' : 'Create New Event'}</h2>
              <button onClick={() => setIsDrawerOpen(false)} style={{ color: 'var(--text-secondary)' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              <form id="event-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className="text-sm font-medium mb-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CalendarIcon size={16} color="var(--primary)" /> Judul Event / Task <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Rapat Panitia Tryout"
                    style={{ backgroundColor: 'var(--bg)', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '12px' }}
                  />
                </div>

                <div style={{ position: 'relative' }} ref={autocompleteRef}>
                  <label className="text-sm font-medium mb-2 block">Sekolah Terkait (Opsional)</label>
                  <input
                    type="text"
                    value={formData.schoolName}
                    onChange={(e) => {
                      setFormData({ ...formData, schoolName: e.target.value, schoolId: '' });
                      setShowSchoolDropdown(true);
                    }}
                    onFocus={() => setShowSchoolDropdown(true)}
                    placeholder="Cari sekolah terdaftar..."
                    style={{ backgroundColor: 'var(--bg)', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '12px' }}
                  />
                  {showSchoolDropdown && formData.schoolName.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)', borderRadius: '12px', marginTop: '4px', zIndex: 10,
                      maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 16px rgba(0,0,0,0.08)'
                    }}>
                      {filteredSchoolSuggestions.length > 0 ? (
                        <>
                          {filteredSchoolSuggestions.map(s => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setFormData({ ...formData, schoolName: s.name, schoolId: s.id });
                                setShowSchoolDropdown(false);
                              }}
                              style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                              className="hover:bg-primary-soft transition-colors"
                            >
                              <p style={{ margin: 0, fontWeight: 500, fontSize: '14px' }}>
                                <span style={{ color: 'var(--primary)', marginRight: '6px' }}>{s.id}</span>
                                {s.name}
                              </p>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                          Sekolah belum terdaftar. Tetap gunakan nama ini?
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="text-sm font-medium mb-2 block">Tanggal Eksekusi</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                      style={{ backgroundColor: 'var(--bg)', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '12px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="text-sm font-medium mb-2" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={16} /> Jam Mulai
                    </label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      style={{ backgroundColor: 'var(--bg)', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '12px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="text-sm font-medium mb-2" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={16} /> Jam Selesai
                    </label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      style={{ backgroundColor: 'var(--bg)', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '12px' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlignLeft size={16} /> Tipe Kategori
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    style={{ backgroundColor: 'var(--bg)', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '12px' }}
                  >
                    <option value="event">Event Khusus Client (Biru)</option>
                    <option value="reminder">Follow Up Reminder (Kuning)</option>
                    <option value="deadline">Project Deadline (Merah)</option>
                    <option value="task">Internal Task / Briefing (Hijau)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={16} /> AO (Account Officer)
                  </label>
                  <input
                    type="text"
                    value={formData.pic}
                    readOnly
                    disabled
                    style={{ backgroundColor: 'var(--border)', padding: '12px 16px', border: 'none', color: 'var(--text-secondary)', width: '100%', borderRadius: '12px', cursor: 'not-allowed' }}
                  />
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>AO otomatis diambil dari akun yang sedang login.</p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Deskripsi Detail</label>
                  <textarea
                    rows={4}
                    value={formData.desc}
                    onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                    placeholder="Tulis instruksi task / catatan di sini..."
                    style={{ backgroundColor: 'var(--bg)', resize: 'none', padding: '12px 16px', border: '1px solid var(--border)', width: '100%' }}
                  ></textarea>
                </div>
              </form>
            </div>

            <div style={{ padding: '24px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--surface)' }}>

              {selectedEvent && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {formData.type === 'event' && (
                    <button
                      type="button"
                      onClick={() => navigate('/reports/event', {
                        state: {
                          eventData: {
                            schoolName: formData.schoolName,
                            program: formData.title,
                            date: formData.date,
                            pic: formData.pic
                          }
                        }
                      })}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', backgroundColor: '#2ED47A', borderColor: '#2ED47A' }}
                    >
                      <ClipboardCheck size={16} /> Buat Laporan After-Event
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSyncToGoogle}
                    className="btn btn-outline"
                    style={{ width: '100%', justifyContent: 'center', borderColor: '#4285F4', color: '#4285F4', backgroundColor: '#F0F7FF' }}
                  >
                    <Share2 size={16} /> Sync to Google Calendar
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                {selectedEvent && (
                  <button type="button" onClick={handleDelete} className="icon-btn" style={{ color: '#FF5252', backgroundColor: '#FFE5E5', borderRadius: '12px', width: '50px', height: '50px' }}>
                    <Trash2 size={20} />
                  </button>
                )}
                <button type="button" onClick={() => setIsDrawerOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
                <button type="submit" form="event-form" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                  <Send size={16} /> {selectedEvent ? 'Simpan Update' : 'Buat Event'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
};

export default Calendar;
