# Review Analyzer

A local, single-page app that collects customer reviews and analyzes them with Google Gemini. Reviews can come from pasted text, an uploaded file, a demo dataset, a product or place URL, or SaarMind (Google Maps reviews via Apify).

The app has two parts:

- **Frontend** (vanilla JS, served as static files): `index.html`, `app.js`, `styles.css`
- **Backend** (Node.js + Express, port 8787): `server/`

## Project structure

```
reviewAnalyzer/
├── index.html            Single-page UI (input tabs, options, results)
├── styles.css            Styling
├── config.js             Frontend config (Gemini model, backend URL, confidence thresholds)
├── app.js                UI controller: state, tabs, fetching, analysis, rendering
├── preprocessor.js       Parses pasted text, CSV, and JSON into review objects
├── domainRouter.js       Chooses the analysis profile for the detected domain
├── geminiClient.js       Sends reviews to Gemini and parses the analysis
├── confidenceEngine.js   Scores confidence from review count and recency
├── saarmingClient.js     Frontend client for the SaarMind endpoints
├── demoData.js           Built-in demo review scenarios
└── server/
    ├── server.js         Express API: fetch-reviews, saarming, health
    ├── scrapers.js       DOM, JSON-LD, and generic review extraction helpers
    ├── package.json      Backend dependencies and scripts
    └── .env              Secrets and port (not committed)
```

## Prerequisites

- Node.js 18 or newer
- A Google Gemini API key ([get one here](https://aistudio.google.com/apikey))
- Optional: an Apify API token (for SaarMind)
- Optional: a Yelp Fusion API key (for restaurant lookups)

## Setup

### 1. Install and start the backend

```bash
cd server
npm install        # also downloads Playwright's Chromium (postinstall)
npm start          # runs on http://localhost:8787
```

### 2. Configure the backend (`server/.env`)

| Variable        | Required | Purpose                                                  |
| --------------- | -------- | -------------------------------------------------------- |
| `APIFY_TOKEN`   | For SaarMind | Apify token used to call the Google Maps reviews actor |
| `YELP_API_KEY`  | No       | Yelp Fusion API. Without it, restaurant URLs are scraped |
| `PORT`          | No       | Backend port. Defaults to `8787`                         |

### 3. Open the frontend

Open `index.html` in a browser. Click the settings control and enter your Gemini API key. The key is saved in `localStorage`. You can also set `GEMINI_API_KEY` in `config.js`, but do not commit it.

## Usage

The input tabs in `index.html` are:

- **Paste**: paste reviews, one per line or as a text block.
- **From URL**
  - *E-commerce*: paste a product page URL (Amazon, Flipkart, and similar sites). The backend launches a headless browser and extracts reviews.
  - *Place / Restaurant*: search by name. Single mode analyzes one place. Compare mode compares 2 or 3 places and shows a winner card.
- **File**: upload CSV or JSON.
- **Demo**: pick a built-in scenario.

Choose a domain and an optional product name in the shared options row, then click **Analyze**. The pipeline runs in this order: fetch or parse reviews, preprocess, route by domain, analyze with Gemini, score confidence, and render results.

## API (backend)

| Method | Path                     | Body                                | Notes                                             |
| ------ | ------------------------ | ----------------------------------- | ------------------------------------------------- |
| POST   | `/api/fetch-reviews`     | `{ "input": "...", "domain": "auto" }` | Non-URL input is accepted only for `restaurant` |
| POST   | `/api/saarming`          | `{ "placeName": "..." }`            | Single place via Apify                            |
| POST   | `/api/saarming/compare`  | `{ "placeNames": ["...", "..."] }`  | 2 to 3 places                                     |
| GET    | `/api/health`            | none                                | Returns `{ "ok": true }`                          |

Errors return a JSON body with an `error` field. Status codes include 400 (bad input), 429 (compute limit), 503 (missing `APIFY_TOKEN`), and 500 (other failures).

## Deploy to Google Cloud (Cloud Run)

The application includes a `Dockerfile` using the official Playwright base image (pre-configured with Chromium and Linux system libraries) and is ready for Google Cloud Run:

1. **Install Google Cloud SDK** (if not already installed):
   ```bash
   brew install --cask google-cloud-sdk
   ```

2. **Authenticate and set your GCP Project**:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_GCP_PROJECT_ID
   ```

3. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy review-analyzer \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --memory 2Gi \
     --cpu 2 \
     --set-env-vars GEMINI_API_KEY="your_gemini_key",APIFY_TOKEN="your_apify_token"
   ```


## Notes

- The backend never fabricates reviews. If nothing can be extracted, it returns an error.
- SaarMind requests use one Apify run per place. Each run returns up to 40 reviews, and the backend keeps the first 20 that have non-empty text.
- Confidence levels depend on review count and the share of recent reviews. Thresholds are in `config.js`.
- The backend has no hot reload. Restart `npm start` after editing `server/` files.
- If the backend port is already in use, stop the old process first (`lsof -nP -iTCP:8787 -sTCP:LISTEN`). A stale process can mask startup errors.

## Troubleshooting

| Symptom                                   | Likely cause                                                  |
| ----------------------------------------- | ------------------------------------------------------------- |
| "Can't reach the backend"                 | Backend not running. Run `npm start` in `server/`.            |
| "Backend returned 404"                    | Another process holds port 8787. Stop it and restart.         |
| "is not a URL"                            | Non-URL input on a non-restaurant domain. Paste the full link. |
| SaarMind returns 503                      | `APIFY_TOKEN` missing from `server/.env`.                     |
| SaarMind "No reviews found"               | Try a more specific name with the city.                       |
