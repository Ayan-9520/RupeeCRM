// AI Trainer — streaming chatbot for /dashboard/learn
// Powered by Lovable AI Gateway (default: google/gemini-2.5-flash)
// Trained on the LeadMines course catalog so every answer cites a module.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mirror of src/lib/courses.ts (kept in sync manually for the launch skeleton).
// When Phase 3 wires courses to the DB, this becomes a Supabase query.
const COURSE_KB = [
  { slug: "personal-loan-pro", title: "Personal Loan Pro", category: "loan", tagline: "CIBIL profiling → disbursal for salaried & self-employed PL.", modules: ["basics", "eligibility", "pitch", "process", "quiz", "cert"] },
  { slug: "business-loan-mastery", title: "Business Loan Mastery", category: "loan", tagline: "Unsecured BL, working capital & MSME — sanction faster.", modules: ["basics", "eligibility", "pitch", "process", "quiz", "cert"] },
  { slug: "home-loan-expert", title: "Home Loan Expert", category: "loan", tagline: "HL + Balance Transfer + Top-up — highest-paying vertical.", modules: ["basics", "eligibility", "pitch", "process", "quiz", "cert"] },
  { slug: "lap-specialist", title: "LAP Specialist", category: "loan", tagline: "Loan Against Property — high-ticket, high-payout.", modules: ["basics", "eligibility", "pitch", "process", "quiz", "cert"] },
  { slug: "health-insurance-advisor", title: "Health Insurance Advisor", category: "insurance", tagline: "IRDAI-aligned health policies that actually claim.", modules: ["basics", "eligibility", "pitch", "process", "quiz", "cert"] },
  { slug: "credit-card-closer", title: "Credit Card Closer", category: "credit_card", tagline: "Match customer to card, keep approvals high.", modules: ["basics", "eligibility", "pitch", "process", "quiz", "cert"] },
  { slug: "compliance-fairlending", title: "Compliance & Fair Lending", category: "compliance", tagline: "RBI, IRDAI, SEBI rules every DSA must follow.", modules: ["basics", "eligibility", "pitch", "process", "quiz", "cert"] },
  { slug: "sales-fundamentals", title: "Sales Fundamentals", category: "sales", tagline: "Mindset, calls and follow-ups that 10× closures.", modules: ["basics", "eligibility", "pitch", "process", "quiz", "cert"] },
];

const SYSTEM_PROMPT = `You are **Trainer AI** — the in-house product & sales coach for LeadMines DSAs (Direct Selling Agents) in India.

ROLE
- Train DSAs on personal loans, business loans, home loans, LAP, health insurance, credit cards, sales technique and RBI/IRDAI compliance.
- Suggest the best product for any customer profile (income, CIBIL, employment, intent, age).
- Handle live customer objections with proven counters.
- Keep answers concise (≤ 220 words), Indian context (₹, CIBIL, KYC, RBI, IRDAI), and **action-first**.

STYLE
- Use short headings, bullet lists, **bold key numbers**.
- Always end with one **next-best-action** line.
- Never invent interest rates, eligibility cut-offs or RBI rules. If unsure, say "Lender-specific — confirm in their grid".

CITATIONS — MANDATORY
You have access to this course catalog. Whenever you give advice, cite 1–3 relevant courses by slug at the very end of your answer using this exact format on its own line:

[[cite: slug-1, slug-2]]

Available course slugs (use these exact slugs):
${COURSE_KB.map((c) => `- ${c.slug} — ${c.title} (${c.category}) — ${c.tagline}`).join("\n")}

Example ending:
"Pitch the BT + Top-up combo — most owners haven't heard of it.

[[cite: home-loan-expert, sales-fundamentals]]"

Never skip the citation block. If no course is relevant, cite the closest fit.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit hit. Wait a minute and ask again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted — top up at Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-trainer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
