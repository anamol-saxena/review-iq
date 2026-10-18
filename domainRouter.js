// ============================================================
// Universal Review Analyzer — Domain Router
// Detects the review domain and selects the appropriate schema
// ============================================================

const DomainRouter = {
  /**
   * Domain schemas define the thematic categories Gemini should evaluate
   * These are the domain-specific lenses that make the analysis smart
   */
  SCHEMAS: {
    hotel: {
      label: "Hotel & Resort",
      icon: "🏨",
      color: "#7c3aed",
      categories: [
        { key: "location",      label: "Location & Accessibility", icon: "📍" },
        { key: "cleanliness",   label: "Cleanliness & Hygiene",    icon: "✨" },
        { key: "staff",         label: "Staff & Service",          icon: "👤" },
        { key: "sleep_quality", label: "Sleep Quality & Comfort",  icon: "🛏️" },
        { key: "food",          label: "Food & Dining",            icon: "🍽️" },
        { key: "value",         label: "Value for Money",          icon: "💰" },
        { key: "amenities",     label: "Amenities & Facilities",   icon: "🏊" },
        { key: "wifi",          label: "WiFi & Connectivity",      icon: "📶" },
      ],
      keywords: ["hotel", "resort", "hotel room", "check-in", "checkout", "front desk", "housekeeping",
                 "resort pool", "hotel lobby", "suite", "concierge", "pillow", "breakfast included",
                 "spa resort", "hotel gym", "beachfront", "room service", "overnight stay", "accommodation", "airbnb",
                 "treehouse", "hostel", "guesthouse", "lodge", "valet", "hotel staff"],
    },

    restaurant: {
      label: "Restaurant & Dining",
      icon: "🍽️",
      color: "#f59e0b",
      categories: [
        { key: "food_quality",  label: "Food Quality & Taste",    icon: "🍴" },
        { key: "service",       label: "Service & Staff",         icon: "👨‍🍳" },
        { key: "ambiance",      label: "Ambiance & Atmosphere",   icon: "✨" },
        { key: "value",         label: "Value for Money",         icon: "💰" },
        { key: "wait_time",     label: "Wait Times",              icon: "⏱️" },
        { key: "portions",      label: "Portion Size",            icon: "🍱" },
        { key: "menu_variety",  label: "Menu Variety",            icon: "📋" },
        { key: "cleanliness",   label: "Cleanliness",             icon: "🧹" },
      ],
      keywords: ["restaurant", "food", "menu", "waiter", "waitress", "dish", "cuisine",
                 "meal", "dinner", "lunch", "breakfast", "brunch", "chef", "cook",
                 "table", "reservation", "appetizer", "dessert", "drinks", "bar",
                 "cafe", "café", "eatery", "diner", "bistro", "pub", "brewery", "beer",
                 "nachos", "burger", "pizza", "sushi", "zomato", "swiggy"],
    },

    electronics: {
      label: "Electronics & Gadgets",
      icon: "💻",
      color: "#06b6d4",
      categories: [
        { key: "performance",   label: "Performance & Speed",     icon: "⚡" },
        { key: "battery",       label: "Battery Life",            icon: "🔋" },
        { key: "build_quality", label: "Build Quality",           icon: "🔧" },
        { key: "sound",         label: "Sound / Display Quality", icon: "🔊" },
        { key: "value",         label: "Value for Money",         icon: "💰" },
        { key: "ease_of_use",   label: "Ease of Use",             icon: "🎯" },
        { key: "software",      label: "Software & Ecosystem",    icon: "📱" },
        { key: "after_sales",   label: "After-Sales Support",     icon: "🛠️" },
      ],
      keywords: ["headphone", "headphones", "earbuds", "speaker", "laptop", "phone",
                 "smartphone", "tablet", "watch", "smartwatch", "camera", "battery",
                 "noise cancelling", "anc", "bluetooth", "wifi", "processor", "ram",
                 "display", "screen", "resolution", "performance", "app", "software",
                 "warranty", "amazon", "flipkart", "samsung", "sony", "apple", "dell",
                 "charger", "cable", "wireless"],
    },

    ecommerce: {
      label: "E-Commerce Product",
      icon: "📦",
      color: "#10b981",
      categories: [
        { key: "build_quality",      label: "Build Quality & Materials",   icon: "🔧" },
        { key: "performance",        label: "Performance & Functionality", icon: "⚡" },
        { key: "ease_of_use",        label: "Ease of Use & Assembly",      icon: "🎯" },
        { key: "value",              label: "Value for Money",             icon: "💰" },
        { key: "design_portability", label: "Design & Portability",        icon: "📐" },
        { key: "durability",         label: "Durability & Reliability",    icon: "⭐" },
        { key: "support_manuals",    label: "Support & Documentation",     icon: "📋" },
        { key: "packaging_delivery", label: "Packaging & Delivery",        icon: "📦" },
      ],
      keywords: ["product", "machine", "device", "treadmill", "walking pad", "fitness", "exercise",
                 "motor", "speed", "compact", "remote", "setup", "assembly", "manual",
                 "workout", "equipment", "build quality", "weight", "durable", "sturdy",
                 "delivery", "shipped", "packaging", "box", "arrived", "seller", "amazon", "flipkart",
                 "return", "refund", "exchange", "order", "price", "brand", "item", "purchase"],
    },
  },

  /**
   * Auto-detect the domain from review text content
   * @param {Array} reviews - Processed review objects
   * @param {string} manualOverride - If user selected a domain manually
   * @param {Array<string>|null} allowedDomains - Optional subset of domains allowed
   * @returns {string} Domain key
   */
  detectDomain(reviews, manualOverride = "auto", allowedDomains = null) {
    if (manualOverride && manualOverride !== "auto") {
      return manualOverride;
    }

    const combinedText = reviews.map(r => r.text).join(" ").toLowerCase();
    const scores = {};

    const candidateSchemas = allowedDomains && Array.isArray(allowedDomains) && allowedDomains.length > 0
      ? Object.entries(this.SCHEMAS).filter(([d]) => allowedDomains.includes(d))
      : Object.entries(this.SCHEMAS);

    for (const [domain, schema] of candidateSchemas) {
      scores[domain] = schema.keywords.filter(kw => combinedText.includes(kw.toLowerCase())).length;
    }

    // Return domain with highest keyword match
    const detected = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    if (detected && detected[1] > 0) {
      return detected[0];
    }

    // Fallback: first allowed domain, or ecommerce
    if (allowedDomains && allowedDomains.length > 0) {
      return allowedDomains[0];
    }
    return "ecommerce";
  },

  /**
   * Get schema for a domain
   */
  getSchema(domain) {
    return this.SCHEMAS[domain] || this.SCHEMAS.electronics;
  },

  /**
   * Build the domain-aware prompt context for Gemini
   * This is the key piece that separates a copilot from a simple summarizer
   */
  buildDomainContext(domain) {
    const schema = this.getSchema(domain);
    const categoryList = schema.categories
      .map(c => `- ${c.label} (key: "${c.key}")`)
      .join("\n");

    return {
      domainLabel: schema.label,
      categoryList,
      categoryKeys: schema.categories.map(c => c.key),
      outputSchema: schema.categories.reduce((acc, c) => {
        acc[c.key] = { label: c.label, score: 0, summary: "", pros: [], cons: [], contradictions: [] };
        return acc;
      }, {}),
    };
  },
};
