// ============================================================
// BiovisOutreachAgent.jsx
// Expert Vision Labs Pvt. Ltd. — Biovis® Sales Outreach Agent
// ============================================================

// ─────────────────────────────────────────────
// SHARED SIGNATURE (appended to every email)
// ─────────────────────────────────────────────
const SIGNATURE = `Best Regards,
Harshal Hegde
Expert Vision Labs Pvt. Ltd.
Ground Floor, 102 Anandi Building, Dr. M.B. Raut Road, Dadar (West)
Mumbai – 400028, Maharashtra, India
Tel: +91 22 2444 2565 / +91 22 2444 2566
Mobile: +91 85915 86471
Website: www.expertvisionlabs.com
Email: harshalhegde@expertvisionlabs.com
Brand: Biovis® — Advanced Image Analysis Scientific Instruments`;

// ─────────────────────────────────────────────
// SECTOR TEMPLATES
// Keys: "Pharmaceutical" | "Industrial" | "Agriculture" | "Human Science" | "Life Science"
// Each provides:
//   applicationBlock  → bullet list of sector-specific use cases (plain text, \n separated)
//   sectorContext     → one-sentence positioning line for the intro paragraph
// ─────────────────────────────────────────────
export const SECTOR_TEMPLATES = {
  Pharmaceutical: {
    sectorContext:
      "pharmaceutical research, quality control, and regulatory compliance",
    applicationBlock: `Key applications in your sector:
• Particle size, shape & colour analysis for APIs and excipients
• Automated visual inspection of tablets, capsules, and injectables
• Cell viability and colony imaging for biologics development
• Formulation reverse engineering and pellet coating evaluation
• Regulatory documentation for ANDA/NDA submissions (USP 776 & 695, 21 CFR Part 11)
• Integration with existing microscopy setups (Leica, Olympus, Nikon)`,
  },

  Industrial: {
    sectorContext:
      "industrial manufacturing, process quality control, and surface inspection",
    applicationBlock: `Key applications in your sector:
• Automated in-line and off-line defect detection on production lines
• Dimensional measurement and surface texture analysis
• Powder, granule & particle characterization for process industries
• Visual inspection of coatings, films, and structural components
• Real-time statistical reporting for production QC`,
  },

  Agriculture: {
    sectorContext:
      "agricultural research, seed science, and agri-input quality control",
    applicationBlock: `Key applications in your sector:
• Seed quality assessment, germination analysis & morphological classification
• Soil particle and organic matter characterization
• Fertiliser and pesticide particle size, shape & colour analysis
• Plant pathology imaging and pest morphology identification
• Post-harvest quality inspection using automated image analysis`,
  },

  "Human Science": {
    sectorContext:
      "human science research, clinical diagnostics, and laboratory medicine",
    applicationBlock: `Key applications in your sector:
• Automated blood cell morphology and differential counting
• Histological tissue imaging, measurement and annotation
• Wound measurement and dermatological imaging for clinical trials
• Microbiological colony counting and characterization
• Urinalysis particle identification and classification`,
  },

  "Life Science": {
    sectorContext:
      "life science research, bioassay development, and drug discovery",
    applicationBlock: `Key applications in your sector:
• Cell viability, proliferation, and morphology assays
• Fluorescence and brightfield imaging for cell biology
• Microbial colony counting and drug screening workflows
• Particle and vesicle analysis for genomics and proteomics
• Automated imaging for toxicology and HCS studies`,
  },
};

