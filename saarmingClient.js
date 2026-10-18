// ============================================================
// SaarMind — Google Maps Review Ingestion Client
// Handles: fetch, multi-place compare, verdict card rendering
// IMPORTANT: Never routes e-commerce/product queries here.
//            Amazon / Flipkart go through the existing ReviewFetcher.
// ============================================================

const SaarmingClient = {

  // ── Domain hint keywords (mirrors server-side logic) ─────────
  RESTAURANT_KW: [
    "cafe", "café", "bar", "dhaba", "bistro", "food", "dining", "eatery",
    "bakery", "pizzeria", "brewery", "kitchen", "restaurant", "grill",
    "diner", "pub", "lounge", "taproom", "canteen", "mess", "tiffin",
    "barbeque", "bbq", "steakhouse", "seafood", "sushi", "pizza", "burger",
  ],
  TRAVEL_KW: [
    "hotel", "resort", "hostel", "inn", "palace", "lodge", "homestay",
    "spa", "museum", "monument", "park", "beach", "airport", "destination",
    "villa", "retreat", "sanctuary", "heritage", "fort", "temple", "lake",
    "waterfall", "valley", "island", "campsite", "glamping",
  ],

  /**
   * Guess the domain from the place name string (client-side hint only).
   * @param {string} name
   * @returns {{ domain: string, icon: string, label: string }}
   */
  detectDomainFromName(name) {
    const lower = name.toLowerCase();
    const restScore = this.RESTAURANT_KW.filter((kw) => lower.includes(kw)).length;
    const travScore = this.TRAVEL_KW.filter((kw) => lower.includes(kw)).length;
    if (restScore === 0 && travScore === 0) return { domain: "restaurant", icon: "🍽️", label: "Restaurant / Café" };
    return restScore >= travScore
      ? { domain: "restaurant", icon: "🍽️", label: "Restaurant / Café" }
      : { domain: "hotel",      icon: "🏨", label: "Hotel / Destination" };
  },

  /**
   * Fetch reviews for a single place from the backend /api/saarming endpoint.
   * @param {string} placeName
   * @returns {Promise<Object>} Backend response payload
   */
  async fetch(placeName) {
    let response;
    try {
      response = await window.fetch(`${CONFIG.BACKEND_URL}/api/saarming`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ placeName }),
      });
    } catch {
      throw new Error(
        `Can't reach the backend at ${CONFIG.BACKEND_URL}. Start it with "cd server && npm start".`
      );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Backend returned ${response.status}`);
    }

    return data;
  },

  /**
   * Fetch 2–3 places sequentially and return array of results + winner card.
   * @param {string[]} placeNames — 2 or 3 place names
   * @returns {Promise<{ results: Object[], winnerCard: Object|null }>}
   */
  async compare(placeNames) {
    let response;
    try {
      response = await window.fetch(`${CONFIG.BACKEND_URL}/api/saarming/compare`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ placeNames }),
      });
    } catch {
      throw new Error(
        `Can't reach the backend at ${CONFIG.BACKEND_URL}. Start it with "cd server && npm start".`
      );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Backend returned ${response.status}`);
    }

    return data; // { results: [...], winnerCard: {...} }
  },

  // ── Verdict Card HTML builder ─────────────────────────────────

  /**
   * Build the full SaarMind Verdict Card HTML for a single place result.
   * @param {Object} result  — payload from /api/saarming
   * @param {Object} analysis — Gemini analysis result (from GeminiClient)
   * @returns {string} HTML string ready to inject into the DOM
   */
  buildVerdictCard(result, analysis) {
    const { meta = {}, saarming = {}, count, totalReviewsOnGoogle, domain } = result;
    const { trend = {}, confidence = "Low", lowSample = false } = saarming;

    const domainLabel = domain === "hotel" ? "Hotel & Resort" : "Restaurant & Dining";
    const domainIcon  = domain === "hotel" ? "🏨" : "🍽️";
    const cityLine    = meta.city ? `📍 ${meta.city}` : "";
    const scoreLabel  = meta.overallRating ? `${meta.overallRating} / 5` : "N/A";
    const reviewCount = totalReviewsOnGoogle
      ? `${count} of ${totalReviewsOnGoogle.toLocaleString()}`
      : `${count}`;

    const confidenceColor = confidence === "High"
      ? "var(--success)"
      : confidence === "Medium"
        ? "#f59e0b"
        : "var(--error)";

    const trendIcon = trend.label || "➡️ Stable";

    // Build Pros rows (top 3)
    const pros = (analysis?.pros || []).slice(0, 3);
    const prosHtml = pros.map((p, i) =>
      `<div class="sm-list-item sm-pro">
         <span class="sm-rank">${i + 1}</span>
         <div><strong>${escHtml(p.title)}</strong> — ${escHtml(p.detail)}</div>
       </div>`
    ).join("");

    // Build Cons rows (top 2)
    const cons = (analysis?.cons || []).slice(0, 2);
    const consHtml = cons.map((c, i) =>
      `<div class="sm-list-item sm-con">
         <span class="sm-rank">${i + 1}</span>
         <div><strong>${escHtml(c.title)}</strong> — ${escHtml(c.detail)}</div>
       </div>`
    ).join("");

    // Contradiction alert (first one only)
    const contra = (analysis?.contradictions || [])[0];
    const contraHtml = contra
      ? `<div class="sm-contra-alert">
           <span class="sm-contra-icon">⚡</span>
           <div>
             <strong>CONTRADICTION ALERT:</strong>
             &ldquo;${escHtml(contra.theme)} is polarizing — ${escHtml(contra.claim_a)},
             but others say ${escHtml(contra.claim_b)}.
             Likely because: ${escHtml(contra.resolution)}&rdquo;
           </div>
         </div>`
      : "";

    // Verdict line
    const verdictHtml = analysis?.verdict
      ? `<div class="sm-verdict-line">
           <span class="sm-verdict-visit">✅ Visit if</span> you care about <strong>${escHtml(analysis.verdict.chooseIf || "—")}</strong>.<br>
           <span class="sm-verdict-skip">⛔ Skip if</span> <strong>${escHtml(analysis.verdict.skipIf || "—")}</strong> is a dealbreaker.
         </div>`
      : "";

    const lowSampleBanner = lowSample
      ? `<div class="sm-low-sample">⚠️ Low sample — treat verdict as indicative only.</div>`
      : "";

    return `
      <div class="saarming-verdict-card" id="saarmingVerdictCard">
        ${lowSampleBanner}
        <div class="sm-header-bar">
          <div class="sm-title-row">
            <span class="sm-logo">📍</span>
            <span class="sm-brand">GOOGLE MAPS VERDICT:</span>
            <span class="sm-place-name">${escHtml(meta.placeName || "Unknown")}</span>
          </div>
          <div class="sm-meta-row">
            ${cityLine ? `<span>${cityLine}</span>` : ""}
            <span class="sm-domain-pill">${domainIcon} ${domainLabel}</span>
            <span style="color:var(--text-muted); font-size:11px;">📊 Google Maps via Apify | ${reviewCount} reviews analyzed</span>
          </div>
        </div>

        <div class="sm-scores-row">
          <div class="sm-score-block">
            <span class="sm-score-star">⭐</span>
            <span class="sm-score-val">${scoreLabel}</span>
            <span class="sm-score-lbl">Google Rating</span>
          </div>
          <div class="sm-divider"></div>
          <div class="sm-score-block">
            <span class="sm-score-star">🎯</span>
            <span class="sm-score-val" style="color:${confidenceColor}">${confidence}</span>
            <span class="sm-score-lbl">Confidence</span>
          </div>
          <div class="sm-divider"></div>
          <div class="sm-score-block">
            <span class="sm-score-star">📅</span>
            <span class="sm-score-val sm-trend">${trendIcon}</span>
            <span class="sm-score-lbl">Trend</span>
          </div>
        </div>

        ${trend.reason ? `<div class="sm-trend-reason">"${escHtml(trend.reason)}"</div>` : ""}

        <div class="sm-sections">
          ${pros.length ? `
            <div class="sm-section">
              <div class="sm-section-title">✅ PROS</div>
              ${prosHtml}
            </div>` : ""}

          ${cons.length ? `
            <div class="sm-section">
              <div class="sm-section-title">❌ CONS</div>
              ${consHtml}
            </div>` : ""}
        </div>

        ${contraHtml}
        ${verdictHtml}

        <div class="sm-footer">Verified Google Maps Reviews via Apify · Analyzed by Gemini AI</div>
      </div>`;
  },

  /**
   * Build a comparison Winner Card HTML from the /api/saarming/compare response.
   * @param {Object} compareResult — { results, winnerCard }
   * @returns {string} HTML string
   */
  buildWinnerCard(compareResult) {
    const { results = [], winnerCard } = compareResult;

    const placeCards = results.map((r) => {
      if (r.error) {
        return `<div class="sm-compare-place sm-compare-error">
          <div class="sm-compare-name">❌ ${escHtml(r.placeName)}</div>
          <div class="sm-compare-err">${escHtml(r.error)}</div>
        </div>`;
      }
      const score = r.meta?.overallRating ? `⭐ ${r.meta.overallRating}/5` : "⭐ N/A";
      const trend = r.saarming?.trend?.label || "➡️ Stable";
      const conf  = r.saarming?.confidence || "Low";
      return `<div class="sm-compare-place">
        <div class="sm-compare-name">${escHtml(r.meta?.placeName || r.placeName)}</div>
        <div class="sm-compare-stats">
          <span>${score}</span>
          <span>${trend}</span>
          <span>🎯 ${conf}</span>
          <span>📊 ${r.count} reviews</span>
        </div>
      </div>`;
    }).join("");

    const winnerHtml = winnerCard ? `
      <div class="sm-winner-table">
        <div class="sm-winner-row">
          <span class="sm-winner-label">🏆 Best Overall</span>
          <span class="sm-winner-val">${escHtml(winnerCard.bestOverall || "—")}
            ${winnerCard.bestScore ? `(${winnerCard.bestScore}⭐)` : ""}</span>
        </div>
        <div class="sm-winner-row">
          <span class="sm-winner-label">📣 Most Reviewed</span>
          <span class="sm-winner-val">${escHtml(winnerCard.mostReviewed || "—")}</span>
        </div>
      </div>` : "";

    return `
      <div class="saarming-winner-card" id="saarmingWinnerCard">
        <div class="sm-header-bar">
          <div class="sm-title-row">
            <span class="sm-logo">🏆</span>
            <span class="sm-brand">GOOGLE MAPS COMPARISON</span>
          </div>
        </div>
        <div class="sm-compare-places">${placeCards}</div>
        ${winnerHtml}
        <div class="sm-footer">Verified Google Maps Reviews via Apify · Analyzed by Gemini AI</div>
      </div>`;
  },
};
