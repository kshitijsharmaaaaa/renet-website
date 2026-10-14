# RENET website

## Setup

```bash
npm install                 # frontend
npm run server:install      # backend (server/)
cp .env.example .env.local  # frontend config: VITE_WHATSAPP_NUMBER
cp server/.env.example server/.env   # backend config: ANTHROPIC_API_KEY
```

## Run (two terminals)

```bash
npm run server   # RENET assistant API on http://localhost:8787
npm run dev      # website on http://localhost:5173 (proxies /api to the backend)
```

## Updating the AI assistant's knowledge

The assistant only answers from `server/knowledge/renet-knowledge.md`.
When website content or official specifications change, edit that file and restart `npm run server`.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Performance & capacity

- `npm run images` regenerates the responsive WebP images in `src/assets/optimized/` from the PNGs in `public/` (run it whenever a photo changes).
- `npm run build` also writes Brotli/gzip copies used when the API server serves the site (`STATIC_DIR=../dist`).
- Load tests (target a **non-production** server with a throw-away `LEADS_FILE`):
  - `node server/scripts/loadtest-journeys.mjs --site http://localhost:8787 --images webp` — staged 50→1,000 virtual visitors (pages, assets, images, API, 5% form submissions).
  - `npm --prefix server run loadtest` — raw endpoint throughput.
- AI capacity is limited by the Groq plan's tokens-per-minute (≈1,900 tokens per chat reply), not by this server. Never load-test the real AI provider.
