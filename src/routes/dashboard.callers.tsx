import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Headphones, Loader2, X } from "lucide-react";
import {
  createMyCaller,
  listMyCallers,
  resetMyCallerPassword,
  updateMyCaller,
  type MyCaller,
} from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/callers")({
  head: () => ({ meta: [{ title: "Telecallers — RupeeOne" }] }),
  component: PartnerCallersPage,
});

const EMPTY = { full_name: "", email: "", phone: "", base_location: "", gender: "" };

function joined(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function PartnerCallersPage() {
  const [rows, setRows] = useState<MyCaller[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<MyCaller | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listMyCallers();
      setRows(data.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load telecallers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await createMyCaller(form);
      toast.success(
        created.emailed
          ? `${created.full_name} can sign in on Employee Login. Password emailed to them and to you.`
          : `${created.full_name} can sign in. Password: ${created.temporary_password}`,
      );
      setForm(EMPTY);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the telecaller");
    } finally {
      setBusy(false);
    }
  };

  const reset = async (row: MyCaller) => {
    setBusy(true);
    try {
      const result = await resetMyCallerPassword(row.id);
      const next = { ...row, issued_password: result.issued_password || row.issued_password };
      setRows((items) => items.map((item) => (item.id === row.id ? next : item)));
      setOpen((current) => (current && current.id === row.id ? next : current));
      toast.success(
        result.emailed
          ? `Reset link emailed to ${result.email}. The new password shows here after they set it.`
          : `Email is not set up. Password: ${result.issued_password}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not email the reset");
    } finally {
      setBusy(false);
    }
  };

  const save = async (row: MyCaller) => {
    setBusy(true);
    try {
      const saved = await updateMyCaller(row.id, {
        full_name: row.full_name,
        phone: row.phone,
        base_location: row.base_location,
        gender: row.gender,
        is_active: row.is_active,
      });
      setRows((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      setOpen(saved);
      toast.success("Telecaller updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#10662A]">Your team</p>
        <h1 className="font-display text-2xl font-bold text-[#390A5D] lg:text-3xl">Telecallers</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#5c4d72]">
          These callers work under your login. They sign in on Employee Login and see only your leads. The password here is the one they use. Email reset lets them set a new one, and that new password shows in this list and for admin.
        </p>
      </div>

      <form onSubmit={(event) => void create(event)} className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
        <h2 className="font-display text-base font-bold text-[#390A5D]">Add a telecaller</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} placeholder="Name" className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm lg:col-span-2" />
          <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm lg:col-span-2" />
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone" className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm" />
          <input value={form.base_location} onChange={(event) => setForm({ ...form, base_location: event.target.value })} placeholder="City" className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm" />
          <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm">
            <option value="">Gender</option>
            <option>Female</option>
            <option>Male</option>
            <option>Other</option>
          </select>
          <button type="submit" disabled={busy} className="h-10 rounded-xl bg-[#10662A] px-4 text-sm font-semibold text-white disabled:opacity-60 lg:col-span-5">
            {busy ? "Adding…" : "Add telecaller"}
          </button>
        </div>
        <p className="mt-2 text-xs text-[#5c4d72]">Up to 10. They do not see other partners' leads, documents, or payout.</p>
      </form>

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-[#10662A]" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#d8ecdd] bg-white p-12 text-center">
          <Headphones className="mx-auto size-6 text-[#10662A]" />
          <h2 className="mt-3 font-display text-xl font-bold text-[#390A5D]">No telecaller yet</h2>
          <p className="mt-2 text-sm text-[#5c4d72]">You record the first call yourself until you add one.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#d8ecdd] bg-white">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-[#5c4d72]">
              <tr>
                {["Name", "Email", "Phone", "City", "Joining date", "Password", "Status", ""].map((head) => (
                  <th key={head || "open"} className="whitespace-nowrap bg-[#E8F7EC] px-4 py-3">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 font-semibold text-[#390A5D]">{row.full_name}</td>
                  <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 text-[#5c4d72]">{row.email}</td>
                  <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 text-[#5c4d72]">{row.phone || "—"}</td>
                  <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 text-[#5c4d72]">{row.base_location || "—"}</td>
                  <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 text-[#5c4d72]">{joined(row.created_at)}</td>
                  <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 font-mono text-xs text-[#390A5D]">{row.issued_password || "—"}</td>
                  <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${row.is_active ? "bg-[#E8F7EC] text-[#10662A]" : "bg-slate-100 text-slate-500"}`}>
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3">
                    <button type="button" onClick={() => setOpen(row)} className="text-sm font-semibold text-[#10662A]">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <CallerPopup
          row={open}
          busy={busy}
          onChange={setOpen}
          onClose={() => setOpen(null)}
          onSave={() => void save(open)}
          onReset={() => void reset(open)}
        />
      ) : null}
    </div>
  );
}

function CallerPopup({
  row,
  busy,
  onChange,
  onClose,
  onSave,
  onReset,
}: {
  row: MyCaller;
  busy: boolean;
  onChange: (row: MyCaller) => void;
  onClose: () => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const facts: [string, string][] = [
    ["Employee ID", row.employee_code || "—"],
    ["Email", row.email],
    ["Password", row.issued_password || "Not saved yet"],
    ["Login", "Employee Login"],
    ["Role", "Telecaller"],
    ["Sees", "Only your new and contacted leads"],
    ["Joining date", joined(row.created_at)],
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#14281c]/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A]">Telecaller</p>
            <h2 className="font-display text-xl font-bold text-[#390A5D]">{row.full_name}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-[#5c4d72]"><X className="size-4" /></button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className={label === "Password" || label === "Email" ? "col-span-2" : ""}>
              <dt className="text-[11px] uppercase tracking-wide text-[#5c4d72]">{label}</dt>
              <dd className={`font-medium text-[#14281c] ${label === "Password" ? "font-mono" : ""}`}>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[#5c4d72]">Name
            <input value={row.full_name} onChange={(event) => onChange({ ...row, full_name: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#d8ecdd] px-3 text-sm font-normal text-[#14281c]" />
          </label>
          <label className="text-xs font-semibold text-[#5c4d72]">Phone
            <input value={row.phone} onChange={(event) => onChange({ ...row, phone: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#d8ecdd] px-3 text-sm font-normal text-[#14281c]" />
          </label>
          <label className="text-xs font-semibold text-[#5c4d72]">City
            <input value={row.base_location} onChange={(event) => onChange({ ...row, base_location: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#d8ecdd] px-3 text-sm font-normal text-[#14281c]" />
          </label>
          <label className="text-xs font-semibold text-[#5c4d72]">Gender
            <select value={row.gender} onChange={(event) => onChange({ ...row, gender: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#d8ecdd] px-3 text-sm font-normal text-[#14281c]">
              <option value="">—</option>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-[#390A5D]">
          <input type="checkbox" checked={row.is_active} onChange={(event) => onChange({ ...row, is_active: event.target.checked })} />
          Active. An inactive caller cannot sign in, and you record the first call yourself.
        </label>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={onSave} className="rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Save</button>
          <button type="button" disabled={busy} onClick={onReset} className="rounded-xl border border-[#d8ecdd] px-4 py-2 text-sm font-semibold text-[#390A5D] disabled:opacity-60">Email reset</button>
        </div>
      </div>
    </div>
  );
}
