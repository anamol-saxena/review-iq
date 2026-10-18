// ============================================================
// Review Analyzer Backend
// Fetches REAL reviews via a headless browser (Playwright) — this
// runs server-side so it isn't subject to browser CORS restrictions
// and renders JS like a real visitor, which is why it succeeds where
// client-side fetch()/CORS-proxy scraping gets blocked.
//
// Never fabricates data: if nothing can be extracted, it returns a
// clear error instead of placeholder reviews.
// ============================================================

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { chromium } = require("playwright");
const { extractJsonLd, extractAmazon, extractFlipkart, extractTripAdvisor, extractGeneric, toUnified } = require("./scrapers");

const app = express();
app.use(cors());
app.use(express.json());
// Serve frontend static files
app.use(express.static(path.join(__dirname, "..")));

// ── Gemini Analysis Endpoint ──────────────────────────────────
// Keeps GEMINI_API_KEY secure on the server; never exposed to browser
app.post("/api/analyze", async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: 'Missing "prompt" in request body.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY" || apiKey.trim() === "") {
    return res.status(503).json({
      error: "Gemini API key is not configured on the server. Please set GEMINI_API_KEY in your deployment environment.",
    });
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  };

  try {
    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/json" },
      timeout: 60000,
    });

    const data = response.data;
    if (data.promptFeedback?.blockReason) {
      return res.status(400).json({ error: `Content blocked: ${data.promptFeedback.blockReason}` });
    }

    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      return res.status(502).json({ error: "No content returned from Gemini model." });
    }

    res.json({ content });
  } catch (err) {
    console.error("Gemini proxy error:", err.response?.data || err.message);
    const msg = err.response?.data?.error?.message || err.message;
    if (err.response?.status === 400 && msg.includes("API_KEY")) {
      return res.status(401).json({ error: "Invalid Gemini API key configured on server." });
    }
    res.status(err.response?.status || 500).json({ error: `Gemini API error: ${msg}` });
  }
});


const PORT = process.env.PORT || 8787;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// ── Domain detection (mirrors the frontend's logic) ────────────
function detectDomain(input, manual) {
  if (manual && manual !== "auto") return manual;
  const s = input.toLowerCase();
  if (/amazon\.|flipkart\.com|ebay\.|walmart\.|myntra\.com|ajio\.com/.test(s)) return "ecommerce";
  if (/tripadvisor\.|booking\.com|expedia\.|airbnb\.|agoda\.|hotels\.com/.test(s)) return "travel";
  if (/yelp\.|zomato\.com|ubereats\.|doordash\.|swiggy\.com/.test(s)) return "restaurant";
  return "ecommerce";
}

function yelpAuthHeader(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}

