import React from 'react';
import ClientAutocomplete from '../components/ClientAutocomplete';
import { formatPriceDisplay, parsePriceValue } from '../../../utils/priceUtils';
import { SPH_FACILITIES } from '../config/placeholders';
import DurationInput from '../../../components/DurationInput';

const SPHForm = ({ formData, setFormData, clients = [], leads = [] }) => {
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePriceChange = (field, rawInput) => {
    const cleanNum = parsePriceValue(rawInput);
    setFormData(prev => ({ ...prev, [field]: cleanNum }));
  };

  // Convert facilities string or array into Array
  const currentFacilities = Array.isArray(formData.facilities)
    ? formData.facilities
    : (typeof formData.facilities === 'string' && formData.facilities
      ? formData.facilities.split(',').map(s => s.trim())
      : []);

  const handleFacilityToggle = (facility) => {
    let next;
    if (currentFacilities.includes(facility)) {
      next = currentFacilities.filter(f => f !== facility);
    } else {
      next = [...currentFacilities, facility];
    }
    setFormData(prev => ({ ...prev, facilities: next }));
  };

  const handleSelectAllFacilities = (e) => {
    if (e.target.checked) {
      setFormData(prev => ({ ...prev, facilities: [...SPH_FACILITIES] }));
    } else {
      setFormData(prev => ({ ...prev, facilities: [] }));
    }
  };

  const isAllSelected = SPH_FACILITIES.every(f => currentFacilities.includes(f));

  // Client Selection & Auto-fill Leads
  const handleClientChange = (selectedClientName, matchedClientObj) => {
    handleChange('client', selectedClientName);
    const matched = matchedClientObj || (clients || []).find(c => (c.sekolah || c.nama || c.name) === selectedClientName);
    if (matched) {
      handleChange('schoolId', matched.id || matched.schoolId || '');
    }
  };

  // Filter PICs for selected school
  const schoolPics = (clients || []).filter(c => {
    if (!formData.client) return false;
    const searchName = formData.client.toLowerCase().trim();
    const schName = (c.sekolah || c.school || c.nama || c.name || '').toLowerCase().trim();
    return schName === searchName || (c.schoolId && formData.schoolId && c.schoolId === formData.schoolId);
  });

  // Ensure leads is an array
  const safeLeads = Array.isArray(leads)
    ? leads
    : (leads && typeof leads === 'object'
      ? Object.values(leads).flatMap(c => c?.items || [])
      : []);

  // Filter leads by selected client
  const clientLeads = safeLeads.filter(l => {
    if (!formData.client) return false;
    const searchName = formData.client.toLowerCase();
    const leadSch = (l.schoolName || l.school || '').toLowerCase();
    return leadSch === searchName || (l.schoolId && formData.schoolId && l.schoolId === formData.schoolId);
  });

  const handleSelectLead = (leadId) => {
    const selectedLead = clientLeads.find(l => l.id === leadId);
    if (selectedLead) {
      setFormData(prev => ({
        ...prev,
        linkedLeadId: selectedLead.id,
        program: selectedLead.program || prev.program,
        specialPrice: selectedLead.price || prev.specialPrice || prev.value,
        date: selectedLead.date && selectedLead.date !== 'TBD' ? selectedLead.date : prev.date
      }));
    }
  };

  const handleSelectPic = (picId) => {
    const picObj = schoolPics.find(p => p.id === picId);
    if (picObj) {
      setFormData(prev => ({
        ...prev,
        selectedPicId: picObj.id,
        selectedPicName: picObj.nama || picObj.name || '',
        penyelenggara: picObj.nama || picObj.name || prev.penyelenggara || '',
        jabatan: picObj.posisi || picObj.position || prev.jabatan || '',
        whatsapp: picObj.whatsapp || picObj.phone || prev.whatsapp || '',
        sapaan: picObj.sapaan || picObj.salutation || prev.sapaan || 'Bapak/Ibu',
        panggilan: picObj.panggilan || picObj.nickname || (picObj.nama || picObj.name || '').split(' ')[0] || ''
      }));
    } else {
      setFormData(prev => ({ ...prev, selectedPicId: '', selectedPicName: '' }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Custom Autocomplete Client */}
      <ClientAutocomplete
        clients={clients}
        value={formData.client || ''}
        onChange={(val) => handleClientChange(val)}
        onSelectClient={(clientObj) => handleClientChange(clientObj.sekolah || clientObj.nama || clientObj.name, clientObj)}
        required
      />

      {/* PIC Selector (Tujuan Dokumen & WA) */}
      {formData.client && (
        <div style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', padding: '12px', borderRadius: '10px' }}>
          <label className="text-xs font-bold mb-1 block" style={{ color: '#0369A1', textTransform: 'uppercase' }}>
            PIC Sekolah <span style={{ color: 'red' }}>*</span>
          </label>
          <select
            className="form-input"
            style={{ fontSize: '13px', backgroundColor: 'white' }}
            value={formData.selectedPicId || ''}
            onChange={(e) => handleSelectPic(e.target.value)}
            required
          >
            <option value="">-- Pilih Kontak PIC --</option>
            {schoolPics.map(pic => {
              const displayName = pic.panggilan || pic.nickname || pic.nama || pic.name || 'Kontak';
              const phoneNum = pic.whatsapp || pic.phone || 'Tanpa No WA';
              return (
                <option key={pic.id} value={pic.id}>
                  {displayName} — {phoneNum}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Lead / Program Selector if client has leads */}
      {clientLeads.length > 0 && (
        <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', padding: '12px', borderRadius: '10px' }}>
          <label className="text-xs font-bold mb-1 block" style={{ color: '#475569', textTransform: 'uppercase' }}>
            Program Terdaftar:
          </label>
          <select
            className="form-input"
            style={{ fontSize: '13px', backgroundColor: 'white' }}
            value={formData.linkedLeadId || ''}
            onChange={(e) => handleSelectLead(e.target.value)}
          >
            <option value="">-- Buat Lead / Opportunity Baru --</option>
            {clientLeads.map(l => (
              <option key={l.id} value={l.id}>
                {l.program || 'Program'} — {l.date || 'TBD'} — Rp {new Intl.NumberFormat('id-ID').format(l.price || 0)} ({l.status?.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Nama Program */}
      <div>
        <label className="text-sm font-bold mb-2 block">
          Nama Program <span style={{ color: 'red' }}>*</span>
        </label>
        <input
          type="text"
          className="form-input"
          placeholder="Contoh: Leadership Character Program"
          value={formData.program || ''}
          onChange={(e) => handleChange('program', e.target.value)}
          required
        />
      </div>

      {/* Deskripsi */}
      <div>
        <label className="text-sm font-bold mb-2 block">
          Deskripsi Program
        </label>
        <textarea
          rows={2}
          className="form-input"
          placeholder="Deskripsi singkat mengenai isi dan sasaran kegiatan..."
          value={formData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </div>

      {/* Sesi, Durasi, Metode & Tanggal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Sesi
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              min="1"
              className="form-input"
              placeholder="1"
              value={formData.session ? String(formData.session).replace(/[^0-9]/g, '') : ''}
              onChange={(e) => {
                const val = e.target.value;
                handleChange('session', val ? `${val} Sesi` : '');
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Sesi</span>
          </div>
        </div>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Durasi
          </label>
          <DurationInput
            value={formData.duration}
            onChange={(val) => handleChange('duration', val)}
          />
        </div>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Metode
          </label>
          <select
            className="form-input"
            value={formData.method || 'Offline'}
            onChange={(e) => handleChange('method', e.target.value)}
          >
            <option value="Offline">Offline</option>
            <option value="Online">Online</option>
            <option value="Hybrid">Hybrid</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Tanggal Surat
          </label>
          <input
            type="date"
            className="form-input"
            value={formData.date || ''}
            onChange={(e) => handleChange('date', e.target.value)}
          />
        </div>
      </div>

      {/* Harga Normal & Special Price (Formatted as Rp 1.000.000,-) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Investasi Normal
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Rp 15.000.000"
            value={formatPriceDisplay(formData.value)}
            onChange={(e) => handlePriceChange('value', e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Special Price<span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Rp 12.500.000"
            value={formatPriceDisplay(formData.specialPrice)}
            onChange={(e) => handlePriceChange('specialPrice', e.target.value)}
            required
          />
        </div>
      </div>

      {/* Fasilitas Checklist System */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', backgroundColor: 'var(--surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label className="text-sm font-bold">
            Fasilitas
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: 'var(--primary)' }}>
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleSelectAllFacilities}
              style={{ width: 'auto' }}
            />
            Pilih Semua
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {SPH_FACILITIES.map((fac, i) => {
            const isChecked = currentFacilities.includes(fac);
            return (
              <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleFacilityToggle(fac)}
                  style={{ width: 'auto', marginTop: '3px' }}
                />
                <span>{fac}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Batas Konfirmasi */}
      <div>
        <label className="text-sm font-bold mb-2 block">
          Batas Konfirmasi Penawaran
        </label>
        <input
          type="date"
          className="form-input"
          value={formData.validUntil || ''}
          onChange={(e) => handleChange('validUntil', e.target.value)}
        />
      </div>

      {/* Catatan */}
      <div>
        <label className="text-sm font-bold mb-2 block">
          Catatan Tambahan
        </label>
        <textarea
          rows={2}
          className="form-input"
          placeholder="Catatan tambahan di dalam surat..."
          value={formData.extraNotes || ''}
          onChange={(e) => handleChange('extraNotes', e.target.value)}
        />
      </div>

    </div>
  );
};

export default SPHForm;
