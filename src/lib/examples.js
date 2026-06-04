export const EXAMPLES = {
  'Webhook \u2192 Filter \u2192 Slack':
    'Buat workflow dengan trigger Webhook. Terima data JSON, filter hanya data dengan field "status" bernilai "active", lalu kirim pesan ke channel Slack #notifications dengan format: "New item: {name} - {status}"',
  'Jadwal harian \u2192 API \u2192 Email':
    'Buat workflow yang berjalan setiap hari pukul 08:00. Ambil data dari REST API, ekstrak field "summary" dan "total", lalu kirim email ke admin@company.com dengan subject "Daily Report".',
  'Form \u2192 simpan DB \u2192 Telegram':
    'Buat workflow dengan trigger Webhook untuk form submission. Simpan data ke PostgreSQL (tabel "submissions"), lalu kirim notifikasi ke Telegram: "Form baru dari {name}: {email}"',
  'RSS feed \u2192 Discord':
    'Cek RSS feed setiap 30 menit. Filter artikel yang mengandung keyword "AI" atau "machine learning", lalu post ke Discord dengan embed berisi judul, link, dan deskripsi.',
  'Rekber: transfer \u2192 notif WA':
    'Workflow rekber. Webhook menerima notifikasi transfer dari payment gateway. Update status di database, kirim notifikasi WhatsApp ke pembeli dan penjual via Fonnte.'
};
