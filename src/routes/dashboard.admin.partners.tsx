import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck, Loader2, CheckCircle2, XCircle, Clock,
  User, Phone, Mail, MapPin, Copy,
} from "lucide-react";
import {
  listPartnerApplications, approvePartnerApplication, rejectPartnerApplication,
  importWebsitePartner, STATUS_LABEL, type PartnerApplication,
} from "@/lib/partners";

export const Route = createFileRoute("/dashboard/admin/partners")({
  head: () => ({ meta: [{ title: "Partner Applications — RupeeDial One" }] }),
  component: AdminPartnersPage,
});

function AdminPartnersPage() {
  const [apps, setApps] = useState<PartnerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
  const [active, setActive] = useState<PartnerApplication | null>(null);
  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [notes, setNotes] = useState("");
  const [ creds, setCreds] = useState<{ email: string; password: string; dsa_id: string } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importForm, setImportForm] = useState({
    website_lead_id: "",
    full_name: "",
    phone: "",
    email: "",
    city: "",
    ref_code: "",
    dsa_type: "referral",
  });

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listPartnerApplications(filter as PartnerApplication["status"] | "all");
      setApps(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const openDetail = (app: PartnerApplication) => {
    setActive(app);
    setRejectReason("");
    setNotes(app.internal_notes || "");
    setCreds(null);
  };

  const onApprove = async () => {
    if (!active) return;
    setActing(true);
    try {
      const res = await approvePartnerApplication(active.id, notes || undefined);
      setCreds({ email: res.email, password: res.temporary_password, dsa_id: res.dsa_id });
      toast.success(`Approved · DSA ${res.dsa_id}`);
      await refresh();
      setActive((prev) => (prev ? { ...prev, status: "approved", generated_dsa_id: res.dsa_id } : prev));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setActing(false);
    }
  };

  const onReject = async () => {
    if (!active) return;
    if (rejectReason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters");
      return;
    }
    setActing(true);
    try {
      await rejectPartnerApplication(active.id, rejectReason.trim());
      toast.success("Application rejected");
      setActive(null);
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Rejection failed");
    } finally {
      setActing(false);
    }
  };

  const onImport = async () => {
    setActing(true);
    try {
      await importWebsitePartner({
        website_lead_id: importForm.website_lead_id.trim(),
        full_name: importForm.full_name.trim(),
        phone: importForm.phone.trim(),
        email: importForm.email.trim(),
        city: importForm.city.trim(),
        ref_code: importForm.ref_code.trim() || undefined,
        dsa_type: importForm.dsa_type.trim() || undefined,
      });
      toast.success("Imported into CRM");
      setShowImport(false);
      setFilter("pending");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setActing(false);
    }
  };

  const counts = {
    pending: apps.filter((a) => a.status === "pending").length,
    approved: apps.filter((a) => a.status === "approved").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#390A5D] flex items-center gap-2">
            <ShieldCheck className="size-6 text-[#10662A]" /> Partner Applications
          </h1>
          <p className="text-[#5c4d72] text-sm mt-0.5">
            Website apply → CRM approve → DSA login at /auth
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="px-3.5 py-2 rounded-xl border border-[#d8ecdd] bg-white text-sm font-semibold text-[#390A5D] hover:bg-[#E8F7EC] cursor-pointer"
        >
          Import from website DB
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCard label="Total" value={apps.length} icon={User} />
        <StatCard label="Pending" value={counts.pending} icon={Clock} accent="text-amber-600" />
        <StatCard label="Approved" value={counts.approved} icon={CheckCircle2} accent="text-emerald-600" />
        <StatCard label="Rejected" value={counts.rejected} icon={XCircle} accent="text-red-600" />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide border cursor-pointer ${
              filter === s
                ? "bg-[#10662A] text-white border-[#10662A]"
                : "border-[#d8ecdd] bg-white text-[#5c4d72] hover:bg-[#E8F7EC]"
            }`}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]?.label || s}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#d8ecdd] rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(16,102,42,0.04)]">
        {loading ? (
          <div className="py-16 grid place-items-center text-[#5c4d72]">
            <Loader2 className="size-6 animate-spin text-[#10662A]" />
          </div>
        ) : apps.length === 0 ? (
          <div className="py-16 text-center text-[#5c4d72] text-sm space-y-2">
            <p>No applications in CRM yet.</p>
            <p className="text-xs">
              New website applies auto-sync. Existing MySQL rows → use <strong>Import from website DB</strong>.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#d8ecdd]">
            {apps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => openDetail(app)}
                className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-[#f5fcf7] transition-colors text-left cursor-pointer"
              >
                <div className="size-9 rounded-xl bg-[#E8F7EC] grid place-items-center font-bold text-[#10662A] text-xs shrink-0">
                  {app.full_name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#390A5D]">{app.full_name}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#f5fcf7] text-[#5c4d72] border border-[#d8ecdd]">
                      {app.website_lead_id}
                    </span>
                    {app.generated_dsa_id && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#E8F7EC] text-[#10662A] font-bold">
                        {app.generated_dsa_id}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#5c4d72] mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" />
                      {app.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {app.city}
                    </span>
                    {app.dsa_type && <span className="capitalize">{app.dsa_type}</span>}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${STATUS_LABEL[app.status]?.color || ""}`}
                >
                  {STATUS_LABEL[app.status]?.label || app.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] grid place-items-center p-4"
          onClick={() => {
            if (!creds) setActive(null);
          }}
        >
          <div
            className="bg-white border border-[#d8ecdd] rounded-2xl shadow-[0_20px_50px_rgba(16,102,42,0.15)] max-w-lg w-full max-h-[min(90dvh,720px)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-extrabold text-[#390A5D]">{active.full_name}</h2>
                  <span
                    className={`mt-1.5 inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase ${STATUS_LABEL[active.status]?.color || ""}`}
                  >
                    {STATUS_LABEL[active.status]?.label || active.status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  className="size-8 rounded-lg grid place-items-center hover:bg-[#E8F7EC] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Detail icon={Mail} label="Email" value={active.email} />
                <Detail icon={Phone} label="Phone" value={active.phone} />
                <Detail icon={MapPin} label="City" value={active.city} />
                <Detail label="Website ID" value={active.website_lead_id} mono />
                <Detail label="Ref code" value={active.ref_code || "—"} mono />
                <Detail label="DSA type" value={active.dsa_type || "—"} />
              </div>

              {creds && (
                <div className="rounded-xl bg-[#E8F7EC] border border-[#d8ecdd] p-4 space-y-2">
                  <div className="font-bold text-[#10662A] text-sm">CRM login credentials</div>
                  <p className="text-xs text-[#5c4d72]">Share with partner — password shown once (re-approve resets it).</p>
                  <div className="text-sm space-y-1 font-mono">
                    <div>DSA ID: {creds.dsa_id}</div>
                    <div>Email: {creds.email}</div>
                    <div>Password: {creds.password}</div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#10662A] cursor-pointer"
                    onClick={async () => {
                      await navigator.clipboard.writeText(
                        `Email: ${creds.email}\nPassword: ${creds.password}\nDSA: ${creds.dsa_id}\nLogin: ${window.location.origin}/auth`,
                      );
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="size-3.5" /> Copy login details
                  </button>
                </div>
              )}

              {active.status === "pending" || active.status === "under_review" ? (
                <div className="space-y-3">
                  <label className="block">
                    <div className="text-[11px] font-semibold text-[#5c4d72] mb-1">Internal notes</div>
                    <textarea
                      className="w-full min-h-[70px] px-3 py-2 rounded-lg border border-[#d8ecdd] text-sm"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </label>
                  <details className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <summary className="text-sm font-semibold text-red-600 cursor-pointer">Reject</summary>
                    <textarea
                      className="w-full mt-2 min-h-[56px] px-3 py-2 rounded-lg border border-red-200 text-sm"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason (min 5 chars)"
                    />
                    <button
                      type="button"
                      onClick={() => void onReject()}
                      disabled={acting || rejectReason.trim().length < 5}
                      className="mt-2 w-full py-2 rounded-xl bg-red-600 text-white font-bold text-sm disabled:opacity-50 cursor-pointer"
                    >
                      {acting ? <Loader2 className="size-4 animate-spin inline" /> : null} Reject
                    </button>
                  </details>
                  <button
                    type="button"
                    onClick={() => void onApprove()}
                    disabled={acting}
                    className="w-full py-2.5 rounded-xl bg-[#10662A] text-white font-bold text-sm hover:bg-[#0D4F20] disabled:opacity-50 cursor-pointer"
                  >
                    {acting ? <Loader2 className="size-4 animate-spin inline mr-1" /> : <CheckCircle2 className="size-4 inline mr-1" />}
                    Approve & create DSA login
                  </button>
                </div>
              ) : active.status === "rejected" ? (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm">
                  <div className="font-bold text-red-600">Rejection reason</div>
                  <div className="mt-1 text-[#390A5D]">{active.rejection_reason}</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm">
                    <div className="font-bold text-emerald-700">Approved · DSA ID</div>
                    <div className="font-mono mt-1">{active.generated_dsa_id}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onApprove()}
                    disabled={acting}
                    className="w-full py-2 rounded-xl border border-[#d8ecdd] text-sm font-semibold text-[#390A5D] hover:bg-[#E8F7EC] cursor-pointer"
                  >
                    Reset password & show login again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/45 grid place-items-center p-4" onClick={() => setShowImport(false)}>
          <div
            className="bg-white border border-[#d8ecdd] rounded-2xl p-5 max-w-md w-full space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-bold text-[#390A5D]">Import Hostinger partner row</h3>
            <p className="text-xs text-[#5c4d72]">
              Paste from phpMyAdmin (e.g. DSA-20260926-855360 / Mohammad Ayan).
            </p>
            {(
              [
                ["website_lead_id", "lead_id (DSA-…)"],
                ["full_name", "Full name"],
                ["phone", "Mobile"],
                ["email", "Email"],
                ["city", "City"],
                ["ref_code", "Ref code"],
                ["dsa_type", "dsa_type"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <div className="text-[11px] font-semibold text-[#5c4d72] mb-1">{label}</div>
                <input
                  className="w-full h-9 px-3 rounded-lg border border-[#d8ecdd] text-sm"
                  value={importForm[key]}
                  onChange={(e) => setImportForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="flex-1 py-2 rounded-xl border border-[#d8ecdd] text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => void onImport()}
                className="flex-1 py-2 rounded-xl bg-[#10662A] text-white text-sm font-bold cursor-pointer"
              >
                {acting ? "…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-[#d8ecdd] px-3 py-2.5 flex items-center gap-2.5">
      <div className={`size-8 rounded-lg bg-[#f5fcf7] grid place-items-center ${accent || "text-[#390A5D]"}`}>
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-[#5c4d72] font-semibold">{label}</div>
        <div className="font-display text-lg font-bold text-[#390A5D]">{value}</div>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[#5c4d72] font-semibold flex items-center gap-1">
        {Icon && <Icon className="size-3" />} {label}
      </div>
      <div className={`mt-0.5 text-[#390A5D] ${mono ? "font-mono text-xs" : "text-sm"}`}>{value}</div>
    </div>
  );
}
