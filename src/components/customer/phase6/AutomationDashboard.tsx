import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Cog, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import { loadAutomationLogs, loadAutomationRules, toggleAutomationRule } from "@/lib/customer-crm/automation-engine";
import { DEFAULT_AUTOMATION_RULES } from "@/lib/customer-crm/phase6-constants";

export function AutomationDashboard() {
  const { user } = useAuth();
  const [rules, setRules] = useState<Awaited<ReturnType<typeof loadAutomationRules>>["rows"]>([]);
  const [logs, setLogs] = useState<Awaited<ReturnType<typeof loadAutomationLogs>>["rows"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [r, l] = await Promise.all([loadAutomationRules(user.id), loadAutomationLogs(user.id)]);
      setRules(r.rows);
      setLogs(l.rows);
      setLoading(false);
    })();
  }, [user]);

  const failed = logs.filter((l) => l.status === "failed");
  const pending = logs.filter((l) => l.retry_at && new Date(l.retry_at) > new Date());

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/dashboard" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="size-4" /> Dashboard
      </Link>
      <div className="flex items-center gap-2">
        <Cog className="size-7 text-accent" />
        <div>
          <h1 className="font-display text-2xl font-bold">Workflow Automation</h1>
          <p className="text-sm text-muted-foreground">Rules, logs, and retry queue</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Active rules", rules.filter((r) => r.enabled).length],
          ["Failed", failed.length],
          ["Retry queue", pending.length],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">{l}</p>
            <p className="text-2xl font-bold">{v}</p>
          </div>
        ))}
      </div>
      {loading ? (
        <Loader2 className="size-8 animate-spin mx-auto" />
      ) : (
        <>
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Play className="size-4" /> Automation rules
            </h2>
            <ul className="space-y-2">
              {(rules.length ? rules : DEFAULT_AUTOMATION_RULES.map((d) => ({ id: d.rule_key, rule_key: d.rule_key, name: d.name, enabled: true }))).map(
                (r) => (
                  <li key={r.id ?? r.rule_key} className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{r.rule_key}</p>
                    </div>
                    {"enabled" in r && r.id && typeof r.enabled === "boolean" && (
                      <Switch
                        checked={r.enabled}
                        onCheckedChange={(v) => toggleAutomationRule(r.id as string, v).then(() => loadAutomationRules(user!.id).then((x) => setRules(x.rows)))}
                      />
                    )}
                  </li>
                ),
              )}
            </ul>
          </section>
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-semibold mb-3">Recent automation logs</h2>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No automation runs yet</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto text-xs">
                {logs.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2 border-b border-border/40 pb-2">
                    <span>
                      <span className="font-mono text-accent">{l.rule_key}</span> — {l.message}
                    </span>
                    <span className="text-muted-foreground shrink-0 capitalize">{l.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

