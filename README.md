# n8n Workflow Generator

Generate workflow n8n JSON dari deskripsi teks menggunakan AI — langsung dari browser, tanpa backend.

## Fitur

- **Generate workflow JSON** dari deskripsi natural language
- **5 AI Provider**: Anthropic (Claude), OpenAI (GPT), Groq, OpenRouter, Custom (OpenAI-compatible)
- **Contoh cepat**: 5 template workflow siap pakai
- **3 tingkat kompleksitas**: Sederhana, Menengah, Lengkap + error handling
- **Kustomisasi**: Nama workflow, versi n8n (1.x / 0.x), bahasa komentar (ID/EN)
- **Direct connection**: API key tetap di browser, tidak dikirim ke server manapun
- **Copy & Download**: Salin JSON ke clipboard atau unduh file `.json`
- **Validasi struktur JSON**: Peringatan otomatis jika ada node/tag/connection yang tidak valid
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
│       └── pipeline.js     # 5-layer pipeline (sanitize → prompt → clean → repair → validate)
└── n8n_workflow_generator_v2.html  # Referensi versi lama (CDN-only)
