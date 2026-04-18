import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck, Loader2, FileText, ExternalLink, CheckCircle2, XCircle, Clock,
  User, Phone, Mail, Building, IndianRupee, MapPin, Briefcase,
} from "lucide-react";
import {
  listPartnerApplications, approvePartnerApplication, rejectPartnerApplication,
  getKycSignedUrl, STATUS_LABEL, type PartnerApplication,
} from "@/lib/partners";

export const Route = createFileRoute("/dashboard/admin/partners")({
  head: () => ({ meta: [{ title: "Partner Applications — LeadMines Admin" }] }),
  component: AdminPartnersPage,
});

function AdminPartnersPage() {
  const [apps, setApps] = useState<PartnerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PartnerApplication["status"] | "all">("pending");
  const [active, setActive] = useState<PartnerApplication | null>(null);
  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [notes, setNotes] = useState("");
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listPartnerApplications(filter === "all" ? undefined : filter);
      setApps(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const openDetail = async (app: PartnerApplication) => {
    setActive(app);
    setRejectReason("");
    setNotes(app.internal_notes || "");
    // Fetch signed URLs for KYC docs
    const urls: Record<string, string> = {};
    for (const [key, path] of Object.entries({
      pan: app.pan_doc_url, aadhaar: app.aadhaar_doc_url, bank: app.bank_proof_url, selfie: app.selfie_url,
    })) {
      if (path) {
        try {
          urls[key] = await getKycSignedUrl(path);
        } catch {
          /* signed url failure — admin can still see path */
        }
      }
    }
    setDocUrls(urls);
  };

  const onApprove = async () => {
    if (!active) return;
    setActing(true);
    try {
      const res = await approvePartnerApplication(active.id, notes || undefined);
      toast.success(`✅ Approved! DSA ID: ${res.dsa_id}`);
      setActive(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Approval failed");
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
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Rejection failed");
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
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><ShieldCheck className="size-6 text-accent" /> Partner Applications</h1>
          <p className="text-muted-foreground text-sm mt-1">Review KYC, approve and assign DSA IDs.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={apps.length} icon={User} />
        <StatCard label="Pending" value={counts.pending} icon={Clock} accent="text-amber-600" />
        <StatCard label="Approved" value={counts.approved} icon={CheckCircle2} accent="text-emerald-600" />
        <StatCard label="Rejected" value={counts.rejected} icon={XCircle} accent="text-destructive" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["pending", "under_review", "approved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border transition-smooth ${filter === s ? "bg-foreground text-background border-foreground" : "border-border hover:border-foreground/40"}`}
          >
            {s === "all" ? "All" : STATUS_LABEL[s as PartnerApplication["status"]]?.label || s}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="py-16 grid place-items-center text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>
        ) : apps.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No applications in this view.</div>
        ) : (
          <div className="divide-y divide-border">
            {apps.map((app) => (
              <button
                key={app.id}
                onClick={() => openDetail(app)}
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-muted/40 transition-smooth text-left"
              >
                <div className="size-10 rounded-xl bg-accent/15 grid place-items-center font-bold text-accent shrink-0">
                  {app.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{app.full_name}</span>
                    {app.generated_dsa_id && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-accent/15 text-accent font-bold">{app.generated_dsa_id}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><Phone className="size-3" />{app.phone}</span>
                    <span className="flex items-center gap-1"><MapPin className="size-3" />{app.city}</span>
                    <span>{app.products_of_interest.slice(0, 3).join(", ")}</span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${STATUS_LABEL[app.status].color}`}>
                  {STATUS_LABEL[app.status].label}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 hidden md:block">{new Date(app.created_at).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {active && (
        <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm grid place-items-end md:place-items-center p-0 md:p-6" onClick={() => setActive(null)}>
          <div className="bg-card border border-border rounded-t-3xl md:rounded-3xl shadow-elegant max-w-2xl w-full max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-8 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold">{active.full_name}</h2>
                  <span className={`mt-2 inline-block px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${STATUS_LABEL[active.status].color}`}>
                    {STATUS_LABEL[active.status].label}
                  </span>
                </div>
                <button onClick={() => setActive(null)} className="size-8 rounded-full grid place-items-center hover:bg-muted">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Detail icon={Mail} label="Email" value={active.email} />
                <Detail icon={Phone} label="Phone" value={active.phone} />
                <Detail icon={MapPin} label="Location" value={`${active.city}${active.state ? ", " + active.state : ""}${active.pincode ? " - " + active.pincode : ""}`} />
                <Detail icon={Building} label="Company" value={active.company_name || "—"} />
                <Detail icon={Briefcase} label="Experience" value={`${active.experience_years} years`} />
                <Detail icon={IndianRupee} label="Monthly target" value={active.monthly_target ? `₹${active.monthly_target.toLocaleString("en-IN")}` : "—"} />
              </div>

              <div className="rounded-2xl bg-muted/40 border border-border p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Products</div>
                <div className="flex flex-wrap gap-1.5">
                  {active.products_of_interest.map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-medium">{p.replace(/_/g, " ")}</span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">KYC & Bank</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Detail label="PAN" value={active.pan} mono />
                  <Detail label="Aadhaar (last 4)" value={active.aadhaar_last4 || "—"} mono />
                  <Detail label="Account holder" value={active.account_holder || "—"} />
                  <Detail label="Bank A/C" value={active.bank_account ? "••••" + active.bank_account.slice(-4) : "—"} mono />
                  <Detail label="IFSC" value={active.ifsc || "—"} mono />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {(["pan", "aadhaar", "bank", "selfie"] as const).map((k) =>
                    docUrls[k] ? (
                      <a key={k} href={docUrls[k]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/15 text-accent text-xs font-bold hover:bg-accent/25 transition-smooth">
                        <FileText className="size-3.5" /> {k.toUpperCase()} <ExternalLink className="size-3" />
                      </a>
                    ) : null
                  )}
                  {!docUrls.pan && !docUrls.aadhaar && !docUrls.bank && (
                    <span className="text-xs text-muted-foreground">No documents uploaded</span>
                  )}
                </div>
              </div>

              {active.status === "pending" || active.status === "under_review" ? (
                <div className="space-y-4">
                  <label className="block">
                    <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Internal notes (optional)</div>
                    <textarea className="input-base min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reviewer notes..." />
                  </label>
                  <details className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                    <summary className="text-sm font-semibold text-destructive cursor-pointer">Reject application</summary>
                    <textarea className="input-base mt-3 min-h-[60px]" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason (min 5 chars)..." />
                    <button onClick={onReject} disabled={acting || rejectReason.trim().length < 5} className="mt-2 w-full py-2 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-smooth flex items-center justify-center gap-2">
                      {acting ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Reject
                    </button>
                  </details>
                  <button onClick={onApprove} disabled={acting} className="w-full py-3 rounded-xl bg-mint-gradient text-foreground font-bold shadow-mint hover:opacity-90 transition-smooth flex items-center justify-center gap-2 disabled:opacity-50">
                    {acting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve & Generate DSA ID
                  </button>
                </div>
              ) : active.status === "rejected" ? (
                <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-4 text-sm">
                  <div className="font-bold text-destructive">Rejection reason</div>
                  <div className="text-foreground mt-1">{active.rejection_reason}</div>
                </div>
              ) : (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-sm">
                  <div className="font-bold text-emerald-700 dark:text-emerald-300">Approved · DSA ID</div>
                  <div className="font-mono mt-1">{active.generated_dsa_id}</div>
                  {active.reviewed_at && <div className="text-xs text-muted-foreground mt-1">on {new Date(active.reviewed_at).toLocaleString()}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; accent?: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
      <div className={`size-10 rounded-xl bg-muted grid place-items-center ${accent || "text-foreground"}`}><Icon className="size-5" /></div>
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-display text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value, mono }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">{Icon && <Icon className="size-3" />} {label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono text-xs" : "text-sm"}`}>{value}</div>
    </div>
  );
}
