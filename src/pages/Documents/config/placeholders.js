export const ALL_FORM_PLACEHOLDERS = {
  SPH: ['nomor', 'tanggal', 'sekolah', 'program', 'deskripsi', 'sesi', 'normal', 'harga', 'terbilang', 'fasilitas', 'konfirmasi', 'catatan'],
  SKK: ['nomor', 'tanggal', 'sekolah', 'program', 'waktu', 'peserta', 'trainer', 'harga', 'terbilang', 'bayar', 'bank', 'fasilitas', 'persiapan', 'pic', 'jabatan', 'catatan'],
  INV: ['nomor', 'tanggal', 'sekolah', 'program', 'waktu', 'harga', 'terbilang', 'bayar', 'bank', 'catatan'],
  KUI: ['nomor', 'tanggal', 'sekolah', 'harga', 'terbilang', 'pembayaran', 'catatan']
};

export const MANDATORY_PLACEHOLDERS = {
  SPH: ['nomor', 'tanggal', 'sekolah'],
  SKK: ['nomor', 'tanggal', 'sekolah'],
  INV: ['nomor', 'tanggal', 'sekolah'],
  KUI: ['nomor', 'tanggal', 'sekolah']
};

export const PLACEHOLDER_DESCRIPTIONS = {
  nomor: 'Nomor Surat Resmi (Generate Otomatis)',
  tanggal: 'Tanggal Surat (Format Indonesia)',
  sekolah: 'Nama Sekolah / Client',
  program: 'Nama Program / Kegiatan',
  deskripsi: 'Deskripsi Singkat Program',
  sesi: 'Jumlah Sesi / Durasi',
  normal: 'Harga Normal (Sebelum Diskon)',
  harga: 'Harga Final / Total Nilai (Format Rp)',
  terbilang: 'Nilai Terbilang Huruf Indonesia',
  bayar: 'Ketentuan / Skema Pembayaran',
  bank: 'Informasi Rekening Pembayaran Bank',
  trainer: 'Nama Trainer / Pembicara Utama',
  waktu: 'Tanggal & Jam Pelaksanaan Kegiatan',
  peserta: 'Jumlah / Target Peserta',
  pic: 'Nama PIC Penyelenggara / Sekolah',
  jabatan: 'Jabatan PIC Sekolah',
  fasilitas: 'Fasilitas yang Disediakan MCKuadrat',
  persiapan: 'Persiapan yang Disiapkan Sekolah',
  konfirmasi: 'Batas Tanggal Konfirmasi Penawaran',
  pembayaran: 'Untuk Pembayaran (Kuitansi)',
  catatan: 'Catatan Khusus Dokumen'
};

export const SPH_FACILITIES = [
  "Expert Trainer",
  "Tim Support training",
  "Fasilitator",
  "Customized Content (Materi yang disesuaikan dengan kebutuhan)",
  "Simulasi dan Tools",
  "Transport",
  "Akomodasi",
  "Sound System Set (2 Sound Yamaha DBR 10, Mixer 10 Channel dan Mic Wireless KREZT)"
];