function extractYelpAlias(url) {
  const m = url.match(/yelp\.[a-z.]+\/biz\/([^/?#]+)/i);
  return m ? m[1] : null;
}

// ── Core: launch a real browser, navigate, extract reviews ─────
async function scrapeWithExtractor(url, extractorFn, sourceLabel, waitTime = 1500) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: UA, viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    // Give lazy-loaded review widgets a moment to render
    await page.waitForTimeout(waitTime);

    let reviews = extractorFn ? await extractorFn(page) : [];

    if (!reviews.length) {
      const html = await page.content();
      reviews = extractJsonLd(html);
    }

    if (!reviews.length) {
      reviews = await extractGeneric(page);
    }

    return { meta: { url, source: sourceLabel }, reviews };
  } finally {
    await browser.close();
  }
}

function scrapeGeneric(url, sourceLabel) {
  return scrapeWithExtractor(url, null, sourceLabel);
}

// ── Restaurant domain: Yelp Fusion API (if configured) + browser fallback ─
async function fetchYelp(input) {
  const apiKey = process.env.YELP_API_KEY;
  const alias = extractYelpAlias(input);

  if (apiKey) {
    try {
      let business;
      if (alias) {
        const { data } = await axios.get(`https://api.yelp.com/v3/businesses/${alias}`, { headers: yelpAuthHeader(apiKey) });
        business = data;
      } else {
        const { data } = await axios.get("https://api.yelp.com/v3/businesses/search", {
          headers: yelpAuthHeader(apiKey),
          params: { term: input, location: "United States", limit: 1 },
        });
        business = data.businesses?.[0];
      }

      if (business) {
        const { data: reviewData } = await axios.get(
          `https://api.yelp.com/v3/businesses/${business.id}/reviews`,
          { headers: yelpAuthHeader(apiKey) }
        );

        const reviews = (reviewData.reviews || []).map((r) =>
          toUnified("yelp", { rating: r.rating, text: r.text, date: r.time_created, author: r.user?.name, verified: true })
        );

        return {
          meta: { name: business.name, rating: business.rating, reviewCount: business.review_count },
          reviews,
          note: "Yelp's official API returns a max of 3 review excerpts per business (Yelp API policy limit).",
        };
      }
    } catch (err) {
      console.warn("Yelp API lookup failed, falling back to browser scrape:", err.message);
    }
  }

  // No API key, or API lookup failed/found nothing — scrape the real page
  const targetUrl = /^https?:\/\//i.test(input) ? input : `https://www.yelp.com/search?find_desc=${encodeURIComponent(input)}`;
  return scrapeGeneric(targetUrl, "yelp");
}

// ── Route ────────────────────────────────────────────────────
app.post("/api/fetch-reviews", async (req, res) => {
  const { input, domain: domainOverride } = req.body || {};
  if (!input || typeof input !== "string") {
    return res.status(400).json({ error: 'Missing "input" (a URL or business name).' });
  }

  const domain = detectDomain(input, domainOverride);

  // Only restaurant lookups accept business names (Yelp search); other domains need a page URL.
  const isUrl = /^https?:\/\//i.test(input.trim());
  if (!isUrl && domain !== "restaurant") {
    return res.status(400).json({
      domain,
      error: `"${input}" is not a URL. Paste the full page link (https://...), or choose the Restaurant domain to search by name.`,
    });
  }

  try {
    let result;

    if (domain === "restaurant") {
      result = await fetchYelp(input);
    } else if (domain === "travel") {
      if (/tripadvisor\./i.test(input)) {
        // TripAdvisor needs longer wait time and specific extractor
        result = await scrapeWithExtractor(input, extractTripAdvisor, "tripadvisor", 3000);
      } else {
        // Other travel sites (Booking, Expedia, etc.) — longer wait for lazy-loading
        result = await scrapeWithExtractor(input, null, "travel", 2000);
      }
    } else if (/amazon\./i.test(input)) {
      result = await scrapeWithExtractor(input, extractAmazon, "amazon");
    } else if (/flipkart\.com/i.test(input)) {
      result = await scrapeWithExtractor(input, extractFlipkart, "flipkart");
    } else {
      result = await scrapeGeneric(input, "ecommerce");
    }

    if (!result.reviews || result.reviews.length === 0) {
      return res.status(404).json({
        domain,
        error:
          "No reviews could be extracted from this page. The site may require login, use heavy anti-bot protection, or load reviews in a way this scraper can't reach.",
        suggestion: 'Try pasting the reviews directly in the "Paste Reviews" tab instead.',
      });
    }

    res.json({
      domain,
      count: result.reviews.length,
      meta: result.meta,
      note: result.note || null,
      reviews: result.reviews,
    });
  } catch (err) {
    console.error("fetch-reviews error:", err);
    const hint = /executable doesn't exist|playwright install/i.test(err.message)
      ? ' Run "npx playwright install chromium" inside the server/ folder, then restart the server.'
      : "";
    res.status(500).json({ domain, error: `${err.message}${hint}` });
  }
});

// ════════════════════════════════════════════════════════════
// SaarMind — Google Maps Reviews via Apify
// Handles TRAVEL and RESTAURANT domains only.
// E-commerce / Amazon pipeline above is completely untouched.
// ════════════════════════════════════════════════════════════

/** Keyword sets used to classify a place name into a domain */
const SAARMING_RESTAURANT_KW = [
  "cafe", "café", "bar", "dhaba", "bistro", "food", "dining", "eatery",
  "bakery", "pizzeria", "brewery", "kitchen", "restaurant", "grill",
  "diner", "pub", "lounge", "taproom", "canteen", "mess", "tiffin",
  "barbeque", "bbq", "steakhouse", "seafood", "sushi", "pizza", "burger",
];

const SAARMING_TRAVEL_KW = [
  "hotel", "resort", "hostel", "inn", "palace", "lodge", "homestay",
  "spa", "museum", "monument", "park", "beach", "airport", "destination",
  "villa", "retreat", "sanctuary", "heritage", "fort", "temple", "lake",
  "waterfall", "valley", "island", "resort", "campsite", "glamping",
];

/**
 * Detect SaarMind domain from the place name string.
 * Returns "restaurant" | "hotel" (maps to travel schema).
 */
function saarmingDetectDomain(placeName, apifyCategory) {
  const lower = (placeName + " " + (apifyCategory || "")).toLowerCase();

  const restScore = SAARMING_RESTAURANT_KW.filter((kw) => lower.includes(kw)).length;
  const travScore = SAARMING_TRAVEL_KW.filter((kw) => lower.includes(kw)).length;

  if (restScore === 0 && travScore === 0) return "restaurant"; // default guess
  return restScore >= travScore ? "restaurant" : "hotel";
}

/**
 * Build a Google Maps search URL from a free-text place name.
 * "Truffles Koramangala Bangalore" → https://www.google.com/maps/search/Truffles+Koramangala+Bangalore
 */
function buildGoogleMapsUrl(placeName) {
  const encoded = placeName.trim().replace(/\s+/g, "+");
  return `https://www.google.com/maps/search/${encoded}`;
}

/**
 * Normalize a single Apify review item into the SaarMind unified schema.
 * Filters out reviews with no text.
 */
function normalizeSaarmingReview(r) {
  const text = (r.text || "").trim();
  if (!text) return null;

  const date = r.publishedAtDate || null;
  const now = new Date();
  const reviewDate = date ? new Date(date) : null;
  const ageMs = reviewDate ? now - reviewDate : Infinity;
  const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30);

  // Recency weight: last 3 months = 3x, last 6 months = 2x, older = 1x
  let recencyWeight = 1.0;
  if (ageMonths <= 3) recencyWeight = 3.0;
  else if (ageMonths <= 6) recencyWeight = 2.0;

  // Credibility: reviewer has >10 reviews = experienced
  const credibility = (r.reviewerNumberOfReviews || 0) > 10 ? "experienced" : "new";

  return {
    source: "google_maps",
    rating: r.stars || null,
    text,
    date,
    credibility,
    helpfulness: r.likesCount || 0,
    recencyWeight,
    ageMonths,
    // Fields needed by the existing Gemini pipeline
    verified: credibility === "experienced",
    author: null,
    year: reviewDate ? reviewDate.getFullYear() : null,
    lang: "en",
  };
}

