import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Search, Users, Mail } from "lucide-react";
import { toast } from "sonner";
import { getBillingMe } from "@/lib/python-api";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import { MarketingUpgradeGate } from "@/components/marketing/MarketingUpgradeGate";

export const Route = createFileRoute("/dashboard/hrms/")({
  component: EmployeesPage,
});

type Member = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_owner: boolean;
  is_active: boolean;
};

function EmployeesPage() {
  const { hrmsSoft, entitlements, loading: entLoading } = useBillingEntitlements();
  const [list, setList] = useState<Member[]>([]);
  const [seats, setSeats] = useState({ used: 0, limit: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!hrmsSoft) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const me = await getBillingMe();
        setList(me.team ?? []);
        setSeats({ used: me.seats_used, limit: me.entitlements.seat_limit });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load team");
        setList([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [hrmsSoft]);

  if (entLoading || loading) {
    return (
      <div className="py-16 grid place-items-center">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  if (!hrmsSoft) {
    return (
      <MarketingUpgradeGate
        title="Team roster"
        description="Growth plan unlocks soft HRMS roster from your seat members."
      />
    );
  }

  const filtered = list.filter(
    (e) =>
      !search ||
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      e.role.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5c4d72]" />
          <Input
            placeholder="Search team…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-xs text-[#5c4d72]">
          Seats {seats.used} / {seats.limit} · {entitlements.plan_name || "plan"}
        </div>
        <Button asChild className="gap-2 bg-[#10662A] hover:bg-[#0d5222]">
          <Link to="/dashboard/billing">
            <Plus className="size-4" /> Invite seat
          </Link>
        </Button>
      </div>

      <div className="rounded-2xl bg-white border border-[#d8ecdd] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="size-10 mx-auto text-[#10662A]/30" />
            <p className="mt-3 text-sm text-[#5c4d72]">No seat members yet. Invite from Billing.</p>
            <Link to="/dashboard/billing" className="text-sm font-semibold text-[#10662A] hover:underline mt-2 inline-block">
              Open Billing
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium text-[#390A5D]">
                    {e.full_name}
                    {e.is_owner && (
                      <span className="ml-2 text-[10px] uppercase text-[#10662A]">Owner</span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize text-[#5c4d72]">{e.role}</TableCell>
                  <TableCell className="text-xs text-[#5c4d72]">
                    <span className="flex items-center gap-1">
                      <Mail className="size-3" />
                      {e.email}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded ${
                        e.is_active ? "bg-[#E8F7EC] text-[#10662A]" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {e.is_active ? "active" : "inactive"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
