# ReviewIQ — Universal Review Intelligence Copilot

A single-page AI copilot that synthesizes customer reviews into honest, actionable intelligence using Google Gemini. Reviews can come from pasted text, uploaded CSV/JSON files, built-in demo datasets, product/place URLs (Amazon, Flipkart, TripAdvisor, Yelp), or Google Maps via SaarMind (Apify).

The app has two parts:
- **Frontend** (Vanilla JS, served as static assets): `index.html`, `app.js`, `styles.css`
- **Backend** (Node.js + Express, port 8787): `server/` with Playwright headless scraper & secure Gemini proxy

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
├── Dockerfile            # Container definition for Google Cloud Run (Playwright base)
├── .dockerignore         # Docker build exclusions
├── .gitignore            # Git exclusions (protects .env and secrets)
└── server/
    ├── server.js         # Express API: /api/analyze, /api/fetch-reviews, /api/saarming
    ├── scrapers.js       # DOM, JSON-LD, Playwright, and Cheerio review extraction helpers
    ├── package.json      # Backend dependencies and scripts
    └── .env.example      # Environment variable template
```

---

## Prerequisites

- **Node.js**: v18 or newer (v20+ recommended)
- **Google Gemini API Key**: [Get a free API key at Google AI Studio](https://aistudio.google.com/apikey)
- **Optional**: [Apify API token](https://console.apify.com/) (required only for SaarMind Google Maps reviews)
- **Optional**: Yelp Fusion API key (for restaurant data without scraping)

---

## Local Setup

### 1. Install Dependencies

```bash
cd server
npm install        # also downloads Playwright's Chromium browser
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
| `APIFY_TOKEN` | For SaarMind | Apify token for Google Maps review extraction |
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
   - **Paste**: Paste raw review text directly (one per line or bulk).
   - **From URL**:
     - *E-commerce*: Paste an Amazon, Flipkart, or e-commerce product URL.
     - *Place / Restaurant*: Search by name or URL (single or side-by-side comparison).
   - **File**: Upload CSV or JSON files.
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
| `POST` | `/api/fetch-reviews` | `{ "input": "...", "domain": "auto" }` | Headless Playwright scraper for e-commerce and travel sites |
| `POST` | `/api/saarming` | `{ "placeName": "..." }` | Fetches Google Maps reviews for a place via Apify |
| `POST` | `/api/saarming/compare` | `{ "placeNames": ["...", "..."] }` | Compares 2–3 places and determines a winner card |
| `GET` | `/api/health` | None | Health check endpoint returning `{ "ok": true }` |

---

## Deploy to Google Cloud (Cloud Run)

The repository includes a production-ready `Dockerfile` based on Microsoft's official Playwright container (Ubuntu Noble + pre-installed Chromium and rendering libraries).

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
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars GEMINI_API_KEY="your_gemini_key",APIFY_TOKEN="your_apify_token"
```

Cloud Run will build the container in Google Cloud Build, allocate 2 vCPUs and 2 GiB RAM, and output your live HTTPS URL.

---

## Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `Can't reach the backend` | Server is not running | Run `npm start` in `server/` |
| `Gemini API key is not configured` | Missing `GEMINI_API_KEY` | Add your key to `.env` and restart the server |
| `Chromium executable doesn't exist` | Playwright browser not installed | Run `npx playwright install chromium` in `server/` |
| `SaarMind returns 503` | Missing `APIFY_TOKEN` | Add your Apify token to `.env` |
| `Port already in use` | Another process holds port 8787 | Run `lsof -nP -iTCP:8787 -sTCP:LISTEN` and kill the PID |
