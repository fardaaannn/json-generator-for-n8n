# n8n Workflow Generator

[Bahasa Indonesia](README.md) · **English**

Generate n8n workflow JSON from a text description using AI — straight from the browser, with no backend.

## Live Demo

Try it right away without running anything on your local machine:

**[https://fardaaannn.github.io/json-generator-for-n8n/](https://fardaaannn.github.io/json-generator-for-n8n/)**

## Preview

<p align="center">
  <img src="Screenshots/Screenshot%202026-06-05%20024305.png" alt="n8n Workflow Generator landing page (hero)" width="100%">
</p>

<p align="center">
  <img src="Screenshots/Screenshot%202026-06-05%20024342.png" alt="Workflow description form, quick examples, and the Output JSON panel" width="100%">
</p>

<p align="center">
  <img src="Screenshots/Screenshot%202026-06-05%20024410.png" alt="AI Provider selection, API key, and workflow options" width="100%">
</p>

## Features

- **Generate workflow JSON** from a natural-language description
- **5 AI providers**: Anthropic (Claude), OpenAI (GPT), Groq, OpenRouter, Custom (OpenAI-compatible)
- **Quick examples**: 5 ready-to-use workflow templates
- **3 complexity levels**: Simple, Medium, Full + error handling
- **Customization**: Workflow name and comment language (ID/EN); workflows always target n8n 1.x
- **Live model list**: Models are fetched straight from the provider (with caching & fallback to the built-in list)
- **Light/dark theme**: A theme toggle that follows your system preference and persists in the browser
- **Direct connection**: API key stays in the browser, never sent to any server
- **Copy & Download**: Copy the JSON to the clipboard or download a `.json` file
- **Visual preview**: See nodes & connections as a diagram, not just JSON text (JSON/Preview toggle)
- **Refine**: Tweak the workflow with a follow-up instruction (e.g. "add a Slack node") without starting over
- **Generation history**: The last 10 results are stored in the browser and can be reopened
- **Direct import to n8n (optional)**: Send the workflow to your own n8n instance via the REST API, straight from the browser
- **Structured JSON output**: Uses providers' JSON mode (OpenAI/Groq/OpenRouter) + a system prompt for more reliable JSON
- **JSON structure validation**: Automatic warnings for invalid nodes/tags/connections or unknown node types
- **Input sanitization**: Basic prompt-injection protection before sending to the AI
- **Template references**: A curated set of third-party n8n workflow collections for inspiration

## Getting Started

### Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Production build

```bash
npm run build
```

The build output lands in the `dist/` folder — open it directly or host it on any static server.

### Usage

1. Write the description of the workflow you want
2. Pick an AI provider and enter your API key (if required)
3. Set the options (workflow name, complexity, language)
4. Click **Generate workflow JSON**
5. Copy or download the resulting JSON
6. Import the `.json` file into n8n
7. _(Optional)_ Or use **Import directly to n8n** to send the workflow to your n8n instance without downloading — see the section below

## Direct import to n8n (Optional)

> **This feature is entirely optional.** The primary flow is still Copy/Download followed by a manual import. This feature only speeds up that step for self-hosted n8n users.

After generating, open the **"Import directly to n8n"** panel in the Output card, then fill in:

- **n8n Base URL** — the address of your instance, without `/api/v1` (e.g. `https://n8n.example.com`)
- **n8n API Key** — create one in n8n: **Settings → n8n API → Create an API key**

Click **Import to n8n**. The workflow is created via the `POST /api/v1/workflows` endpoint, and on success you get a link to open it directly in n8n.

### How it works & privacy

- The request goes **straight from the browser to your n8n instance** — your n8n API key **never** passes through our servers (same as the AI API keys).
- The payload sent contains only `name`, `nodes`, `connections`, and `settings` (read-only fields such as `active`/`id` are stripped so n8n won't reject it).

### Limitations (important)

- **Self-hosted n8n only**, and the instance must allow this site's origin via the `N8N_CORS_ALLOW_ORIGIN` env var. Without it, the browser blocks the request due to CORS.
- **Mixed content**: an HTTPS page cannot call an n8n at `http://` or `localhost`.
- For **n8n Cloud**, this feature generally does not work because of CORS limitations — use Copy/Download instead.
- If it fails for any reason, the **Copy/Download fallback** is always available.

## Providers & API Keys

| Provider | API Key | Default Model |
|---|---|---|
| Anthropic (Claude) | Required | claude-sonnet-4-20250514 |
| OpenAI (GPT) | Required | gpt-4o |
| Groq | Required | llama-3.3-70b-versatile |
| OpenRouter | Required | anthropic/claude-sonnet-4-5 |
| Custom | Required | Manual input |

## Security

- The API key is **never** sent to our servers — requests go straight from the browser to the AI provider's API
- The same applies to your **n8n API key** in the optional import feature — requests go straight from the browser to your n8n instance
- The "Remember API key" option stores the key in the browser's `localStorage` (do not enable it on a public computer)
- Input is sanitized first to mitigate prompt injection

## Stack

- [Vite](https://vitejs.dev/) — build tool & dev server
- [React 18](https://react.dev/) — UI framework
- [Tailwind CSS](https://tailwindcss.com/) — utility CSS via PostCSS
- Vanilla CSS — the original design is kept as the source of truth

## Project structure

```
├── index.html              # Vite entry point
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js
├── public/
│   └── favicon.svg
├── scripts/
│   ├── test-generation.mjs # Smoke test for the generation pipeline (no API key)
│   └── test-providers.mjs  # Provider connectivity check (uses real API keys)
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Main component (state + layout)
    ├── index.css           # All CSS (vanilla + tailwind directives)
    ├── components/
    │   ├── Header.jsx          # Header: brand, language switch, theme toggle
    │   ├── Hero.jsx            # Hero/title section
    │   ├── WorkflowPreview.jsx # Node & connection diagram (SVG, dependency-free)
    │   ├── References.jsx      # List of third-party n8n template collections
    │   └── Footer.jsx          # Footer + social links
    └── lib/
        ├── providers.js          # Definitions for the 5 AI providers (request, parse, models)
        ├── modelCatalog.js       # Live model-list fetching + localStorage cache
        ├── examples.js           # Quick-example templates
        ├── references.js         # Reference template-collection data
        ├── n8nNodes.js           # n8n node catalog for node-type validation
        ├── getNodeClass.js       # Node classification (trigger/logic/action)
        ├── i18n.jsx              # ID/EN translations + LanguageProvider
        ├── useTheme.js           # Light/dark theme hook
        ├── useWorkflowGeneration.js # Generate/refine + history hook
        ├── useN8nImport.js       # Direct import-to-n8n hook (optional)
        ├── pipeline.js           # 5-layer pipeline (sanitize → prompt → clean → repair → validate) + optional import to n8n
        └── pipeline.test.js      # Unit tests for the pipeline
```
