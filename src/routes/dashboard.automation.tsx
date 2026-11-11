import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cog, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { loadAutomationLogs, loadAutomationRules, toggleAutomationRule } from "@/lib/customer-crm/automation-engine";

export const Route = createFileRoute("/dashboard/automation")({
  head: () => ({ meta: [{ title: "Automation — RupeeOne" }] }),
  component: AutomationPage,
});

type Rule = { id: string; rule_key: string; name: string; enabled: boolean };
type Log = { id: string; rule_key: string; status: string; message: string };

function AutomationPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [ruleRes, logRes] = await Promise.all([loadAutomationRules(""), loadAutomationLogs("")]);
      setRules(ruleRes.rows);
      setLogs(logRes.rows);
      if ("error" in ruleRes && ruleRes.error) toast.error(ruleRes.error);
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

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Cog className="size-7 text-[#10662A]" />
        <div>
          <h1 className="font-display text-2xl font-bold text-[#390A5D]">Workflow automation</h1>
          <p className="text-sm text-[#5c4d72]">These rules create a task on your own cases. A switch stays off until you turn it on again.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5 shadow-[0_4px_20px_rgba(16,102,42,0.05)]">
        {loading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-5 animate-spin text-[#10662A]" />
          </div>
        ) : (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li key={rule.rule_key} className="flex items-center justify-between gap-3 border-b border-[#d8ecdd] py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium text-[#390A5D]">{rule.name}</p>
                  <p className="text-[11px] text-[#5c4d72]">{rule.enabled ? "On for your cases" : "Off for your cases"}</p>
                </div>
                <Switch checked={rule.enabled} disabled={saving === rule.rule_key} onCheckedChange={(value) => void onToggle(rule, value)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
        <h2 className="font-semibold text-[#390A5D]">Recent runs</h2>
        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-[#5c4d72]">No rule has run on your cases yet. Open a case and the matching rule will leave a task.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {logs.map((log) => (
              <li key={log.id} className="flex items-start justify-between gap-3 border-b border-[#eef6f0] pb-2">
                <span className="text-[#14281c]">{log.message}</span>
                <span className="shrink-0 text-xs font-semibold uppercase text-[#10662A]">{log.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
