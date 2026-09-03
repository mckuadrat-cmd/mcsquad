import React, { useState, useRef, useEffect, useMemo } from 'react';

const ClientAutocomplete = ({
  clients = [],
  value = '',
  onChange,
  onSelectClient,
  placeholder = "Contoh: SMA Negeri 1 Jakarta",
  required = false,
  label = "Sekolah / Client"
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Deduplicate client list by school name (same pattern as Leads.jsx)
  const uniqueSchools = useMemo(() => {
    const map = new Map();
    (clients || []).forEach(c => {
      const schName = c.sekolah || c.school || c.nama || c.name;
      if (schName && !map.has(schName.toLowerCase())) {
        map.set(schName.toLowerCase(), {
          id: c.id || c.schoolId || '',
          name: schName,
          raw: c
        });
      }
    });
    return Array.from(map.values());
  }, [clients]);

  const searchLower = (value || '').toLowerCase().trim();
  const filteredSchoolSuggestions = uniqueSchools.filter(s =>
    s.name.toLowerCase().includes(searchLower)
  );

  return (
    <div style={{ position: 'relative' }} ref={wrapperRef}>
      <label className="text-sm font-medium mb-2 block">
        {label} {required && <span style={{ color: 'red' }}>*</span>}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={value || ''}
        required={required}
        onChange={(e) => {
          onChange(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        style={{
          backgroundColor: 'var(--bg)',
          padding: '12px 16px',
          border: '1px solid var(--border)',
          width: '100%',
          borderRadius: '8px',
          fontSize: '15px'
        }}
      />

      {showDropdown && (value || '').trim().length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          marginTop: '4px',
          zIndex: 200,
          maxHeight: '220px',
          overflowY: 'auto',
          boxShadow: '0 8px 16px rgba(0,0,0,0.08)'
        }}>
          {filteredSchoolSuggestions.length > 0 ? (
            <>
              <div style={{
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '700',
                color: 'var(--text-secondary)',
                backgroundColor: '#F8F9FB',
                borderBottom: '1px solid var(--border)',
                textTransform: 'uppercase'
              }}>
                PILIH SEKOLAH TERDAFTAR:
              </div>
              {filteredSchoolSuggestions.map((s, idx) => (
                <div
                  key={s.id || idx}
                  onClick={() => {
                    onChange(s.name);
                    if (onSelectClient) onSelectClient(s.raw);
                    setShowDropdown(false);
                  }}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: idx === filteredSchoolSuggestions.length - 1 ? 'none' : '1px solid var(--border)'
                  }}
                  className="hover:bg-primary-soft transition-colors"
                >
                  <p style={{ margin: 0, fontWeight: 500, fontSize: '15px' }}>
                    {s.id && <span style={{ color: 'var(--primary)', marginRight: '6px' }}>{s.id}</span>}
                    {s.name}
                  </p>
                </div>
              ))}
            </>
          ) : (
            <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Sekolah baru? <strong>"{value}"</strong> akan digunakan sebagai nama sekolah/client baru.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientAutocomplete;
