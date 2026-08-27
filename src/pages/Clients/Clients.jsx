import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Filter, MoreVertical, Edit2, Trash2, Eye, Download, Upload, Clock, ChevronLeft, ChevronRight, X, Building2, Send, Sparkles, Radio } from 'lucide-react';
import { invokeApi } from '../../lib/supabase';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useBroadcast } from '../../context/BroadcastContext';
import { openManualWaChat } from '../../utils/whatsappUtils';
import { logActivity } from '../../utils/activityLogger';
import { cascadeSchoolNameUpdate, calculateDynamicClientStatus, findSimilarSchool } from '../../utils/clientUtils';

const Clients = () => {
  const navigate = useNavigate();
  const { clients, uniqueSchools } = useAppData();
  const { userRole, currentUser } = useAuth();
  const { showAlert, showConfirm, showToast } = useNotification();
  const { startClientDrip, stopClientDrip, clientDrips, dripSteps = [], templates = [] } = useBroadcast();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');

  // Drawer & Form State
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('clientsTab') || 'clients';
  });

  useEffect(() => {
    localStorage.setItem('clientsTab', activeTab);
  }, [activeTab]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    sekolah: '',
    schoolId: '',
    alamat: '',
    sapaan: 'Bapak',
    nama: '',
    panggilan: '',
    posisi: '',
    whatsapp: '',
    email: '',
    notes: ''
  });

  // Autocomplete State
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);

  // CSV Import Typo Queue State
  const [importPendingQueue, setImportPendingQueue] = useState([]);
  const [currentTypoItem, setCurrentTypoItem] = useState(null);
  const [importCount, setImportCount] = useState(0);

  // Bulk Selection & Sapa Modal State
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [prosesFilter, setProsesFilter] = useState('all');
  const [isSapaModalOpen, setIsSapaModalOpen] = useState(false);
  const [sapaTargetClients, setSapaTargetClients] = useState([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sync Form when editing
  useEffect(() => {
    if (editingClient) {
      setFormData({
        sekolah: editingClient.sekolah || editingClient.school || '',
        schoolId: editingClient.schoolId || '',
        alamat: editingClient.alamat || editingClient.schoolAddress || '',
        sapaan: editingClient.sapaan || editingClient.salutation || 'Bapak',
        nama: editingClient.nama || editingClient.name || '',
        panggilan: editingClient.panggilan || editingClient.nickname || '',
        posisi: editingClient.posisi || editingClient.position || '',
        whatsapp: editingClient.whatsapp || editingClient.phone || '',
        email: editingClient.email || '',
        notes: editingClient.notes || ''
      });
    } else {
      setFormData({
        sekolah: '',
        schoolId: '',
        alamat: '',
        sapaan: 'Bapak',
        nama: '',
        panggilan: '',
        posisi: '',
        whatsapp: '',
        email: '',
        notes: ''
      });
    }
  }, [editingClient]);

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const clientName = client.nama || client.name || '';
      const clientSchool = client.sekolah || client.school || '';
      const clientPhone = client.whatsapp || client.phone || '';
      const matchesSearch =
        clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clientSchool.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clientPhone.includes(searchQuery) ||
        client.email?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const dynamicStatus = calculateDynamicClientStatus(client);

      if (statusFilter !== 'all' && dynamicStatus !== statusFilter) {
        return false;
      }

      const clientProses = (client.proses || 'SUSPECT').toUpperCase();
      if (prosesFilter !== 'all' && clientProses !== prosesFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, [clients, searchQuery, statusFilter, prosesFilter]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage) || 1;
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  // Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedClientIds.length === paginatedClients.length && paginatedClients.length > 0) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(paginatedClients.map(c => c.id));
    }
  };

  const handleToggleSelect = (clientId) => {
    setSelectedClientIds(prev =>
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  // Proses Sapa Modal Openers & Submitter
  const handleOpenSapaModal = (targetList) => {
    if (!targetList || targetList.length === 0) return;
    setSapaTargetClients(targetList);
    setIsSapaModalOpen(true);
  };

  const handleConfirmStartSapa = async () => {
    for (const c of sapaTargetClients) {
      await startClientDrip(c);
    }
    setIsSapaModalOpen(false);
    setSelectedClientIds([]);
    showToast(`Berhasil memasukkan ${sapaTargetClients.length} client ke Proses Sapa!`, 'success');
  };

  const handleOpenAdd = () => {
    setEditingClient(null);
    setIsViewMode(false);
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (client) => {
    setEditingClient(client);
    setIsViewMode(false);
    setIsDrawerOpen(true);
  };

  const handleOpenView = (client) => {
    setEditingClient(client);
    setIsViewMode(true);
    setIsDrawerOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (userRole === 'viewer') return;

    const currentSekolah = (formData.sekolah || '').trim();
    const matchedSchool = uniqueSchools.find(s => s.name.toLowerCase() === currentSekolah.toLowerCase());
    const finalSchoolId = matchedSchool ? matchedSchool.id : (formData.schoolId || (editingClient ? editingClient.schoolId : `S-${Math.floor(Math.random() * 9000) + 1000}`));

    const clientData = {
      sapaan: formData.sapaan,
      nama: formData.nama,
      panggilan: formData.panggilan,
      sekolah: currentSekolah,
      schoolId: finalSchoolId,
      alamat: formData.alamat,
      posisi: formData.posisi,
      whatsapp: formData.whatsapp,
      email: formData.email,
      notes: formData.notes,
      status: editingClient ? (editingClient.status || 'COLD') : 'COLD',
      proses: editingClient ? (editingClient.proses || 'SUSPECT') : 'SUSPECT',
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.email
    };

    const editingSchoolName = editingClient ? (editingClient.sekolah || editingClient.school || '') : '';

    try {
      if (editingClient) {
        if (matchedSchool && matchedSchool.id !== editingClient.schoolId) {
          showConfirm(
            "Sekolah Sudah Ada",
            `Nama "${formData.sekolah}" sudah terdaftar dengan ID ${matchedSchool.id}. Apakah Anda ingin menggabungkan data ini ke sekolah tersebut?`,
            async () => {
              try {
                await cascadeSchoolNameUpdate(editingClient.schoolId, matchedSchool.id, editingSchoolName, currentSekolah);
                await invokeApi('/clients', {
                  method: 'PUT',
                  body: { id: editingClient.id, ...clientData, schoolId: matchedSchool.id }
                });
                setIsDrawerOpen(false);
                showAlert("Berhasil", "Data telah digabungkan ke sekolah yang sudah ada.", "success");
              } catch (mergeErr) {
                showAlert("Gagal", "Gagal merge otomatis: " + mergeErr.message, "error");
              }
            }
          );
          return;
        }

        if (editingSchoolName.trim() !== currentSekolah) {
          cascadeSchoolNameUpdate(editingClient.schoolId, finalSchoolId, editingSchoolName, currentSekolah);
        }

        await invokeApi('/clients', {
          method: 'PUT',
          body: { id: editingClient.id, ...clientData }
        });
        logActivity(currentUser, `Mengubah data client: ${formData.nama} (${currentSekolah})`, editingClient.id, 'Client', 'Clients');
        showAlert("Berhasil", "Data client telah diperbarui.", "success");
      } else {
        const newId = `C-${Math.floor(Math.random() * 9000) + 1000}`;
        await invokeApi('/clients', {
          method: 'POST',
          body: {
            ...clientData,
            id: newId,
            createdAt: new Date().toISOString(),
            lastActivityDesc: 'Registered',
            lastActivityAt: new Date().toISOString()
          }
        });
        logActivity(currentUser, `Menambah client baru: ${formData.nama} (${currentSekolah})`, newId, 'Client', 'Clients');
        showAlert("Berhasil", "Client baru telah ditambahkan.", "success");
      }
      setIsDrawerOpen(false);
    } catch (err) {
      console.error("Save client error:", err);
      showAlert("Gagal", "Gagal menyimpan data: " + err.message, "error");
    }
  };

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState('');

  const handleMerge = async () => {
    if (!mergeTargetId) return;
    const targetSchool = uniqueSchools.find(s => s.id === mergeTargetId);
    if (!targetSchool) return;

    showConfirm(
      "Konfirmasi Penggabungan",
      `Apakah Anda yakin ingin menggabungkan "${mergeSource.name}" ke "${targetSchool.name}"? Semua Leads, Project, dan Dokumen terkait akan dipindahkan ke ID "${targetSchool.id}".`,
      async () => {
        try {
          await cascadeSchoolNameUpdate(mergeSource.id, targetSchool.id, mergeSource.name, targetSchool.name);
          showAlert("Berhasil", "Data telah digabungkan.", "success");
          setIsMergeModalOpen(false);
          setMergeSource(null);
          setMergeTargetId('');
        } catch (err) {
          showAlert("Gagal", "Gagal menggabungkan: " + err.message, "error");
        }
      }
    );
  };

  const handleDelete = (id) => {
    if (userRole !== 'owner' && userRole !== 'admin') return showAlert("Akses Ditolak", "Hanya Owner dan Admin yang dapat menghapus data client.", "error");
    showConfirm(
      "Hapus Client",
      "Apakah Anda yakin ingin menghapus data client ini?",
      async () => {
        try {
          await invokeApi(`/clients?id=eq.${id}`, { method: 'DELETE' });
          showToast("Data client telah dihapus.", "success");
        } catch (err) {
          showAlert("Gagal", "Gagal menghapus data.", "error");
        }
      }
    );
  };
  const handleExport = () => {
    if (filteredClients.length === 0) {
      showToast("Tidak ada data client untuk diexport!", "error");
      return;
    }
    const headers = ['Sapaan', 'Nama', 'Panggilan', 'Sekolah', 'Alamat', 'Posisi', 'WhatsApp', 'Email', 'Status', 'Proses', 'Notes'];
    const rows = filteredClients.map(c => [
      c.sapaan || c.salutation || '',
      c.nama || c.name || '',
      c.panggilan || c.nickname || '',
      c.sekolah || c.school || '',
      c.alamat || c.schoolAddress || '',
      c.posisi || c.position || '',
      c.whatsapp || c.phone || '',
      c.email || '',
      c.status || 'COLD',
      c.proses || 'SUSPECT',
      c.notes || ''
    ]);

    const csvContent = headers.join(",") + "\n"
      + rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `MCKuadrat_Clients_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Data client berhasil diexport ke CSV!", "success");
  };

  const saveImportedClient = async (item, finalSchoolName, finalSchoolId) => {
    const newId = `C-${Math.floor(Math.random() * 9000) + 1000}`;
    await invokeApi('/clients', {
      method: 'POST',
      body: {
        id: newId,
        sapaan: item.sapaan || item.salutation || 'Bapak',
        nama: item.nama || item.name || 'Unknown',
        panggilan: item.panggilan || item.nickname || '',
        sekolah: finalSchoolName,
        schoolId: finalSchoolId,
        alamat: item.alamat || item.schooladdress || item['school address'] || item.schoolAddress || '',
        posisi: item.posisi || item.position || '',
        whatsapp: item.whatsapp || item.phone || '',
        email: item.email || '',
        status: item.status ? item.status.toUpperCase() : 'COLD',
        proses: item.proses ? item.proses.toUpperCase() : (item.stage ? item.stage.toUpperCase() : 'SUSPECT'),
        notes: item.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
  };

  const handleResolveTypo = async (choice) => {
    if (!currentTypoItem) return;
    const { item, match } = currentTypoItem;

    if (choice === 'existing') {
      await saveImportedClient(item, match.school.name, match.school.id);
      setImportCount(prev => prev + 1);
    } else if (choice === 'new') {
      const newSchoolId = `S-${Math.floor(Math.random() * 9000) + 1000}`;
      await saveImportedClient(item, (item.sekolah || item.school || '').trim(), newSchoolId);
      setImportCount(prev => prev + 1);
    }

    const remaining = importPendingQueue.slice(1);
    setImportPendingQueue(remaining);
    if (remaining.length > 0) {
      setCurrentTypoItem(remaining[0]);
    } else {
      setCurrentTypoItem(null);
      showToast(`Proses import selesai! Total client berhasil diimport.`, "success");
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showToast("Sedang mengecek & mengimport data client...", "info");
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n');
        if (lines.length < 2) return;

        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
        const importedData = lines.slice(1).filter(l => l.trim()).map(line => {
          const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          const obj = {};
          headers.forEach((header, i) => {
            let val = values[i]?.replace(/^"|"$/g, '').trim() || '';
            obj[header] = val;
          });
          return obj;
        });

        let autoSuccess = 0;
        const fuzzyQueue = [];

        for (const item of importedData) {
          const rawSchool = item.school || 'Unknown';
          const matchResult = findSimilarSchool(rawSchool, uniqueSchools);

          if (matchResult && (matchResult.matchType === 'exact' || matchResult.matchType === 'normalized')) {
            await saveImportedClient(item, matchResult.school.name, matchResult.school.id);
            autoSuccess++;
          } else if (matchResult && matchResult.matchType === 'fuzzy') {
            fuzzyQueue.push({ item, match: matchResult });
          } else {
            const newSchoolId = `S-${Math.floor(Math.random() * 9000) + 1000}`;
            await saveImportedClient(item, rawSchool.trim(), newSchoolId);
            autoSuccess++;
          }
        }

        setImportCount(autoSuccess);

        if (fuzzyQueue.length > 0) {
          setImportPendingQueue(fuzzyQueue);
          setCurrentTypoItem(fuzzyQueue[0]);
          showToast(`Ditemukan ${fuzzyQueue.length} nama sekolah mirip. Mohon beri konfirmasi.`, "info");
        } else {
          showToast(`${autoSuccess} client telah berhasil diimport & ID Sekolah dibuat otomatis.`, "success");
        }

        e.target.value = null; // reset input
      } catch (err) {
        console.error("Import error:", err);
        showAlert("Gagal", "Gagal mengimport data. Pastikan format CSV benar.", "error");
      }
    };
    reader.readAsText(file);
  };


  const getStatusStyle = (status) => {
    const s = (status || 'COLD').toUpperCase();
    switch (s) {
      case 'WARM': return { bg: '#FEF3C7', color: '#D97706', border: '#FCD34D' };
      case 'HOT': return { bg: '#FEE2E2', color: '#DC2626', border: '#FCA5A5' };
      case 'COLD':
      default: return { bg: '#E0F2FE', color: '#0284C7', border: '#BAE6FD' };
    }
  };

  const getProsesStyle = (proses) => {
    const p = (proses || 'SUSPECT').toUpperCase();
    switch (p) {
      case 'PROSPEK': return { bg: '#E0F2FE', color: '#0369A1' };
      case 'DEAL': return { bg: '#FFEDD5', color: '#C2410C' };
      case 'CONFIRM': return { bg: '#EDE9FE', color: '#6D28D9' };
      case 'BUYER': return { bg: '#DCFCE7', color: '#15803D' };
      case 'CANCEL': return { bg: '#FEE2E2', color: '#B91C1C' };
      case 'SUSPECT':
      default: return { bg: '#F3F4F6', color: '#4B5563' };
    }
  };

  const handleStatusChange = async (client, newStatus) => {
    try {
      await invokeApi('/clients', {
        method: 'PUT',
        body: { id: client.id, status: newStatus }
      });

      // Auto-stop drip sequence if client status becomes WARM or HOT
      if (newStatus === 'WARM' || newStatus === 'HOT') {
        const activeDrip = clientDrips.find(cd => cd.client_id === client.id && cd.status === 'active');
        if (activeDrip) {
          await stopClientDrip(activeDrip.id, `Status diubah ke ${newStatus}`);
        }
      }

      showToast(`Status ${client.name} diubah ke ${newStatus}`, 'success');
    } catch (err) {
      showAlert('Gagal', 'Gagal merubah status: ' + err.message, 'error');
    }
  };

  const handleProsesChange = async (client, newProses) => {
    try {
      await invokeApi('/clients', {
        method: 'PUT',
        body: { id: client.id, proses: newProses }
      });
      showToast(`Proses ${client.name} diubah ke ${newProses}`, 'success');
    } catch (err) {
      showAlert('Gagal', 'Gagal merubah proses: ' + err.message, 'error');
    }
  };

  return (
    <div style={{ position: 'relative', height: '100%', paddingBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="text-3xl font-semibold">Client Management</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          {userRole !== 'viewer' && (
            <>
              {!isMobile && (
                <>
                  <button onClick={handleExport} className="btn btn-outline" style={{ borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Download size={18} /> Export
                  </button>
                  <label className="btn btn-outline" style={{ borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Upload size={18} /> Import
                    <input type="file" accept=".csv" onChange={handleImport} style={{ display: 'none' }} />
                  </label>
                </>
              )}
              <button onClick={handleOpenAdd} className="btn btn-primary" style={{ borderRadius: '12px', padding: isMobile ? '10px 16px' : '12px 24px' }}>
                <Plus size={18} /> {isMobile ? 'Tambah' : 'Tambah Client'}
              </button>
            </>
          )}
        </div>

      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('clients')}
          style={{ padding: '12px 8px', fontSize: '15px', fontWeight: 600, color: activeTab === 'clients' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'clients' ? '2px solid var(--primary)' : '2px solid transparent', backgroundColor: 'transparent', cursor: 'pointer' }}
        >
          Client
        </button>
        <button
          onClick={() => setActiveTab('schools')}
          style={{ padding: '12px 8px', fontSize: '15px', fontWeight: 600, color: activeTab === 'schools' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'schools' ? '2px solid var(--primary)' : '2px solid transparent', backgroundColor: 'transparent', cursor: 'pointer' }}
        >
          Sekolah
        </button>
      </div>

      {activeTab === 'clients' ? (
        <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: isMobile ? '16px' : '20px 24px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', borderBottom: '1px solid var(--border)', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <div style={{ position: 'relative', width: isMobile ? '100%' : '280px' }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Cari nama, sekolah, atau email..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  style={{ borderRadius: '12px', paddingLeft: '44px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', width: '100%' }}
                />
              </div>

              {/* Filter Status */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                style={{
                  borderRadius: '12px', padding: '10px 14px', border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg)', fontSize: '14px', fontWeight: 600, outline: 'none',
                  width: isMobile ? '100%' : 'auto', minWidth: '140px'
                }}
              >
                <option value="all">Semua Status</option>
                <option value="COLD">COLD</option>
                <option value="WARM">WARM</option>
                <option value="HOT">HOT</option>
              </select>

              {/* Filter Proses */}
              <select
                value={prosesFilter}
                onChange={(e) => { setProsesFilter(e.target.value); setCurrentPage(1); }}
                style={{
                  borderRadius: '12px', padding: '10px 14px', border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg)', fontSize: '14px', fontWeight: 600, outline: 'none',
                  width: isMobile ? '100%' : 'auto', minWidth: '140px'
                }}
              >
                <option value="all">Semua Proses</option>
                <option value="SUSPECT">SUSPECT</option>
                <option value="PROSPEK">PROSPEK</option>
                <option value="DEAL">DEAL</option>
                <option value="CONFIRM">CONFIRM</option>
                <option value="BUYER">BUYER</option>
                <option value="CANCEL">CANCEL</option>
              </select>
            </div>
            <p className="text-sm text-secondary font-medium">Total {filteredClients.length} Client</p>
          </div>

          {/* Floating Bulk Action Bar */}
          {selectedClientIds.length > 0 && (
            <div style={{
              backgroundColor: '#FFF9E6', borderBottom: '1px solid #FFE082', padding: '12px 24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#B78103" />
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#B78103' }}>
                  {selectedClientIds.length} client dipilih
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  onClick={() => handleOpenSapaModal(clients.filter(c => selectedClientIds.includes(c.id)))}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--primary)',
                    color: 'white', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Sparkles size={15} /> Proses Sapa
                </button>

                <button
                  onClick={() => setSelectedClientIds([])}
                  style={{
                    padding: '8px 12px', borderRadius: '8px', backgroundColor: 'transparent',
                    border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '14px',
                    fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          <div style={{ overflowX: 'auto', minHeight: '400px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8F9FB', color: 'var(--text-secondary)', fontSize: '14px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '16px 16px 16px 24px', width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedClientIds.length === paginatedClients.length && paginatedClients.length > 0}
                      onChange={handleToggleSelectAll}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  <th style={{ padding: '16px 20px', fontWeight: 600 }}>Nama Client</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600 }}>Sekolah</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600 }}>Kontak</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600 }}>Proses</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600 }}>Status Sapa</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600 }}>Aktivitas Terakhir</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>Tidak ada data.</td></tr>
                ) : paginatedClients.map((client, idx) => {
                  const dynamicStatus = calculateDynamicClientStatus(client);
                  const statusStyle = getStatusStyle(dynamicStatus);
                  const prosesStyle = getProsesStyle(client.proses);
                  const activeDrip = clientDrips.find(cd => cd.client_id === client.id && cd.status === 'active');
                  const isChecked = selectedClientIds.includes(client.id);

                  return (
                    <tr key={client.id} style={{ borderBottom: idx === paginatedClients.length - 1 ? 'none' : '1px solid var(--border)', backgroundColor: isChecked ? '#FFFDF5' : 'transparent' }} className="hover:bg-gray-50">
                      <td style={{ padding: '16px 16px 16px 24px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(client.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <p style={{ fontWeight: 600, margin: 0 }}>
                          {client.sapaan || client.salutation} {client.nama || client.name}
                        </p>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>{client.posisi || client.position}
                          {(client.panggilan || client.nickname) && <span style={{ marginLeft: '6px', color: 'var(--text-secondary)', fontWeight: 400 }}>({client.panggilan || client.nickname})</span>}
                        </p>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span onClick={() => navigate(`/clients/dashboard/${client.sekolah || client.school}`)} style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }} className="hover:underline">
                          {client.sekolah || client.school}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <p style={{ margin: 0, fontSize: '14px' }}>{client.whatsapp || client.phone}</p>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>{client.email}</p>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <select
                          disabled={userRole === 'viewer'}
                          value={dynamicStatus}
                          onChange={(e) => handleStatusChange(client, e.target.value)}
                          style={{
                            backgroundColor: statusStyle.bg,
                            color: statusStyle.color,
                            border: `1px solid ${statusStyle.border}`,
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: userRole === 'viewer' ? 'default' : 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="COLD">COLD</option>
                          <option value="WARM">WARM</option>
                          <option value="HOT">HOT</option>
                        </select>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <select
                          disabled={userRole === 'viewer'}
                          value={(client.proses || 'SUSPECT').toUpperCase()}
                          onChange={(e) => handleProsesChange(client, e.target.value)}
                          style={{
                            backgroundColor: prosesStyle.bg,
                            color: prosesStyle.color,
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: userRole === 'viewer' ? 'default' : 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="SUSPECT">SUSPECT</option>
                          <option value="PROSPEK">PROSPEK</option>
                          <option value="DEAL">DEAL</option>
                          <option value="CONFIRM">CONFIRM</option>
                          <option value="BUYER">BUYER</option>
                          <option value="CANCEL">CANCEL</option>
                        </select>
                      </td>

                      {/* Kolom Status & Aksi Proses Sapa */}
                      <td style={{ padding: '16px 20px' }}>
                        {activeDrip ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
                            backgroundColor: '#FFF4E5', color: '#E65100', border: '1px solid #FFE0B2'
                          }} title="Sedang aktif dalam alur sapa bertahap">
                            <Sparkles size={13} /> Tahap {activeDrip.current_step_number}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleOpenSapaModal([client])}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '4px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                              backgroundColor: '#FFF8E1', color: '#B78103', border: '1px solid #FFE082',
                              cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            title="Masukkan ke alur Proses Sapa"
                          >
                            <Sparkles size={13} /> + Proses Sapa
                          </button>
                        )}
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>{client.lastActivity || 'No Activity'}</p>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{client.updatedAt?.toDate ? client.updatedAt.toDate().toLocaleDateString() : (client.updatedAt ? new Date(client.updatedAt).toLocaleDateString() : '-')}</p>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>

                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={() => openManualWaChat(client.whatsapp || client.phone, `Assalamualaikum ${client.sapaan || client.salutation || 'Bapak/Ibu'} ${client.nama || client.name}`)}
                            className="icon-btn"
                            title="Kirim Pesan WhatsApp"
                            style={{ color: '#25D366' }}
                          >
                            <Send size={18} />
                          </button>

                          <button onClick={() => handleOpenView(client)} className="icon-btn" title="Lihat Detail"><Eye size={18} /></button>
                          {userRole !== 'viewer' && <button onClick={() => handleOpenEdit(client)} className="icon-btn" title="Edit Client"><Edit2 size={18} /></button>}
                          {(userRole === 'owner' || userRole === 'admin') && <button onClick={() => handleDelete(client.id)} className="icon-btn text-red-500" title="Hapus Client"><Trash2 size={18} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-sm text-secondary">Showing {paginatedClients.length} of {filteredClients.length} entries</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handlePrevPage} disabled={currentPage === 1} className="btn btn-outline" style={{ padding: '10px' }}><ChevronLeft size={18} /></button>
              <button onClick={handleNextPage} disabled={currentPage === totalPages} className="btn btn-outline" style={{ padding: '10px' }}><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Daftar Sekolah yang terdaftar di sistem</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Total {uniqueSchools.length} Sekolah</p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', backgroundColor: '#F8F9FB', color: 'var(--text-secondary)', fontSize: '14px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '16px 24px', fontWeight: 600, width: '100px' }}>ID</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Nama Sekolah</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, width: '30%' }}>Alamat</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Aktivitas Terakhir</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>PIC</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'right' }}>Aksi</th>



                </tr>
              </thead>
              <tbody>
                {uniqueSchools.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-gray-50">
                    <td style={{ padding: '16px 24px', fontWeight: 700, color: 'var(--primary)' }}>{s.id}</td>
                    <td style={{ padding: '16px 24px', fontWeight: 600 }}>
                      <span
                        onClick={() => navigate(`/clients/dashboard/${s.name}`)}
                        style={{ color: 'var(--primary)', cursor: 'pointer' }}
                        className="hover:underline"
                      >
                        {s.name}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-secondary)' }}>{s.address || '-'}</td>
                    <td style={{ padding: '16px 24px' }}>
                      {s.hasClient ? (
                        <span style={{ color: '#2ED47A', fontWeight: 700, fontSize: '13px' }}>AKTIF</span>
                      ) : (
                        <span style={{ color: '#FFB020', fontWeight: 700, fontSize: '13px' }}>LEAD DATA</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>{s.lastActivityText || 'N/A'}</p>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{s.lastActivityTS?.toDate().toLocaleDateString() || '-'}</p>
                    </td>

                    <td style={{ padding: '16px 24px' }}>{s.picCount} Person</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      {!s.hasClient && userRole !== 'viewer' && (

                        <button
                          onClick={() => { setMergeSource(s); setIsMergeModalOpen(true); }}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '13px' }}
                        >
                          Merge
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Merge Modal (Daftar Sekolah) */}
      {isMergeModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '450px', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Merge Sekolah</h3>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>Gabungkan <strong>{mergeSource?.name}</strong> ke:</p>
            <select
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '24px' }}
            >
              <option value="">-- Pilih Tujuan --</option>
              {uniqueSchools.filter(s => s.hasClient && s.id !== mergeSource?.id).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setIsMergeModalOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
              <button onClick={handleMerge} disabled={!mergeTargetId} className="btn btn-primary" style={{ flex: 1 }}>Gabung</button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer PIC */}
      {isDrawerOpen && (
        <>
          <div onClick={() => setIsDrawerOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: isMobile ? '100%' : '450px', height: '100vh', backgroundColor: 'white', zIndex: 101, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-xl font-semibold">{isViewMode ? 'View Client' : editingClient ? 'Edit Client' : 'Tambah Client'}</h2>
              <button onClick={() => setIsDrawerOpen(false)}><X size={24} /></button>
            </div>
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="text-sm font-bold mb-2 block">Sekolah *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      disabled={isViewMode}
                      value={formData.sekolah}
                      onChange={(e) => { setFormData({ ...formData, sekolah: e.target.value }); setShowSchoolDropdown(true); }}
                      onFocus={() => setShowSchoolDropdown(true)}
                      className="form-input"
                      placeholder="contoh: SMA Negeri 2 Jakarta"
                      required
                    />
                    {showSchoolDropdown && !isViewMode && formData.sekolah.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '8px', zIndex: 10, maxHeight: '150px', overflowY: 'auto' }}>
                        {uniqueSchools.filter(s => s.name.toLowerCase().includes(formData.sekolah.toLowerCase())).map(s => (
                          <div key={s.id} onClick={() => { setFormData({ ...formData, sekolah: s.name, schoolId: s.id }); setShowSchoolDropdown(false); }} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }} className="hover:bg-gray-50">
                            {s.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold mb-2 block">Alamat</label>
                  <input
                    type="text"
                    disabled={isViewMode}
                    value={formData.alamat}
                    onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                    className="form-input"
                    placeholder="Masukkan alamat lengkap sekolah..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2.5fr', gap: '12px' }}>
                  <div>
                    <label className="text-sm font-bold mb-2 block">Sapaan</label>
                    <select disabled={isViewMode} value={formData.sapaan} onChange={(e) => setFormData({ ...formData, sapaan: e.target.value })} className="form-input">
                      <option value="Bapak">Bapak</option>
                      <option value="Ibu">Ibu</option>
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Ms">Ms</option>
                      <option value="Kak">Kak</option>
                    </select>

                  </div>
                  <div>
                    <label className="text-sm font-bold mb-2 block">Nama <span style={{ color: 'red' }}>*</span></label>
                    <input type="text" disabled={isViewMode} value={formData.nama} onChange={(e) => setFormData({ ...formData, nama: e.target.value })} className="form-input" required />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold mb-2 block">Panggilan</label>
                  <input type="text" disabled={isViewMode} value={formData.panggilan} onChange={(e) => setFormData({ ...formData, panggilan: e.target.value })} className="form-input" placeholder="e.g. Pak Budi" />
                </div>

                <div>
                  <label className="text-sm font-bold mb-2 block">Posisi</label>
                  <input type="text" disabled={isViewMode} value={formData.posisi} onChange={(e) => setFormData({ ...formData, posisi: e.target.value })} className="form-input" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="text-sm font-bold mb-2 block">WhatsApp</label>
                    <input type="text" disabled={isViewMode} value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} className="form-input" />
                  </div>
                  <div>
                    <label className="text-sm font-bold mb-2 block">Email</label>
                    <input type="email" disabled={isViewMode} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="form-input" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold mb-2 block">Catatan Tambahan</label>
                  <textarea
                    disabled={isViewMode}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="form-input"
                    rows={3}
                    style={{ resize: 'none' }}
                    placeholder="Informasi tambahan tentang client ini..."
                  ></textarea>
                </div>

                {!isViewMode && (
                  <div style={{ marginTop: '20px' }}>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>Simpan Data</button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </>
      )}

      {/* Modal Konfirmasi Typo / Sekolah Mirip saat Import */}
      {currentTypoItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '480px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#D97706', marginBottom: '16px' }}>
              <Building2 size={28} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Nama Sekolah Mirip Ditemukan</h3>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Sistem menemukan nama sekolah di file CSV yang mirip dengan data yang sudah ada (Tingkat kemiripan {currentTypoItem.match.similarity}%):
            </p>

            <div style={{ backgroundColor: '#F9FAFB', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Klien: <strong>{currentTypoItem.item.sapaan || currentTypoItem.item.salutation} {currentTypoItem.item.nama || currentTypoItem.item.name}</strong></p>
              <p style={{ margin: '0 0 6px 0', fontSize: '14px' }}>Nama di CSV: <span style={{ color: '#DC2626', fontWeight: 700 }}>"{currentTypoItem.item.sekolah || currentTypoItem.item.school}"</span></p>
              <p style={{ margin: 0, fontSize: '14px' }}>Sekolah Terdaftar: <span style={{ color: '#16A34A', fontWeight: 700 }}>"{currentTypoItem.match.school.name}"</span> (ID: {currentTypoItem.match.school.id})</p>
            </div>

            <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Pilih tindakan untuk data ini ({importPendingQueue.length} tersisa):</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => handleResolveTypo('existing')}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
              >
                Gunakan "{currentTypoItem.match.school.name}" (ID: {currentTypoItem.match.school.id})
              </button>
              <button
                onClick={() => handleResolveTypo('new')}
                className="btn btn-outline"
                style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
              >
                Tetap Gunakan "{currentTypoItem.item.school}" (Buat ID Baru)
              </button>
              <button
                onClick={() => handleResolveTypo('skip')}
                style={{ width: '100%', padding: '8px', backgroundColor: 'transparent', border: 'none', color: '#6B7280', fontSize: '14px', cursor: 'pointer' }}
              >
                Abaikan / Lewati Baris Ini
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Masuk Proses Sapa */}
      {isSapaModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '540px', padding: '24px', borderRadius: '16px', backgroundColor: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#E65100', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#FFF4E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={24} color="#E65100" />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Masuk ke Proses Sapa
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                  Cold Outreach & Drip Follow-up Otomatis
                </p>
              </div>
            </div>

            {/* List Target Clients */}
            <div style={{ backgroundColor: '#F8F9FB', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '16px' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>
                Target Client ({sapaTargetClients.length}):
              </p>
              <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sapaTargetClients.map((tc, idx) => (
                  <div key={tc.id || idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', backgroundColor: 'white', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 600 }}>{tc.sapaan || tc.salutation || ''} {tc.nama || tc.name}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{tc.sekolah || tc.school || '-'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sequence Timeline Explanation */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Rencana Jadwal Pengiriman:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                {dripSteps.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>
                    Belum ada tahapan Proses Sapa yang aktif dikonfigurasi.
                  </div>
                ) : (
                  [...dripSteps]
                    .filter(step => step.template_id)
                    .sort((a, b) => a.step_number - b.step_number)
                    .map((step, idx) => {
                      const template = templates.find(t => t.id === step.template_id);
                      const templateName = template ? template.name : (step.custom_message ? 'Custom Message' : 'Tanpa Template');
                      const isFirst = step.step_number === 1;
                      
                      return (
                        <div key={step.id || idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ 
                            width: '22px', 
                            height: '22px', 
                            borderRadius: '50%', 
                            backgroundColor: isFirst ? '#E5F6EB' : '#FFF4E5', 
                            color: isFirst ? '#2ED47A' : '#FFB020', 
                            fontWeight: 700, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '12px' 
                          }}>
                            {step.step_number}
                          </span>
                          <span>
                            <strong>Tahap {step.step_number}</strong> ({isFirst ? 'Mulai +15 Menit' : `Jeda +${step.delay_days} Hari`}): {templateName}
                          </span>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Auto Stop Note */}
            <div style={{ backgroundColor: '#E8F5E9', border: '1px solid #C8E6C9', borderRadius: '10px', padding: '10px 14px', marginBottom: '20px', fontSize: '13px', color: '#2E7D32', lineHeight: 1.4 }}>
              💡 <strong>Aturan Auto-Stop</strong>: Proses Sapa akan langsung berhenti begitu client membalas pesan WhatsApp atau statusnya diubah ke WARM / PROSPEK / DEAL di CRM.
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsSapaModalOpen(false)}
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 600 }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmStartSapa}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'var(--primary)', color: 'white', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Sparkles size={16} /> Mulai Proses Sapa ({sapaTargetClients.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
