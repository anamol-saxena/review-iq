// ============================================================
// Review Analyzer Backend
// API-driven architecture:
// - Amazon Reviews: Apify Amazon Reviews Scraper (rotating residential proxies)
// - Google Maps Reviews (SaarMind): Apify Google Maps Scraper
// - Yelp Reviews: Yelp Fusion API
// - AI Analysis: Google Gemini Flash (Server-Side Proxy)
//
// Never fabricates data: returns real extracted reviews.
// ============================================================

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { toUnified } = require("./scrapers");

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

// ── Domain detection ──────────────────────────────────────────
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

// ── Yelp Fusion API ───────────────────────────────────────────
async function fetchYelp(input) {
  const apiKey = process.env.YELP_API_KEY;
  const alias = extractYelpAlias(input);

  if (!apiKey || apiKey === "YOUR_YELP_API_KEY") {
    throw new Error(
      "Yelp API key is not configured. For restaurants, use the 'Search Place' (SaarMind) tab to fetch Google Maps reviews via Apify, or paste reviews directly in the 'Paste Reviews' tab."
    );
  }

  let business;
  if (alias) {
    const { data } = await axios.get(`https://api.yelp.com/v3/businesses/${alias}`, {
      headers: yelpAuthHeader(apiKey),
    });
    business = data;
  } else {
    const { data } = await axios.get("https://api.yelp.com/v3/businesses/search", {
      headers: yelpAuthHeader(apiKey),
      params: { term: input, location: "United States", limit: 1 },
    });
    business = data.businesses?.[0];
  }

  if (!business) {
    throw new Error(`No Yelp business found for "${input}".`);
  }

  const { data: reviewData } = await axios.get(
    `https://api.yelp.com/v3/businesses/${business.id}/reviews`,
    { headers: yelpAuthHeader(apiKey) }
  );

  const reviews = (reviewData.reviews || []).map((r) =>
    toUnified("yelp", {
      rating: r.rating,
      text: r.text,
      date: r.time_created,
      author: r.user?.name,
      verified: true,
    })
  );

  return {
    meta: { name: business.name, rating: business.rating, reviewCount: business.review_count },
    count: reviews.length,
    reviews,
    note: "Yelp official API returns a max of 3 review excerpts per business (Yelp API policy limit).",
  };
}

// ── Amazon: Direct Apify Reviews Scraper (Primary) ─────────────
// Uses rotating residential proxies to bypass datacenter IP bot protection.
// Fetches up to 20 reviews (capped between min and max 20).
async function fetchAmazonReviews(url) {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken || apifyToken.trim() === "") {
    throw new Error(
      "APIFY_TOKEN is not configured on the server. Please set APIFY_TOKEN in your deployment environment."
    );
  }

  // Normalize URL to standard product format if possible
  const asinMatch = url.match(/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})/i);
  const targetUrl = asinMatch
    ? url.replace(/\/product-reviews\/([A-Z0-9]{10}).*/, "/dp/$1")
    : url;

  console.log(`[Amazon Apify] Primary call for: ${targetUrl}`);

  // Set memory=1024 to stay well within Apify concurrent memory limits and conserve compute units
  const endpoint = `https://api.apify.com/v2/acts/junglee~amazon-reviews-scraper/run-sync-get-dataset-items?token=${apifyToken}&memory=1024`;
  const body = {
    productUrls: [{ url: targetUrl }],
    maxReviews: 20,
    sort: "helpful",
  };

  const response = await axios.post(endpoint, body, { timeout: 120_000 });
  const items = Array.isArray(response.data) ? response.data : [];

  if (items.length === 0) {
    throw new Error("No reviews returned from Amazon for this product URL.");
  }

  // Deduplicate and cap strictly at 20 reviews (min/max bound: 20)
  const seen = new Set();
  const validItems = [];
  for (const item of items) {
    const key = item.reviewId || item.reviewDescription || item.reviewTitle;
    if (key && !seen.has(key)) {
      seen.add(key);
      validItems.push(item);
    }
  }

  const boundedItems = validItems.slice(0, 20);

  const reviews = boundedItems
    .filter((it) => it.reviewDescription || it.reviewTitle)
    .map((it) => {
      const text = it.reviewTitle
        ? `${it.reviewTitle}. ${it.reviewDescription || ""}`.trim()
        : it.reviewDescription || "";
      return toUnified("amazon", {
        rating: it.ratingScore,
        text,
        date: it.date,
        verified: !!it.isVerified,
        author: it.userName || it.userId || null,
      });
    });

  const first = boundedItems[0] || {};
  return {
    meta: {
      title: first.productTitle || "Amazon Product",
      rating: first.totalCategoryRatings ? first.ratingScore : null,
      asin: first.productAsin || (asinMatch ? asinMatch[1] : null),
      source: "apify_amazon",
      requestedCount: 20,
    },
    count: reviews.length,
    reviews,
    note: "Extracted via Apify Amazon Review Scraper (residential proxies).",
  };
}

