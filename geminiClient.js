// ============================================================
// Universal Review Analyzer — Gemini Client
// Multi-step reasoning chain: 5 steps, single structured call
// ============================================================

const GeminiClient = {
  /**
   * Main analysis function — runs the 5-step reasoning chain
   * @param {Array} reviews - Preprocessed reviews
   * @param {string} domain - Detected domain
   * @param {Object} domainContext - Domain schema context
   * @param {Function} onStepComplete - Callback for step-by-step progress UI
   * @returns {Object} Structured analysis result
   */
  async analyze(reviews, domain, domainContext, onStepComplete) {
    const reviewsText = reviews
      .map((r, i) =>
        `[Review ${i + 1}] [Weight: ${r.recencyWeight}] [Year: ${r.year || "unknown"}] [Lang: ${r.lang}]\n${r.text}`
      )
      .join("\n\n---\n\n");

    const prompt = this._buildMasterPrompt(reviewsText, domain, domainContext);

    onStepComplete?.("thinking", "Sending to Gemini reasoning core...");

    const response = await this._callGemini(prompt);
    const parsed = this._parseResponse(response, domainContext);

    return parsed;
  },

  /**
   * Build the master 5-step chain-of-thought prompt
   * Uses structured JSON output for reliable parsing
   */
  _buildMasterPrompt(reviewsText, domain, domainContext) {
    return `You are an expert review intelligence analyst. Analyze these ${domain} reviews through a structured 5-step reasoning chain.

**DOMAIN**: ${domainContext.domainLabel}
**ANALYSIS CATEGORIES** for this domain:
${domainContext.categoryList}

**REVIEWS TO ANALYZE**:
${reviewsText}

---

Perform this 5-step analysis chain:

**STEP 1 — EXTRACT CLAIMS**: For each review, identify the atomic factual claims made.

**STEP 2 — CLUSTER THEMES**: Group claims into the domain-specific categories listed above. Each claim belongs to the most relevant category.

**STEP 3 — RESOLVE CONTRADICTIONS**: For each category, identify conflicting claims between reviews. Explain the contradiction and what might cause it (e.g., "inconsistent service across shifts", "varies by room type", "changed over time").

**STEP 4 — WEIGHT BY RECENCY & VOLUME**: Apply the recency weights ([Weight: X] in each review) to determine which themes are most currently relevant. Higher weight = more recent = more important.

**STEP 5 — GENERATE VERDICT**: Create an actionable, honest verdict.

---

Respond ONLY with a valid JSON object in this exact structure (no markdown, no explanation outside the JSON):

{
  "overallScore": <number 1-10, one decimal>,
  "verdict": {
    "chooseIf": "<what type of person/need this is perfect for>",
    "skipIf": "<what concern or need would make someone avoid this>",
    "summary": "<2-3 sentence honest summary of what this is>"
  },
  "pros": [
    { "title": "<pro title>", "detail": "<detailed explanation>", "strength": <1-3>, "themes": ["<category_key>"] },
    ...
  ],
  "cons": [
    { "title": "<con title>", "detail": "<detailed explanation>", "severity": <1-3>, "themes": ["<category_key>"] },
    ...
  ],
  "categories": {
    "<category_key>": {
      "score": <0-10, one decimal>,
      "sentiment": "<positive|negative|mixed>",
      "summary": "<2-sentence summary of what reviewers say>",
      "contradiction": "<null or description of conflicting opinions and why>"
    }
  },
  "contradictions": [
    { "theme": "<category_key>", "claim_a": "<one group says>", "claim_b": "<others say>", "resolution": "<likely explanation>" }
  ],
  "reasoning": {
    "step1_claims": "<brief summary of key claims extracted>",
    "step2_clustering": "<brief summary of how claims were clustered>",
    "step3_contradictions": "<brief summary of contradictions found>",
    "step4_weighting": "<brief summary of how recency weighting affected the analysis>",
    "step5_synthesis": "<brief summary of how the verdict was reached>"
  },
  "keyInsight": "<The single most important insight from this analysis that most reviewers miss>"
}

Requirements:
- Include 3-5 pros and 3-5 cons minimum
- pros sorted by strength descending (3 = strong, 1 = mild)
- cons sorted by severity descending (3 = critical, 1 = minor)
- All category keys must be present in the categories object
- The verdict must follow EXACTLY: "Choose this if you care about [X]. Skip it if [Y] matters to you."
- Be honest — if there are serious problems, don't downplay them
- Consider multilingual reviews equally (they may be in Hindi, Kannada, etc.)`;
  },

  /**
   * Call the Gemini proxy endpoint on the backend
   * The API key remains strictly on the server and is never sent to the browser
   */
  async _callGemini(prompt) {
    let response;
    try {
      response = await fetch(`${CONFIG.BACKEND_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
    } catch {
      throw new Error(`Cannot reach backend at ${CONFIG.BACKEND_URL}. Ensure the server is running.`);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Server returned ${response.status}`);
    }

    if (!data.content) {
      throw new Error("No content received from server analysis");
    }

    return data.content;
  },


  /**
   * Parse Gemini's JSON response
   */
  _parseResponse(responseText, domainContext) {
    try {
      // Handle cases where model wraps JSON in markdown code blocks
      let cleaned = responseText.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(cleaned);

      // Validate required fields exist
      if (!parsed.verdict || !parsed.pros || !parsed.cons || !parsed.categories) {
        throw new Error("Incomplete response structure");
      }

      // Ensure all categories from schema are present
      for (const key of domainContext.categoryKeys) {
        if (!parsed.categories[key]) {
          parsed.categories[key] = {
            score: 5.0,
            sentiment: "mixed",
            summary: "Insufficient data for this category.",
            contradiction: null,
          };
        }
      }

      return parsed;
    } catch (e) {
      console.error("Parse error:", e, "\nRaw response:", responseText);
      throw new Error(`Failed to parse Gemini response: ${e.message}`);
    }
  },
};
