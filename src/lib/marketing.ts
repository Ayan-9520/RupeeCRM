// Marketing library: types, share helpers, personalization, fallback templates.

export type TemplateKind = "post" | "reel" | "whatsapp" | "visiting_card";
export type MarketingProduct =
  | "personal_loan" | "business_loan" | "home_loan" | "lap" | "msme"
  | "credit_card" | "insurance" | "investment" | "generic";

export interface TemplateTheme {
  bg: string;
  accent: string;
  text: string;
  pattern?: "diagonal" | "dots" | "waves" | "luxury" | "shield" | "grid" | "festive";
}

export interface MarketingTemplate {
  id: string;
  kind: TemplateKind;
  product: MarketingProduct;
  name: string;
  headline: string;
  subheadline: string | null;
  body: string | null;
  cta: string;
  theme: TemplateTheme;
  enabled: boolean;
  display_order: number;
}

export interface PartnerBranding {
  name: string;
  phone: string;
  company: string;
  referralLink: string;
  email?: string;
  logo?: string | null;
}

export const PRODUCT_LABEL: Record<MarketingProduct, string> = {
  personal_loan: "Personal Loan",
  business_loan: "Business Loan",
  home_loan: "Home Loan",
  lap: "Loan Against Property",
  msme: "MSME / Working Capital",
  credit_card: "Credit Card",
  insurance: "Insurance",
  investment: "Investment / MF",
  generic: "All Products",
};

// Fallback hardcoded templates if DB hasn't loaded yet.
export const FALLBACK_TEMPLATES: MarketingTemplate[] = [
  {
    id: "fallback-pl", kind: "post", product: "personal_loan",
    name: "PL — Instant Approval", headline: "Personal Loan up to ₹10 Lakhs",
    subheadline: "Approval in 24 hours",
    body: "No collateral · Minimal documents · Flexible EMIs",
    cta: "Apply Now", enabled: true, display_order: 1,
    theme: { bg: "#0c2340", accent: "#2dd4a8", text: "#ffffff", pattern: "diagonal" },
  },
];

// === Personalization ===
export function personalize(text: string, branding: PartnerBranding): string {
  return text
    .replace(/\{\{name\}\}/g, branding.name)
    .replace(/\{\{phone\}\}/g, branding.phone)
    .replace(/\{\{company\}\}/g, branding.company)
    .replace(/\{\{link\}\}/g, branding.referralLink)
    .replace(/\{\{email\}\}/g, branding.email ?? "");
}

// === Share helpers ===
export function shareWhatsApp(text: string, phone?: string) {
  const url = phone
    ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
}

export function shareFacebook(url: string, quote?: string) {
  const u = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}${quote ? `&quote=${encodeURIComponent(quote)}` : ""}`;
  window.open(u, "_blank", "noopener");
}

export function shareTwitter(text: string, url: string) {
  const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(u, "_blank", "noopener");
}

export function shareLinkedIn(url: string) {
  const u = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  window.open(u, "_blank", "noopener");
}

export function shareTelegram(text: string, url: string) {
  const u = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  window.open(u, "_blank", "noopener");
}

export function buildReferralLink(code: string, baseUrl?: string): string {
  const base = baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "https://leadmines.app");
  return `${base}/r/${code}`;
}

export function generateReferralCode(name: string, userId: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 6) || "user";
  const tail = userId.replace(/-/g, "").slice(0, 5);
  return `${slug}${tail}`;
}

// === Pattern SVG backgrounds ===
export function patternStyle(theme: TemplateTheme): React.CSSProperties {
  const a = theme.accent;
  const patterns: Record<string, string> = {
    diagonal: `repeating-linear-gradient(45deg, transparent, transparent 18px, ${a}14 18px, ${a}14 19px)`,
    dots: `radial-gradient(${a}30 1.5px, transparent 1.5px)`,
    waves: `radial-gradient(circle at 100% 0%, ${a}20 0%, transparent 40%), radial-gradient(circle at 0% 100%, ${a}20 0%, transparent 40%)`,
    luxury: `linear-gradient(135deg, ${a}10 0%, transparent 50%, ${a}10 100%)`,
    shield: `radial-gradient(circle at 50% 30%, ${a}25 0%, transparent 35%)`,
    grid: `linear-gradient(${a}12 1px, transparent 1px), linear-gradient(90deg, ${a}12 1px, transparent 1px)`,
    festive: `radial-gradient(circle at 20% 20%, ${a}30 0%, transparent 25%), radial-gradient(circle at 80% 80%, ${a}30 0%, transparent 25%)`,
  };
  const bgImage = theme.pattern ? patterns[theme.pattern] : undefined;
  const bgSize = theme.pattern === "dots" ? "18px 18px" : theme.pattern === "grid" ? "24px 24px" : undefined;
  return {
    backgroundColor: theme.bg,
    color: theme.text,
    backgroundImage: bgImage,
    backgroundSize: bgSize,
  };
}
