# ReviewIQ — Universal Review Intelligence Copilot

A single-page AI copilot that synthesizes customer reviews into honest, actionable intelligence using Google Gemini. Reviews can come from pasted text, uploaded CSV/JSON files, built-in demo datasets, Amazon product URLs (via Apify with rotating residential proxies), Yelp, or Google Maps via SaarMind (Apify).

The app has two parts:
- **Frontend** (Vanilla JS, served as static assets): `index.html`, `app.js`, `styles.css`
- **Backend** (Node.js + Express, port 8787): `server/` with API-driven review ingestion & secure Gemini proxy

---

## Project Structure

```
review-iq/
├── index.html            # Single-page UI (input tabs, domain options, verdict cards)
├── styles.css            # Dark aesthetic styling, animations, and typography
├── config.js             # Client configuration (Gemini model, dynamic backend URL, confidence)
├── app.js                # UI controller: state, tabs, fetching, analysis, rendering
├── geminiClient.js       # Client client that routes reasoning chains through backend proxy
├── domainRouter.js       # Auto-detects domain and selects category schema
├── confidenceEngine.js   # Scores review credibility from volume and recency
├── preprocessor.js       # Parses pasted text, CSV, and JSON into structured review objects
├── saarmingClient.js     # Client for Google Maps reviews endpoints
├── demoData.js           # Built-in demo review scenarios
├── Dockerfile            # Lightweight container definition (Node 20 Alpine)
├── .dockerignore         # Docker build exclusions
├── .gitignore            # Git exclusions (protects .env and secrets)
└── server/
    ├── server.js         # Express API: /api/analyze, /api/fetch-reviews, /api/saarming
    ├── scrapers.js       # Data normalization helpers (toUnified)
    ├── package.json      # Backend dependencies and scripts
    └── .env.example      # Environment variable template
```

---

## Prerequisites

- **Node.js**: v18 or newer (v20+ recommended)
- **Google Gemini API Key**: [Get a free API key at Google AI Studio](https://aistudio.google.com/apikey)
- **Apify API Token**: [Get an Apify token](https://console.apify.com/) (powers Amazon reviews and Google Maps SaarMind)
- **Optional**: Yelp Fusion API key (for Yelp restaurant lookups)

---

## Local Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment (`.env`)

Create a `.env` file in the project root (or inside `server/.env`) by copying the template:

```bash
cp server/.env.example .env
```

Fill in your configuration:

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Yes** | Google Gemini API key used for 5-step reasoning analysis |
| `GEMINI_MODEL` | No | Model name (default: `gemini-3.1-flash-lite`) |
| `APIFY_TOKEN` | **Yes** | Apify token for Amazon reviews (20 reviews) and Google Maps SaarMind |
| `YELP_API_KEY` | No | Yelp Fusion API key for restaurant lookups |
| `PORT` | No | Server port (default: `8787`) |

> [!IMPORTANT]
> All API keys remain strictly on the backend. The frontend never receives or exposes your keys.

### 3. Start the Server

```bash
cd server
npm start
```

Visit **[http://localhost:8787](http://localhost:8787)** in your browser. The backend automatically serves the frontend interface.

---

## Usage

1. **Select an Input Tab**:
   - **From URL**:
     - *Amazon*: Paste any Amazon product link (`amazon.com`, `amazon.in`, etc.). Fetches up to 20 balanced reviews directly via Apify.
     - *Yelp / Restaurants*: Search by Yelp URL or business name.
   - **Search Place (SaarMind)**:
     - Search any restaurant or hotel name for Google Maps reviews, recency weighting, and trend analysis.
     - Supports 2–3 place comparison with automated winner detection.
   - **Paste**: Paste raw review text directly (one per line or bulk).
   - **File**: Upload CSV or JSON review files.
   - **Demo**: Pick one of the built-in scenarios.
2. **Options**: Select a domain (*Auto-Detect*, *E-Commerce*, *Electronics*, *Travel/Hotels*, or *Restaurants*) and an optional product name.
3. **Analyze**: ReviewIQ executes the 5-step reasoning chain:
   - **Step 1**: Atomic claim extraction
   - **Step 2**: Theme clustering
   - **Step 3**: Contradiction resolution
   - **Step 4**: Recency & volume weighting
   - **Step 5**: Honest verdict synthesis ("Choose this if... / Skip if...")

---

## API Endpoints (Backend)

| Method | Path | Body | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/analyze` | `{ "prompt": "..." }` | Proxies analysis to Gemini server-side with your `GEMINI_API_KEY` |
| `POST` | `/api/fetch-reviews` | `{ "input": "...", "domain": "auto" }` | Direct Amazon review extraction (via Apify) and Yelp API |
| `POST` | `/api/saarming` | `{ "placeName": "..." }` | Fetches Google Maps reviews for a place via Apify |
| `POST` | `/api/saarming/compare` | `{ "placeNames": ["...", "..."] }` | Compares 2–3 places and determines a winner card |
| `GET` | `/api/health` | None | Health check endpoint returning `{ "ok": true }` |

---

## Deploy to Google Cloud (Cloud Run)

The application includes a lightweight `Dockerfile` (`node:20-alpine`) requiring minimal resources.

### 1. Authenticate with Google Cloud

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
```

### 2. Deploy from Source

```bash
gcloud run deploy review-analyzer \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars GEMINI_API_KEY="your_gemini_key",APIFY_TOKEN="your_apify_token"
```

---

## Security Highlights

- **Server-Side API Proxy**: The Gemini API key and Apify token are never exposed to the client or stored in `localStorage`.
- **Zero Scraping Bot-Blocks**: Uses Apify's rotating residential proxy network to bypass cloud datacenter WAF restrictions.
- **Git Safeguards**: `.gitignore` strictly protects `.env`, keys, logs, and caches.
