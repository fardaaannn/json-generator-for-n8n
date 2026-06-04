export const EXAMPLES = {
  id: {
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
  },
  en: {
    'Webhook \u2192 Filter \u2192 Slack':
      'Build a workflow with a Webhook trigger. Receive JSON data, filter only items where the "status" field equals "active", then send a message to the Slack channel #notifications in the format: "New item: {name} - {status}"',
    'Daily schedule \u2192 API \u2192 Email':
      'Build a workflow that runs every day at 08:00. Fetch data from a REST API, extract the "summary" and "total" fields, then send an email to admin@company.com with the subject "Daily Report".',
    'Form \u2192 save to DB \u2192 Telegram':
      'Build a workflow with a Webhook trigger for form submissions. Save the data to PostgreSQL (table "submissions"), then send a Telegram notification: "New form from {name}: {email}"',
    'RSS feed \u2192 Discord':
      'Check an RSS feed every 30 minutes. Filter articles containing the keyword "AI" or "machine learning", then post to Discord with an embed containing the title, link, and description.',
    'Escrow: transfer \u2192 WA notify':
      'Escrow workflow. A webhook receives a transfer notification from a payment gateway. Update the status in the database, then send WhatsApp notifications to the buyer and seller via Fonnte.'
  }
}
