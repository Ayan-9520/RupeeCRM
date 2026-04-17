/**
 * Course library skeleton — Learn & Earn academy
 * Static catalog for the launch. Once Phase 3 ships, this will be backed by a
 * `courses` + `course_modules` + `course_progress` table set in Lovable Cloud
 * and replaced with live data + auto-generated content via the AI Trainer.
 */

export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type CourseCategory = "loan" | "insurance" | "credit_card" | "investment" | "sales" | "compliance";

export type CourseModule = {
  key: string;
  title: string;
  duration_min: number;
  type: "video" | "reading" | "script" | "quiz" | "certificate";
  summary: string;
};

export type Course = {
  slug: string;
  title: string;
  tagline: string;
  category: CourseCategory;
  level: CourseLevel;
  duration_min: number;
  lessons: number;
  reward_points: number;
  unlock: string;
  badge: string;
  hero_color: string;
  outcomes: string[];
  modules: CourseModule[];
};

const STANDARD_MODULES = (productLabel: string, useCases: string[]): CourseModule[] => [
  {
    key: "basics",
    title: `Module 1 — ${productLabel} basics`,
    duration_min: 12,
    type: "reading",
    summary: `What is ${productLabel}, who buys it and key use-cases: ${useCases.join(", ")}.`,
  },
  {
    key: "eligibility",
    title: "Module 2 — Eligibility & documents",
    duration_min: 10,
    type: "reading",
    summary: "Income, age, CIBIL bands, employment proofs, KYC checklist.",
  },
  {
    key: "pitch",
    title: "Module 3 — Pitch & objection handling",
    duration_min: 18,
    type: "script",
    summary: "Short + long pitch scripts, top 10 objections with proven counters.",
  },
  {
    key: "process",
    title: "Module 4 — End-to-end process",
    duration_min: 14,
    type: "video",
    summary: "Lead → Documents → Lender → Sanction → Disbursal → Payout.",
  },
  {
    key: "quiz",
    title: "Module 5 — Quiz (pass ≥ 70%)",
    duration_min: 8,
    type: "quiz",
    summary: "10 MCQs covering eligibility, pitch and process.",
  },
  {
    key: "cert",
    title: "Module 6 — Certificate & badge",
    duration_min: 2,
    type: "certificate",
    summary: "Auto-generated certificate, badge unlocked on your profile.",
  },
];

