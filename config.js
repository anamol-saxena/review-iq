// ============================================================
// Universal Review Analyzer — Configuration
// ============================================================
// Set your Gemini API key below before running the app.
// Get your key at: https://aistudio.google.com/apikey
// ============================================================

const CONFIG = {
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY_HERE",
  GEMINI_MODEL: "gemini-3.1-flash-lite",
  GEMINI_API_BASE: "https://generativelanguage.googleapis.com/v1beta/models",

  // Local backend that does real review fetching (headless-browser
  // scraping + optional Yelp API). Start it from the server/ folder:
  //   cd server && npm install && npm start
  BACKEND_URL: "http://localhost:8787",

  // Confidence thresholds
  CONFIDENCE: {
    HIGH_MIN_REVIEWS: 100,
    HIGH_MIN_RECENT_RATIO: 0.5,
    MEDIUM_MIN_REVIEWS: 30,
    MEDIUM_MIN_RECENT_RATIO: 0.3,
    RECENT_YEAR_THRESHOLD: 2023,
  },

  // Recency weights by year delta
  RECENCY_WEIGHTS: {
    0: 1.0,   // current year
    1: 0.9,   // 1 year ago
    2: 0.75,  // 2 years ago
    3: 0.6,   // 3 years ago
    4: 0.45,  // 4 years ago
    5: 0.3,   // 5+ years ago
  },
};
