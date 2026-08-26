import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Filter, MoreVertical, Edit2, Trash2, Eye, Download, Upload, Clock, ChevronLeft, ChevronRight, X, Building2 } from 'lucide-react';
import { invokeApi } from '../../lib/supabase';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { logActivity } from '../../utils/activityLogger';
import { cascadeSchoolNameUpdate } from '../../utils/clientUtils';

const Clients = () => {
  const navigate = useNavigate();
  const { clients, uniqueSchools } = useAppData();
  const { userRole, currentUser } = useAuth();
  const { showAlert, showConfirm } = useNotification();
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
    school: '',
    schoolId: '',
    schoolAddress: '',
    salutation: 'Bapak/Mr',
    name: '',

    nickname: '',
    position: '',
    phone: '',
    email: '',
    status: 'Active',
    notes: ''
  });

  // Autocomplete State
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sync Form when editing
  useEffect(() => {
    if (editingClient) {
      setFormData({
        school: editingClient.school || '',
        schoolId: editingClient.schoolId || '',
        schoolAddress: editingClient.schoolAddress || '',
        salutation: editingClient.salutation || 'Bapak/Mr',
        name: editingClient.name || '',
        nickname: editingClient.nickname || '',
        position: editingClient.position || '',
        phone: editingClient.phone || '',
        email: editingClient.email || '',
        status: editingClient.status || 'Active',
        notes: editingClient.notes || ''
      });
    } else {
      setFormData({
        school: '',
        schoolId: '',
        schoolAddress: '',
        salutation: 'Bapak/Mr',
        name: '',

        nickname: '',
        position: '',
        phone: '',
        email: '',
        status: 'Active',
        notes: ''
      });
    }
  }, [editingClient]);

  const filteredClients = useMemo(() => {
    return clients.filter(client =>
      client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.school?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone?.includes(searchQuery) ||
      client.email?.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, [clients, searchQuery]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

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

    const matchedSchool = uniqueSchools.find(s => s.name.toLowerCase() === formData.school.trim().toLowerCase());
    const finalSchoolId = matchedSchool ? matchedSchool.id : (formData.schoolId || (editingClient ? editingClient.schoolId : `S-${Math.floor(Math.random() * 9000) + 1000}`));

    const clientData = {
      ...formData,
      school: formData.school.trim(),
      schoolId: finalSchoolId,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.email
    };

    try {
      if (editingClient) {
        if (matchedSchool && matchedSchool.id !== editingClient.schoolId) {
          showConfirm(
            "Sekolah Sudah Ada",
            `Nama "${formData.school}" sudah terdaftar dengan ID ${matchedSchool.id}. Apakah Anda ingin menggabungkan data ini ke sekolah tersebut?`,
            async () => {
              try {
                await cascadeSchoolNameUpdate(editingClient.schoolId, matchedSchool.id, editingClient.school, formData.school);
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

        if (editingClient.school.trim() !== formData.school.trim()) {
          cascadeSchoolNameUpdate(editingClient.schoolId, finalSchoolId, editingClient.school, formData.school);
        }

        await invokeApi('/clients', {
          method: 'PUT',
          body: { id: editingClient.id, ...clientData }
        });
        logActivity(currentUser, `Mengubah data client: ${formData.name} (${formData.school})`, editingClient.id, 'Client', 'Clients');
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
        logActivity(currentUser, `Menambah client baru: ${formData.name} (${formData.school})`, newId, 'Client', 'Clients');
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
          showAlert("Berhasil", "Data client telah dihapus.", "success");
        } catch (err) {
          showAlert("Gagal", "Gagal menghapus data.", "error");
        }
      }
    );
  };
  const handleExport = () => {
    if (filteredClients.length === 0) return;
    const headers = ['Salutation', 'Name', 'Nickname', 'School', 'SchoolAddress', 'Position', 'Phone', 'Email', 'Status', 'Notes'];
    const rows = filteredClients.map(c => [
      c.salutation || '',
      c.name || '',
      c.nickname || '',
      c.school || '',
      c.schoolAddress || '',
      c.position || '',
      c.phone || '',
      c.email || '',
      c.status || '',
      c.notes || ''
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MCKuadrat_Clients_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
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

        let successCount = 0;
        for (const item of importedData) {
          const newId = `C-${Math.floor(Math.random() * 9000) + 1000}`;
          await invokeApi('/clients', {
            method: 'POST',
            body: {
              id: newId,
              salutation: item.salutation || 'Bapak/Mr',
              name: item.name || 'Unknown',
              nickname: item.nickname || '',
              school: item.school || 'Unknown',
              schoolAddress: item.schooladdress || item['school address'] || '',
              position: item.position || '',
              phone: item.phone || '',
              email: item.email || '',
              status: item.status || 'Active',
              notes: item.notes || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          });
          successCount++;
        }
        
        showAlert("Berhasil", `${successCount} client telah diimport.`, "success");
        e.target.value = null; // reset input
      } catch (err) {
        console.error("Import error:", err);
        showAlert("Gagal", "Gagal mengimport data. Pastikan format CSV benar.", "error");
      }
    };
    reader.readAsText(file);
  };


  const getStatusStyle = (status) => {
    switch (status) {
      case 'Active': return { bg: '#E5F6EB', color: '#2ED47A' };
      case 'Inactive': return { bg: '#FEEBEC', color: '#FF5252' };
      case 'Lead': return { bg: '#E5EFFF', color: '#4680FF' };
      default: return { bg: '#F4F6F9', color: '#7A849C' };
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
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: isMobile ? '100%' : '320px' }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Cari nama, sekolah, atau email..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  style={{ borderRadius: '12px', paddingLeft: '44px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', width: '100%' }}
                />
              </div>
            </div>
            <p className="text-sm text-secondary font-medium">Total {filteredClients.length} Client</p>
          </div>

          <div style={{ overflowX: 'auto', minHeight: '400px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8F9FB', color: 'var(--text-secondary)', fontSize: '14px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>ID</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Nama Client</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Sekolah</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Kontak</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Aktivitas Terakhir</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'center' }}>Aksi</th>

                </tr>
              </thead>
              <tbody>
                {paginatedClients.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>Tidak ada data.</td></tr>
                ) : paginatedClients.map((client, idx) => {
                  const style = getStatusStyle(client.status);
                  return (
                    <tr key={client.id} style={{ borderBottom: idx === paginatedClients.length - 1 ? 'none' : '1px solid var(--border)' }} className="hover:bg-gray-50">
                      <td style={{ padding: '16px 24px', fontWeight: 600, fontSize: '14px' }}>{client.id}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <p style={{ fontWeight: 600, margin: 0 }}>
                          {client.salutation} {client.name}
                        </p>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{client.position}
                          {client.nickname && <span style={{ marginLeft: '6px', color: 'var(--text-secondary)', fontWeight: 400 }}>({client.nickname})</span>}
                        </p>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span onClick={() => navigate(`/clients/dashboard/${client.school}`)} style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }} className="hover:underline">
                          {client.school}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <p style={{ margin: 0, fontSize: '14px' }}>{client.phone}</p>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{client.email}</p>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ backgroundColor: style.bg, color: style.color, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>{client.status}</span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>{client.lastActivity || 'No Activity'}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{client.updatedAt?.toDate().toLocaleDateString() || '-'}</p>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>

                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button onClick={() => handleOpenView(client)} className="icon-btn"><Eye size={18} /></button>
                          {userRole !== 'viewer' && <button onClick={() => handleOpenEdit(client)} className="icon-btn"><Edit2 size={18} /></button>}
                          {(userRole === 'owner' || userRole === 'admin') && <button onClick={() => handleDelete(client.id)} className="icon-btn text-red-500"><Trash2 size={18} /></button>}
                        </div>
                      </td>
                    </tr>
                  )
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
                    <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>{s.address || '-'}</td>
                    <td style={{ padding: '16px 24px' }}>
                      {s.hasClient ? (
                        <span style={{ color: '#2ED47A', fontWeight: 700, fontSize: '12px' }}>AKTIF</span>
                      ) : (
                        <span style={{ color: '#FFB020', fontWeight: 700, fontSize: '12px' }}>LEAD DATA</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>{s.lastActivityText || 'N/A'}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{s.lastActivityTS?.toDate().toLocaleDateString() || '-'}</p>
                    </td>

                    <td style={{ padding: '16px 24px' }}>{s.picCount} Person</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      {!s.hasClient && userRole !== 'viewer' && (

                        <button
                          onClick={() => { setMergeSource(s); setIsMergeModalOpen(true); }}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
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
                  <label className="text-sm font-bold mb-2 block">Cari Sekolah atau Input Baru</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      disabled={isViewMode}
                      value={formData.school}
                      onChange={(e) => { setFormData({ ...formData, school: e.target.value }); setShowSchoolDropdown(true); }}
                      onFocus={() => setShowSchoolDropdown(true)}
                      className="form-input"
                      placeholder="contoh: SMA Negeri 2 Jakarta"
                      required
                    />
                    {showSchoolDropdown && !isViewMode && formData.school.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '8px', zIndex: 10, maxHeight: '150px', overflowY: 'auto' }}>
                        {uniqueSchools.filter(s => s.name.toLowerCase().includes(formData.school.toLowerCase())).map(s => (
                          <div key={s.id} onClick={() => { setFormData({ ...formData, school: s.name, schoolId: s.id }); setShowSchoolDropdown(false); }} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }} className="hover:bg-gray-50">
                            {s.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold mb-2 block">Alamat Sekolah</label>
                  <input
                    type="text"
                    disabled={isViewMode}
                    value={formData.schoolAddress}
                    onChange={(e) => setFormData({ ...formData, schoolAddress: e.target.value })}
                    className="form-input"
                    placeholder="Masukkan alamat lengkap sekolah..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2.5fr', gap: '12px' }}>
                  <div>
                    <label className="text-sm font-bold mb-2 block">Sapaan</label>
                    <select disabled={isViewMode} value={formData.salutation} onChange={(e) => setFormData({ ...formData, salutation: e.target.value })} className="form-input">
                      <option value="Bapak/Mr">Bapak / Mr</option>
                      <option value="Ibu/Mrs">Ibu / Mrs</option>
                      <option value="Ms">Ms</option>
                      <option value="Kak">Kak</option>
                    </select>

                  </div>
                  <div>
                    <label className="text-sm font-bold mb-2 block">Nama Lengkap <span style={{ color: 'red' }}>*</span></label>
                    <input type="text" disabled={isViewMode} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="form-input" required />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold mb-2 block">Nama Panggilan</label>
                  <input type="text" disabled={isViewMode} value={formData.nickname} onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} className="form-input" placeholder="e.g. Pak Budi" />
                </div>

                <div>
                  <label className="text-sm font-bold mb-2 block">Jabatan</label>
                  <input type="text" disabled={isViewMode} value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} className="form-input" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="text-sm font-bold mb-2 block">WhatsApp/Phone</label>
                    <input type="text" disabled={isViewMode} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="form-input" />
                  </div>
                  <div>
                    <label className="text-sm font-bold mb-2 block">Email</label>
                    <input type="email" disabled={isViewMode} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="form-input" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold mb-2 block">Status Client</label>
                  <select disabled={isViewMode} value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="form-input">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Lead">Lead / Suspect</option>
                  </select>
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
    </div>
  );
};

export default Clients;
