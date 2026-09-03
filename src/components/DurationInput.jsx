import React, { useState, useEffect } from 'react';

const PRESETS = ['1 - 1.5 Jam', '2 Jam', 'Half Day', 'Full Day', '2 Hari', '2H 1M', '3H 2M'];

const DurationInput = ({ value = '', onChange, style, className = 'form-input' }) => {
  const isPreset = PRESETS.includes(value);
  const [isCustomMode, setIsCustomMode] = useState(!isPreset && value !== '' && value !== '2 Jam');

  useEffect(() => {
    if (value && !PRESETS.includes(value)) {
      setIsCustomMode(true);
    }
  }, [value]);

  if (isCustomMode) {
    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type="text"
          className={className}
          placeholder="Ketik..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...style, paddingRight: '36px' }}
          autoFocus
        />
        <button
          type="button"
          onClick={() => {
            setIsCustomMode(false);
            onChange('2 Jam');
          }}
          title="Kembali ke pilihan dropdown"
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary, #64748b)',
            fontSize: '14px',
            fontWeight: 'bold',
            lineHeight: 1
          }}
        >
          ✕
        </button>
      </div>
    );
  }

  const selectValue = isPreset ? value : (value || '2 Jam');

  return (
    <select
      className={className}
      value={selectValue}
      onChange={(e) => {
        const val = e.target.value;
        if (val === 'CUSTOM_OPTION') {
          setIsCustomMode(true);
          onChange('');
        } else {
          onChange(val);
        }
      }}
      style={{ ...style, cursor: 'pointer' }}
    >
      <option value="1 - 1.5 Jam">1 - 1.5 Jam</option>
      <option value="2 Jam">2 Jam</option>
      <option value="Half Day">Half Day</option>
      <option value="Full Day">Full Day</option>
      <option value="2 Hari">2 Hari</option>
      <option value="2H 1M">2H 1M</option>
      <option value="3H 2M">3H 2M</option>
      <option value="CUSTOM_OPTION">Custom</option>
    </select>
  );
};

export default DurationInput;
