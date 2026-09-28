import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogIn, RefreshCw, Search, Globe, Phone, MapPin, IndianRupee } from "lucide-react";
import {
  API_URL,
  clearCrmSession,
  crmHealth,
  crmLogin,
  getCrmUser,
  listCrmLeads,
  type CrmLead,
  type CrmUser,
} from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/website-leads")({
  head: () => ({ meta: [{ title: "Website Leads — RupeeDial One" }] }),
  component: WebsiteLeadsPage,
});

type ScoreFilter = "all" | "hot" | "warm" | "cold";

function scoreClass(score: string, active = false) {
  const base = "text-xs font-bold uppercase px-2.5 py-1 rounded-full border cursor-pointer transition-all select-none";
  if (score === "hot") {
    return `${base} ${active ? "bg-red-500 text-white border-red-500 shadow-sm" : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"}`;
  }
  if (score === "warm") {
    return `${base} ${active ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"}`;
  }
  return `${base} ${active ? "bg-sky-500 text-white border-sky-500 shadow-sm" : "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"}`;
}

function WebsiteLeadsPage() {
  const [user, setUser] = useState<CrmUser | null>(null);
  const [email, setEmail] = useState("admin@rupeedial.com");
  const [password, setPassword] = useState("Admin@12345");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiUp, setApiUp] = useState<boolean | null>(null);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setUser(getCrmUser());
    crmHealth().then(setApiUp);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listCrmLeads({ source: "website", q: search.trim() || undefined, limit: 200 });
      setLeads(data.items);
      setTotal(data.total);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load leads";
      toast.error(msg);
      if (msg.toLowerCase().includes("auth") || msg.includes("401") || msg.includes("Not authenticated") || msg.includes("Invalid token")) {
        clearCrmSession();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (scoreFilter !== "all" && l.score !== scoreFilter) return false;
      if (!q) return true;
      return `${l.applicant_name} ${l.full_phone} ${l.city} ${l.product_subtype ?? ""}`.toLowerCase().includes(q);
    });
  }, [leads, search, scoreFilter]);

  const scoreCounts = useMemo(() => {
    const c = { hot: 0, warm: 0, cold: 0 };
    for (const l of leads) {
      if (l.score === "hot") c.hot += 1;
      else if (l.score === "warm") c.warm += 1;
      else c.cold += 1;
    }
    return c;
  }, [leads]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const u = await crmLogin(email.trim(), password);
      setUser(u);
      toast.success(`Logged into CRM API as ${u.full_name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-extrabold text-[#390A5D] flex items-center gap-2">
            <Globe className="size-7 text-[#10662A]" />
            Website Leads
          </h1>
          <p className="text-[#5c4d72] mt-1 text-sm">
            Leads from rupeedial.com forms via Python CRM API ({API_URL})
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void crmHealth().then(setApiUp)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border cursor-pointer transition-all ${
              apiUp
                ? "border-[#10662A]/30 text-[#10662A] bg-[#E8F7EC] hover:bg-[#d8ecdd]"
                : "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
            }`}
          >
            API {apiUp === null ? "…" : apiUp ? "online" : "offline — run docker compose up"}
          </button>
          {user && (
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 border border-[#d8ecdd] bg-white rounded-xl px-3 py-2 text-sm font-semibold text-[#390A5D] hover:border-[#10662A]/40 hover:bg-[#E8F7EC] cursor-pointer shadow-[0_2px_8px_rgba(16,102,42,0.04)]"
            >
              <RefreshCw className={`size-4 text-[#10662A] ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {!user ? (
        <form
          onSubmit={handleLogin}
          className="rounded-2xl border border-[#d8ecdd] bg-white p-6 max-w-md space-y-4 shadow-[0_4px_20px_rgba(16,102,42,0.06)]"
        >
          <p className="text-sm text-[#5c4d72]">
            Sign in to the Docker CRM API to view website leads. Default local admin is prefilled.
          </p>
          <div>
            <label className="text-xs font-semibold text-[#5c4d72]">Email</label>
            <input className="input-base w-full mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#5c4d72]">Password</label>
            <input
              type="password"
              className="input-base w-full mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loggingIn}
            className="inline-flex items-center gap-2 bg-[#10662A] text-white rounded-xl px-4 py-2.5 font-semibold shadow-[0_8px_20px_rgba(16,102,42,0.25)] hover:bg-[#0D4F20] disabled:opacity-60 cursor-pointer"
          >
            {loggingIn ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            Connect CRM API
          </button>
        </form>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-[#5c4d72]">
              Signed in as <span className="font-semibold text-[#390A5D]">{user.full_name}</span> · {total} website leads
            </p>
            <button
              type="button"
              className="text-sm text-[#5c4d72] hover:text-[#10662A] font-medium cursor-pointer"
              onClick={() => {
                clearCrmSession();
                setUser(null);
                setLeads([]);
              }}
            >
              Disconnect API
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-md flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#5c4d72]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter name, phone, city…"
                className="input-base pl-9 w-full"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setScoreFilter("all")}
                className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                  scoreFilter === "all"
                    ? "bg-[#10662A] text-white border-[#10662A]"
                    : "bg-white text-[#5c4d72] border-[#d8ecdd] hover:border-[#10662A]/40"
                }`}
              >
                All ({leads.length})
              </button>
              {(["hot", "warm", "cold"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScoreFilter(scoreFilter === s ? "all" : s)}
                  className={scoreClass(s, scoreFilter === s)}
                >
                  {s} ({scoreCounts[s]})
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-8 animate-spin text-[#10662A]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d8ecdd] bg-white p-10 text-center text-[#5c4d72]">
              No website leads yet. Submit a form on rupeedial.com (PHP must point to this API).
            </div>
          ) : (
            <div className="rounded-2xl border border-[#d8ecdd] bg-white overflow-hidden shadow-[0_4px_20px_rgba(16,102,42,0.06)]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#E8F7EC]/70 text-left text-[#390A5D]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Applicant</th>
                      <th className="px-4 py-3 font-semibold">Contact</th>
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 font-semibold">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => (
                      <tr
                        key={l.id}
                        onClick={() => setSelectedId(selectedId === l.id ? null : l.id)}
                        className={`border-t border-[#d8ecdd] cursor-pointer transition-colors ${
                          selectedId === l.id ? "bg-[#E8F7EC]" : "hover:bg-[#f5fcf7]"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#390A5D]">{l.applicant_name}</div>
                          <div className="text-xs text-[#5c4d72] flex items-center gap-1 mt-0.5">
                            <MapPin className="size-3" /> {l.city || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-[#390A5D]">
                            <Phone className="size-3 text-[#5c4d72]" />
                            {l.full_phone}
                          </div>
                          <div className="text-xs text-[#5c4d72]">{l.email || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="capitalize text-[#390A5D]">{l.product_category}</div>
                          <div className="text-xs text-[#5c4d72]">{l.product_subtype || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-0.5 font-medium text-[#390A5D]">
                            <IndianRupee className="size-3.5" />
                            {Number(l.loan_amount || 0).toLocaleString("en-IN")}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className={scoreClass(l.score, scoreFilter === l.score)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setScoreFilter(scoreFilter === l.score ? "all" : (l.score as ScoreFilter));
                            }}
                          >
                            {l.score}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-[#5c4d72] whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
