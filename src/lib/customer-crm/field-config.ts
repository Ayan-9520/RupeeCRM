import type { CrmFieldConfig } from "@/components/customer/shared/CrmFormGrid";
import {
  EMPLOYMENT_TYPES,
  GENDER_OPTIONS,
  MARITAL_OPTIONS,
  RESIDENCE_TYPES,
} from "./constants";

export const PERSONAL_FIELDS: CrmFieldConfig[] = [
  { key: "full_name", label: "Full Name", placeholder: "As per PAN" },
  { key: "mobile", label: "Mobile", type: "tel", placeholder: "10-digit mobile" },
  { key: "alternate_mobile", label: "Alternate Mobile", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "dob", label: "Date of Birth", type: "date" },
  { key: "gender", label: "Gender", type: "select", options: [...GENDER_OPTIONS] },
  { key: "marital_status", label: "Marital Status", type: "select", options: [...MARITAL_OPTIONS] },
  { key: "father_name", label: "Father Name" },
  { key: "mother_name", label: "Mother Name" },
  { key: "pan", label: "PAN", placeholder: "ABCDE1234F" },
  { key: "aadhaar", label: "Aadhaar", placeholder: "Last 4 or full" },
  { key: "education", label: "Education" },
  { key: "residence_type", label: "Residence Type", type: "select", options: [...RESIDENCE_TYPES] },
  { key: "current_address", label: "Current Address", type: "textarea", colSpan: 2 },
  { key: "permanent_address", label: "Permanent Address", type: "textarea", colSpan: 2 },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode", placeholder: "6-digit PIN" },
  { key: "family_members", label: "Family Members", type: "number" },
];

export function employmentFields(type: string | null): CrmFieldConfig[] {
  const base: CrmFieldConfig[] = [
    { key: "employment_type", label: "Employment Type", type: "select", options: [...EMPLOYMENT_TYPES] },
    { key: "industry_type", label: "Industry Type" },
    { key: "designation", label: "Designation" },
    { key: "monthly_income", label: "Monthly Income (₹)", type: "number" },
    { key: "work_experience", label: "Work Experience (years)" },
    { key: "salary_mode", label: "Salary Mode", type: "select", options: ["Bank transfer", "Cash", "Cheque"] },
    { key: "gst_number", label: "GST Number" },
    { key: "itr_filed", label: "ITR Filed", type: "select", options: ["Yes", "No", "NA"] },
    { key: "office_address", label: "Office Address", type: "textarea", colSpan: 2 },
  ];
  if (type === "Salaried") {
    return [
      ...base.slice(0, 1),
      { key: "company_name", label: "Company Name" },
      { key: "net_salary", label: "Net Salary (₹)", type: "number" },
      ...base.slice(1),
    ];
  }
  if (type === "Self-employed" || type === "Business") {
    return [
      ...base.slice(0, 1),
      { key: "business_name", label: "Business Name" },
      { key: "annual_turnover", label: "Annual Turnover (₹)", type: "number" },
      { key: "business_vintage", label: "Business Vintage (years)" },
      ...base.slice(1),
    ];
  }
  return base;
}

export function productExtraFields(productType: string | null): CrmFieldConfig[] {
  const p = (productType ?? "").toLowerCase();
  if (p.includes("home")) {
    return [
      { key: "property_value", label: "Property Value (₹)", type: "number" },
      { key: "extra_builder", label: "Builder / Project" },
      { key: "extra_occupancy", label: "Occupancy", type: "select", options: ["Self-occupied", "Rented", "Vacant"] },
    ];
  }
  if (p.includes("insurance")) {
    return [
      { key: "property_value", label: "Sum Insured (₹)", type: "number" },
      { key: "insurance_type", label: "Policy Type", type: "select", options: ["Term", "Health", "ULIP", "Motor", "Other"] },
    ];
  }
  if (p.includes("credit card") || p === "cc") {
    return [
      { key: "insurance_type", label: "Card Variant", placeholder: "e.g. Platinum Rewards" },
      { key: "property_value", label: "Requested Limit (₹)", type: "number" },
    ];
  }
  return [{ key: "property_value", label: "Collateral / Asset Value (₹)", type: "number" }];
}
