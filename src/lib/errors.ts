export function errorMessage(error: unknown): string {
  const value = error as { message?: string; code?: string }
  if (value?.message?.includes('Invalid API key')) return 'Key Supabase tidak valid. Periksa URL dan publishable/anon key di .env, lalu mulai ulang aplikasi.'
  if (value?.code === 'PGRST106') return 'Schema myhome belum diekspos. Tambahkan myhome di Supabase Settings → Data API → Exposed schemas.'
  if (value?.code === 'PGRST205' || value?.code === 'PGRST202') return 'Tabel atau fungsi myhome belum tersedia. Pastikan supabase/myhome.sql sudah dijalankan di proyek yang sama.'
  if (value?.message?.includes('Invalid login credentials')) return 'Email atau kata sandi tidak cocok.'
  if (value?.message?.includes('Email not confirmed')) return 'Konfirmasi email terlebih dahulu melalui tautan yang dikirim Supabase.'
  if (value?.code === '23503') return 'Data masih digunakan atau referensinya tidak tersedia. Muat ulang dan periksa catatan terkait.'
  if (value?.code === '23505') return 'Data tersebut sudah ada. Periksa nama atau catatan yang sama.'
  if (value?.code === '23514' || value?.code === '22P02') return value.message?.includes('Saldo tidak cukup') ? 'Saldo tidak cukup untuk perubahan ini.' : 'Periksa nominal, tanggal, dan kelengkapan formulir.'
  if (value?.code === '42501') return 'Akses ditolak. Pastikan akun masih menjadi anggota rumah ini.'
  if (value?.message?.includes('fetch') || value?.message?.includes('network')) return 'Tidak dapat terhubung. Periksa koneksi internet, lalu coba muat ulang.'
  return value?.message || 'Terjadi kesalahan. Silakan coba lagi.'
}
