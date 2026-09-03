import React, { useState, useEffect } from 'react';
import { invokeApi } from '../../../lib/supabase';
import { CreditCard } from 'lucide-react';

const BankSelector = ({ value, onChange, label = "Rekening Pembayaran / Transfer" }) => {
  const [bankAccounts, setBankAccounts] = useState([]);

  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        const { data } = await invokeApi('/settings?id=eq.business&single=true');
        if (data?.value?.bankAccounts && Array.isArray(data.value.bankAccounts)) {
          const valid = data.value.bankAccounts.filter(b => b.bankName || b.accountNo);
          setBankAccounts(valid);
          // Auto select first bank if form value is empty
          if (!value && valid.length > 0) {
            const first = valid[0];
            const defaultStr = `${first.bankName} ${first.accountNo} ${first.accountName}`.trim();
            onChange(defaultStr);
          }
        }
      } catch (err) {
        console.error("Gagal mengambil daftar rekening dari settings:", err);
      }
    };
    fetchBankAccounts();
  }, []);

  const handleSelect = (e) => {
    const selectedVal = e.target.value;
    onChange(selectedVal);
  };

  return (
    <div>
      <label className="text-sm font-bold mb-2 block" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <CreditCard size={16} style={{ color: 'var(--primary)' }} />
        {label}
      </label>
      
      {bankAccounts.length > 0 ? (
        <select
          className="form-input"
          value={value || ''}
          onChange={handleSelect}
          style={{ backgroundColor: 'white', fontWeight: '500' }}
        >
          <option value="">-- Pilih Rekening dari Setting --</option>
          {bankAccounts.map((account, idx) => {
            const strVal = `${account.bankName} ${account.accountNo} ${account.accountName}`.trim();
            const displayLabel = `${account.bankName} - ${account.accountNo} (${account.accountName})`;
            return (
              <option key={idx} value={strVal}>
                {displayLabel}
              </option>
            );
          })}
        </select>
      ) : (
        <input
          type="text"
          className="form-input"
          placeholder="Contoh: Bank Mandiri 1234567890 a/n MCKuadrat"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      
      {bankAccounts.length > 0 && (
        <input
          type="text"
          className="form-input"
          style={{ marginTop: '6px', fontSize: '13px', backgroundColor: '#F8FAFC' }}
          placeholder="Atau sesuaikan teks rekening di sini..."
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
};

export default BankSelector;
