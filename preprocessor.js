// ============================================================
// Universal Review Analyzer — Preprocessor
// Handles: deduplication, recency tagging, language detection
// ============================================================

const Preprocessor = {
  /**
   * Full preprocessing pipeline
   * @param {Array} rawReviews - Array of review objects
   * @returns {{ reviews: Array, stats: Object }}
   */
  process(rawReviews) {
    const stats = { original: rawReviews.length, duplicatesRemoved: 0, languages: {} };

    let reviews = this.parseAndNormalize(rawReviews);
    const deduped = this.deduplicate(reviews);
    stats.duplicatesRemoved = reviews.length - deduped.length;
    reviews = deduped;

    reviews = this.tagRecency(reviews);
    reviews = this.detectLanguages(reviews);

    // Build language stats
    reviews.forEach(r => {
      stats.languages[r.lang] = (stats.languages[r.lang] || 0) + 1;
    });

    stats.processed = reviews.length;
    stats.dateRange = this.getDateRange(reviews);
    stats.avgRecencyWeight = (reviews.reduce((s, r) => s + r.recencyWeight, 0) / reviews.length).toFixed(2);

    return { reviews, stats };
  },

  /**
   * Parse raw text or objects into a normalized structure
   */
  parseAndNormalize(rawReviews) {
    if (typeof rawReviews === "string") {
      // Raw text pasted by user — split by double newlines or numbered lists
      return rawReviews
        .split(/\n{2,}|\n(?=\d+[\.\)])/g)
        .map((text, i) => ({ id: i + 1, text: text.trim(), date: null, rating: null, author: null }))
        .filter(r => r.text.length > 20);
    }

    // Structured review objects (from file upload, demo data, or the backend's
    // real URL-fetch endpoint — which already returns { source, rating, text, date, verified, author })
    return rawReviews.map((r, i) => ({
      id: r.id || i + 1,
      text: (r.text || r.review || r.content || "").trim(),
      date: r.date || r.timestamp || null,
      rating: r.rating || null,
      author: r.author || r.reviewer || null,
      lang: r.lang || null,
      source: r.source || null,
      verified: !!r.verified,
    })).filter(r => r.text.length > 10);
  },

  /**
   * Remove duplicate or near-duplicate reviews
   * Uses character-level similarity to catch bot/copy-paste reviews
   */
  deduplicate(reviews) {
    const seen = new Set();
    const unique = [];

    for (const review of reviews) {
      // Hash-based exact duplicate removal
      const hash = this._simpleHash(review.text.toLowerCase().replace(/\s+/g, " "));
      if (seen.has(hash)) continue;
      seen.add(hash);

      // Near-duplicate check (first 80 chars similarity)
      const fingerprint = review.text.toLowerCase().replace(/\s+/g, "").slice(0, 80);
      if ([...seen].some(h => this._similarity(fingerprint, h) > 0.9)) continue;

      seen.add(fingerprint);
      unique.push(review);
    }

    return unique;
  },

  /**
   * Tag each review with a recency weight based on its date
   */
  tagRecency(reviews) {
    const currentYear = new Date().getFullYear();

    return reviews.map(review => {
      let year = null;

      if (review.date) {
        const parsed = new Date(review.date);
        if (!isNaN(parsed)) year = parsed.getFullYear();
        else {
          // Try extracting year from text like "2024-05-12" or "May 2024"
          const match = review.date.match(/20\d{2}/);
          if (match) year = parseInt(match[0]);
        }
      }

      // Try to extract year from review text itself if not in date field
      if (!year) {
        const match = review.text.match(/20\d{2}/);
        if (match) year = parseInt(match[0]);
      }

      const delta = year ? Math.max(0, currentYear - year) : 5;
      const weights = CONFIG.RECENCY_WEIGHTS;
      const baseWeight = weights[Math.min(delta, 5)] ?? weights[5];
      // Verified purchase/visit reviews get 1.5x weight in the final analysis
      const recencyWeight = review.verified ? +(baseWeight * 1.5).toFixed(2) : baseWeight;

      return { ...review, year, recencyWeight, isRecent: year >= CONFIG.CONFIDENCE.RECENT_YEAR_THRESHOLD };
    });
  },

  /**
   * Detect language of each review
   * Simple heuristic-based detection for common scripts
   */
  detectLanguages(reviews) {
    return reviews.map(review => {
      if (review.lang) return review; // Already tagged

      const lang = this._detectLang(review.text);
      return { ...review, lang };
    });
  },

  /**
   * Simple language detection heuristic
   */
  _detectLang(text) {
    // Script-based detection
    if (/[\u0900-\u097F]/.test(text)) return "hi"; // Devanagari (Hindi)
    if (/[\u0C80-\u0CFF]/.test(text)) return "kn"; // Kannada
    if (/[\u0B80-\u0BFF]/.test(text)) return "ta"; // Tamil
    if (/[\u4E00-\u9FFF]/.test(text)) return "zh"; // Chinese
    if (/[\u3040-\u30FF]/.test(text)) return "ja"; // Japanese
    if (/[\u0600-\u06FF]/.test(text)) return "ar"; // Arabic

    // Common word-based detection for European languages
    const words = text.toLowerCase().split(/\s+/);
    const frWords = ["le", "la", "les", "de", "du", "est", "et", "je", "très", "pour"];
    const deWords = ["der", "die", "das", "ist", "und", "ich", "sehr", "gut", "nicht"];
    const esWords = ["el", "la", "los", "es", "muy", "con", "para", "que", "tiene"];

    if (words.filter(w => frWords.includes(w)).length >= 3) return "fr";
    if (words.filter(w => deWords.includes(w)).length >= 3) return "de";
    if (words.filter(w => esWords.includes(w)).length >= 3) return "es";

    return "en";
  },

  /**
   * Get date range of reviews
   */
  getDateRange(reviews) {
    const years = reviews.filter(r => r.year).map(r => r.year);
    if (!years.length) return { min: null, max: null };
    return { min: Math.min(...years), max: Math.max(...years) };
  },

  /**
   * Simple string hash for deduplication
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  },

  /**
   * Jaccard similarity between two strings (as char sets)
   */
  _similarity(a, b) {
    const setA = new Set(a.split(""));
    const setB = new Set(b.split(""));
    const intersection = [...setA].filter(c => setB.has(c)).length;
    const union = new Set([...setA, ...setB]).size;
    return intersection / union;
  },

  /**
   * Parse a plain text block (from paste mode) into review objects
   * Handles various formats: numbered, bulleted, paragraph-separated
   */
  parseTextBlock(text) {
    // Try numbered list: "1. Review text" or "1) Review text"
    const numberedMatch = text.match(/^\d+[\.\)]/m);
    if (numberedMatch) {
      return text.split(/\n?\d+[\.\)]\s+/)
        .filter(s => s.trim().length > 15)
        .map((t, i) => ({ id: i + 1, text: t.trim(), date: null, rating: null, author: null }));
    }

    // Try separator-based: "---" or "===" between reviews
    if (text.includes("---") || text.includes("===")) {
      return text.split(/---+|===+/)
        .filter(s => s.trim().length > 15)
        .map((t, i) => ({ id: i + 1, text: t.trim(), date: null, rating: null, author: null }));
    }

    // Default: split by double newlines
    return text.split(/\n{2,}/)
      .filter(s => s.trim().length > 15)
      .map((t, i) => ({ id: i + 1, text: t.trim(), date: null, rating: null, author: null }));
  }
};