// ── Route: Fetch Reviews ──────────────────────────────────────
app.post("/api/fetch-reviews", async (req, res) => {
  const { input, domain: domainOverride } = req.body || {};
  if (!input || typeof input !== "string" || !input.trim()) {
    return res.status(400).json({ error: 'Missing "input" (a URL or business name).' });
  }

  const domain = detectDomain(input, domainOverride);

  try {
    let result;

    if (/amazon\./i.test(input)) {
      result = await fetchAmazonReviews(input);
    } else if (domain === "restaurant") {
      result = await fetchYelp(input);
    } else {
      return res.status(400).json({
        domain,
        error:
          "Automated review extraction is supported for Amazon URLs and Yelp. For other platforms, please copy and paste the reviews directly into the 'Paste Reviews' tab, or use the 'Search Place' tab for Google Maps reviews.",
        suggestion: 'Try pasting the reviews directly in the "Paste Reviews" tab instead.',
      });
    }

    if (!result.reviews || result.reviews.length === 0) {
      return res.status(404).json({
        domain,
        error: "No reviews could be extracted from this product page.",
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
    console.error("fetch-reviews error:", err.message);
    res.status(500).json({ domain, error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
// SaarMind — Google Maps Reviews via Apify
// Handles TRAVEL and RESTAURANT domains.
// ════════════════════════════════════════════════════════════

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

function saarmingDetectDomain(placeName, apifyCategory) {
  const lower = (placeName + " " + (apifyCategory || "")).toLowerCase();
  const restScore = SAARMING_RESTAURANT_KW.filter((kw) => lower.includes(kw)).length;
  const travScore = SAARMING_TRAVEL_KW.filter((kw) => lower.includes(kw)).length;
  if (restScore === 0 && travScore === 0) return "restaurant";
  return restScore >= travScore ? "restaurant" : "hotel";
}

function buildGoogleMapsUrl(placeName) {
  const encoded = placeName.trim().replace(/\s+/g, "+");
  return `https://www.google.com/maps/search/${encoded}`;
}

function normalizeSaarmingReview(r) {
  const text = (r.text || "").trim();
  if (!text) return null;

  const date = r.publishedAtDate || null;
  const now = new Date();
  const reviewDate = date ? new Date(date) : null;
  const ageMs = reviewDate ? now - reviewDate : Infinity;
  const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30);

  let recencyWeight = 1.0;
  if (ageMonths <= 3) recencyWeight = 3.0;
  else if (ageMonths <= 6) recencyWeight = 2.0;

  const credibility = (r.reviewerNumberOfReviews || 0) > 10 ? "experienced" : "new";

  return {
    source: "google_maps",
    rating: r.stars || null,
    text,
    date,
    verified: false,
    author: r.name || null,
    recencyWeight,
    credibility,
    ageMonths: isFinite(ageMonths) ? Math.round(ageMonths) : null,
  };
}

function computeSaarmingTrend(reviews) {
  const dated = reviews.filter((r) => r.ageMonths !== null && r.rating !== null);
  if (dated.length < 4) return "stable";

  const recent = dated.filter((r) => r.ageMonths <= 6);
  const older  = dated.filter((r) => r.ageMonths > 6);

  if (recent.length === 0 || older.length === 0) return "stable";

  const recentAvg = recent.reduce((s, r) => s + r.rating, 0) / recent.length;
  const olderAvg  = older.reduce((s, r) => s + r.rating, 0) / older.length;
  const diff = recentAvg - olderAvg;

  if (diff >= 0.4)  return "improving";
  if (diff <= -0.4) return "declining";
  return "stable";
}

function computeSaarmingConfidence(reviews) {
  const n = reviews.length;
  const recentCount = reviews.filter((r) => r.ageMonths <= 6).length;
  const recentRatio = n > 0 ? recentCount / n : 0;

  if (n >= 15 && recentRatio >= 0.4) return "High";
  if (n >= 8)                         return "Medium";
  return "Low";
}

async function callApify(googleMapsUrl, apifyToken) {
  const endpoint = `https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/run-sync-get-dataset-items?token=${apifyToken}`;
  const body = {
    startUrls:    [{ url: googleMapsUrl }],
    maxReviews:   40,
    reviewsSort:  "newest",
    language:     "en",
    personalData: false,
  };

  const tryOnce = () => axios.post(endpoint, body, { timeout: 120_000 });

  let response;
  try {
    response = await tryOnce();
  } catch (err) {
    if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
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

async function fetchSaarming(placeName) {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    throw new Error("APIFY_TOKEN is not set in server/.env. Add your Apify API token to enable SaarMind.");
  }

  const googleMapsUrl = buildGoogleMapsUrl(placeName);
  const items = await callApify(googleMapsUrl, apifyToken);

  const firstItem  = items[0] || {};
  const allReviews = items.flatMap((item) => (Array.isArray(item.reviews) ? item.reviews : [item]));
  const domain = saarmingDetectDomain(placeName, firstItem.categoryName || "");

  const validReviews = allReviews
    .filter((r) => typeof r.text === "string" && r.text.trim() !== "")
    .slice(0, 20);

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
