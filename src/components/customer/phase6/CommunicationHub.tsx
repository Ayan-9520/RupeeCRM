import { useCallback, useEffect, useState } from "react";
import { Mail, MessageSquare, Phone, Send, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SectionShell } from "../shared/SectionShell";
import { COMM_CHANNELS, type CommChannel } from "@/lib/customer-crm/phase6-constants";
import { loadCommunications, loadCommTemplates, saveCommunication } from "@/lib/customer-crm/phase6-api";
import { generateMessageDraft } from "@/lib/customer-crm/ai-intelligence";
import type { CustomerProfile, CustomerWorkspaceData } from "@/lib/customer-crm/types";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

const ICONS = { call: Phone, whatsapp: MessageSquare, sms: MessageSquare, email: Mail };

export function CommunicationHub({
  profile,
  workspace,
  phone,
}: {
  profile: CustomerProfile;
  workspace: CustomerWorkspaceData;
  phone: string;
}) {
  const { user } = useAuth();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof loadCommunications>>["rows"]>([]);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof loadCommTemplates>>["rows"]>([]);
  const [channel, setChannel] = useState<CommChannel>("whatsapp");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [schedule, setSchedule] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [h, t] = await Promise.all([loadCommunications(profile.lead_purchase_id), loadCommTemplates(user.id)]);
    setHistory(h.rows);
    setTemplates(t.rows);
    setLoading(false);
  }, [profile.lead_purchase_id, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const send = async () => {
    if (!user || !body.trim()) return;
    await saveCommunication({
      customer_profile_id: profile.id,
      lead_purchase_id: profile.lead_purchase_id,
      dsa_id: profile.dsa_id,
      channel,
      body: body.trim(),
      subject: subject || undefined,
      scheduled_at: schedule || null,
      created_by: user.id,
    });
    toast.success(schedule ? "Scheduled" : "Logged");
    setBody("");
    refresh();
  };

  const wa = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(body)}`;

  return (
    <SectionShell title="Communication Hub" description="Calls, WhatsApp, SMS, email" icon={MessageSquare}>
      <Tabs value={channel} onValueChange={(v) => setChannel(v as CommChannel)}>
        <TabsList className="mb-4">
          {COMM_CHANNELS.map((c) => {
            const Icon = ICONS[c];
            return (
              <TabsTrigger key={c} value={c} className="capitalize text-xs">
                <Icon className="size-3 mr-1" />
                {c}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {COMM_CHANNELS.map((c) => (
          <TabsContent key={c} value={c} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {templates
                .filter((t) => t.channel === c)
                .map((t) => (
                  <Button key={t.id} type="button" size="sm" variant="outline" onClick={() => setBody(t.body_template.replace(/\{\{name\}\}/g, profile.full_name ?? "Customer"))}>
                    {t.name}
                  </Button>
                ))}
              <Button type="button" size="sm" variant="secondary" onClick={() => setBody(generateMessageDraft(c, workspace, "followup"))}>
                AI draft
              </Button>
            </div>
            {c === "email" && <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />}
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={`${c} message…`} />
            <Input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={send}>
                <Send className="size-4 mr-1" /> Log / schedule
              </Button>
              {c === "call" && (
                <a href={`tel:${phone}`} className="inline-flex items-center px-3 py-1.5 rounded-md border text-xs font-semibold">
                  <Phone className="size-4 mr-1" /> Call
                </a>
              )}
              {c === "whatsapp" && body && (
                <a href={wa} target="_blank" rel="noopener" className="inline-flex items-center px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold">
                  Open WhatsApp
                </a>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      <div className="mt-6 border-t border-border pt-4">
        <p className="text-xs font-bold uppercase text-muted-foreground mb-2">History</p>
        {loading ? (
          <Loader2 className="size-5 animate-spin mx-auto" />
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No communications logged</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {history.map((h) => (
              <li key={h.id} className="text-xs border border-border rounded-lg p-2">
                <span className="font-semibold capitalize">{h.channel}</span> · {new Date(h.created_at).toLocaleString("en-IN")}
                <p className="text-muted-foreground line-clamp-2 mt-0.5">{h.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionShell>
  );
}


