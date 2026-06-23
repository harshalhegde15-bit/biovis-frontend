// ============================================================
// sequences.js — Biovis Campaign Sequence Definitions
// Expert Vision Labs Pvt. Ltd.
// ============================================================
// This file defines:
//   SEQUENCES        — the 4-step follow-up sequence model
//   getSequenceForLead() — picks the right sequence per lead
//   getNextStep()    — determines what to send next and when
//   isStepDue()      — checks if a step is ready to fire
// ============================================================

// ─────────────────────────────────────────────
// SEQUENCE DEFINITIONS
// Each step defines:
//   step        → step number (1 = initial, 2-4 = follow-ups)
//   type        → "initial" | "followup"
//   templateId  → which product template to use
//   delayDays   → days after the PREVIOUS step before this fires
//   subject     → optional subject override (null = use template default)
// ─────────────────────────────────────────────
export const SEQUENCES = {

  // ── Default 4-step sequence (used for all leads unless overridden) ──
  default: {
    id: "default",
    name: "Standard 4-Step Outreach",
    description: "Initial email + 3 follow-ups over 14 days",
    steps: [
      {
        step:       1,
        type:       "initial",
        templateId: "biovis_psa",
        delayDays:  0,   // fires immediately on enrol
        subject:    null, // uses product template subject
      },
      {
        step:       2,
        type:       "followup",
        templateId: "biovis_psa",
        delayDays:  3,   // 3 days after step 1
        subject:    null,
      },
      {
        step:       3,
        type:       "followup",
        templateId: "biovis_all",  // broaden to full range on step 3
        delayDays:  7,   // 7 days after step 2
        subject:    null,
      },
      {
        step:       4,
        type:       "followup",
        templateId: "biovis_all",
        delayDays:  14,  // 14 days after step 3
        subject:    null,
      },
    ],
  },

  // ── Pharmaceutical-specific sequence ──────────────────────────
  pharmaceutical: {
    id: "pharmaceutical",
    name: "Pharma Specialist Sequence",
    description: "PSA intro → FPS compliance → MP sub-visible → All products",
    steps: [
      { step: 1, type: "initial",  templateId: "biovis_psa", delayDays: 0  },
      { step: 2, type: "followup", templateId: "biovis_fps", delayDays: 3  },
      { step: 3, type: "followup", templateId: "biovis_mp",  delayDays: 7  },
      { step: 4, type: "followup", templateId: "biovis_all", delayDays: 14 },
    ],
  },

  // ── Life Science / Cell Biology sequence ──────────────────────
  life_science: {
    id: "life_science",
    name: "Life Science Sequence",
    description: "Cell Analysis intro → PSA → IP identification → All products",
    steps: [
      { step: 1, type: "initial",  templateId: "cell_analysis", delayDays: 0  },
      { step: 2, type: "followup", templateId: "biovis_psa",    delayDays: 3  },
      { step: 3, type: "followup", templateId: "biovis_ip",     delayDays: 7  },
      { step: 4, type: "followup", templateId: "biovis_all",    delayDays: 14 },
    ],
  },

  // ── Industrial / Manufacturing sequence ───────────────────────
  industrial: {
    id: "industrial",
    name: "Industrial Sequence",
    description: "IP identification → PSA → MP → All products",
    steps: [
      { step: 1, type: "initial",  templateId: "biovis_ip",  delayDays: 0  },
      { step: 2, type: "followup", templateId: "biovis_psa", delayDays: 3  },
      { step: 3, type: "followup", templateId: "biovis_mp",  delayDays: 7  },
      { step: 4, type: "followup", templateId: "biovis_all", delayDays: 14 },
    ],
  },

  // ── Human Science / Clinical sequence ─────────────────────────
  human_science: {
    id: "human_science",
    name: "Human Science Sequence",
    description: "Cell Analysis → FPS → MP → All products",
    steps: [
      { step: 1, type: "initial",  templateId: "cell_analysis", delayDays: 0  },
      { step: 2, type: "followup", templateId: "biovis_fps",    delayDays: 3  },
      { step: 3, type: "followup", templateId: "biovis_mp",     delayDays: 7  },
      { step: 4, type: "followup", templateId: "biovis_all",    delayDays: 14 },
    ],
  },

  // ── Agriculture sequence ──────────────────────────────────────
  agriculture: {
    id: "agriculture",
    name: "Agriculture Sequence",
    description: "PSA particle analysis → IP → All products",
    steps: [
      { step: 1, type: "initial",  templateId: "biovis_psa", delayDays: 0  },
      { step: 2, type: "followup", templateId: "biovis_ip",  delayDays: 3  },
      { step: 3, type: "followup", templateId: "biovis_psa", delayDays: 7  },
      { step: 4, type: "followup", templateId: "biovis_all", delayDays: 14 },
    ],
  },
};

