import React, { useState, useMemo, useRef, useEffect } from 'react';
// Optimized import for DND
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, MoreVertical, Calendar, DollarSign, X, Trash2, FilePlus, Building2, Edit2 } from 'lucide-react';
import { invokeApi } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { logActivity } from '../../utils/activityLogger';
import { updateClientActivity, updateClientStatusAndProses } from '../../utils/clientUtils';
import { sendNotificationByName } from '../../utils/notificationUtils';

const Leads = () => {
  const navigate = useNavigate();
  const { leads, projects, calendarEvents, events, clients, uniqueSchools } = useAppData();
  const { userRole, currentUser, userProfile } = useAuth();
  const { showAlert, showConfirm } = useNotification();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const userName = (userProfile?.nickname?.trim() || userProfile?.name) || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Staff';

  const hasAccess = (lead) => {
    if (userProfile?.role === 'owner' || userProfile?.role === 'admin') return true;
    if (!lead) return false;

    // 1. Check by ID (The preferred way)
    if (lead.picId && currentUser?.uid && lead.picId === currentUser.uid) return true;

    // 2. Fallback by Name (For legacy data)
    const picName = lead.pic;
    if (!picName) return false;
    const searchPic = picName.toLowerCase().trim();
    const myNickname = userProfile?.nickname?.toLowerCase().trim();
    const myFullName = userProfile?.name?.toLowerCase().trim();
    const myDisplayName = currentUser?.displayName?.toLowerCase().trim();

    return searchPic === myNickname || searchPic === myFullName || searchPic === myDisplayName || searchPic === userName.toLowerCase().trim();
  };

  const columns = leads; // Use the structured leads from AppDataContext

  // --- AUTO MOVE: Confirm -> Deal when current month matches Payment Date ---
  useEffect(() => {
    if (!leads.confirm || leads.confirm.items.length === 0) return;
    const currentYearMonth = new Date().toISOString().substring(0, 7); // e.g. "2026-04"

    leads.confirm.items.forEach(async (item) => {
      // If payment is scheduled for this month, move to deal automatically
      if (item.paymentDate && item.paymentDate.startsWith(currentYearMonth)) {
        try {
          await invokeApi(`/leads?id=eq.${item.id}`, {
            method: 'PUT',
            body: {
              status: 'deal',
              isRealPrice: true,
              updatedAt: new Date().toISOString()
            }
          });

          if (item.calendarEventId) {
            await invokeApi(`/calendar_events?id=eq.${item.calendarEventId}`, {
              method: 'PATCH',
              body: {
                backgroundColor: '#E5EFFF',
                borderColor: '#4680FF',
                textColor: '#4680FF',
                extendedProps: { ...(item.extendedProps || {}), isEstimasi: false },
                updatedAt: new Date().toISOString()
              }
            });
          }
        } catch (err) {
          console.error("Auto-move error:", err);
        }
      }
    });
  }, [leads.confirm]);



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

  // Modal states for Business Rules
  const [dealConfirmModalOpen, setDealConfirmModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState(null);
  const [inputValRealPrice, setInputValRealPrice] = useState('');
  const [inputValDocRef, setInputValDocRef] = useState('');
  const [inputPaymentDate, setInputPaymentDate] = useState('');
  const [inputCancelReason, setInputCancelReason] = useState('');

  // Add/Edit Lead Drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [newLead, setNewLead] = useState({
    schoolName: '',
    schoolPic: '',
    program: '',
    date: '',
    price: '', // Estimasi Nilai setup di awal
    pic: userName,
    picId: currentUser?.uid,
    notes: '',
    duration: '8', // Default to 1 day (8 hours)
    newPicSalutation: '',
    newPicName: ''
  });

  const handleOpenEdit = (lead) => {
    setEditingLead(lead);
    setNewLead({
      schoolName: lead.schoolName || lead.school || '',
      schoolPic: lead.schoolPic || '',
      program: lead.program || '',
      date: lead.date || '',
      price: lead.price || '',
      pic: lead.pic || userName,
      picId: lead.picId || '',
      notes: lead.notes || '',
      duration: lead.duration || '8',
      newPicSalutation: '',
      newPicName: ''
    });
    setIsDrawerOpen(true);
  };


  const schoolPics = useMemo(() => {
    if (!newLead.schoolName) return [];
    return clients.filter(c => (c.sekolah || c.school).toLowerCase() === newLead.schoolName.toLowerCase());
  }, [clients, newLead.schoolName]);

  const isNewSchool = useMemo(() => {
    if (!newLead.schoolName) return false;
    return !uniqueSchools.find(s => s.name.toLowerCase() === newLead.schoolName.trim().toLowerCase());
  }, [newLead.schoolName, uniqueSchools]);

  const formatRupiah = (value) => {
    if (!value) return '';
    const numberString = value.replace(/[^0-9]/g, '');
    const number = parseInt(numberString);
    if (isNaN(number)) return '';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(number) + ',-';
  };

  const toRoman = (num) => {
    const romanMap = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    return romanMap[num] || num.toString();
  };

  const generateDocRefDraft = () => {
    const now = new Date();
    const mm = now.getMonth() + 1;
    const romanMonth = toRoman(mm);
    const yyyy = now.getFullYear();
    return `.../SKK/MCC/${romanMonth}/${yyyy}`;
  };

  // Sync PIC when user profile loads
  useEffect(() => {
    if (userName && userName !== 'Staff') {
      setNewLead(prev => ({ ...prev, pic: userName }));
    }
  }, [userName]);

  const filteredSchoolSuggestions = uniqueSchools.filter(s =>
    s.name.toLowerCase().includes((newLead.schoolName || '').toLowerCase())
  );

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Trigger forms for Deal or Confirm (requiring Real Nilai Project & Surat)
    if (
      (destination.droppableId === 'deal' || destination.droppableId === 'confirm' || destination.droppableId === 'buyer') &&
      source.droppableId !== 'deal' && source.droppableId !== 'confirm' && source.droppableId !== 'buyer'
    ) {
      setPendingMove({ source, destination, draggableId });
      setInputValRealPrice('');
      setInputValDocRef(generateDocRefDraft());
      setInputPaymentDate('');
      setDealConfirmModalOpen(true);
      return;
    }

    // Trigger form for Cancel
    if (destination.droppableId === 'cancel' && source.droppableId !== 'cancel') {
      setPendingMove({ source, destination, draggableId });
      setCancelModalOpen(true);
      return;
    }

    executeMove(source, destination, draggableId);
  };

  const executeMove = async (source, destination, draggableId, extraData = {}) => {
    try {
      const updateData = {
        status: destination.droppableId,
        updatedAt: new Date().toISOString(),
        ...extraData
      };

      // Auto Log Activity
      const stageName = destination.droppableId.charAt(0).toUpperCase() + destination.droppableId.slice(1);
      logActivity(currentUser, `Memindahkan Lead ke tahap: ${stageName}`, draggableId, 'Lead', 'Leads');

      // Set flag if it's now a real price Stage
      if (destination.droppableId === 'deal' || destination.droppableId === 'confirm' || destination.droppableId === 'buyer') {
        updateData.isRealPrice = true;
      }

      await invokeApi(`/leads?id=eq.${draggableId}`, { method: 'PUT', body: updateData });

      // --- SYNC CLIENT STATUS & PROSES AUTOMATICALLY ---
      const allLeadItems = Object.values(leads).flatMap(col => col.items);
      const lead = allLeadItems.find(l => l.id === draggableId);

      if (lead && lead.schoolName) {
        const targetProses = destination.droppableId.toUpperCase();
        let targetStatus = null;
        if (['PROSPEK'].includes(targetProses)) targetStatus = 'WARM';
        if (['DEAL', 'CONFIRM', 'BUYER'].includes(targetProses)) targetStatus = 'HOT';
        // Note: For CANCEL, targetStatus remains null so the client retains status and cools down naturally over time (14d/45d)

        updateClientStatusAndProses(lead.schoolName, targetStatus, targetProses);
      }

      // --- SYNC CALENDAR EVENT COLOR ---
      if (lead && lead.calendarEventId) {
        if (destination.droppableId === 'cancel') {
          // Delete from calendar if moved to cancel
          await invokeApi(`/calendar_events?id=eq.${lead.calendarEventId}`, { method: 'DELETE' });

          // Also delete payment event if exists
          if (lead.paymentEventId) {
            try {
              await invokeApi(`/calendar_events?id=eq.${lead.paymentEventId}`, { method: 'DELETE' });
              // Clear paymentEventId from lead
              await invokeApi(`/leads?id=eq.${draggableId}`, { method: 'PUT', body: { paymentEventId: null } });
            } catch (pEvErr) {
              console.warn("Payment event not found or failed to delete:", pEvErr);
            }
          }
        } else {
          // Update color for other stages
          let bg = '#F4F6F9', border = '#7A849C', text = '#7A849C'; // Default Gray for Suspect/Prospect
          let isEstimasi = true;

          if (['confirm', 'deal'].includes(destination.droppableId)) {
            bg = '#E5EFFF'; border = '#4680FF'; text = '#4680FF'; // Blue for Commitment
            isEstimasi = false;
          } else if (destination.droppableId === 'buyer') {
            bg = '#E5F6EB'; border = '#2ED47A'; text = '#2ED47A'; // Green for Finalized
            isEstimasi = false;
          }

          // Get existing event props to merge
          const existingEvent = calendarEvents.find(e => e.id === lead.calendarEventId);
          const updatedProps = {
            ...(existingEvent?.extendedProps || {}),
            isEstimasi: isEstimasi
          };

          await invokeApi('/calendar_events', {
            method: 'PUT',
            body: {
              id: lead.calendarEventId,
              backgroundColor: bg,
              borderColor: border,
              textColor: text,
              extendedProps: updatedProps,
              updatedAt: new Date().toISOString()
            }
          });
        }

        // --- NEW: SYNC PAYMENT DATE TO CALENDAR (Orange Event) ---
        if (extraData.paymentDate) {
          const paymentEvId = `EVP-${draggableId}`; // Use consistent ID for payment
          await invokeApi('/calendar_events', {
            method: 'PUT',
            body: {
              id: paymentEvId,
              title: `[PAYMENT] ${lead.program} - ${lead.schoolName}`,
              start: extraData.paymentDate,
              allDay: true,
              backgroundColor: '#FFF4E5', // Orange for Payment
              borderColor: '#FFB020',
              textColor: '#FFB020',
              extendedProps: {
                type: 'reminder',
                leadId: draggableId,
                schoolName: lead.schoolName,
                schoolId: lead.schoolId,
                pic: lead.pic
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          });

          // Store reference in lead
          await invokeApi(`/leads?id=eq.${draggableId}`, { method: 'PUT', body: { paymentEventId: paymentEvId } });
        }
      }

      // Update Client Last Activity
      if (lead) {
        const stageName = destination.droppableId.charAt(0).toUpperCase() + destination.droppableId.slice(1);
        await updateClientActivity(lead.schoolName, `Lead moved to: ${stageName}`);
      }
    } catch (err) {
      console.error("Lead move error:", err);
      showAlert("Gagal", "Gagal memindahkan lead: " + err.message, "error");
    }
  };

  const handleModalSubmit = (type) => {
    let extraData = {};
    if (type === 'deal_confirm') {
      if (!inputValRealPrice) return showAlert('Peringatan', 'Real Nilai Project wajib diisi!', 'warning');
      if (!inputPaymentDate) return showAlert('Peringatan', 'Tanggal Pembayaran wajib diisi!', 'warning');
      extraData = {
        price: inputValRealPrice,
        docRef: inputValDocRef || '',
        paymentDate: inputPaymentDate
      };
      setDealConfirmModalOpen(false);
    }
    if (type === 'cancel') {
      if (!inputCancelReason) return showAlert('Peringatan', 'Alasan cancel wajib diisi!', 'warning');
      extraData = { cancelReason: inputCancelReason };
      setCancelModalOpen(false);
    }

    executeMove(pendingMove.source, pendingMove.destination, pendingMove.draggableId, extraData);
    setPendingMove(null);
    setInputValRealPrice('');
    setInputValDocRef('');
    setInputPaymentDate('');
    setInputCancelReason('');
  };

  const cancelPendingMove = () => {
    setDealConfirmModalOpen(false);
    setCancelModalOpen(false);
    setPendingMove(null);
    setInputValRealPrice('');
    setInputValDocRef('');
    setInputPaymentDate('');
    setInputCancelReason('');
  };

  const handleAddLeadSubmit = async (e) => {
    e.preventDefault();
    const matched = uniqueSchools.find(s => s.name.toLowerCase() === newLead.schoolName.trim().toLowerCase());
    const finalSchoolId = matched ? matched.id : (editingLead?.schoolId || `S-${Math.floor(Math.random() * 9000) + 1000}`);

    let finalSchoolPic = newLead.schoolPic;


    if (editingLead) {
      // MODE UPDATE
      try {
        const updateData = {
          schoolId: finalSchoolId,
          schoolName: newLead.schoolName,
          schoolPic: finalSchoolPic,
          program: newLead.program,
          price: newLead.price,
          pic: newLead.pic,
          picId: newLead.picId || currentUser?.uid,
          date: newLead.date || 'TBD',
          duration: newLead.duration,
          notes: newLead.notes,
          updatedAt: new Date().toISOString()
        };

        // Sync to calendar if date changed
        if (newLead.date !== editingLead.date && editingLead.calendarEventId) {
          const existingEvent = calendarEvents.find(e => e.id === editingLead.calendarEventId);
          const updatedProps = {
            ...(existingEvent?.extendedProps || {}),
            schoolName: newLead.schoolName,
            pic: newLead.pic,
            duration: newLead.duration
          };

          await invokeApi('/calendar_events', {
            method: 'PUT',
            body: {
              id: editingLead.calendarEventId,
              title: `${newLead.program} - ${newLead.schoolName}`,
              start: newLead.date,
              extendedProps: updatedProps,
              updatedAt: new Date().toISOString()
            }
          });
        }

        await invokeApi(`/leads?id=eq.${editingLead.id}`, { method: 'PUT', body: updateData });
        setIsDrawerOpen(false);
        setEditingLead(null);
        setNewLead({ schoolName: '', schoolPic: '', program: '', date: '', price: '', pic: userName, notes: '', duration: '8', newPicSalutation: '', newPicName: '' });
        showAlert("Berhasil", "Lead telah diperbarui.", "success");
        return;
      } catch (err) {
        console.error("Update lead error:", err);
        return showAlert("Kesalahan", "Gagal memperbarui lead: " + err.message, "error");
      }
    }

    const newId = `L-${Math.floor(Math.random() * 9000) + 1000}`;

    // Create new client if it's a new school or "Tambah PIC Baru"
    if (isNewSchool || newLead.schoolPic === 'new') {
      if (!newLead.newPicName) {
        return showAlert('Peringatan', 'Nama PIC wajib diisi untuk entri baru.', 'warning');
      }
      const clientId = `C-${Math.floor(Math.random() * 9000) + 1000}`;
      await invokeApi('/clients', {
        method: 'POST',
        body: {
          id: clientId,
          schoolId: finalSchoolId,
          sekolah: newLead.schoolName.trim(),
          nama: newLead.newPicName.trim(),
          sapaan: newLead.newPicSalutation,
          panggilan: '',
          posisi: '',
          whatsapp: '',
          email: '',
          status: 'COLD',
          proses: 'SUSPECT',
          notes: 'Dibuat otomatis dari Leads',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastActivityDesc: 'Registered',
          lastActivityAt: new Date().toISOString()
        }
      });
      finalSchoolPic = newLead.newPicName.trim();
    }

    const hasValidDate = newLead.date && newLead.date !== 'TBD';

    const lead = {
      id: newId,
      schoolId: finalSchoolId,
      schoolName: newLead.schoolName,
      schoolPic: finalSchoolPic,
      program: newLead.program,
      price: newLead.price,
      isRealPrice: false,
      pic: newLead.pic,
      picId: currentUser?.uid,
      date: newLead.date || 'TBD',
      duration: newLead.duration,
      notes: newLead.notes,
      status: 'suspect',
      calendarEventId: hasValidDate ? `EVL-${newId}` : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await invokeApi('/leads', { method: 'POST', body: lead });

      // Auto Log Activity
      logActivity(currentUser, `Menambah Lead baru: ${lead.schoolName} - ${lead.program}`, newId, 'Lead', 'Leads');

      // Auto-Sync to Calendar only if valid date provided
      if (lead.calendarEventId && hasValidDate) {
        let endDate = newLead.date;
        const durHours = parseInt(newLead.duration);

        // If 2 days or more, calculate end date for multi-day display
        if (durHours === 16) {
          const d = new Date(newLead.date);
          d.setDate(d.getDate() + 2);
          endDate = d.toISOString().split('T')[0];
        } else if (durHours === 24) {
          const d = new Date(newLead.date);
          d.setDate(d.getDate() + 3);
          endDate = d.toISOString().split('T')[0];
        }

        await invokeApi('/calendar_events', {
          method: 'POST',
          body: {
            id: lead.calendarEventId,
            title: `${newLead.program} - ${newLead.schoolName}`,
            start: newLead.date,
            end: endDate,
            allDay: true,
            backgroundColor: '#F4F6F9', // Gray for Initial Suspect
            borderColor: '#7A849C',
            textColor: '#7A849C',
            extendedProps: {
              type: 'event',
              isEstimasi: true,
              pic: userName,
              duration: newLead.duration,
              desc: `Lead baru dibuat untuk program ${newLead.program}. Durasi: ${newLead.duration} Jam. Catatan: ${newLead.notes}`,
              schoolName: newLead.schoolName,
              schoolId: finalSchoolId
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        });
      }

      // 3. Send Notification to PIC
      if (lead.pic && lead.pic !== userName) {
        await sendNotificationByName(lead.pic, {
          title: 'Lead Baru Ditugaskan',
          text: `Anda ditugaskan sebagai PIC untuk ${lead.schoolName} - ${lead.program}`,
          type: 'assign',
          link: '/leads'
        });
      }

      setIsDrawerOpen(false);
      setNewLead({ schoolName: '', schoolPic: '', program: '', date: '', price: '', pic: userName, notes: '', duration: '8', newPicSalutation: '', newPicName: '' });
      showAlert("Berhasil", "Lead baru telah berhasil ditambahkan ke pipeline.", "success");
    } catch (err) {
      console.error("Add lead error:", err);
      showAlert("Kesalahan", "Gagal menambah lead: " + err.message, "error");
    }
  };

  const handleDeleteLead = (e, lead) => {
    e.stopPropagation();
    if (!hasAccess(lead)) return;

    showConfirm(
      "Konfirmasi Hapus",
      `Apakah Anda yakin ingin menghapus lead "${lead.program}" dari ${lead.schoolName}? Tindakan ini juga akan menghapus jadwal terkait di kalender.`,
      async () => {
        try {
          await invokeApi(`/leads?id=eq.${lead.id}`, { method: 'DELETE' });

          if (lead.calendarEventId) {
            try {
              await invokeApi(`/calendar_events?id=eq.${lead.calendarEventId}`, { method: 'DELETE' });
            } catch (evErr) {
              console.warn("Linked calendar event not found or failed to delete:", evErr);
            }
          }

          if (lead.paymentEventId) {
            try {
              await invokeApi(`/calendar_events?id=eq.${lead.paymentEventId}`, { method: 'DELETE' });
            } catch (pEvErr) {
              console.warn("Linked payment event not found or failed to delete:", pEvErr);
            }
          }
          showAlert("Berhasil", "Lead telah dihapus.", "success");
        } catch (err) {
          console.error("Delete lead error:", err);
          showAlert("Gagal", "Gagal menghapus lead: " + err.message, "error");
        }
      }
    );
  };

  return (
    <div style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .lead-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .lead-card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.08) !important; }
        .lead-card-detail { 
          max-height: 0; 
          opacity: 0; 
          overflow: hidden; 
          transition: all 0.3s ease-in-out;
        }
        .lead-card:hover .lead-card-detail,
        .lead-card.expanded .lead-card-detail { 
          max-height: 500px; 
          opacity: 1; 
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .text-truncate {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }

      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '8px' : '4px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '24px' : '30px', fontWeight: 700, margin: 0 }}>Leads Pipeline</h1>
          {!isMobile && <p className="text-secondary text-sm">Kelola Leads Potensial yang masuk</p>}
        </div>
        <button className="btn btn-primary" style={{ borderRadius: '12px', padding: isMobile ? '10px 16px' : '12px 24px' }} onClick={() => setIsDrawerOpen(true)}>
          <Plus size={18} /> {isMobile ? 'Add' : 'Add Lead'}
        </button>
      </div>

      <div style={{
        flex: 1,
        marginTop: '16px',
        overflow: 'hidden',
        paddingBottom: '8px',
      }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ display: 'flex', gap: '16px', height: '100%', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '16px', scrollSnapType: 'x mandatory' }}>
            {Object.keys(columns).map((colId) => {
              const column = columns[colId];
              return (
                <div key={colId} style={{
                  flex: isMobile ? '0 0 calc(100vw - 48px)' : '1 1 250px',
                  minWidth: isMobile ? 'calc(100vw - 48px)' : '220px',
                  maxWidth: isMobile ? 'calc(100vw - 48px)' : '350px',
                  backgroundColor: '#F4F6F9',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '100%',
                  border: `1px solid ${column.color}30`,
                  overflow: 'hidden',
                  scrollSnapAlign: 'start'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: 'white',
                    borderTop: `4px solid ${column.color}` // Color tag on top
                  }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: column.color, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {column.title}
                      <span style={{ backgroundColor: column.bgSoft, padding: '2px 8px', borderRadius: '12px', fontSize: '14px', color: column.color }}>
                        {column.items.length}
                      </span>
                    </h3>
                  </div>

                  <Droppable droppableId={colId}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        style={{
                          flex: 1,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          padding: '16px',
                          backgroundColor: snapshot.isDraggingOver ? `${column.color}15` : 'transparent',
                          transition: 'background-color 0.2s ease',
                        }}
                      >
                        {column.items.map((item, index) => {
                          const currentColumnId = colId; // Explicitly capture current column ID
                          return (
                            <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!hasAccess(item)}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`lead-card ${expandedId === item.id ? 'expanded' : ''}`}
                                  onClick={() => setExpandedId(prev => prev === item.id ? null : item.id)}
                                  style={{
                                    ...provided.draggableProps.style,
                                    backgroundColor: 'white',
                                    borderRadius: '12px',
                                    padding: '14px',
                                    boxShadow: (snapshot.isDragging || expandedId === item.id) ? '0 12px 24px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.04)',
                                    border: (snapshot.isDragging || expandedId === item.id) ? `1px solid ${column.color}` : '1px solid var(--border)',
                                    userSelect: !hasAccess(item) ? 'none' : 'auto',
                                    cursor: !hasAccess(item) ? 'not-allowed' : 'pointer',
                                    opacity: !hasAccess(item) ? 0.8 : 1,
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  {/* Permanently Visible Part */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span
                                      onClick={(e) => { e.stopPropagation(); navigate(`/clients/dashboard/${item.schoolName || item.school}`); }}
                                      style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}
                                      className="hover:underline text-truncate"
                                      title={item.schoolName || item.school}
                                    >
                                      {item.schoolName || item.school}
                                    </span>

                                    {item.price && (() => {
                                      let color = '#7A849C';
                                      if (currentColumnId === 'buyer') color = '#2ED47A';
                                      else if (item.isRealPrice) color = '#FFB020';

                                      return (
                                        <div style={{ fontSize: '16px', fontWeight: 800, color: color }}>
                                          {formatRupiah(item.price)}
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  {/* Hover Detail Part */}
                                  <div className="lead-card-detail">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
                                      <span className="text-truncate" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }} title={item.program || item.programName}>
                                        {item.program || item.programName || 'No Program'}
                                      </span>
                                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                                        {item.date || '-'}
                                      </span>
                                    </div>

                                    {item.docRef && (
                                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }} className="text-truncate">
                                        Ref: {item.docRef}
                                      </p>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
                                      <div style={{ width: '18px', height: '18px', backgroundColor: '#E5EFFF', color: '#4680FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '10px' }}>
                                        {item.pic?.charAt(0).toUpperCase() || '?'}
                                      </div>
                                      <span className="text-truncate">AO: {item.pic}</span>
                                    </div>

                                    {/* Action Buttons (Now in detail area) */}
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px dashed var(--border)', paddingTop: '12px' }}>
                                      {['suspect', 'prospek', 'confirm', 'deal', 'buyer'].includes(currentColumnId) && hasAccess(item) && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            let docType = 'SPH';
                                            if (currentColumnId === 'prospek') docType = 'SKK';
                                            else if (currentColumnId === 'confirm' || currentColumnId === 'deal') docType = 'INV';
                                            else if (currentColumnId === 'buyer') docType = 'KUI';
                                            navigate('/documents', { state: { preFill: { linkedLeadId: item.id, client: item.schoolName || item.school, program: item.program || item.programName, value: item.price || item.budget || 0, startDate: item.date || '', type: docType } } });
                                          }}
                                          className="icon-btn" style={{ width: '32px', height: '32px', backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
                                          title="Buat Dokumen"
                                        >
                                          <FilePlus size={14} />
                                        </button>
                                      )}
                                      {hasAccess(item) && (
                                        <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }} className="icon-btn" style={{ width: '32px', height: '32px', backgroundColor: '#FFF4E5', color: '#FFB020' }} title="Edit">
                                          <Edit2 size={14} />
                                        </button>
                                      )}
                                      {hasAccess(item) && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteLead(e, item); }} className="icon-btn" style={{ width: '32px', height: '32px', backgroundColor: '#FFE5E5', color: '#FF5252' }} title="Hapus">
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Leads Drawer for "+" Add */}
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
              <h2 className="text-xl font-semibold">{editingLead ? 'Edit Lead' : 'Tambah Leads Baru'}</h2>
              <button onClick={() => { setIsDrawerOpen(false); setEditingLead(null); }} style={{ color: 'var(--text-secondary)' }}>
                <X size={24} />
              </button>

            </div>

            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              <form id="lead-form" onSubmit={handleAddLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ position: 'relative' }} ref={autocompleteRef}>
                  <label className="text-sm font-medium mb-2 block">Cari Sekolah<span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    required
                    value={newLead.schoolName}
                    onChange={(e) => {
                      setNewLead({ ...newLead, schoolName: e.target.value });
                      setShowSchoolDropdown(true);
                    }}
                    onFocus={() => setShowSchoolDropdown(true)}
                    placeholder="Search existing / type new school..."
                    style={{ backgroundColor: 'var(--bg)', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '8px' }}
                  />
                  {showSchoolDropdown && newLead.schoolName.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)', borderRadius: '12px', marginTop: '4px', zIndex: 10,
                      maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 16px rgba(0,0,0,0.08)'
                    }}>
                      {filteredSchoolSuggestions.length > 0 ? (
                        <>
                          <div style={{ padding: '8px 16px', fontSize: '14px', color: 'var(--text-secondary)', backgroundColor: '#F8F9FB', borderBottom: '1px solid var(--border)' }}>PILIH SEKOLAH TERDAFTAR:</div>
                          {filteredSchoolSuggestions.map(s => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setNewLead({ ...newLead, schoolName: s.name });
                                setShowSchoolDropdown(false);
                              }}
                              style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                              className="hover:bg-primary-soft transition-colors"
                            >
                              <p style={{ margin: 0, fontWeight: 500, fontSize: '15px' }}>
                                <span style={{ color: 'var(--primary)', marginRight: '6px' }}>{s.id}</span>
                                {s.name}
                              </p>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '15px' }}>
                          Sekolah baru? <strong>"{newLead.schoolName}"</strong> akan dibuat sebagai record baru.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* PIC Input Section based on whether school is new or not */}
                {newLead.schoolName.trim() && (
                  isNewSchool ? (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '16px', backgroundColor: '#F8F9FB', padding: '16px', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Sapaan</label>
                        <select
                          value={newLead.newPicSalutation}
                          onChange={(e) => setNewLead({ ...newLead, newPicSalutation: e.target.value })}
                          style={{ backgroundColor: 'white', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '8px' }}
                        >
                          <option value="">Pilih...</option>
                          <option value="Bapak/Mr">Bapak / Mr</option>
                          <option value="Ibu/Mrs">Ibu / Mrs</option>
                          <option value="Ms">Ms</option>
                          <option value="Kak">Kak</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Nama PIC <span style={{ color: 'red' }}>*</span></label>
                        <input
                          type="text"
                          required={isNewSchool}
                          value={newLead.newPicName}
                          onChange={(e) => setNewLead({ ...newLead, newPicName: e.target.value })}
                          placeholder="Nama lengkap PIC baru..."
                          style={{ backgroundColor: 'white', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '8px' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm font-medium mb-2 block">PIC Sekolah <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 400 }}>(Pilih PIC atau Tambah Baru")</span></label>
                      <select
                        value={newLead.schoolPic}
                        onChange={(e) => setNewLead({ ...newLead, schoolPic: e.target.value })}
                        style={{ backgroundColor: 'var(--bg)', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        <option value="">-- Pilih PIC Sekolah --</option>
                        {schoolPics.map((pic, idx) => {
                          const displayName = pic.panggilan || pic.nickname || pic.nama || pic.name || 'Unknown';
                          const actualName = pic.nama || pic.name || 'Unknown';
                          const actualSalutation = pic.sapaan || pic.salutation || '';
                          return (
                            <option key={idx} value={actualName}>
                              {actualSalutation} {displayName}
                            </option>
                          );
                        })}
                        <option value="new" style={{ fontSize: '14px', color: 'var(--primary)' }}>+ Tambah PIC</option>
                      </select>

                      {/* Show New PIC Inputs if 'new' is selected */}
                      {newLead.schoolPic === 'new' && (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '16px', backgroundColor: '#F8F9FB', padding: '16px', borderRadius: '12px', border: '1px dashed var(--border)', marginTop: '12px' }}>
                          <div>
                            <label className="text-sm font-medium mb-2 block">Sapaan</label>
                            <select
                              value={newLead.newPicSalutation}
                              onChange={(e) => setNewLead({ ...newLead, newPicSalutation: e.target.value })}
                              style={{ backgroundColor: 'white', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '8px' }}
                            >
                              <option value="">Pilih...</option>
                              <option value="Bapak/Mr">Bapak / Mr</option>
                              <option value="Ibu/Mrs">Ibu / Mrs</option>
                              <option value="Ms">Ms</option>
                              <option value="Kak">Kak</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">Nama PIC <span style={{ color: 'red' }}>*</span></label>
                            <input
                              type="text"
                              required={newLead.schoolPic === 'new'}
                              value={newLead.newPicName}
                              onChange={(e) => setNewLead({ ...newLead, newPicName: e.target.value })}
                              placeholder="Nama lengkap PIC baru..."
                              style={{ backgroundColor: 'white', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '8px' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">Program Layanan / Event <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    required
                    value={newLead.program}
                    onChange={(e) => setNewLead({ ...newLead, program: e.target.value })}
                    placeholder="e.g. LDKS / Seminar Motivasi"
                    style={{ backgroundColor: 'var(--bg)', padding: '12px 16px', border: '1px solid var(--border)', width: '100%' }}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Estimasi Nilai Project (Rp) <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    required
                    value={newLead.price}
                    onChange={(e) => {
                      const formatted = formatRupiah(e.target.value);
                      setNewLead({ ...newLead, price: formatted });
                    }}
                    placeholder="e.g. Rp 25.000.000"
                    style={{ backgroundColor: 'var(--bg)', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '8px' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="text-sm font-medium mb-2 block">Tanggal Event (Est.)</label>
                    <input
                      type="date"
                      value={newLead.date}
                      onChange={(e) => setNewLead({ ...newLead, date: e.target.value })}
                      style={{ backgroundColor: 'var(--bg)', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '8px', fontSize: '15px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="text-sm font-medium mb-2 block">Durasi</label>
                    <select
                      value={newLead.duration}
                      onChange={(e) => setNewLead({ ...newLead, duration: e.target.value })}
                      style={{ backgroundColor: 'var(--bg)', padding: '12px 16px', border: '1px solid var(--border)', width: '100%', borderRadius: '8px', fontSize: '15px', cursor: 'pointer' }}
                    >
                      <option value="1">1 Jam</option>
                      <option value="2">2 Jam</option>
                      <option value="4">Setengah Hari</option>
                      <option value="8">Sehari (Full-day)</option>
                      <option value="16">2 Hari</option>
                      <option value="24">3 Hari</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="text-sm font-medium mb-2 block">AO (Account Officer)</label>
                    <input
                      type="text"
                      disabled
                      value={newLead.pic}
                      style={{ backgroundColor: 'var(--border)', padding: '12px 16px', border: 'none', color: 'var(--text-secondary)', width: '100%', borderRadius: '8px', fontSize: '15px' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Catatan Tambahan [opsional]</label>
                  <textarea
                    rows={4}
                    value={newLead.notes}
                    onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                    placeholder="Catatan singkat tentang Lead ini..."
                    style={{ backgroundColor: 'var(--bg)', resize: 'none', padding: '12px 16px', border: '1px solid var(--border)', width: '100%' }}
                  ></textarea>
                </div>
              </form>
            </div>

            <div style={{ padding: '24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', backgroundColor: 'var(--surface)' }}>
              <button type="button" onClick={() => setIsDrawerOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
              <button type="submit" form="lead-form" className="btn btn-primary" style={{ flex: 1 }}>Tambah</button>
            </div>
          </div>
        </>
      )}

      {/* Global Modals for Business Validations (Deal/Confirm, Cancel) */}
      {(dealConfirmModalOpen || cancelModalOpen) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '400px', boxShadow: '0 24px 48px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
                {dealConfirmModalOpen && 'Tahap Komitmen (Deal / Confirm)'}
                {cancelModalOpen && 'Tahap Cancel / Batal'}
              </h3>
              <button onClick={cancelPendingMove} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>

            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              {dealConfirmModalOpen && 'Input nilai project riil dan nomor surat terkait (opsional) untuk memindahkan lead ke tahap ini.'}
              {cancelModalOpen && 'Sayang sekali. Mohon jelaskan secara logis alasan kenapa klien ini gagal (*Lost*).'}
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleModalSubmit(dealConfirmModalOpen ? 'deal_confirm' : 'cancel') }}>
              {cancelModalOpen ? (
                <>
                  <label style={{ display: 'block', fontSize: '15px', fontWeight: 500, marginBottom: '8px' }}>Alasan Lengkap Batal</label>
                  <textarea
                    value={inputCancelReason}
                    onChange={(e) => setInputCancelReason(e.target.value)}
                    placeholder="Misal: Anggaran dipotong dari pihak yayasan..."
                    rows={3}
                    required
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', marginBottom: '24px', outline: 'none' }}
                  />
                </>
              ) : (
                <>
                  <label style={{ display: 'block', fontSize: '15px', fontWeight: 500, marginBottom: '8px' }}>Real Nilai Project (Rp) <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    value={inputValRealPrice}
                    onChange={(e) => {
                      const formatted = formatRupiah(e.target.value);
                      setInputValRealPrice(formatted);
                    }}
                    placeholder="Rp 5.000.000,-"
                    required
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', marginBottom: '16px', outline: 'none' }}
                  />

                  <label style={{ display: 'block', fontSize: '15px', fontWeight: 500, marginBottom: '8px' }}>Tanggal Pembayaran <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="date"
                    value={inputPaymentDate}
                    onChange={(e) => setInputPaymentDate(e.target.value)}
                    required
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', marginBottom: '16px', outline: 'none' }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ display: 'block', fontSize: '15px', fontWeight: 500, margin: 0 }}>No Surat (Opsional)</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!pendingMove?.draggableId) return;
                        // Find the lead item manually
                        const allItems = Object.values(leads).flatMap(col => col.items);
                        const item = allItems.find(i => i.id === pendingMove.draggableId);

                        if (!item) return;

                        navigate('/documents', {
                          state: {
                            preFill: {
                              linkedLeadId: item.id,
                              client: item.schoolName || item.school,
                              program: item.program || item.programName,
                              value: inputValRealPrice || item.price || 0,
                              startDate: item.date || '',
                              type: 'SKK'
                            }
                          }
                        });
                      }}
                      style={{ color: 'var(--primary)', fontSize: '14px', fontWeight: 700, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={14} /> Tambah Surat SKK
                    </button>
                  </div>
                  <input
                    type="text"
                    value={inputValDocRef}
                    onChange={(e) => setInputValDocRef(e.target.value)}
                    placeholder="Contoh: 012/SKK/MCC/IV/2026"
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8F9FB', marginBottom: '24px', outline: 'none' }}
                  />
                </>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={cancelPendingMove} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Ok</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leads;
