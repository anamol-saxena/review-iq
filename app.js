// ============================================================
// Universal Review Analyzer — Main App Orchestrator
// ============================================================

// ── State ────────────────────────────────────────────────────
const AppState = {
  currentTab: "paste",
  currentScenario: null,
  fileContent: null,
  urlFetchedReviews: null,
  // SaarMind
  saarmingReviews: null,
  saarmingResult: null,   // raw /api/saarming payload (for the verdict card)
  saarmingCompareData: null, // raw /api/saarming/compare payload
  lastResult: null,
  lastReviews: null,
  lastConfidence: null,
  isAnalyzing: false,
};

// ── DOM Refs ──────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Review Fetcher (talks to the local backend) ────────────────
const ReviewFetcher = {
  /**
   * Fetches real reviews for a URL/business name from the local backend,
   * which does the actual scraping/API calls server-side.
   * @param {string} input - URL or business name
   * @param {string} domain - 'ecommerce' | 'travel' | 'restaurant' | 'auto'
   * @returns {Promise<{domain:string, count:number, meta:Object, reviews:Array, note:?string}>}
   */
  async fetchFromUrl(input, domain = "auto") {
    let response;
    try {
      response = await fetch(`${CONFIG.BACKEND_URL}/api/fetch-reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, domain }),
      });
    } catch {
      throw new Error(
        `Can't reach the backend at ${CONFIG.BACKEND_URL}. Start it with "cd server && npm install && npm start".`
      );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Backend returned ${response.status}`);
    }

    return data;
  },
};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initFileUpload();
  initDemoGrid();
  initDemoChips();
  initUrlFetch();
  initSaarming();
  initAnalyze();
  initResultsActions();
  initTextareaCount();
});


// ── Tabs ──────────────────────────────────────────────────────
function initTabs() {
  $$(".input-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  AppState.currentTab = tabName;

  $$(".input-tab").forEach((t) => {
    const isActive = t.dataset.tab === tabName;
    t.classList.toggle("active", isActive);
    t.setAttribute("aria-selected", isActive);
  });

  $$(".input-tab-panel").forEach((p) => {
    p.classList.toggle("active", p.id === `panel-${tabName}`);
  });
}

// ── Textarea char count ───────────────────────────────────────
function initTextareaCount() {
  const ta = $("reviewTextarea");
  ta.addEventListener("input", () => {
    $("charCount").textContent = `${ta.value.length.toLocaleString()} chars`;
  });
}

// ── File Upload ───────────────────────────────────────────────
function initFileUpload() {
  const zone = $("fileUploadZone");
  const input = $("fileInput");

  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  input.addEventListener("change", () => { if (input.files[0]) handleFile(input.files[0]); });

  $("clearFileBtn").addEventListener("click", () => {
    AppState.fileContent = null;
    $("fileSelected").classList.remove("visible");
    $("fileName").textContent = "";
    input.value = "";
  });
}

function handleFile(file) {
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    showError("File too large. Maximum size is 5MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    AppState.fileContent = parseFileContent(file.name, content);
    $("fileName").textContent = `${file.name} (${AppState.fileContent.length} reviews parsed)`;
    $("fileSelected").classList.add("visible");
  };
  reader.readAsText(file);
}

function parseFileContent(filename, content) {
  const ext = filename.split(".").pop().toLowerCase();

  if (ext === "json") {
    try {
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [{ text: content }];
    } catch {
      return Preprocessor.parseTextBlock(content);
    }
  }

  if (ext === "csv") {
    return parseCSV(content);
  }

  // TXT
  return Preprocessor.parseTextBlock(content);
}

function parseCSV(content) {
  const lines = content.split("\n").filter((l) => l.trim());
  if (!lines.length) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const textCol = headers.findIndex((h) => ["text", "review", "content", "comment", "body"].includes(h));
  const dateCol = headers.findIndex((h) => ["date", "timestamp", "time", "created"].includes(h));
  const ratingCol = headers.findIndex((h) => ["rating", "score", "stars"].includes(h));

  if (textCol === -1) {
    // No header match — treat each line as a review
    return lines.map((l, i) => ({ id: i + 1, text: l.trim().replace(/^["']|["']$/g, "") }));
  }

  return lines
    .slice(1)
    .map((line, i) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      return {
        id: i + 1,
        text: cols[textCol] || "",
        date: dateCol >= 0 ? cols[dateCol] : null,
        rating: ratingCol >= 0 ? parseFloat(cols[ratingCol]) : null,
      };
    })
    .filter((r) => r.text.length > 5);
}

// ── Demo Grid ─────────────────────────────────────────────────
function initDemoGrid() {
  const grid = $("demoGrid");
  Object.entries(DEMO_SCENARIOS).forEach(([id, scenario]) => {
    const card = document.createElement("button");
    card.className = "demo-chip";
    card.style.cssText = "flex-direction:column; align-items:flex-start; padding:16px; border-radius:12px; height:auto; text-align:left;";
    card.innerHTML = `
      <div style="font-size:24px; margin-bottom:8px;">${scenario.icon}</div>
      <div style="font-weight:700; font-size:14px; color:var(--text-primary); margin-bottom:4px;">${scenario.name}</div>
      <div style="font-size:11px; color:var(--text-muted);">${scenario.description}</div>
      <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">📄 ${scenario.reviews.length} reviews · ${scenario.source}</div>
    `;
    card.addEventListener("click", () => loadDemoScenario(id));
    grid.appendChild(card);
  });
}

function initDemoChips() {
  $$(".demo-chip[data-scenario]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const id = chip.dataset.scenario;
      loadDemoScenario(id);
      switchTab("demo");
    });
  });
}

function loadDemoScenario(id) {
  const scenario = DEMO_SCENARIOS[id];
  if (!scenario) return;

  AppState.currentScenario = scenario;

  // Show visual feedback in demo grid
  $$(".demo-chip[data-scenario]").forEach((c) => {
    c.classList.toggle("active", c.dataset.scenario === id);
  });

  // Highlight selected chip
  const selected = document.querySelector(`[data-scenario="${id}"]`);
  if (selected) {
    selected.style.borderColor = "var(--accent-1)";
    selected.style.background = "rgba(124,58,237,0.1)";
    setTimeout(() => {
      selected.style.borderColor = "";
      selected.style.background = "";
    }, 1000);
  }

  showToast(`Loaded: ${scenario.name} (${scenario.reviews.length} reviews)`, "success");
}

// ── URL Fetch ─────────────────────────────────────────────────
function initUrlFetch() {
  $("fetchUrlBtn").addEventListener("click", fetchUrl);
  $("urlInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") fetchUrl();
  });

  // Initialize domain chips
  $$(".domain-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$(".domain-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      setUrlSourceView(chip.dataset.domain);
    });
  });
}

function setUrlSourceView(domain) {
  const isPlace = domain === "place";
  $("urlEcommerceSection").style.display = isPlace ? "none" : "";
  $("urlPlaceSection").style.display = isPlace ? "" : "none";
}

function isPlaceSource() {
  return document.querySelector(".domain-chip.active")?.dataset.domain === "place";
}

async function fetchUrl() {
  const url = $("urlInput").value.trim();
  if (!url) { showToast("Please enter a URL", "error"); return; }

  // Get selected domain
  const selectedDomain = document.querySelector(".domain-chip.active").dataset.domain;

  const btn = $("fetchUrlBtn");
  const btnText = $("fetchBtnText");
  const status = $("urlFetchStatus");

  btn.disabled = true;
  btnText.textContent = "⏳ Fetching...";
  status.style.display = "block";
  status.innerHTML = `<div style="color:var(--text-secondary); font-size:13px;">🔍 Fetching verified reviews via Apify...</div>`;

  try {
    const data = await ReviewFetcher.fetchFromUrl(url, selectedDomain);
    AppState.urlFetchedReviews = data.reviews;
    AppState.urlFetchedData = data;

    const noteHtml = data.note ? `<div style="color:var(--text-muted); font-size:12px; margin-top:4px;">ℹ️ ${data.note}</div>` : "";
    const sourceDisplay = data.meta?.source === "apify_amazon" ? "Amazon" : (data.meta?.source || "web");
    status.innerHTML = `<div style="color:var(--success); font-size:13px;">✅ Fetched ${data.count} real review(s) via ${sourceDisplay}</div>${noteHtml}`;

    $("urlFetchedPreview").style.display = "block";
    const preview = data.reviews.slice(0, 5).map((r, i) => `${i + 1}. ${r.rating ? `[${r.rating}★] ` : ""}${r.text}`).join("\n\n");
    $("urlFetchedText").value = preview + (data.reviews.length > 5 ? `\n\n...and ${data.reviews.length - 5} more` : "");

    showToast(`Fetched ${data.count} real reviews`, "success");
  } catch (e) {
    status.innerHTML = `<div style="color:var(--error); font-size:13px;">❌ ${e.message}</div>`;
    showToast("Failed to fetch URL", "error");
  } finally {
    btn.disabled = false;
    btnText.textContent = "🔍 Fetch Amazon Reviews";
  }
}

// ── Analysis Engine ───────────────────────────────────────────
function initAnalyze() {
  $("analyzeBtn").addEventListener("click", runAnalysis);
}

async function runAnalysis() {
  if (AppState.isAnalyzing) return;

  // Collect raw reviews
  let rawReviews = null;
  const tab = AppState.currentTab;

  if (tab === "paste") {
    const text = $("reviewTextarea").value.trim();
    if (!text) { showToast("Please paste some reviews", "error"); return; }
    rawReviews = Preprocessor.parseTextBlock(text);
  } else if (tab === "url") {
    if (isPlaceSource()) {
      if (!AppState.saarmingReviews) { showToast("Please fetch a place first", "error"); return; }
      rawReviews = AppState.saarmingReviews;
    } else {
      if (!AppState.urlFetchedReviews) { showToast("Please fetch a URL first", "error"); return; }
      rawReviews = AppState.urlFetchedReviews;
    }
  } else if (tab === "file") {
    if (!AppState.fileContent) { showToast("Please upload a file first", "error"); return; }
    rawReviews = AppState.fileContent;
  } else if (tab === "demo") {
    if (!AppState.currentScenario) { showToast("Please select a demo scenario", "error"); return; }
    rawReviews = AppState.currentScenario.reviews;
  }

  if (!rawReviews || rawReviews.length === 0) {
    showToast("No reviews found. Please check your input.", "error");
    return;
  }

  // Begin analysis
  AppState.isAnalyzing = true;
  setAnalyzingState(true);
  hideAllSections();
  showProcessingSection();

  try {
    // ── Step 1: Preprocess ──
    await activatePipelineStep("step-preprocess", 1200);
    const { reviews, stats } = Preprocessor.process(rawReviews);

    if (reviews.length === 0) throw new Error("No valid reviews after preprocessing.");

    completePipelineStep("step-preprocess", `${reviews.length} reviews processed, ${stats.duplicatesRemoved} duplicates removed`);

    // ── Step 2: Domain Routing ──
    await activatePipelineStep("step-domain", 800);
    let domainOverride = "auto";
    let allowedDomains = null;

    if (tab === "demo") {
      domainOverride = AppState.currentScenario?.domain || "auto";
    } else if (tab === "url") {
      if (isPlaceSource()) {
        // Google Maps place is strictly places (Hotel or Restaurant)
        allowedDomains = ["restaurant", "hotel"];
        domainOverride = AppState.saarmingResult?.domain || "auto";
      } else {
        // Amazon product URL is strictly physical/consumer product
        allowedDomains = ["ecommerce", "electronics"];
        domainOverride = "auto";
      }
    }

    const domain = DomainRouter.detectDomain(reviews, domainOverride, allowedDomains);
    const domainContext = DomainRouter.buildDomainContext(domain);
    const schema = DomainRouter.getSchema(domain);

    completePipelineStep("step-domain", `Detected domain: ${schema.label}`);

    // ── Step 3: Extract Claims (Gemini) ──
    await activatePipelineStep("step-extract", 0);

    // ── Step 4: Contradictions (Gemini) ──
    // Steps 3-5 all happen inside the Gemini call — we simulate UI progress
    const contradictPromise = activatePipelineStep("step-contradict", 0);

    // Run Gemini analysis
    const analysis = await GeminiClient.analyze(
      reviews,
      domain,
      domainContext,
      (stepId, detail) => {
        // Update pipeline detail text if needed
      }
    );

    completePipelineStep("step-extract", "Claims extracted and clustered into themes");
    await contradictPromise;
    completePipelineStep("step-contradict", `${(analysis.contradictions || []).length} contradictions identified`);

    // ── Step 5: Verdict ──
    await activatePipelineStep("step-verdict", 600);
    const confidence = ConfidenceEngine.compute(reviews, stats);
    completePipelineStep("step-verdict", `Overall score: ${analysis.overallScore}/10`);

    // Store results
    AppState.lastResult = analysis;
    AppState.lastReviews = reviews;
    AppState.lastConfidence = confidence;
    AppState.lastStats = stats;
    AppState.lastDomain = domain;
    AppState.lastScenario = AppState.currentTab === "demo" ? AppState.currentScenario : null;
    AppState.lastIsPlace = AppState.currentTab === "url" && isPlaceSource();

    // Wait a beat then show results
    await sleep(600);
    hideProcessingSection();
    renderResults(analysis, confidence, stats, schema, domain);

  } catch (err) {
    console.error("Analysis error:", err);
    hideProcessingSection();
    showErrorState("Analysis Failed", err.message || "An unexpected error occurred. Please try again.");
  } finally {
    AppState.isAnalyzing = false;
    setAnalyzingState(false);
    resetPipelineSteps();
  }
}

// ── Pipeline Step Helpers ─────────────────────────────────────
async function activatePipelineStep(stepId, duration) {
  // Deactivate previous active step
  $$(".pipeline-step.active").forEach((s) => {
    if (s.id !== stepId) s.classList.remove("active");
  });

  const step = $(stepId);
  step.classList.add("active");
  step.querySelector(".pipeline-step-status").textContent = "⚙️";

  if (duration > 0) await sleep(duration);
}

function completePipelineStep(stepId, detail) {
  const step = $(stepId);
  step.classList.remove("active");
  step.classList.add("complete");
  step.querySelector(".pipeline-step-status").textContent = "✅";
  if (detail) step.querySelector(".pipeline-step-detail").textContent = detail;
}

function resetPipelineSteps() {
  $$(".pipeline-step").forEach((step) => {
    step.classList.remove("active", "complete");
    step.querySelector(".pipeline-step-status").textContent = "⏳";
  });
}

// ── Section Visibility ────────────────────────────────────────
function hideAllSections() {
  $("processingSection").classList.remove("visible");
  $("resultsSection").classList.remove("visible");
  $("errorState").classList.remove("visible");
}

function showProcessingSection() {
  $("processingSection").classList.add("visible");
  $("processingSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideProcessingSection() {
  $("processingSection").classList.remove("visible");
}

function showErrorState(title, message) {
  $("errorState").classList.add("visible");
  $("errorState").querySelector(".error-title").textContent = title;
  $("errorMessage").textContent = message;
}

// ── Render Results ────────────────────────────────────────────
function renderResults(analysis, confidence, stats, schema, domain) {
  // Header
  const scenario = AppState.lastScenario;
  const placeLabel = AppState.lastIsPlace
    ? AppState.saarmingCompareData?.results?.map((r) => r.placeName).join(" vs ") ||
      AppState.saarmingResult?.meta?.placeName ||
      AppState.saarmingResult?.placeName ||
      $("saarmingPlaceInput")?.value?.trim()
    : null;

  const productTitle = (!AppState.lastIsPlace && AppState.urlFetchedData?.meta?.title)
    ? AppState.urlFetchedData.meta.title
    : null;

  $("resultIcon").textContent = scenario?.icon || schema.icon;
  $("resultName").textContent = placeLabel || productTitle || scenario?.name || `${schema.label} Intelligence`;

  // Source attribution for meta line
  let sourceLabel = "Customer Reviews";
  if (AppState.lastIsPlace) {
    sourceLabel = "Google Maps Reviews";
  } else if (AppState.currentTab === "url" || AppState.urlFetchedData) {
    sourceLabel = "Amazon Reviews";
  } else if (scenario) {
    sourceLabel = `${scenario.source || "Sample"} Reviews`;
  } else if (AppState.currentTab === "file") {
    sourceLabel = "Uploaded Reviews";
  } else if (AppState.currentTab === "paste") {
    sourceLabel = "Pasted Reviews";
  }

  $("resultMeta").textContent = `${schema.label} · ${stats.processed} ${sourceLabel} Analyzed`;

  // Confidence badge
  const badge = $("confidenceBadge");
  badge.textContent = `${confidence.icon} ${confidence.label}`;
  badge.className = `confidence-badge confidence-${confidence.level}`;
  badge.title = confidence.description;

  // Preprocessing stats
  renderPreprocessingStats(stats, confidence);

  // Cards
  renderVerdictCard(analysis, confidence);
  renderProsCard(analysis.pros || []);
  renderConsCard(analysis.cons || []);
  renderThematicCard(analysis.categories || {}, schema);

  // Contradictions
  renderContradictions(analysis.contradictions || [], schema);

  // Reasoning Chain
  renderReasoningChain(analysis.reasoning || {});

  // Show section
  $("resultsSection").classList.add("visible");
  $("resultsSection").scrollIntoView({ behavior: "smooth", block: "start" });

  // Animate cards in staggered
  const cards = $$(".card");
  cards.forEach((card, i) => {
    setTimeout(() => card.classList.add("revealed"), i * 120);
  });

  // Animate bars after a delay
  setTimeout(() => animateBars(), 600);

  // Animate contradiction cards
  $$(".contradiction-card").forEach((card, i) => {
    setTimeout(() => card.classList.add("revealed"), 400 + i * 80);
  });

  // Animate reasoning steps
  $$(".reasoning-step-card").forEach((card, i) => {
    setTimeout(() => card.classList.add("revealed"), 600 + i * 100);
  });

  // ── SaarMind verdict card injection ──────────────────────────
  if (AppState.lastIsPlace && AppState.saarmingResult) {
    injectSaarmingVerdictCard(analysis);
  }
}

function renderPreprocessingStats(stats, confidence) {
  const container = $("preprocessingStats");
  const items = [
    { value: stats.processed, label: "Reviews Analyzed" },
    { value: stats.duplicatesRemoved, label: "Duplicates Removed" },
    { value: confidence.stats.recentRatio + "%", label: "Recent Data" },
    { value: Object.keys(stats.languages || {}).length, label: "Languages Detected" },
    {
      value: stats.dateRange?.min && stats.dateRange?.max
        ? `${stats.dateRange.min}–${stats.dateRange.max}`
        : "Unknown",
      label: "Date Range",
    },
    { value: confidence.stats.avgRating || "N/A", label: "Avg Rating" },
  ];

  container.innerHTML = items
    .map(
      (item, i) => `
      ${i > 0 ? '<div class="stat-divider"></div>' : ""}
      <div class="stat-item">
        <div class="stat-value">${item.value}</div>
        <div class="stat-label">${item.label}</div>
      </div>
    `
    )
    .join("");
}

function renderVerdictCard(analysis, confidence) {
  $("overallScore").textContent = analysis.overallScore ?? "—";

  // Color code score
  const score = parseFloat(analysis.overallScore);
  const scoreEl = $("overallScore");
  if (score >= 7.5) scoreEl.style.background = "linear-gradient(135deg, #10b981, #34d399)";
  else if (score >= 5) scoreEl.style.background = "linear-gradient(135deg, #f59e0b, #fbbf24)";
  else scoreEl.style.background = "linear-gradient(135deg, #ef4444, #f87171)";
  scoreEl.style["-webkit-background-clip"] = "text";
  scoreEl.style["-webkit-text-fill-color"] = "transparent";
  scoreEl.style["background-clip"] = "text";

  $("verdictSummary").textContent = analysis.verdict?.summary || "";

  // Helper to format clean verdict statement without double phrases
  const formatStatement = (text, fallback = "—") => {
    if (!text) return fallback;
    let str = text.trim();
    str = str.replace(/^you care about\s+/i, "");
    str = str.replace(/^if you\s+/i, "you ");
    str = str.replace(/\s+matters to you\.?$/i, ".");
    if (str.length > 0) {
      str = str.charAt(0).toUpperCase() + str.slice(1);
    }
    return str;
  };

  $("verdictChooseIf").textContent = formatStatement(analysis.verdict?.chooseIf);
  $("verdictSkipIf").textContent = formatStatement(analysis.verdict?.skipIf);

  if (analysis.keyInsight) {
    $("keyInsightBox").style.display = "block";
    $("keyInsightText").textContent = analysis.keyInsight;
  }

  // Show confidence description inside card
  const confDetail = document.createElement("div");
  confDetail.style.cssText = "font-size:12px; color:var(--text-muted); margin-top:12px; line-height:1.5;";
  confDetail.innerHTML = `<strong style="color:${confidence.color}">${confidence.icon} ${confidence.label}</strong> — ${confidence.description}`;

  const existingDetail = $("verdictCard").querySelector(".confidence-detail");
  if (existingDetail) existingDetail.remove();

  confDetail.className = "confidence-detail";
  $("verdictCard").appendChild(confDetail);

  // Confidence factors
  if (confidence.factors?.length) {
    const factorsEl = document.createElement("div");
    factorsEl.style.cssText = "display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;";
    factorsEl.innerHTML = confidence.factors
      .map(
        (f) => `
        <div style="font-size:12px; color:${f.positive ? "var(--success)" : "var(--text-muted)"};">
          ${f.icon} ${f.text}
        </div>
      `
      )
      .join("");
    $("verdictCard").appendChild(factorsEl);
  }
}

function renderProsCard(pros) {
  const list = $("prosList");
  list.innerHTML = pros
    .slice(0, 6)
    .map(
      (pro) => `
    <div class="pro-item">
      <div class="pro-icon">✅</div>
      <div class="item-content">
        <div class="item-title">${escHtml(pro.title)}</div>
        <div class="item-detail">${escHtml(pro.detail)}</div>
        <div class="item-strength">
          ${[1, 2, 3].map((n) => `<div class="strength-dot ${n <= (pro.strength || 1) ? "active-pro" : ""}"></div>`).join("")}
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

function renderConsCard(cons) {
  const list = $("consList");
  list.innerHTML = cons
    .slice(0, 6)
    .map(
      (con) => `
    <div class="con-item">
      <div class="con-icon">⚠️</div>
      <div class="item-content">
        <div class="item-title">${escHtml(con.title)}</div>
        <div class="item-detail">${escHtml(con.detail)}</div>
        <div class="item-strength">
          ${[1, 2, 3].map((n) => `<div class="strength-dot ${n <= (con.severity || 1) ? "active-con" : ""}"></div>`).join("")}
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

function renderThematicCard(categories, schema) {
  const grid = $("categoriesGrid");
  grid.innerHTML = "";

  schema.categories.forEach((cat) => {
    const data = categories[cat.key];
    if (!data) return;

    const score = parseFloat(data.score) || 0;
    const barClass = score >= 7 ? "bar-high" : score >= 4.5 ? "bar-medium" : "bar-low";
    const scoreClass = score >= 7 ? "score-high" : score >= 4.5 ? "score-medium" : "score-low";

    const item = document.createElement("div");
    item.className = "category-item";
    item.innerHTML = `
      <div class="category-header">
        <div class="category-label">
          <span>${cat.icon}</span>
          <span>${cat.label}</span>
        </div>
        <div class="category-score ${scoreClass}">${score.toFixed(1)}</div>
      </div>
      <div class="category-bar-track">
        <div class="category-bar-fill ${barClass}" data-width="${score * 10}" style="width:0%"></div>
      </div>
      <div class="category-summary">${escHtml(data.summary || "")}</div>
      ${
        data.contradiction
          ? `<div class="category-contradiction">⚡ ${escHtml(data.contradiction)}</div>`
          : ""
      }
    `;
    grid.appendChild(item);
  });
}

function animateBars() {
  $$(".category-bar-fill").forEach((bar) => {
    const targetWidth = bar.dataset.width + "%";
    bar.style.width = targetWidth;
  });
}

function renderContradictions(contradictions, schema) {
  const section = $("contradictionsSection");
  const grid = $("contradictionsGrid");

  if (!contradictions || contradictions.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  grid.innerHTML = contradictions
    .slice(0, 6)
    .map((c) => {
      const cat = schema?.categories?.find((item) => item.key === c.theme);
      const themeLabel = cat
        ? `${cat.icon || ""} ${cat.label}`
        : (c.theme || "").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

      return `
    <div class="contradiction-card">
      <div class="contradiction-theme">⚡ ${escHtml(themeLabel)}</div>
      <div class="contradiction-claims">
        <div class="contradiction-claim claim-a">👍 "${escHtml(c.claim_a || "")}"</div>
        <div class="contradiction-claim claim-b">👎 "${escHtml(c.claim_b || "")}"</div>
      </div>
      <div class="contradiction-resolution">💡 ${escHtml(c.resolution || "")}</div>
    </div>
  `;
    })
    .join("");
}

function renderReasoningChain(reasoning) {
  const container = $("reasoningSteps");
  const steps = [
    { num: "01", label: "Claim Extraction", key: "step1_claims" },
    { num: "02", label: "Theme Clustering", key: "step2_clustering" },
    { num: "03", label: "Contradiction Analysis", key: "step3_contradictions" },
    { num: "04", label: "Recency Weighting", key: "step4_weighting" },
    { num: "05", label: "Verdict Synthesis", key: "step5_synthesis" },
  ];

  container.innerHTML = steps
    .map(
      (s) => `
    <div class="reasoning-step-card" title="Click to expand">
      <div class="reasoning-step-num">STEP ${s.num}</div>
      <div class="reasoning-step-label">${s.label}</div>
      <div class="reasoning-step-text">${escHtml(reasoning[s.key] || "No detail available")}</div>
    </div>
  `
    )
    .join("");
}

// ── Results Actions ───────────────────────────────────────────
function initResultsActions() {
  $("copyResultsBtn").addEventListener("click", copyResults);
  $("newAnalysisBtn").addEventListener("click", newAnalysis);
  $("tryAgainBtn").addEventListener("click", newAnalysis);
}

function copyResults() {
  if (!AppState.lastResult) return;

  const r = AppState.lastResult;
  const c = AppState.lastConfidence;

  const text = [
    `# ReviewIQ Analysis Report`,
    `**Overall Score:** ${r.overallScore}/10`,
    `**Confidence:** ${c?.label}`,
    ``,
    `## Verdict`,
    `✅ Choose this if you care about ${r.verdict?.chooseIf}`,
    `❌ Skip it if ${r.verdict?.skipIf} matters to you`,
    ``,
    r.verdict?.summary,
    ``,
    `## Top Pros`,
    ...(r.pros || []).slice(0, 5).map((p) => `• ${p.title}: ${p.detail}`),
    ``,
    `## Top Cons`,
    ...(r.cons || []).slice(0, 5).map((c) => `• ${c.title}: ${c.detail}`),
    ``,
    `---`,
    `Generated by ReviewIQ · AI Builder Cup 2026`,
  ].join("\n");

  navigator.clipboard.writeText(text).then(() => showToast("Results copied to clipboard!", "success"));
}

function newAnalysis() {
  hideAllSections();
  $("reviewTextarea").value = "";
  $("charCount").textContent = "0 chars";
  AppState.currentScenario = null;
  AppState.fileContent = null;
  AppState.urlFetchedReviews = null;
  AppState.saarmingReviews = null;
  AppState.saarmingResult = null;
  AppState.saarmingCompareData = null;
  AppState.lastResult = null;
  // Remove any injected SaarMind verdict card
  const smCard = $("saarmingVerdictCard");
  if (smCard) smCard.remove();
  const smWinner = $("saarmingWinnerCard");
  if (smWinner) smWinner.remove();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── UI Helpers ────────────────────────────────────────────────
function setAnalyzingState(loading) {
  const btn = $("analyzeBtn");
  btn.classList.toggle("loading", loading);
  btn.disabled = loading;
  btn.querySelector(".btn-text-content").textContent = loading
    ? "Analyzing..."
    : "✨ Analyze Reviews";
}

let toastTimeout;
function showToast(message, type = "info") {
  // Remove existing toast
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  clearTimeout(toastTimeout);

  const toast = document.createElement("div");
  toast.className = "toast";
  const colors = { success: "var(--success)", error: "var(--error)", info: "var(--info)" };
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    padding: 12px 20px;
    background: var(--bg-secondary);
    border: 1px solid ${colors[type] || colors.info};
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: toastIn 0.3s ease;
    max-width: 320px;
    line-height: 1.4;
  `;

  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  toast.textContent = `${icons[type] || "ℹ️"} ${message}`;
  document.body.appendChild(toast);

  toastTimeout = setTimeout(() => {
    toast.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Add toast animations to document
const toastStyles = document.createElement("style");
toastStyles.textContent = `
  @keyframes toastIn  { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
  @keyframes toastOut { from { opacity:1; transform: translateY(0); } to { opacity:0; transform: translateY(12px); } }
`;
document.head.appendChild(toastStyles);

function escHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── SaarMind UI ───────────────────────────────────────────────
function initSaarming() {
  // Mode toggle: Single ↔ Compare
  $$("#saarmingModeRow .sm-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("#saarmingModeRow .sm-mode-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.dataset.mode;
      $("saarmingSinglePanel").style.display  = mode === "single"  ? "" : "none";
      $("saarmingComparePanel").style.display = mode === "compare" ? "" : "none";
      // Reset status
      $("saarmingFetchStatus").style.display  = "none";
      $("saarmingFetchedPreview").style.display = "none";
    });
  });

  // Domain hint on keystroke
  $("saarmingPlaceInput").addEventListener("input", () => {
    const val = $("saarmingPlaceInput").value.trim();
    const hint = $("saarmingDomainHint");
    if (!val) { hint.textContent = ""; return; }
    const { icon, label } = SaarmingClient.detectDomainFromName(val);
    hint.innerHTML = `${icon} Detected as <strong>${label}</strong>`;
  });

  // Fetch on Enter
  $("saarmingPlaceInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") saarmingFetchSingle();
  });

  // Fetch button
  $("saarmingFetchBtn").addEventListener("click", saarmingFetchSingle);

  // Compare button
  $("saarmingCompareBtn2").addEventListener("click", saarmingFetchCompare);
}

async function saarmingFetchSingle() {
  const placeName = $("saarmingPlaceInput").value.trim();
  if (!placeName) { showToast("Please enter a place name", "error"); return; }

  const btn = $("saarmingFetchBtn");
  const btnText = $("saarmingFetchBtnText");
  const status  = $("saarmingFetchStatus");

  btn.disabled = true;
  btnText.textContent = "⏳ Fetching...";
  status.style.display = "block";
  status.innerHTML = `<div style="color:var(--text-secondary); font-size:13px;">🌐 Calling Apify Google Maps scraper for <strong>${escHtml(placeName)}</strong>...</div>`;
  $("saarmingFetchedPreview").style.display = "none";

  try {
    const data = await SaarmingClient.fetch(placeName);

    AppState.saarmingReviews = data.reviews;
    AppState.saarmingResult  = data;
    AppState.saarmingCompareData = null;

    const trendLabel = data.saarming?.trend?.label || "➡️ Stable";
    const conf       = data.saarming?.confidence || "Low";
    const lowNote    = data.saarming?.lowSample
      ? `<div style="color:var(--warning); font-size:12px; margin-top:4px;">⚠️ Low sample — treat verdict as indicative only.</div>` : "";

    status.innerHTML = `
      <div style="color:var(--success); font-size:13px;">
        ✅ Fetched <strong>${data.count}</strong> Google Maps reviews
        ${data.totalReviewsOnGoogle ? `(of ${data.totalReviewsOnGoogle.toLocaleString()} total)` : ""}
      </div>
      <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
        📅 Trend: ${trendLabel} &nbsp;·&nbsp; 🎯 Confidence: ${conf}
        ${data.saarming?.trend?.reason ? `<br>"${escHtml(data.saarming.trend.reason)}"` : ""}
      </div>
      ${lowNote}`;

    // Preview
    $("saarmingFetchedPreview").style.display = "block";
    const preview = data.reviews
      .slice(0, 5)
      .map((r, i) => `${i + 1}. ${r.rating ? `[${r.rating}★] ` : ""}${r.text}`)
      .join("\n\n");
    $("saarmingFetchedText").value =
      preview + (data.reviews.length > 5 ? `\n\n...and ${data.reviews.length - 5} more` : "");

    showToast(`Fetched ${data.count} Google Maps reviews`, "success");
  } catch (e) {
    status.innerHTML = `<div style="color:var(--error); font-size:13px;">❌ ${escHtml(e.message)}</div>`;
    showToast("SaarMind fetch failed", "error");
  } finally {
    btn.disabled = false;
    btnText.textContent = "📍 Fetch Google Reviews";
  }
}

async function saarmingFetchCompare() {
  const p1 = $("saarmingCompare1").value.trim();
  const p2 = $("saarmingCompare2").value.trim();
  const p3 = $("saarmingCompare3").value.trim();

  const placeNames = [p1, p2, p3].filter(Boolean);
  if (placeNames.length < 2) { showToast("Please enter at least 2 place names", "error"); return; }

  const btn     = $("saarmingCompareBtn2");
  const btnText = $("saarmingCompareBtnText");
  const status  = $("saarmingFetchStatus");

  btn.disabled = true;
  btnText.textContent = "⏳ Fetching...";
  status.style.display = "block";
  status.innerHTML = `<div style="color:var(--text-secondary); font-size:13px;">🌐 Fetching reviews for ${placeNames.length} places sequentially...</div>`;
  $("saarmingFetchedPreview").style.display = "none";

  try {
    const data = await SaarmingClient.compare(placeNames);
    AppState.saarmingCompareData = data;

    // Use the first successful place's reviews for Gemini analysis
    const first = (data.results || []).find((r) => !r.error && r.reviews?.length);
    if (first) {
      AppState.saarmingReviews = first.reviews;
      AppState.saarmingResult  = first;
    }

    const successCount = (data.results || []).filter((r) => !r.error).length;
    status.innerHTML = `<div style="color:var(--success); font-size:13px;">✅ Fetched reviews for ${successCount}/${placeNames.length} places.</div>`;

    // Show winner card summary
    if (data.winnerCard) {
      status.innerHTML += `
        <div style="font-size:12px; color:var(--text-muted); margin-top:6px;">
          🏆 Best overall: <strong>${escHtml(data.winnerCard.bestOverall)}</strong>
          ${data.winnerCard.bestScore ? `(${data.winnerCard.bestScore}⭐)` : ""}
        </div>`;
    }

    showToast(`Comparison ready for ${successCount} places`, "success");
  } catch (e) {
    status.innerHTML = `<div style="color:var(--error); font-size:13px;">❌ ${escHtml(e.message)}</div>`;
    showToast("Compare fetch failed", "error");
  } finally {
    btn.disabled = false;
    btnText.textContent = "⚖️ Compare All Places";
  }
}

/**
 * Inject the SaarMind verdict card into the results section,
 * below the existing standard cards.
 */
function injectSaarmingVerdictCard(analysis) {
  // Remove any old card
  const old = $("saarmingVerdictCard");
  if (old) old.remove();
  const oldW = $("saarmingWinnerCard");
  if (oldW) oldW.remove();

  const resultsSection = $("resultsSection");

  // Single-place verdict card
  const cardHtml = SaarmingClient.buildVerdictCard(AppState.saarmingResult, analysis);
  const wrapper  = document.createElement("div");
  wrapper.innerHTML = cardHtml;
  resultsSection.appendChild(wrapper.firstElementChild);

  // Compare winner card (if multi-place run)
  if (AppState.saarmingCompareData) {
    const winnerHtml = SaarmingClient.buildWinnerCard(AppState.saarmingCompareData);
    const winWrapper = document.createElement("div");
    winWrapper.innerHTML = winnerHtml;
    resultsSection.appendChild(winWrapper.firstElementChild);
  }

  // Smooth scroll to it
  setTimeout(() => {
    $("saarmingVerdictCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 400);
}
