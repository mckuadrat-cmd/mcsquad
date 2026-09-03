/**
 * Formats a raw number string/number into Indonesian Rupiah display format (e.g. 1000000 -> Rp 1.000.000,-)
 */
export const formatPriceDisplay = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const numStr = String(val).replace(/[^0-9]/g, '');
  if (!numStr) return '';
  const formatted = new Intl.NumberFormat('id-ID').format(parseInt(numStr, 10));
  return `Rp ${formatted},-`;
};

/**
 * Extracts raw number string from a formatted price string (e.g. Rp 1.000.000,- -> 1000000)
 */
export const parsePriceValue = (val) => {
  if (!val) return '';
  return String(val).replace(/[^0-9]/g, '');
};
