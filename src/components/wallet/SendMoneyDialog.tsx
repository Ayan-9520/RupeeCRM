import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Recipient = { id: string; full_name: string | null; dsa_id: string | null; phone: string | null };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentBalance: number;
  onSuccess: () => void;
}

export function SendMoneyDialog({ open, onOpenChange, currentBalance, onSuccess }: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Recipient[]>([]);
  const [picked, setPicked] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const reset = () => {
    setQuery(""); setResults([]); setPicked(null); setAmount(""); setNote("");
  };

  const search = async () => {
    const q = query.trim();
    if (q.length < 3) return toast.error("Type at least 3 characters");
    setSearching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,dsa_id,phone")
      .or(`dsa_id.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(8);
    setSearching(false);
    if (error) return toast.error(error.message);
    setResults((data ?? []) as Recipient[]);
    if (!data?.length) toast.info("No partners found");
  };

  const send = async () => {
    if (!picked) return toast.error("Pick a recipient");
    const amt = Number(amount);
    if (!amt || amt < 10) return toast.error("Minimum ₹10");
    if (amt > currentBalance) return toast.error("Amount exceeds your balance");
    setSending(true);
    const { data, error } = await supabase.rpc("transfer_money", {
      _to_user_id: picked.id,
      _amount: amt,
      _note: note.trim() || null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    const result = data as { recipient_name?: string; new_balance?: number } | null;
    toast.success(`₹${amt} sent to ${result?.recipient_name ?? "recipient"}`);
    reset();
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="size-4 text-accent" /> Send money</DialogTitle>
          <DialogDescription>
            Transfer wallet balance to another partner. Available: ₹{currentBalance.toLocaleString("en-IN")}
          </DialogDescription>
        </DialogHeader>

        {!picked ? (
          <div className="space-y-3">
            <Label>Find recipient</Label>
            <div className="flex gap-2">
              <Input
                placeholder="DSA ID, name, or phone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
              <Button onClick={search} disabled={searching} variant="outline">
                {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>
            {results.length > 0 && (
              <ul className="border border-border rounded-xl divide-y divide-border max-h-64 overflow-auto">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setPicked(r)}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-smooth"
                    >
                      <div className="text-sm font-medium">{r.full_name || "Unnamed partner"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.dsa_id ? `${r.dsa_id} · ` : ""}{r.phone || "—"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Sending to</div>
                <div className="font-medium text-sm">{picked.full_name || "Unnamed"}</div>
                <div className="text-xs text-muted-foreground">
                  {picked.dsa_id ? `${picked.dsa_id} · ` : ""}{picked.phone || "—"}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>Change</Button>
            </div>

            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number" min={10} max={50000} step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Min ₹10, max ₹50,000"
              />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Lead share, refund" maxLength={100} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={!picked || sending || !amount}>
            {sending ? <><Loader2 className="size-4 animate-spin mr-2" /> Sending</> : <>Send ₹{amount || "0"}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
