export const isOnlyEmoji = (str) => {
  if (!str) return false;
  const noEmoji = str.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\u200d]/gu, '').trim();
  return noEmoji.length === 0 && str.trim().length > 0;
};

export const formatDateSeparator = (date, mode = 'long') => {
  if (!date) return '';
  const now = new Date();
  const d = date instanceof Date ? date : date.toDate();
  
  if (d.toDateString() === now.toDateString()) return 'Hari Ini';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Kemarin';
  
  if (mode === 'short') {
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }
  
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

export const formatLastSeen = (timestamp) => {
  if (!timestamp) return 'Offline';
  const date = timestamp.toDate();
  const now = new Date();
  
  const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  
  if (date.toDateString() === now.toDateString()) {
    return `Aktif: hari ini, ${timeStr} WIB`;
  }
  return `Aktif: ${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, ${timeStr} WIB`;
};
