// ============================================================
// Review Analyzer Backend — Data Normalization Helpers
// Unified schema for normalized reviews across all sources.
// Never fabricates data: returns real extracted reviews.
// ============================================================

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

module.exports = { toUnified };
