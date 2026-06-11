/** Coerce CRM form values for Supabase numeric / empty fields */
export function toNumberOrNull(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function toIntOrNull(value: unknown): number | null {
  const n = toNumberOrNull(value);
  return n == null ? null : Math.round(n);
}

const PROFILE_NUMERIC_KEYS = new Set([
  "monthly_income",
  "net_salary",
  "annual_turnover",
  "family_members",
]);

export function normalizeProfilePatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out = { ...patch };
  for (const key of Object.keys(out)) {
    if (PROFILE_NUMERIC_KEYS.has(key)) {
      out[key] = toNumberOrNull(out[key]);
    }
    if (key === "family_members") {
      out[key] = toIntOrNull(out[key]);
    }
  }
  return out;
}
