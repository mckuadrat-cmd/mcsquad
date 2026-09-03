export const DOCUMENT_TYPES = {
  SPH: {
    code: 'SPH',
    name: 'Surat Penawaran Harga',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    usesWordTemplate: true,
    description: 'Dokumen penawaran harga resmi kegiatan / program untuk calon client.'
  },
  SKK: {
    code: 'SKK',
    name: 'Surat Kerjasama & Konfirmasi Penjadwalan',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    usesWordTemplate: true,
    description: 'Surat kesepakatan kerjasama dan konfirmasi waktu/jadwal kegiatan.'
  },
  INV: {
    code: 'INV',
    name: 'Invoice',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    usesWordTemplate: true,
    description: 'Tagihan pembayaran resmi untuk client.'
  },
  KUI: {
    code: 'KUI',
    name: 'Kuitansi',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    usesWordTemplate: true,
    description: 'Tanda terima pembayaran yang sah.'
  },
  MOU: {
    code: 'MOU',
    name: 'Memorandum of Understanding',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    usesWordTemplate: false,
    description: 'Registrasi nomor dokumen nota kesepahaman (tanpa file DOCX/PDF).'
  },
  GEN: {
    code: 'GEN',
    name: 'Surat Umum',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    usesWordTemplate: false,
    description: 'Registrasi nomor surat keluar umum/administrasi (tanpa file DOCX/PDF).'
  }
};
