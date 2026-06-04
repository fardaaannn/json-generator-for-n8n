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
| Anthropic (Claude) | Opsional | claude-sonnet-4-20250514 |
| OpenAI (GPT) | Wajib | gpt-4o |
| Groq | Wajib | llama-3.3-70b-versatile |
| OpenRouter | Wajib | anthropic/claude-sonnet-4-5 |
| Custom | Wajib | Manual input |

## Keamanan

- API key **tidak pernah** dikirim ke server kami — request langsung dari browser ke API provider AI
- Opsi "Ingat API key" menyimpan key di `localStorage` browser (jangan aktifkan di komputer publik)
- Input didahului sanitasi untuk mencegah prompt injection

## Hosting di GitHub Pages

Build dulu, lalu deploy folder `dist/`:

### Opsi 1 — GitHub Actions (otomatis)

Buat `.github/workflows/deploy.yml`:

```yml
name: Deploy to Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci && npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

Push ke `main` → otomatis build & deploy.

### Opsi 2 — Manual

1. `npm run build`
2. Push folder `dist/` (atau deploy ke branch `gh-pages`)
3. Buka repo → Settings → Pages → Source: **GitHub Actions**

Akses via `https://username.github.io/nama-repo`.

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