// ─────────────────────────────────────────────
// PRODUCT TEMPLATES
// Keys must match the `id` values used in CampaignPreview.jsx's EMAIL_TEMPLATES array.
// Each provides:
//   displayName    → human-readable product name (used in body text)
//   subject        → fn(firstName, company) → email subject string
//   intro          → fn(firstName, company, sectorContext) → opening paragraph
//   productBlock   → multi-line string describing the product's key features
// ─────────────────────────────────────────────
export const PRODUCT_TEMPLATES = {
  // ── Biovis PSA 2000 ──────────────────────────────────────────
  biovis_psa: {
    displayName: "Biovis® PSA 2000",
    subject: (firstName, company) =>
      `Biovis® PSA 2000 — Advanced Particle Characterization for ${company || "Your Organisation"}`,
    intro: (firstName, company, sectorContext) =>
      `I am writing on behalf of Expert Vision Labs Pvt. Ltd. to introduce our flagship product — the Biovis® PSA 2000 — an advanced image-based particle characterization system purpose-built for ${sectorContext}. This platform goes far beyond conventional particle sizing by delivering quantitative analysis of particle size, shape, and colour in a single automated workflow.`,
    productBlock: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Biovis® PSA 2000 — Particle Size, Shape & Colour Analyzer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Quantitative analysis of particle Size, Shape & Colour
• Batch-wise and continuous sampling for dry & liquid formulations
• AI/ML-assisted classification of crystalline/amorphous structures
• USP 776 & 695 compliant | 21 CFR Part 11 ready
• High-resolution imaging with full statistical reporting
• Time-lapse tracking and particle migration studies
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },

  // ── Biovis FPS ───────────────────────────────────────────────
  biovis_fps: {
    displayName: "Biovis® FPS",
    subject: (firstName, company) =>
      `Biovis® FPS — Automated Filter/Fiber Particle System for ${company || "Your Organisation"}`,
    intro: (firstName, company, sectorContext) =>
      `I am writing from Expert Vision Labs Pvt. Ltd. to introduce the Biovis® FPS — our Filter/Fiber Particle System — designed for precise identification, counting, and characterization of particulate matter on filter membranes. This system is specifically engineered for ${sectorContext} where regulatory compliance and contamination control are critical.`,
    productBlock: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Biovis® FPS — Filter/Fiber Particle System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Automated particle detection and counting on filter membranes
• Fibre, filament & foreign particle identification
• Compliant with USP <788>, USP <789>, EU GMP Annex 1
• Darkfield and brightfield illumination for contrast-rich imaging
• Full audit trail and regulatory-ready PDF reporting
• Suitable for injectable, ophthalmic & parenteral product QC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },

  // ── Biovis MP ────────────────────────────────────────────────
  biovis_mp: {
    displayName: "Biovis® MP",
    subject: (firstName, company) =>
      `Biovis® MP — Micro-Particle Analyzer for ${company || "Your Organisation"}`,
    intro: (firstName, company, sectorContext) =>
      `I am reaching out from Expert Vision Labs Pvt. Ltd. to introduce the Biovis® MP — our dedicated Micro-Particle Analyzer — engineered for high-sensitivity detection and characterization of sub-visible and micro-scale particles. The system is well-suited for demanding applications in ${sectorContext} where particle purity and size distribution directly impact product quality and compliance.`,
    productBlock: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Biovis® MP — Micro-Particle Analyzer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Detection and characterization of micro and sub-visible particles
• Size range from 2 µm to several millimetres
• High-throughput automated image capture and analysis
• Morphological classification: spherical, fibrous, irregular
• Compliant with USP <788> for injectable particulate testing
• Compatible with aqueous and non-aqueous sample matrices
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },

  // ── Biovis IP ────────────────────────────────────────────────
  biovis_ip: {
    displayName: "Biovis® IP",
    subject: (firstName, company) =>
      `Biovis® IP — Automated Image-Based Particle Identification for ${company || "Your Organisation"}`,
    intro: (firstName, company, sectorContext) =>
      `I am writing on behalf of Expert Vision Labs Pvt. Ltd. to introduce the Biovis® IP — our Image-based Particle Identification platform — which combines high-resolution microscopy with advanced pattern recognition to classify and identify particles by morphology, colour, and texture. It is specifically designed for ${sectorContext}, enabling rapid root-cause analysis and contamination investigations.`,
    productBlock: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Biovis® IP — Image-Based Particle Identification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Morphology-based particle identification and classification
• Colour, texture & shape descriptors for unknown particle typing
• Library-based matching for known contaminant profiles
• Root-cause and contamination investigation workflows
• Supports reflected and transmitted light imaging modes
• Exportable reports with annotated particle images
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },

  // ── Cell Analysis ────────────────────────────────────────────
  cell_analysis: {
    displayName: "Biovis® Cell Analysis Suite",
    subject: (firstName, company) =>
      `Biovis® Cell Analysis Suite — Automated Cell Imaging for ${company || "Your Organisation"}`,
    intro: (firstName, company, sectorContext) =>
      `I am writing from Expert Vision Labs Pvt. Ltd. to introduce our Biovis® Cell Analysis Suite — a comprehensive automated imaging platform for cell counting, viability assessment, and morphological profiling. Designed for ${sectorContext}, this system eliminates manual haemocytometer counting and brings reproducible, high-throughput cell analysis to your laboratory.`,
    productBlock: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Biovis® Cell Analysis Suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Automated cell counting and viability (live/dead discrimination)
• Brightfield and fluorescence imaging modes
• Morphological profiling: size, circularity, nuclear features
• Batch processing for high-throughput screening
• Trypan blue and AO/PI fluorescent dye compatibility
• Exportable data to LIMS, Excel, and PDF formats
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },

  // ── Generic / All Products ───────────────────────────────────
  biovis_all: {
    displayName: "Biovis® Product Range",
    subject: (firstName, company) =>
      `Biovis® Advanced Image Analysis Instruments — Introduction for ${company || "Your Organisation"}`,
    intro: (firstName, company, sectorContext) =>
      `I am writing from Expert Vision Labs Pvt. Ltd. to introduce our Biovis® range of advanced image analysis-based scientific instruments — covering particle characterization, filter particle analysis, micro-particle detection, cell imaging, and contamination identification. Our solutions are actively deployed in ${sectorContext} to bring accuracy, automation, and regulatory compliance to analytical workflows.`,
    productBlock: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Biovis® Product Range — Overview
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Biovis® PSA 2000 — Particle Size, Shape & Colour Analyzer
• Biovis® FPS — Filter/Fiber Particle System (USP <788>, <789>)
• Biovis® IP — Image-Based Particle Identification Platform
• Biovis® Cell Analysis Suite — Automated Cell Counting & Viability
• Backpack Based Portable Freezer for cold chain Sample Transportation 
All instruments feature: AI-assisted classification | 21 CFR Part 11
compliance | high-resolution imaging | regulatory-ready reporting
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },

  // ── Generic / All Products Exhibition Intro ───────────────────────────────────
   biovis_all: {
    displayName: "Biovis® Exhibition Intro",
    subject: (firstName, company) =>
      `Biovis® Advanced Image Analysis Instruments — Introduction for ${company || "Your Organisation"}`,
    intro: (firstName, company, sectorContext) =>
      `I am writing from Expert Vision Labs Pvt. Ltd. thankyou for visting our stall and I like to introduce our Biovis® range of advanced image analysis-based scientific instruments — covering particle characterization, filter particle analysis, micro-particle detection, cell imaging, and contamination identification. Our solutions are actively deployed in ${sectorContext} to bring accuracy, automation, and regulatory compliance to analytical workflows.`,
    productBlock: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Biovis® Product Range — Overview
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Biovis® PSA 2000 — Particle Size, Shape & Colour Analyzer
• Biovis® FPS — Filter/Fiber Particle System (USP <788>, <789>)
• Biovis® IP — Image-Based Particle Identification Platform
• Biovis® Cell Analysis Suite — Automated Cell Counting & Viability
• Biovis ALM - Automated Detection of SEM/TEM Images
• Backpack Based Portable Freezer for cold chain Sample Transportation 
All instruments feature: AI-assisted classification | 21 CFR Part 11
compliance | high-resolution imaging | regulatory-ready reporting
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  },

};

