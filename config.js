// Universal Review Analyzer — Frontend Configuration
// ============================================================
// Note: Secrets (Gemini API key, Apify token, etc.) are kept
// strictly on the backend and configured via server environment variables.
// ============================================================

const CONFIG = {
  GEMINI_MODEL: "gemini-3.1-flash-lite",


  // Backend that provides review fetching and Gemini AI analysis:
  BACKEND_URL:
    typeof window !== "undefined" && window.location.origin && window.location.origin.startsWith("http")
      ? window.location.origin
      : "http://localhost:8787",


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