/**
 * Compute the SaarMind sentiment trend by comparing
 * average rating of reviews ≤3 months old vs older ones.
 */
function computeSaarmingTrend(reviews) {
  const recent = reviews.filter((r) => r.ageMonths <= 3 && r.rating);
  const older  = reviews.filter((r) => r.ageMonths > 3  && r.rating);

  if (recent.length === 0) return { trend: "stable", label: "➡️ Stable", reason: "Insufficient recent data to detect a trend." };

  const avgRecent = recent.reduce((s, r) => s + r.rating, 0) / recent.length;

  if (older.length === 0) return { trend: "stable", label: "➡️ Stable", reason: "Only recent reviews available — no baseline to compare against." };

  const avgOlder  = older.reduce((s, r) => s + r.rating, 0) / older.length;
  const delta     = avgRecent - avgOlder;

  if (delta >= 0.4)  return { trend: "improving", label: "📈 Improving", reason: `Average rating rose from ${avgOlder.toFixed(1)} → ${avgRecent.toFixed(1)} in the last 3 months.` };
  if (delta <= -0.4) return { trend: "declining", label: "📉 Declining", reason: `Average rating dropped from ${avgOlder.toFixed(1)} → ${avgRecent.toFixed(1)} in the last 3 months.` };
  return { trend: "stable", label: "➡️ Stable", reason: `Rating consistent at ~${avgRecent.toFixed(1)} — no significant shift detected.` };
}

/**
 * Compute SaarMind confidence tier.
 * High  = 15+ reviews, majority recent
 * Medium = 8–14 reviews or mixed recency
 * Low   = <8 reviews or mostly old data
 */
function computeSaarmingConfidence(reviews) {
  const n = reviews.length;
  const recentCount = reviews.filter((r) => r.ageMonths <= 6).length;
  const recentRatio = n > 0 ? recentCount / n : 0;

  if (n >= 15 && recentRatio >= 0.4) return "High";
  if (n >= 8)                         return "Medium";
  return "Low";
}

/**
 * Call Apify run-sync-get-dataset-items for a single place.
 * Retries once on timeout.
 */
