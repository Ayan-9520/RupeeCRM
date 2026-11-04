import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Search, Users, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { getBillingMe, listCrmUsers, listMyDownline, listSalesGrades, setUserDesignation } from "@/lib/python-api";
import { useAuth } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/role-access";
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
  phone?: string | null;
  is_owner?: boolean;
  is_active: boolean;
  rm2_name?: string | null;
  rm2_status?: string;
  sales_grade?: string | null;
  sales_title?: string | null;
  reports_to_user_id?: string | null;
  reports_to_name?: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  ceo: "CEO",
  super_admin: "Super Admin",
  admin: "Admin",
  dsa: "Partner",
  caller: "Telecaller",
  coordinator: "Coordinator",
  lender: "Lender",
  affiliate: "Affiliate",
  customer: "Customer",
};

function EmployeesPage() {
  const { role } = useAuth();
  const admin = isPlatformAdmin(role);
  const { hrmsSoft, entitlements, loading: entLoading } = useBillingEntitlements();
  const [list, setList] = useState<Member[]>([]);
  const [seats, setSeats] = useState({ used: 0, limit: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [grades, setGrades] = useState<{ code: string; title: string }[]>([]);

  useEffect(() => {
    if (!hrmsSoft) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const me = await getBillingMe();
        setSeats({ used: me.seats_used, limit: me.entitlements.seat_limit });
        const gradeBook = await listSalesGrades().catch(() => ({ items: [] as { code: string; title: string }[] }));
        setGrades(gradeBook.items);
        const users = admin ? await listCrmUsers() : await listMyDownline();
        setList(
          users.items.map((u) => ({
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            phone: u.phone,
            is_active: u.is_active,
            rm2_name: "rm2_name" in u ? u.rm2_name : undefined,
            rm2_status: "rm2_status" in u ? u.rm2_status || "Not set" : "Not set",
            sales_grade: u.sales_grade,
            sales_title: u.sales_title,
            reports_to_user_id: u.reports_to_user_id,
            reports_to_name: u.reports_to_name,
          })),
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load team");
        setList([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [hrmsSoft, admin]);

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

  const filtered = list.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.full_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q) ||
      (e.phone || "").includes(q) ||
      (e.rm2_name || "").toLowerCase().includes(q) ||
      (e.rm2_status || "").toLowerCase().includes(q) ||
      (e.sales_title || "").toLowerCase().includes(q) ||
      (e.sales_grade || "").toLowerCase().includes(q) ||
      (e.reports_to_name || "").toLowerCase().includes(q)
    );
  });

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

      <div className="overflow-hidden rounded-3xl border border-[#d8ecdd] bg-white shadow-[0_16px_40px_rgba(16,102,42,0.06)]">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="size-10 mx-auto text-[#10662A]/30" />
            <p className="mt-3 text-sm text-[#5c4d72]">No people yet. Invite from Billing.</p>
            <Link to="/dashboard/billing" className="text-sm font-semibold text-[#10662A] hover:underline mt-2 inline-block">
              Open Billing
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f4faf6] hover:bg-[#f4faf6]">
                <TableHead className="text-[#0e4d28]">Name</TableHead>
                <TableHead className="text-[#0e4d28]">Designation</TableHead>
                <TableHead className="text-[#0e4d28]">Reports to</TableHead>
                <TableHead className="text-[#0e4d28]">Role</TableHead>
                <TableHead className="text-[#0e4d28]">Number</TableHead>
                <TableHead className="text-[#0e4d28]">Email</TableHead>
                <TableHead className="text-[#0e4d28]">RM2 status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const assigned = (e.rm2_status || "Not set") === "Assigned";
                return (
                  <TableRow key={e.id} className="hover:bg-[#f8fdf9]">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0e4d28] text-xs font-bold text-white">
                          {(e.full_name || "?").slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <div className="font-semibold text-[#14281c]">{e.full_name}</div>
                          {e.is_owner && <div className="text-[10px] font-bold uppercase tracking-wide text-[#0e4d28]">Owner</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {admin ? (
                        <select
                          value={e.sales_grade || ""}
                          onChange={(event) => {
                            const sales_grade = event.target.value || null;
                            void setUserDesignation(e.id, { sales_grade, reports_to_user_id: e.reports_to_user_id || null })
                              .then(() => {
                                const title = grades.find((g) => g.code === sales_grade)?.title || null;
                                setList((prev) => prev.map((row) => (row.id === e.id ? { ...row, sales_grade, sales_title: title } : row)));
                              })
                              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not save designation"));
                          }}
                          className="rounded-full border border-[#d8ecdd] bg-[#f4faf6] px-2 py-1 text-xs font-semibold text-[#0e4d28]"
                        >
                          <option value="">Not set</option>
                          {grades.map((g) => (
                            <option key={g.code} value={g.code}>{g.code} · {g.title}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm font-semibold text-[#14281c]">{e.sales_grade ? `${e.sales_grade} · ${e.sales_title}` : "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {admin ? (
                        <select
                          value={e.reports_to_user_id || ""}
                          onChange={(event) => {
                            const reports_to_user_id = event.target.value || null;
                            void setUserDesignation(e.id, { sales_grade: e.sales_grade || null, reports_to_user_id })
                              .then(() => {
                                const manager = list.find((row) => row.id === reports_to_user_id);
                                setList((prev) => prev.map((row) => (row.id === e.id ? { ...row, reports_to_user_id, reports_to_name: manager?.full_name || null } : row)));
                              })
                              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not save manager"));
                          }}
                          className="max-w-[180px] rounded-full border border-[#d8ecdd] bg-white px-2 py-1 text-xs text-[#14281c]"
                        >
                          <option value="">No manager</option>
                          {list.filter((row) => row.id !== e.id).map((row) => (
                            <option key={row.id} value={row.id}>{row.full_name}{row.sales_grade ? ` · ${row.sales_grade}` : ""}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-[#14281c]">{e.reports_to_name || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-[#E8F7EC] px-2.5 py-1 text-xs font-semibold text-[#0e4d28]">
                        {ROLE_LABEL[e.role] || e.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-[#14281c]">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="size-3.5 text-[#0e4d28]" />
                        {e.phone || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-[#14281c]">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="size-3.5 text-[#0e4d28]" />
                        {e.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${assigned ? "bg-[#E8F7EC] text-[#0e4d28]" : "bg-[#f4f1ea] text-[#6b645b]"}`}>
                        {assigned ? `Assigned${e.rm2_name ? ` · ${e.rm2_name}` : ""}` : "Not set"}
                      </span>
                      <span className={`ml-2 text-[10px] font-bold uppercase ${e.is_active ? "text-[#0e4d28]" : "text-red-700"}`}>
                        {e.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
