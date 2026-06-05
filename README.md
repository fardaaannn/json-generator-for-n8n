# n8n Workflow Generator

**Bahasa Indonesia** · [English](README.en.md)

Generate workflow n8n JSON dari deskripsi teks menggunakan AI — langsung dari browser, tanpa backend.

## Live Demo

Coba langsung tanpa perlu menjalankan program di komputer lokal:

**[https://fardaaannn.github.io/json-generator-for-n8n/](https://fardaaannn.github.io/json-generator-for-n8n/)**

## Tampilan

<p align="center">
  <img src="Screenshots/Screenshot%202026-06-05%20024305.png" alt="Halaman utama n8n Workflow Generator (hero)" width="100%">
</p>

<p align="center">
  <img src="Screenshots/Screenshot%202026-06-05%20024342.png" alt="Form deskripsi workflow, contoh cepat, dan panel Output JSON" width="100%">
</p>

<p align="center">
  <img src="Screenshots/Screenshot%202026-06-05%20024410.png" alt="Pilihan AI Provider, API key, dan opsi workflow" width="100%">
</p>

## Fitur

- **Generate workflow JSON** dari deskripsi natural language
- **5 AI Provider**: Anthropic (Claude), OpenAI (GPT), Groq, OpenRouter, Custom (OpenAI-compatible)
- **Contoh cepat**: 5 template workflow siap pakai
- **3 tingkat kompleksitas**: Sederhana, Menengah, Lengkap + error handling
- **Kustomisasi**: Nama workflow, versi n8n (1.x / 0.x), bahasa komentar (ID/EN)
- **Direct connection**: API key tetap di browser, tidak dikirim ke server manapun
- **Copy & Download**: Salin JSON ke clipboard atau unduh file `.json`
- **Preview visual**: Lihat node & koneksi sebagai diagram, bukan cuma teks JSON (toggle JSON/Preview)
- **Refine**: Ubah workflow lewat perintah lanjutan (mis. "tambah node Slack") tanpa mulai dari nol
- **Riwayat generasi**: 10 hasil terakhir tersimpan di browser dan bisa dibuka kembali
- **Import langsung ke n8n (opsional)**: Kirim workflow ke instance n8n kamu via REST API, langsung dari browser
- **Output JSON terstruktur**: Memakai JSON mode provider (OpenAI/Groq/OpenRouter) + system prompt agar hasil JSON lebih andal
- **Validasi struktur JSON**: Peringatan otomatis jika ada node/tag/connection tidak valid atau node type tidak dikenal
- **Input sanitization**: Proteksi dasar prompt injection sebelum dikirim ke AI

## Cara Pakai

### Development

```bash
npm install
npm run dev
```

Buka `http://localhost:5173` di browser.

### Production build

```bash
npm run build
```

Hasil build di folder `dist/` — bisa dibuka langsung atau dihosting ke static server.

### Penggunaan

1. Tulis deskripsi workflow yang kamu mau
2. Pilih AI Provider dan masukkan API key (jika diperlukan)
3. Atur opsi (nama workflow, versi n8n, kompleksitas, bahasa)
4. Klik **Generate workflow JSON**
5. Copy atau download hasil JSON
6. Import file `.json` ke n8n
7. _(Opsional)_ Atau gunakan **Import langsung ke n8n** untuk mengirim workflow ke instance n8n kamu tanpa download — lihat bagian di bawah

## Import langsung ke n8n (Opsional)

> **Fitur ini sepenuhnya opsional.** Cara utama tetap Copy/Download lalu import manual. Fitur ini hanya mempercepat langkah tersebut untuk pengguna n8n self-hosted.

Setelah generate, buka panel **"Import langsung ke n8n"** di kartu Output, lalu isi:

- **n8n Base URL** — alamat instance kamu, tanpa `/api/v1` (mis. `https://n8n.example.com`)
- **n8n API Key** — buat di n8n: **Settings → n8n API → Create an API key**

Klik **Import ke n8n**. Workflow akan dibuat lewat endpoint `POST /api/v1/workflows`, dan kalau berhasil kamu dapat tautan untuk membukanya langsung di n8n.

### Cara kerja & privasi

- Request berjalan **langsung dari browser ke instance n8n kamu** — API key n8n **tidak** melewati server kami (sama seperti API key AI).
- Payload yang dikirim hanya `name`, `nodes`, `connections`, dan `settings` (field read-only seperti `active`/`id` dibuang agar tidak ditolak n8n).

### Batasan (penting)

- **Hanya untuk n8n self-hosted** yang mengizinkan origin situs ini lewat env `N8N_CORS_ALLOW_ORIGIN`. Tanpa itu, browser akan memblokir request karena CORS.
- **Mixed content**: halaman HTTPS tidak bisa memanggil n8n di `http://` atau `localhost`.
- Untuk **n8n Cloud**, fitur ini umumnya tidak berfungsi karena keterbatasan CORS — gunakan Copy/Download.
- Kalau gagal karena alasan apa pun, **fallback ke Copy/Download** selalu tersedia.

## Provider & API Key

| Provider | API Key | Model Default |
|---|---|---|
| Anthropic (Claude) | Wajib | claude-sonnet-4-20250514 |
| OpenAI (GPT) | Wajib | gpt-4o |
| Groq | Wajib | llama-3.3-70b-versatile |
| OpenRouter | Wajib | anthropic/claude-sonnet-4-5 |
| Custom | Wajib | Manual input |

## Keamanan

- API key **tidak pernah** dikirim ke server kami — request langsung dari browser ke API provider AI
- Begitu juga **n8n API key** pada fitur import opsional — request langsung dari browser ke instance n8n kamu
- Opsi "Ingat API key" menyimpan key di `localStorage` browser (jangan aktifkan di komputer publik)
- Input didahului sanitasi untuk mencegah prompt injection

## Stack

- [Vite](https://vitejs.dev/) — build tool & dev server
- [React 18](https://react.dev/) — UI framework
- [Tailwind CSS](https://tailwindcss.com/) — utility CSS via PostCSS
- Vanilla CSS — desain lama dipertahankan sebagai source of truth

## Struktur project

```
├── index.html              # Vite entry point
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.jsx            # Entry point React
│   ├── App.jsx             # Komponen utama (state + layout)
│   ├── index.css           # Semua CSS (vanilla + tailwind directives)
│   ├── components/
│   │   ├── Header.jsx
│   │   └── Hero.jsx
│   └── lib/
│       ├── providers.js    # Definisi 5 AI provider
│       ├── examples.js     # Template contoh cepat
│       ├── getNodeClass.js # Klasifikasi node n8n
│       └── pipeline.js     # 5-layer pipeline (sanitize → prompt → clean → repair → validate) + import opsional ke n8n
└── n8n_workflow_generator_v2.html  # Referensi versi lama (CDN-only)
