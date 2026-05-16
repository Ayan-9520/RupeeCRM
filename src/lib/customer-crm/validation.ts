const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;
const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_RE = /^\d{6}$/;

export function validatePan(value: string): string | null {
  const v = value.trim().toUpperCase();
  if (!v) return null;
  return PAN_RE.test(v) ? null : "Invalid PAN (e.g. ABCDE1234F)";
}

export function validateMobile(value: string): string | null {
  const digits = value.replace(/\D/g, "").slice(-10);
  if (!digits) return null;
  return MOBILE_RE.test(digits) ? null : "Enter a valid 10-digit mobile number";
}

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return EMAIL_RE.test(v) ? null : "Invalid email address";
}

export function validatePincode(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return PIN_RE.test(v) ? null : "Pincode must be 6 digits";
}

export function normalizePan(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}