// ─────────────────────────────────────────────
// SECTOR → SEQUENCE MAP
// Determines which sequence a lead gets based on their sector.
// ─────────────────────────────────────────────
const SECTOR_SEQUENCE_MAP = {
  "Pharmaceutical":  "pharmaceutical",
  "Life Science":    "life_science",
  "Industrial":      "industrial",
  "Human Science":   "human_science",
  "Agriculture":     "agriculture",
};

// ─────────────────────────────────────────────
// getSequenceForLead(lead)
// Returns the full sequence object for a given lead.
// Falls back to "default" if sector has no specific sequence.
// ─────────────────────────────────────────────
export function getSequenceForLead(lead) {
  const sector     = (lead.sector || lead.industry || "").trim();
  const sequenceId = SECTOR_SEQUENCE_MAP[sector] || "default";
  return SEQUENCES[sequenceId] || SEQUENCES.default;
}

// ─────────────────────────────────────────────
// getStepDefinition(sequence, stepNumber)
// Returns the step config object for a given step number.
// ─────────────────────────────────────────────
export function getStepDefinition(sequence, stepNumber) {
  return sequence.steps.find((s) => s.step === stepNumber) || null;
}

// ─────────────────────────────────────────────
// getNextStep(sequence, currentStep)
// Returns the next step definition, or null if sequence is complete.
// ─────────────────────────────────────────────
export function getNextStep(sequence, currentStep) {
  const maxStep = sequence.steps.length;
  if (currentStep >= maxStep) return null;
  return sequence.steps.find((s) => s.step === currentStep + 1) || null;
}

// ─────────────────────────────────────────────
// isStepDue(lastSentAt, delayDays)
// Returns true if enough time has passed since the last send.
// lastSentAt: ISO string or Date object
// delayDays: number of days to wait
// ─────────────────────────────────────────────
export function isStepDue(lastSentAt, delayDays) {
  if (!lastSentAt) return false;
  const last     = new Date(lastSentAt).getTime();
  const now      = Date.now();
  const required = delayDays * 24 * 60 * 60 * 1000;
  return now - last >= required;
}

// ─────────────────────────────────────────────
// getDueDate(lastSentAt, delayDays)
// Returns the Date when the next step becomes due.
// ─────────────────────────────────────────────
export function getDueDate(lastSentAt, delayDays) {
  if (!lastSentAt) return null;
  const last = new Date(lastSentAt).getTime();
  return new Date(last + delayDays * 24 * 60 * 60 * 1000);
}

// ─────────────────────────────────────────────
// getSequenceList()
// Returns array of { id, name, description } for UI dropdowns.
// ─────────────────────────────────────────────
export function getSequenceList() {
  return Object.values(SEQUENCES).map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}

// ─────────────────────────────────────────────
// getTotalSteps(sequence)
// ─────────────────────────────────────────────
export function getTotalSteps(sequence) {
  return sequence?.steps?.length || 4;
}
