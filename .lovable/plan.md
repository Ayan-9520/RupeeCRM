## Goal

Replace the small side popup that opens when a DSA clicks a purchased lead in **My Leads** with a full-screen, premium fintech CRM workspace — without touching the marketplace, purchase flow, wallet deduction, routing, or any existing working logic.

## What stays untouched

- `src/routes/dashboard.leadboard.tsx` (marketplace + purchase + wallet deduction)
- `src/routes/dashboard.my-leads.tsx` list/cards/kanban UI, filters, queries
- `src/routes/dashboard.my-leads.$id.apply.tsx` (lender application flow)
- All Supabase tables already in use: `leads`, `lead_purchases`, `case_documents`, `case_status_logs`, `wallet_*`, `commissions`, etc.
- All existing RLS, auth, routing

Only the detail modal that opens from a purchased-lead card changes.

## Scope (phase 1 — this turn)

A new component `LeadWorkspaceModal` that renders as a centered, full-screen (max ~1400px) modal with sticky header and tabbed body. All data is read from Supabase — no hardcoded/fake values. Empty fields render as "—".

### Sticky header
- Applicant name, category badge, score badge, current pipeline stage badge, source badge
- Price paid, purchased date, lead age (days since purchase)
- Quick actions: Call, WhatsApp, SMS, Email, Copy phone, Start Processing (advances stage), Apply (links to existing `/dashboard/my-leads/$id/apply`), Download Lead Summary PDF

### Tabs
1. **Overview** — Personal, Contact, Employment, Business (if self-employed), Loan Requirement cards. All fields from existing `leads` columns + `product_details` JSON. Read-only fields show "—" when missing.
2. **Pipeline** — Vertical stage list using product pipeline; click a stage to update `lead_purchases.pipeline_stage` and append to `case_status_logs` (existing flow). Timeline of stage history below.
3. **Documents** — Upload/preview/delete using existing `case-documents` storage bucket and `case_documents` table (already wired). Suggested doc types: Aadhaar, PAN, Salary Slip, Bank Statement, ITR, Selfie, GST, Business Proof, Property Papers.
4. **Follow-ups & Notes** — Schedule next follow-up (writes `lead_purchases.next_followup_at`), add note (appends to `lead_purchases.notes` JSONB array). Unified activity timeline merging stage logs + notes + document uploads.
5. **Commission** — Reads `commissions` + `disbursals` rows joined on `lead_purchase_id`. Shows loan amount, approved amount, payout %, estimated/received commission, status. Read-only.

### PDF
- "Download Lead Summary PDF" generated client-side via `jspdf` (already used elsewhere — verify; otherwise add). Contains customer details, loan details, current stage, notes, document list (filenames only).

## Out of scope (defer / not building this turn)

To avoid breaking the working CRM and to keep the change reviewable, the following are **not** built now. They can be added in follow-up turns once the core workspace is approved:

- New tables (`lead_processing`, `lead_followups`, `lead_assignments`, banker assignment fields) — current schema already covers stage history, documents, notes, commissions, disbursals. Adding parallel tables would duplicate data.
- Banker Assignment section as a separate editable form — `disbursals` already stores `lender_id`, `lender_name`, `loan_account_no`, dates. Shown read-only inside Commission tab.
- Banker Summary PDF and Application PDF variants — only Lead Summary PDF in phase 1.
- Editing personal/contact/employment fields on the lead — leads are immutable post-purchase in current flow; editing would need new RLS + audit. Confirm before adding.
- SMS/Email send integrations — buttons open `sms:` and `mailto:` links (same pattern as existing Call/WhatsApp).

## Files

- **New:** `src/components/leads/LeadWorkspaceModal.tsx` (the full workspace)
- **Edit:** `src/routes/dashboard.my-leads.tsx` — replace the existing detail modal/drawer JSX with `<LeadWorkspaceModal>`. No changes to data fetching, kanban DnD, filters, or cards.
- **Maybe add:** `jspdf` dependency if not present.

## Verification

- `bun run build` succeeds.
- Marketplace, purchase, wallet, kanban, filters all behave identically.
- Opening a purchased lead shows the new full-screen workspace with real Supabase data.

---

**Confirm to proceed with phase 1 as scoped above**, or tell me which deferred items you want pulled into this turn (note: more scope = higher risk of regressions in the working flow).