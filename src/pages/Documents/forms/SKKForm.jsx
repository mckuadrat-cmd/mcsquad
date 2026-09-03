import React, { useEffect } from 'react';
import { SPH_FACILITIES } from '../config/placeholders';
import { CalendarX } from 'lucide-react';
import ClientAutocomplete from '../components/ClientAutocomplete';
import BankSelector from '../components/BankSelector';
import DurationInput from '../../../components/DurationInput';
import { formatPriceDisplay, parsePriceValue } from '../../../utils/priceUtils';

export const DEFAULT_PENYELENGGARA_PREP = "Tempat training yang kondusif, Sound Sistem, LCD Proyektor, Kabel HDMI, Kabel Audio, Kursi-Meja Trainer & Flipchart-spidol";

const SKKForm = ({ formData, setFormData, clients = [], leads = [], onRemoveSchedule }) => {
  // Ensure default value for disiapkanPenyelenggara is populated on mount if empty
  useEffect(() => {
    if (!formData?.disiapkanPenyelenggara) {
      setFormData(prev => ({
        ...prev,
        disiapkanPenyelenggara: DEFAULT_PENYELENGGARA_PREP
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      handleChange('penyelenggara', matched.nama || matched.name || '');
      handleChange('jabatan', matched.posisi || matched.position || '');
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
        value: selectedLead.price || prev.value,
        startDate: selectedLead.date && selectedLead.date !== 'TBD' ? selectedLead.date : prev.startDate
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
            <option value="">-- Pilih Lead / Program --</option>
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
          placeholder="Contoh: Character Building & Outbound"
          value={formData.program || ''}
          onChange={(e) => handleChange('program', e.target.value)}
          required
        />
      </div>

      {/* Trainer & Peserta */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Trainer
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Anrio Marfizal & Team"
            value={formData.trainer || ''}
            onChange={(e) => handleChange('trainer', e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Target Peserta
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="150 Siswa Kelas VII"
            value={formData.peserta || ''}
            onChange={(e) => handleChange('peserta', e.target.value)}
          />
        </div>
      </div>

      {/* Tanggal Mulai & Tanggal Selesai */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Tanggal Pelaksanaan <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="date"
            className="form-input"
            value={formData.startDate || ''}
            onChange={(e) => handleChange('startDate', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Tanggal Selesai
          </label>
          <input
            type="date"
            className="form-input"
            value={formData.endDate || formData.startDate || ''}
            onChange={(e) => handleChange('endDate', e.target.value)}
          />
        </div>
      </div>

      {/* Sesi, Durasi & Metode */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
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
      </div>
      {/* Jam Mulai & Jam Selesai */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Jam Mulai
          </label>
          <input
            type="time"
            className="form-input"
            value={formData.startTime || '08:00'}
            onChange={(e) => handleChange('startTime', e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Jam Selesai
          </label>
          <input
            type="time"
            className="form-input"
            value={formData.endTime || '16:00'}
            onChange={(e) => handleChange('endTime', e.target.value)}
          />
        </div>
      </div>

      {/* Action Hapus Jadwal */}
      {onRemoveSchedule && formData.startDate && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onRemoveSchedule}
            className="btn btn-outline"
            style={{ color: '#E03131', border: '1px solid #FFC9C9', backgroundColor: '#FFF5F5', padding: '6px 12px', fontSize: '12px' }}
          >
            <CalendarX size={14} /> Hapus Jadwal dari Kalender
          </button>
        </div>
      )}

      {/* Nilai Program & Estimasi Pembayaran */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Investasi <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Ketik angka, misal 18000000"
            value={formatPriceDisplay(formData.value)}
            onChange={(e) => handlePriceChange('value', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-bold mb-2 block">
            Estimasi Pembayaran
          </label>
          <input
            type="date"
            className="form-input"
            value={formData.paymentDate || formData.validUntil || ''}
            onChange={(e) => {
              handleChange('paymentDate', e.target.value);
              handleChange('validUntil', e.target.value);
            }}
          />
        </div>
      </div>

      {/* Selector Rekening Pembayaran */}
      <BankSelector
        value={formData.bank}
        onChange={(val) => handleChange('bank', val)}
      />

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

      {/* Persiapan (Disiapkan oleh Penyelenggara) */}
      <div>
        <label className="text-sm font-bold mb-2 block">
          Disiapkan oleh Penyelenggara <span style={{ color: 'red' }}>*</span>
        </label>
        <textarea
          rows={3}
          className="form-input"
          value={formData.disiapkanPenyelenggara !== undefined ? formData.disiapkanPenyelenggara : DEFAULT_PENYELENGGARA_PREP}
          onChange={(e) => handleChange('disiapkanPenyelenggara', e.target.value)}
          required
        />
      </div>

      {/* Catatan Tambahan */}
      <div>
        <label className="text-sm font-bold mb-2 block">
          Catatan Tambahan
        </label>
        <textarea
          rows={2}
          className="form-input"
          placeholder="Catatan persetujuan kegiatan..."
          value={formData.extraNotes || ''}
          onChange={(e) => handleChange('extraNotes', e.target.value)}
        />
      </div>

      {/* POSISI PALING BAWAH: Persetujuan (Nama & Jabatan Pihak Penyelenggara) */}
      <div style={{ border: '1px solid #CBD5E1', borderRadius: '10px', padding: '14px', backgroundColor: '#F8FAFC', marginTop: '4px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Persetujuan Penyelenggara
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="text-sm font-bold mb-2 block">
              Nama Lengkap <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              style={{ backgroundColor: 'white' }}
              placeholder="Contoh: Bpk. Ahmad Fauzi, M.Pd"
              value={formData.penyelenggara || ''}
              onChange={(e) => handleChange('penyelenggara', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-bold mb-2 block">
              Jabatan <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              style={{ backgroundColor: 'white' }}
              placeholder="Contoh: Kepala Sekolah / Wakasek"
              value={formData.jabatan || ''}
              onChange={(e) => handleChange('jabatan', e.target.value)}
              required
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default SKKForm;