// ─────────────────────────────────────────────
// SECTOR NORMALIZER
// ─────────────────────────────────────────────
export function normalizeSector(raw) {
  if (!raw) return "Pharmaceutical";
  const s = raw.toString().toLowerCase();
  if (s.includes("pharma") || s.includes("drug") || s.includes("api"))
    return "Pharmaceutical";
  if (s.includes("industr") || s.includes("manufactur") || s.includes("chem"))
    return "Industrial";
  if (s.includes("agri") || s.includes("seed") || s.includes("farm") || s.includes("crop"))
    return "Agriculture";
  if (
    s.includes("human") ||
    s.includes("clinic") ||
    s.includes("hospital") ||
    s.includes("diagn") ||
    s.includes("medic")
  )
    return "Human Science";
  if (
    s.includes("life") ||
    s.includes("bio") ||
    s.includes("cell") ||
    s.includes("genomic") ||
    s.includes("laborat")
  )
    return "Life Science";
  return "Pharmaceutical"; // safe default
}

// ─────────────────────────────────────────────
// EMAIL COMPOSER (pure function, no side effects)
// ─────────────────────────────────────────────
function composeEmailBody(lead, productTemplate, sectorTemplate) {
  const firstName =
    (lead.personName || lead.name || "")
      .replace(/^(dr\.|mr\.|ms\.|mrs\.|prof\.)\s*/i, "")
      .split(" ")[0]
      .trim() || "Sir/Madam";

  const company = (lead.company || "").trim();

  const greeting = `Respected ${firstName},`;
  const openingLine = `Greetings from Expert Vision Labs!`;
  const introText = productTemplate.intro(firstName, company, sectorTemplate.sectorContext);
  const productBlock = productTemplate.productBlock;
  const applicationBlock = sectorTemplate.applicationBlock;
  const closingText = `We would be delighted to schedule an on-site demonstration or a brief product overview call at your convenience. Please feel free to reach out — we look forward to supporting your analytical goals.`;

  return [
    greeting,
    "",
    openingLine,
    "",
    introText,
    "",
    productBlock,
    "",
    applicationBlock,
    "",
    closingText,
    "",
    SIGNATURE,
  ].join("\n");
}

