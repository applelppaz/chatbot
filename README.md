# Vocab — Multilingual Vocabulary Trainer

A mobile-first web app for building a personal vocabulary bank in **English, Chinese, Spanish, or French**. Add words by typing them, or by photographing text and letting **Google Gemini** extract them. The app auto-generates a Japanese translation, an example sentence with translation, and Pinyin (for Chinese). Words are pronounced in the browser via the Web Speech API and reviewed with **SM-2 spaced repetition**. UI is in English. Designed to feel native when added to the iPhone home screen.

The app is a static SPA (Vite + React + TypeScript + Tailwind) with serverless functions that proxy Gemini so the API key never reaches the browser. It can be deployed to **either Netlify or Vercel** — the same handler logic lives in `netlify/functions/` and is re-exported from `api/` for Vercel's file-based routing.

---

## 1. Run locally

```bash
npm install
npm run dev          # plain Vite at http://localhost:5173 (no Gemini calls)
```

To exercise the Netlify Functions locally, install the Netlify CLI and run:

```bash
npm install -g netlify-cli
echo "VOCAB_GEMINI_KEY=your_key_here" > .env
netlify dev          # serves the SPA + functions at http://localhost:8888
```

`.env` is gitignored. Get a Gemini API key from <https://aistudio.google.com/app/apikey>.

## 2. Deploy to Netlify

1. Push this branch to GitHub.
2. In Netlify, **Add new site → Import from Git** and pick this repo / branch.
3. Build settings are read from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. **Site settings → Environment variables → Add a variable**:
   - Key: `VOCAB_GEMINI_KEY`
   - Value: *your Gemini key*

   > **Note:** the env var is named `VOCAB_GEMINI_KEY`, not `GEMINI_API_KEY`. Netlify reserves `GEMINI_API_KEY` for its built-in AI Gateway and silently overrides any user value with a JWT, which Google rejects.
5. Trigger a deploy. The site URL Netlify gives you (e.g. `https://your-site.netlify.app`) is the URL you open on your iPhone.

For a friendlier URL, **Domain management → Options → Edit site name** lets you change the subdomain.

## 2b. Deploy to Vercel

1. Push this branch to GitHub.
2. In Vercel, **Add New… → Project** and import this repo.
3. Vercel auto-detects the Vite framework. The remaining config is read from `vercel.json`:
   - Build command: `npm run build`
   - Output directory: `dist`
   - SPA fallback: every non-`/api/*` path serves `index.html`
   - Functions: each file under `api/` is deployed as a Vercel Function and reuses the handler in `netlify/functions/`.
4. **Project settings → Environment variables → Add new**, for each Gemini key slot you want to use:
   - Name: `VOCAB_GEMINI_KEY` (slot 1), `VOCAB_GEMINI_KEY_2` (slot 2), `VOCAB_GEMINI_KEY_3` (slot 3)
   - Value: *your Gemini key* — get one from <https://aistudio.google.com/app/apikey>
   - Environment: Production (and Preview if you want preview deploys to work)

   > **Common cause of `API Key not found. Please pass a valid API key.`**: the env var contains a non-Gemini key (e.g. a generic Google Cloud key, a Vertex AI key, or extra whitespace). The active slot is chosen from the Settings page in-app (Key 1/2/3).
5. Trigger a deploy. The site URL Vercel gives you (e.g. `https://your-project.vercel.app`) is the URL you open on your iPhone.

After changing an environment variable, **redeploy** — Vercel only reads env vars at build time for serverless functions.

### Add to iPhone home screen

In Safari, tap **Share → Add to Home Screen**. The PWA manifest gives it a standalone-app appearance.

## 3. How it works

```
┌─────────────┐         ┌────────────────────┐      ┌──────────────┐
│ React SPA   │ POST →  │ Netlify Function   │ →    │ Gemini API   │
│ (your phone)│ ←  JSON │ /api/generate-     │ ←    │ 2.5-flash    │
│             │         │   metadata         │      │              │
│             │         │ /api/extract-words │      │              │
└─────────────┘         └────────────────────┘      └──────────────┘
        │
        ▼ IndexedDB (local-only word bank)
```

- **Manual add**: typed term → `/api/generate-metadata` → preview card → save.
- **Image add**: camera/photo → resized to ≤1280px → `/api/extract-words` → checklist → for each ticked word, `/api/generate-metadata` runs in parallel (4 concurrent).
- **Review**: cards with `nextReviewAt <= now` enter the queue; the SM-2 scheduler updates EF/interval/repetitions on each grade.
- **Pronunciation**: `SpeechSynthesisUtterance` with the word's BCP-47 locale (`en-US`, `zh-CN`, `es-ES`, `fr-FR`).

Source layout:

```
src/
├── App.tsx
├── main.tsx
├── api.ts              # client → Netlify Functions
├── db.ts               # idb wrapper
├── srs.ts              # SM-2 algorithm
├── speech.ts           # Web Speech API wrapper
├── languages.ts        # locale + UI metadata per language
├── types.ts
├── components/         # Layout, BottomNav, LanguagePicker, PlayButton, …
└── pages/              # WordsPage, AddManualPage, AddImagePage,
                        # WordDetailPage, ReviewHomePage,
                        # ReviewSessionPage, SettingsPage
netlify/functions/      # Netlify Functions (canonical handler source)
├── _gemini.ts          # shared HTTP + error helpers
├── generate-metadata.ts
├── extract-words.ts
├── lookup-forms.ts
└── key-status.ts
api/                    # Vercel Functions — thin wrappers around the above
├── generate-metadata.ts
├── extract-words.ts
├── lookup-forms.ts
└── key-status.ts
```

## 4. Privacy

- Your word bank lives **only in your browser** (IndexedDB). Clearing site data deletes it.
- Images and terms are sent to your serverless function (Netlify or Vercel), which forwards them to Google's Gemini API. They are not stored server-side.
- The API key never leaves the hosting platform's servers.
