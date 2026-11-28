import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Cog,
  FileClock,
  HandCoins,
  History,
  Loader2,
  Lock,
  PhoneOff,
  ShieldCheck,
  Zap,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { request } from "@/lib/python-api";
import { loadAutomationLogs, toggleAutomationRule } from "@/lib/customer-crm/automation-engine";

export const Route = createFileRoute("/dashboard/automation")({
  head: () => ({ meta: [{ title: "Automation — RupeeOne" }] }),
  component: AutomationPage,
});

type Rule = { id: string; rule_key: string; name: string; enabled: boolean; updated_at?: string | null };
type Log = { id: string; rule_key: string; status: string; message: string; created_at?: string };

const DETAILS: Record<string, { icon: LucideIcon; description: string; trigger: string; action: string }> = {
  docs_pending_reminder: {
    icon: FileClock,
    description: "Reminds the owner when customer documents stay pending.",
    trigger: "Documents pending for 3+ days",
    action: "Creates a reminder task and a notification",
  },
  sanction_disbursal_task: {
    icon: HandCoins,
    description: "Moves a sanctioned file towards disbursal.",
    trigger: "Case reaches the Sanctioned stage",
    action: "Creates a 'Coordinate disbursal' task",
  },
  payout_followup: {
    icon: Clock,
    description: "Chases the lender when payout is delayed.",
    trigger: "Payout pending for 7+ days",
    action: "Creates a payout follow-up task",
  },
  unreachable_retry: {
    icon: PhoneOff,
    description: "Schedules another call when the customer did not pick up.",
    trigger: "Last follow-up marked unreachable",
    action: "Creates a retry task in 2 days and a notification",
  },
  rejected_lender_alt: {
    icon: ArrowRightLeft,
    description: "Suggests another lender after a rejection.",
    trigger: "A lender rejects the file",
    action: "Logs an alternate-lender recommendation",
  },
};

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

function AutomationPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [ruleRes, logRes] = await Promise.all([
        request<{ can_edit?: boolean; rows: Rule[] }>("/api/automation-rules").catch((err: Error) => {
          toast.error(err.message);
          return { can_edit: false, rows: [] as Rule[] };
        }),
        loadAutomationLogs(""),
      ]);
      setRules(ruleRes.rows ?? []);
      setCanEdit(Boolean(ruleRes.can_edit));
      setLogs(logRes.rows);
      setLoading(false);
    })();
  }, []);

  const onToggle = async (rule: Rule, enabled: boolean) => {
    setSaving(rule.rule_key);
    setRules((current) => current.map((item) => (item.rule_key === rule.rule_key ? { ...item, enabled } : item)));
    const res = await toggleAutomationRule(rule.rule_key, enabled);
    if (res.error) {
      setRules((current) => current.map((item) => (item.rule_key === rule.rule_key ? { ...item, enabled: rule.enabled } : item)));
      toast.error(res.error.message);
    }
    setSaving(null);
  };

  const success = logs.filter((l) => l.status === "success").length;
  const failed = logs.filter((l) => l.status === "failed").length;
  const active = rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-4 rounded-3xl bg-gradient-to-br from-[#f2faf4] via-white to-[#f6f0fb] p-4 lg:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[#390A5D]">
            <Cog className="size-6 text-[#087A35]" /> Workflow Automation
          </h1>
          <p className="text-xs text-[#5c4d72]">
            {canEdit ? "System-wide rules. A switch here turns the rule on or off for every case." : "Rules run automatically on your cases. Only an admin can change them."}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ${canEdit ? "bg-[#efe7f7] text-[#390A5D]" : "bg-[#e6f4ea] text-[#087A35]"}`}>
          {canEdit ? <ShieldCheck className="size-3.5" /> : <Lock className="size-3.5" />} {canEdit ? "Admin control" : "Read only"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["Active rules", `${active}/${rules.length}`, Zap, "green"],
            ["Recent runs", logs.length, History, "purple"],
            ["Successful", success, CheckCircle2, "green"],
            ["Failed", failed, XCircle, "red"],
          ] as [string, string | number, LucideIcon, string][]
        ).map(([label, value, Icon, tone]) => (
          <div key={label} className="rounded-2xl border border-[#d8ecdd] bg-white p-3 shadow-[0_4px_18px_rgba(8,122,53,0.06)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#5c4d72]">{label}</span>
              <span className={`grid size-7 place-items-center rounded-lg ${tone === "green" ? "bg-[#e6f4ea] text-[#087A35]" : tone === "red" ? "bg-red-50 text-red-600" : "bg-[#efe7f7] text-[#390A5D]"}`}>
                <Icon className="size-3.5" />
              </span>
            </div>
            <div className="mt-1.5 font-display text-xl font-bold text-[#390A5D]">{value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="size-5 animate-spin text-[#087A35]" />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
            {rules.map((rule) => {
              const info = DETAILS[rule.rule_key];
              const Icon = info?.icon ?? Zap;
              const ruleLogs = logs.filter((l) => l.rule_key === rule.rule_key);
              const last = ruleLogs[0];
              return (
                <article key={rule.rule_key} className="flex flex-col rounded-2xl border border-[#d8ecdd] bg-white p-4 shadow-[0_4px_18px_rgba(8,122,53,0.05)]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#087A35] to-[#0b9a45] text-white">
                        <Icon className="size-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-[#390A5D]">{rule.name}</h3>
                        <p className="text-[11px] text-[#5c4d72]">{info?.description}</p>
                      </div>
                    </div>
                    {canEdit ? (
                      <Switch checked={rule.enabled} disabled={saving === rule.rule_key} onCheckedChange={(value) => void onToggle(rule, value)} />
                    ) : null}
                  </div>
                  <dl className="mt-3 space-y-1 rounded-xl bg-[#f6fbf7] p-2.5 text-[11px]">
                    <div className="flex gap-1.5">
                      <dt className="w-14 shrink-0 font-semibold text-[#087A35]">Trigger</dt>
                      <dd className="text-[#390A5D]">{info?.trigger}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="w-14 shrink-0 font-semibold text-[#087A35]">Action</dt>
                      <dd className="text-[#390A5D]">{info?.action}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex items-center justify-between text-[11px]">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${rule.enabled ? "bg-[#e6f4ea] text-[#087A35]" : "bg-gray-100 text-gray-500"}`}>
                      {rule.enabled ? "Active" : "Paused"}
                    </span>
                    <span className="flex items-center gap-1 text-[#5c4d72]">
                      {last ? (
                        last.status === "success" ? <CheckCircle2 className="size-3.5 text-[#087A35]" /> : <XCircle className="size-3.5 text-red-500" />
                      ) : null}
                      Last run {when(last?.created_at)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4 shadow-[0_4px_18px_rgba(8,122,53,0.05)]">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#390A5D]">
              <History className="size-4 text-[#087A35]" /> Recent runs
            </h2>
            {logs.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#5c4d72]">No rule has run on your cases yet.</p>
            ) : (
              <ul className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <li key={log.id} className="flex items-start gap-2 rounded-xl border border-[#eef6f0] bg-[#fbfdfb] p-2 text-xs">
                    {log.status === "success" ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#087A35]" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />}
                    <div className="min-w-0">
                      <p className="text-[#14281c]">{log.message}</p>
                      <p className="text-[10px] text-[#5c4d72]">
                        {rules.find((r) => r.rule_key === log.rule_key)?.name ?? log.rule_key} · {when(log.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