// ─────────────────────────────────────────────
// PUBLIC API — called by CampaignPreview.jsx
// Signature: buildEmailDraftFromLead(lead, templateId) → { to, subject, body }
// ─────────────────────────────────────────────
export function buildEmailDraftFromLead(lead, templateId = "biovis_psa") {
  // 1. Resolve sector
  const rawSector = lead.sector || lead.industry || "";
  const sector = normalizeSector(rawSector);
  const sectorTemplate = SECTOR_TEMPLATES[sector] || SECTOR_TEMPLATES["Pharmaceutical"];

  // 2. Resolve product template (fall back to PSA if unknown id)
  const productTemplate =
    PRODUCT_TEMPLATES[templateId] || PRODUCT_TEMPLATES["biovis_psa"];

  // 3. Derive firstName + company for subject line
  const firstName =
    (lead.personName || lead.name || "")
      .replace(/^(dr\.|mr\.|ms\.|mrs\.|prof\.)\s*/i, "")
      .split(" ")[0]
      .trim() || "Sir/Madam";
  const company = (lead.company || "").trim();

  // 4. Compose
  const subject = productTemplate.subject(firstName, company);
  const body = composeEmailBody(lead, productTemplate, sectorTemplate);
  const to = (lead.email || "").trim();

  return { to, subject, body };
}

// ─────────────────────────────────────────────
// FOLLOW-UP EMAIL BUILDER
// Same signature extension: buildFollowUpDraftFromLead(lead, templateId)
// ─────────────────────────────────────────────
export function buildFollowUpDraftFromLead(lead, templateId = "biovis_psa") {
  const rawSector = lead.sector || lead.industry || "";
  const sector = normalizeSector(rawSector);
  const sectorTemplate = SECTOR_TEMPLATES[sector] || SECTOR_TEMPLATES["Pharmaceutical"];
  const productTemplate = PRODUCT_TEMPLATES[templateId] || PRODUCT_TEMPLATES["biovis_psa"];

  const firstName =
    (lead.personName || lead.name || "")
      .replace(/^(dr\.|mr\.|ms\.|mrs\.|prof\.)\s*/i, "")
      .split(" ")[0]
      .trim() || "Sir/Madam";
  const company = (lead.company || "").trim();
  const to = (lead.email || "").trim();

  const subject = `Following up — ${productTemplate.displayName} for ${company || "Your Organisation"}`;

  const body = [
    `Respected ${firstName},`,
    "",
    "Greetings from Expert Vision Labs!",
    "",
    `I am following up on my earlier email regarding our ${productTemplate.displayName}, which I believe could add significant value to your work in ${sectorTemplate.sectorContext}.`,
    "",
    `To recap the highlights of the ${productTemplate.displayName}:`,
    "",
    productTemplate.productBlock,
    "",
    sectorTemplate.applicationBlock,
    "",
    "I would be happy to arrange a brief demonstration, share an application note, or answer any specific questions — whichever is most convenient for you.",
    "",
    SIGNATURE,
  ].join("\n");

  return { to, subject, body };
}

// ─────────────────────────────────────────────
// UTILITIES (exported for UI use if needed)
// ─────────────────────────────────────────────

/** Returns an array of { id, name } for populating dropdowns */
export function getProductTemplateList() {
  return Object.entries(PRODUCT_TEMPLATES).map(([id, tpl]) => ({
    id,
    name: tpl.displayName,
  }));
}

/** Returns an array of all supported sector names */
export function getSectorList() {
  return Object.keys(SECTOR_TEMPLATES);
}
