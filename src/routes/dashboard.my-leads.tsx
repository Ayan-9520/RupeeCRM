import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Phone, MapPin, Banknote } from "lucide-react";

export const Route = createFileRoute("/dashboard/my-leads")({
  head: () => ({ meta: [{ title: "My Leads — LeadMines" }] }),
  component: MyLeads,
});

type Purchase = {
  id: string;
  pipeline_stage: string;
  price_paid: number;
  created_at: string;
  leads: {
    applicant_name: string; full_phone: string; city: string;
    loan_type: string; loan_amount: number;
  } | null;
};

const STAGES = ["new", "contacted", "documents_collected", "submitted", "approved", "disbursed", "rejected"];

function MyLeads() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("lead_purchases")
        .select("id,pipeline_stage,price_paid,created_at,leads(applicant_name,full_phone,city,loan_type,loan_amount)")
        .eq("dsa_id", user.id)
        .order("created_at", { ascending: false });
      setPurchases((data ?? []) as unknown as Purchase[]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">My Leads</h1>
        <p className="text-muted-foreground mt-1">Pipeline of leads you've purchased. Drag-and-drop Kanban coming in Phase 3.</p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>
      ) : purchases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          You haven't purchased any leads yet. Visit the Leadboard to get started.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {purchases.map((p) => (
            <div key={p.id} className="rounded-2xl bg-card border border-border p-5 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{p.leads?.applicant_name ?? "—"}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Phone className="size-3" /> {p.leads?.full_phone}
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wide font-bold px-2 py-1 rounded-full bg-accent/15 text-accent">
                  {p.pipeline_stage.replace("_", " ")}
                </span>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-foreground/80">
                <div className="flex items-center gap-2"><MapPin className="size-3.5 text-muted-foreground" /> {p.leads?.city}</div>
                <div className="flex items-center gap-2"><Banknote className="size-3.5 text-muted-foreground" /> {p.leads?.loan_type.replace(/_/g, " ")} • ₹{p.leads?.loan_amount.toLocaleString("en-IN")}</div>
              </div>
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>Bought ₹{p.price_paid}</span>
                <span>{new Date(p.created_at).toLocaleDateString("en-IN")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Available stages: {STAGES.join(" → ")}</p>
    </div>
  );
}