export const COURSES: Course[] = [
  {
    slug: "personal-loan-pro",
    title: "Personal Loan Pro",
    tagline: "Close more PL deals — from CIBIL profiling to disbursal.",
    category: "loan",
    level: "beginner",
    duration_min: 64,
    lessons: 6,
    reward_points: 250,
    unlock: "Premium PL leads + 0.5% extra commission",
    badge: "PL Certified",
    hero_color: "from-blue-500/30 to-blue-500/5",
    outcomes: [
      "Qualify any salaried/self-employed customer in under 60 seconds",
      "Match the right lender by CIBIL band & income slab",
      "Handle 'why is rate of interest high?' with confidence",
    ],
    modules: STANDARD_MODULES("Personal Loan", ["debt consolidation", "medical", "wedding", "travel"]),
  },
  {
    slug: "business-loan-mastery",
    title: "Business Loan Mastery",
    tagline: "Unsecured BL, working capital & MSME — sanction faster.",
    category: "loan",
    level: "intermediate",
    duration_min: 72,
    lessons: 6,
    reward_points: 300,
    unlock: "BL high-ticket leads + priority lender queue",
    badge: "BL Certified",
    hero_color: "from-cyan-500/30 to-cyan-500/5",
    outcomes: [
      "Read GST returns, bank statements & ITRs in 2 minutes",
      "Pick BL vs OD vs MSME for the right customer",
      "Negotiate processing fee waivers with channel managers",
    ],
    modules: STANDARD_MODULES("Business Loan", ["expansion", "working capital", "machinery", "GST top-up"]),
  },
  {
    slug: "home-loan-expert",
    title: "Home Loan Expert",
    tagline: "HL + Balance Transfer + Top-up — the highest-paying vertical.",
    category: "loan",
    level: "advanced",
    duration_min: 95,
    lessons: 6,
    reward_points: 400,
    unlock: "HL pre-approved leads + 1% extra commission",
    badge: "HL Certified",
    hero_color: "from-indigo-500/30 to-indigo-500/5",
    outcomes: [
      "Master legal/technical valuation timelines",
      "Pitch BT + Top-up to existing HL customers",
      "Handle PEMI, Pre-EMI & moratorium queries",
    ],
    modules: STANDARD_MODULES("Home Loan", ["new purchase", "balance transfer", "top-up", "construction"]),
  },
  {
    slug: "lap-specialist",
    title: "LAP Specialist",
    tagline: "Loan Against Property — high-ticket, high-payout.",
    category: "loan",
    level: "advanced",
    duration_min: 80,
    lessons: 6,
    reward_points: 350,
    unlock: "LAP leads ≥ ₹50L + diamond-tier payout",
    badge: "LAP Certified",
    hero_color: "from-violet-500/30 to-violet-500/5",
    outcomes: [
      "Calculate LTV across residential, commercial & industrial",
      "Spot title issues before lender legal does",
      "Position LAP vs BL for self-employed customers",
    ],
    modules: STANDARD_MODULES("Loan Against Property", ["business expansion", "debt consolidation", "education abroad"]),
  },
  {
    slug: "health-insurance-advisor",
    title: "Health Insurance Advisor",
    tagline: "Sell health policies that customers actually claim — IRDAI-aligned.",
    category: "insurance",
    level: "beginner",
    duration_min: 70,
    lessons: 6,
    reward_points: 280,
    unlock: "Health pre-qualified leads + renewal commission share",
    badge: "Health Certified",
    hero_color: "from-emerald-500/30 to-emerald-500/5",
    outcomes: [
      "Compare sum insured, room rent, co-pay across insurers",
      "Explain PED, waiting period & no-claim bonus simply",
      "Position family floater vs individual",
    ],
    modules: STANDARD_MODULES("Health Insurance", ["family floater", "senior citizen", "critical illness", "top-up"]),
  },
  {
    slug: "credit-card-closer",
    title: "Credit Card Closer",
    tagline: "Match the customer to the card — and keep approvals high.",
    category: "credit_card",
    level: "beginner",
    duration_min: 50,
    lessons: 6,
    reward_points: 200,
    unlock: "Premium card leads + ₹500 bonus per activation",
    badge: "Card Certified",
    hero_color: "from-orange-500/30 to-orange-500/5",
    outcomes: [
      "Pick the right card for every income & spend pattern",
      "Reduce rejections with pre-screening questions",
      "Drive activation with first-spend playbooks",
    ],
    modules: STANDARD_MODULES("Credit Cards", ["cashback", "travel/miles", "fuel", "premium metal cards"]),
  },
  {
    slug: "compliance-fairlending",
    title: "Compliance & Fair Lending",
    tagline: "RBI, IRDAI, SEBI rules every DSA must follow — mandatory.",
    category: "compliance",
    level: "beginner",
    duration_min: 40,
    lessons: 5,
    reward_points: 150,
    unlock: "Verified DSA badge — required to access leadboard",
    badge: "Compliance Verified",
    hero_color: "from-slate-500/30 to-slate-500/5",
    outcomes: [
      "Understand DNC, do-not-disturb & call recording rules",
      "Handle PII (Aadhaar, PAN, bank) safely",
      "Avoid mis-selling traps that get DSAs banned",
    ],
    modules: STANDARD_MODULES("Compliance", ["KYC", "DNC", "data privacy", "mis-selling red flags"]),
  },
  {
    slug: "sales-fundamentals",
    title: "Sales Fundamentals",
    tagline: "The mindset, calls and follow-ups that 10× your closures.",
    category: "sales",
    level: "beginner",
    duration_min: 55,
    lessons: 6,
    reward_points: 180,
    unlock: "+10% lead-allocation priority for 30 days",
    badge: "Sales Pro",
    hero_color: "from-amber-500/30 to-amber-500/5",
    outcomes: [
      "Build a daily call discipline that converts",
      "Use the 3-touch follow-up framework",
      "Track funnel & fix the leaky stage in CRM",
    ],
    modules: STANDARD_MODULES("Sales Fundamentals", ["cold calls", "WhatsApp follow-up", "objection handling"]),
  },
];

export const CATEGORY_LABEL: Record<CourseCategory, string> = {
  loan: "Loans",
  insurance: "Insurance",
  credit_card: "Credit Cards",
  investment: "Investments",
  sales: "Sales",
  compliance: "Compliance",
};

export const LEVEL_LABEL: Record<CourseLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function getCourse(slug: string) {
  return COURSES.find((c) => c.slug === slug);
}