async function callApify(googleMapsUrl, apifyToken) {
  const endpoint = `https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/run-sync-get-dataset-items?token=${apifyToken}`;
  const body = {
    startUrls:    [{ url: googleMapsUrl }],
    maxReviews:   40, // buffer so 20 non-empty reviews remain after filtering
    reviewsSort:  "newest",
    language:     "en",
    personalData: false,
  };

  const tryOnce = () =>
    axios.post(endpoint, body, { timeout: 120_000 });

  let response;
  try {
    response = await tryOnce();
  } catch (err) {
    if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
      // Retry once
      try {
        response = await tryOnce();
      } catch (retryErr) {
        throw new Error("Apify request timed out after two attempts. Please try again.");
      }
    } else {
      throw err;
    }
  }

  const items = response.data;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No results returned from Apify. Try a more specific place name or add the city.");
  }

  return items;
}

/**
 * Core SaarMind fetch for a single place name.
 */
async function fetchSaarming(placeName) {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    throw new Error("APIFY_TOKEN is not set in server/.env. Add your Apify API token to enable SaarMind.");
  }

  const googleMapsUrl = buildGoogleMapsUrl(placeName);
  const items = await callApify(googleMapsUrl, apifyToken);

  // Each Apify item is one Google Maps place (may have multiple reviews)
  // Actor returns one item per review, with place fields repeated on each
  const firstItem  = items[0] || {};
  const allReviews = items.flatMap((item) => (Array.isArray(item.reviews) ? item.reviews : [item]));

  // Detect domain
  const domain = saarmingDetectDomain(placeName, firstItem.categoryName || "");

  // Keep only reviews with non-empty text, then take the first 20
  const validReviews = allReviews
    .filter((r) => typeof r.text === "string" && r.text.trim() !== "")
    .slice(0, 20);

  // Normalize
  const normalized = validReviews
    .map(normalizeSaarmingReview)
    .filter(Boolean);

  if (normalized.length === 0) {
    throw new Error("No reviews found. Try a more specific place name or add the city name.");
  }

  const trend      = computeSaarmingTrend(normalized);
  const confidence = computeSaarmingConfidence(normalized);

  return {
    domain,
    count: normalized.length,
    totalReviewsOnGoogle: firstItem.reviewsCount || null,
    meta: {
      source: "google_maps_apify",
      placeName: firstItem.title || placeName,
      city: firstItem.city || "",
      overallRating: firstItem.totalScore || null,
      googleMapsUrl,
    },
    saarming: {
      trend,
      confidence,
      lowSample: normalized.length < 5,
    },
    reviews: normalized,
  };
}

// ── SaarMind: single place ─────────────────────────────────────
app.post("/api/saarming", async (req, res) => {
  const { placeName } = req.body || {};
  if (!placeName || typeof placeName !== "string" || !placeName.trim()) {
    return res.status(400).json({ error: 'Missing "placeName". Provide a restaurant or hotel name.' });
  }

  try {
    const result = await fetchSaarming(placeName.trim());
    res.json(result);
  } catch (err) {
    console.error("saarming error:", err);

    if (err.message.includes("APIFY_TOKEN")) {
      return res.status(503).json({ error: err.message });
    }
    if (err.message.includes("429") || err.message.toLowerCase().includes("rate limit")) {
      return res.status(429).json({ error: "Free tier compute limit reached for this session." });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── SaarMind: multi-place comparison (up to 3) ─────────────────
app.post("/api/saarming/compare", async (req, res) => {
  const { placeNames } = req.body || {};
  if (!Array.isArray(placeNames) || placeNames.length < 2 || placeNames.length > 3) {
    return res.status(400).json({ error: '"placeNames" must be an array of 2–3 place names.' });
  }

  const results = [];
  for (const name of placeNames) {
    try {
      const r = await fetchSaarming(name.trim());
      results.push({ placeName: name.trim(), ...r });
    } catch (err) {
      results.push({ placeName: name.trim(), error: err.message });
    }
  }

  // Build winner card from successful results
  const valid = results.filter((r) => !r.error && r.meta);
  let winnerCard = null;
  if (valid.length >= 2) {
    const byScore   = [...valid].sort((a, b) => (b.meta.overallRating || 0) - (a.meta.overallRating || 0));
    const byReviews = [...valid].sort((a, b) => (b.count || 0) - (a.count || 0));

    winnerCard = {
      bestOverall:   byScore[0]?.meta?.placeName || byScore[0]?.placeName,
      bestScore:     byScore[0]?.meta?.overallRating,
      mostReviewed:  byReviews[0]?.meta?.placeName || byReviews[0]?.placeName,
    };
  }

  res.json({ results, winnerCard });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Review Analyzer backend running at http://localhost:${PORT}`);
});
