// ============================================================
// Review Analyzer Backend — Extraction Helpers
// Real DOM / JSON-LD parsing only. Never returns fabricated data —
// an empty array means "nothing found", not a placeholder.
// ============================================================

const cheerio = require("cheerio");

function toUnified(source, { rating = null, text, date = null, verified = false, author = null }) {
  return {
    source,
    rating: rating || rating === 0 ? Number(rating) : null,
    text: (text || "").replace(/\s+/g, " ").trim(),
    date: date || null,
    verified: !!verified,
    author: author || null,
  };
}

/**
 * Extract schema.org Review nodes from JSON-LD <script> tags.
 * Many sites (incl. Yelp, TripAdvisor, e-commerce) embed this for SEO,
 * independent of how the visible DOM is structured.
 */
function extractJsonLd(html) {
  const $ = cheerio.load(html);
  const results = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data) ? data : [data];
      nodes.forEach((node) => collectReviewNodes(node, results));
    } catch {
      // Malformed JSON-LD is common in the wild — skip silently
    }
  });

  return results;
}

function collectReviewNodes(node, results) {
  if (!node || typeof node !== "object") return;

  const reviewField = node.review || node.reviews;
  const list = Array.isArray(reviewField) ? reviewField : reviewField ? [reviewField] : [];

  for (const r of list) {
    if (r["@type"] === "Review" || r.reviewBody) {
      results.push(
        toUnified("web", {
          rating: r.reviewRating?.ratingValue,
          text: r.reviewBody || r.description,
          date: r.datePublished,
          author: typeof r.author === "string" ? r.author : r.author?.name,
          verified: false,
        })
      );
    }
  }

  if (Array.isArray(node["@graph"])) {
    node["@graph"].forEach((n) => collectReviewNodes(n, results));
  }
}

/** Amazon product-review page — robust data-hook & class fallbacks + lazy scroll */
async function extractAmazon(page) {
  // Check for Amazon Captcha / Robot Check
  const pageTitle = (await page.title().catch(() => "")) || "";
  if (/robot check|captcha/i.test(pageTitle)) {
    console.warn("Amazon anti-bot verification challenge encountered.");
    return [];
  }

  // Scroll down to trigger Amazon's lazy-loaded review widget
  await page.evaluate(() => {
    window.scrollBy(0, 1800);
  }).catch(() => {});
  await page.waitForTimeout(1500);

  // Wait for review container
  await page.waitForSelector('[data-hook="review"], div[id^="customer_review-"], .review', { timeout: 8000 }).catch(() => {});

  const selector = '[data-hook="review"], div[id^="customer_review-"], .review';
  const raw = await page.$$eval(selector, (nodes) =>
    nodes.map((n) => {
      const body = n.querySelector('[data-hook="review-body"], .review-text-content, .review-text, .review-body');
      const starText = n.querySelector('[data-hook="review-star-rating"] span, [data-hook="cmps-review-star-rating"] span, .a-icon-alt')?.textContent || "";
      const ratingMatch = starText.match(/(\d+(?:\.\d+)?)/);
      return {
        text: (body?.innerText || body?.textContent || "").trim(),
        rating: ratingMatch ? ratingMatch[1] : null,
        date: n.querySelector('[data-hook="review-date"], .review-date')?.textContent?.trim() || null,
        author: n.querySelector(".a-profile-name, .author")?.textContent?.trim() || null,
        verified: !!n.querySelector('[data-hook="avp-badge"], [data-hook="review-format-strip"]'),
      };
    })
  );

  return raw.filter((r) => r.text && r.text.length > 5).map((r) => toUnified("amazon", r));
}


/** Flipkart product page — class names are obfuscated/rotate, so use broad heuristics */
async function extractFlipkart(page) {
  await page
    .waitForSelector('div[class*="ZmyHe"], div[class*="t-ZTKy"], div[class*="EPCmJX"]', { timeout: 8000 })
    .catch(() => {});

  const raw = await page.$$eval(
    'div[class*="t-ZTKy"], div[class*="EPCmJX"], div[class*="ZmyHe"]',
    (nodes) => nodes.map((n) => ({ text: n.innerText || "", rating: null, date: null, author: null, verified: false }))
  );

  return raw.filter((r) => r.text.trim().length > 5).map((r) => toUnified("flipkart", r));
}

/**
 * TripAdvisor hotel/restaurant page — uses specific selectors and longer wait time
 * because reviews load dynamically via JavaScript.
 */
async function extractTripAdvisor(page) {
  // TripAdvisor loads reviews via JS; wait longer and scroll to trigger lazy-loading
  try {
    await page.waitForSelector('div[class*="Review"], div[data-test-target="review-card"]', { timeout: 10000 }).catch(() => {});

    // Scroll down a bit to trigger lazy-loading
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await page.waitForTimeout(1000);
  } catch {
    // Selector not found, will fall back to generic extraction
  }

  // Try TripAdvisor-specific review containers
  const raw = await page
    .$$eval(
      'div[class*="Review"], div[data-test-target="review-card"], [itemprop="review"]',
      (nodes) =>
        nodes.map((n) => {
          // Extract rating (often in a data attribute or span with number)
          const ratingEl = n.querySelector('[class*="rating"], [itemprop="ratingValue"]');
          const ratingText = ratingEl?.innerText || ratingEl?.getAttribute("data-rating") || "";
          const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);

          // Extract review text
          const textEl = n.querySelector('[itemprop="reviewBody"], div[class*="description"], p[class*="review"]');
          const text = textEl?.innerText || n.innerText || "";

          // Extract date
          const dateEl = n.querySelector('[itemprop="datePublished"], time, span[class*="date"]');
          const date = dateEl?.getAttribute("datetime") || dateEl?.innerText || null;

          // Extract author
          const authorEl = n.querySelector('[itemprop="author"], [class*="username"], [class*="reviewer"]');
          const author = authorEl?.innerText || null;

          return {
            text: text.replace(/\s+/g, " ").trim(),
            rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
            date,
            author,
            verified: false,
          };
        })
    )
    .catch(() => []);

  return raw.filter((r) => r.text.trim().length > 20).map((r) => toUnified("tripadvisor", r));
}

/**
 * Generic fallback — works across unknown sites by targeting any element
 * whose class/id/itemprop mentions "review" and holds substantial text.
 */
async function extractGeneric(page) {
  const texts = await page.$$eval(
    '[class*="review" i], [id*="review" i], [itemprop="review"], [itemprop="reviewBody"], [data-testid*="review" i]',
    (nodes) =>
      nodes
        .map((n) => n.innerText || "")
        .map((t) => t.replace(/\s+/g, " ").trim())
        .filter((t) => t.length > 40 && t.length < 2000)
  );

  const unique = [...new Set(texts)].slice(0, 30);
  return unique.map((text) => toUnified("web", { text }));
}

module.exports = { extractJsonLd, extractAmazon, extractFlipkart, extractTripAdvisor, extractGeneric, toUnified };
