// ============================================================
// Universal Review Analyzer — Confidence Engine
// Computes trust signals based on review volume, recency, and diversity
// ============================================================

const ConfidenceEngine = {
  /**
   * Compute confidence level for the analysis
   * @param {Array} reviews - Processed reviews with recency tags
   * @param {Object} stats - Preprocessing stats
   * @returns {Object} Confidence object
   */
  compute(reviews, stats) {
    const count = reviews.length;
    const recentCount = reviews.filter(r => r.isRecent).length;
    const recentRatio = count > 0 ? recentCount / count : 0;
    const dateRange = stats.dateRange;

    const { HIGH_MIN_REVIEWS, HIGH_MIN_RECENT_RATIO, MEDIUM_MIN_REVIEWS, MEDIUM_MIN_RECENT_RATIO } =
      CONFIG.CONFIDENCE;

    let level, label, color, icon, description, score;

    if (count >= HIGH_MIN_REVIEWS && recentRatio >= HIGH_MIN_RECENT_RATIO) {
      level = "high";
      label = "High Confidence";
      icon = "🟢";
      color = "#10b981";
      score = this._computeScore(count, recentRatio);
      description = `Based on ${count} reviews, ${Math.round(recentRatio * 100)}% from recent years. Strong statistical basis.`;
    } else if (count >= MEDIUM_MIN_REVIEWS && recentRatio >= MEDIUM_MIN_RECENT_RATIO) {
      level = "medium";
      label = "Moderate Confidence";
      icon = "🟡";
      color = "#f59e0b";
      score = this._computeScore(count, recentRatio);
      description = `Based on ${count} reviews with moderate recency coverage. Results are indicative.`;
    } else if (count >= MEDIUM_MIN_REVIEWS && recentRatio < MEDIUM_MIN_RECENT_RATIO) {
      level = "medium-low";
      label = "Moderate Confidence — Mostly Older Data";
      icon = "🟠";
      color = "#f97316";
      score = this._computeScore(count, recentRatio);
      description = `${count} reviews available but most are older. Current experience may differ.`;
    } else {
      level = "low";
      label = "Low Confidence — Limited Recent Data";
      icon = "🔴";
      color = "#ef4444";
      score = this._computeScore(count, recentRatio);
      description = `Only ${count} review${count !== 1 ? "s" : ""} available${dateRange.max && dateRange.max < CONFIG.CONFIDENCE.RECENT_YEAR_THRESHOLD ? `, last updated in ${dateRange.max}` : ""}. Interpret results with caution.`;
    }

    // Build contributing factors
    const factors = this._buildFactors(count, recentRatio, reviews, dateRange);

    return {
      level,
      label,
      icon,
      color,
      score,
      description,
      factors,
      stats: {
        total: count,
        recent: recentCount,
        recentRatio: Math.round(recentRatio * 100),
        dateRange,
        avgRating: this._computeAvgRating(reviews),
        langCount: Object.keys(stats.languages || {}).length,
      },
    };
  },

  /**
   * Compute a 0-100 confidence score
   */
  _computeScore(count, recentRatio) {
    const volumeScore = Math.min(100, (count / 200) * 60); // Max 60 points from volume
    const recencyScore = recentRatio * 40;                  // Max 40 points from recency
    return Math.round(volumeScore + recencyScore);
  },

  /**
   * Build human-readable contributing factors
   */
  _buildFactors(count, recentRatio, reviews, dateRange) {
    const factors = [];

    // Volume factor
    if (count >= 100) factors.push({ icon: "✅", text: `${count} reviews — strong sample size`, positive: true });
    else if (count >= 30) factors.push({ icon: "⚠️", text: `${count} reviews — moderate sample size`, positive: false });
    else factors.push({ icon: "❌", text: `Only ${count} review${count !== 1 ? "s" : ""} — small sample`, positive: false });

    // Recency factor
    const recentPct = Math.round(recentRatio * 100);
    if (recentPct >= 50) factors.push({ icon: "✅", text: `${recentPct}% are recent — data is fresh`, positive: true });
    else if (recentPct >= 25) factors.push({ icon: "⚠️", text: `${recentPct}% recent — moderate freshness`, positive: false });
    else factors.push({ icon: "❌", text: `Only ${recentPct}% recent — data may be outdated`, positive: false });

    // Date range factor
    if (dateRange.min && dateRange.max) {
      if (dateRange.max - dateRange.min >= 3) {
        factors.push({ icon: "✅", text: `Covers ${dateRange.max - dateRange.min}+ years of feedback`, positive: true });
      }
    }

    // Language diversity factor
    const hasMultiLang = reviews.some(r => r.lang && r.lang !== "en");
    if (hasMultiLang) {
      factors.push({ icon: "✅", text: "Multilingual reviews — broader perspective", positive: true });
    }

    // Rating distribution
    const ratings = reviews.filter(r => r.rating).map(r => r.rating);
    if (ratings.length > 0) {
      const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      const hasVariance = ratings.some(r => r <= 2) && ratings.some(r => r >= 4);
      if (hasVariance) {
        factors.push({ icon: "✅", text: "Diverse rating distribution — balanced perspective", positive: true });
      }
    }

    return factors;
  },

  /**
   * Compute average rating from reviews
   */
  _computeAvgRating(reviews) {
    const ratings = reviews.filter(r => r.rating !== null && r.rating !== undefined).map(r => parseFloat(r.rating));
    if (!ratings.length) return null;
    return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
  },
};
