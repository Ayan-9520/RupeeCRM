import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Loader2, Banknote, Smartphone, IndianRupee, Info } from "lucide-react";

const MIN = 500;

type Method = "bank" | "upi";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}

export function WithdrawDialog({ open, onOpenChange, onSuccess }: Props) {
  const { user } = useAuth();
  const [available, setAvailable] = useState<number>(0);
  const [pendingExists, setPendingExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<Method>("upi");
  const [upi, setUpi] = useState("");
  const [bankAcc, setBankAcc] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [holder, setHolder] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    (async () => {
      const [availRes, pendingRes] = await Promise.all([
        supabase.rpc("user_withdrawable", { _user_id: user.id }),
        supabase.from("payout_requests").select("id").eq("user_id", user.id).eq("status", "pending").limit(1),
      ]);
      setAvailable(Number(availRes.data ?? 0));
      setPendingExists((pendingRes.data ?? []).length > 0);
      setLoading(false);
    })();
  }, [open, user]);

  const reset = () => {
    setAmount(""); setUpi(""); setBankAcc(""); setIfsc(""); setHolder("");
  };

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt < MIN) { toast.error(`Minimum withdrawal is ₹${MIN}`); return; }
    if (amt > available) { toast.error("Amount exceeds your available balance"); return; }
    if (method === "upi" && upi.trim().length < 3) { toast.error("Enter a valid UPI ID"); return; }
    if (method === "bank" && (!bankAcc || !ifsc || !holder)) { toast.error("Fill all bank details"); return; }

    setSubmitting(true);
    const { error } = await supabase.rpc("request_payout", {
      _amount: amt,
      _method: method,
      _upi_id: method === "upi" ? upi.trim() : undefined,
      _bank_account: method === "bank" ? bankAcc.trim() : undefined,
      _ifsc: method === "bank" ? ifsc.trim().toUpperCase() : undefined,
      _account_holder: method === "bank" ? holder.trim() : undefined,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Withdrawal request submitted");
    reset();
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="size-5 text-emerald-600" /> Request withdrawal
          </DialogTitle>
          <DialogDescription>
            Cash out your paid commissions. Minimum ₹{MIN}.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin text-accent" /></div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary/40 p-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Available to withdraw</div>
                <div className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{available.toLocaleString("en-IN")}
                </div>
              </div>
              <IndianRupee className="size-7 text-emerald-500/60" />
            </div>

            {pendingExists && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                <Info className="size-4 mt-0.5 shrink-0" />
                <span>You already have a pending request. Wait for it to be processed before submitting another.</span>
              </div>
            )}

            <div>
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount" type="number" min={MIN} step={1}
                value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder={`Minimum ${MIN}`}
                disabled={pendingExists || available < MIN}
              />
              <div className="flex gap-2 mt-1.5">
                {[500, 1000, 5000].filter(v => v <= available).map(v => (
                  <button
                    key={v} type="button"
                    onClick={() => setAmount(String(v))}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-accent/20 border border-border"
                  >₹{v}</button>
                ))}
                {available >= MIN && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(Math.floor(available)))}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-accent/20 border border-border"
                  >Max</button>
                )}
              </div>
            </div>

            <div>
              <Label>Payout method</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {(["upi", "bank"] as Method[]).map((m) => (
                  <button
                    key={m} type="button"
                    onClick={() => setMethod(m)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                      method === m
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-card hover:border-accent/50"
                    }`}
                  >
                    {m === "upi" ? <Smartphone className="size-4" /> : <Banknote className="size-4" />}
                    {m === "upi" ? "UPI" : "Bank transfer"}
                  </button>
                ))}
              </div>
            </div>

            {method === "upi" ? (
              <div>
                <Label htmlFor="upi">UPI ID</Label>
                <Input id="upi" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@oksbi" disabled={pendingExists} />
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <Label htmlFor="holder">Account holder name</Label>
                  <Input id="holder" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="As per bank records" disabled={pendingExists} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="acc">Account number</Label>
                    <Input id="acc" value={bankAcc} onChange={(e) => setBankAcc(e.target.value)} placeholder="123456789012" disabled={pendingExists} />
                  </div>
                  <div>
                    <Label htmlFor="ifsc">IFSC</Label>
                    <Input id="ifsc" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" disabled={pendingExists} />
                  </div>
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Payouts are reviewed by admin within 24–48 business hours and transferred manually to the chosen account.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || pendingExists || available < MIN || loading}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
