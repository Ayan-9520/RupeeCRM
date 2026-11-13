import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { getMyDesk, saveHrProfile, type DeskNode, type DeskPerson } from "@/lib/python-api";
import { departmentLabel } from "@/lib/login-door";
import { toast } from "sonner";

const LEVEL: Record<string, string> = {
  rm: "RM",
  manager: "Manager",
  business_head: "Business head",
  accounts: "Accounts",
};

const TABS = ["Profile", "Bank & Statutory", "Agent Details", "Documents", "Visa", "My team"] as const;

const BLANK: Record<string, string> = {
  personal_email: "",
  birthday: "",
  gender: "",
  address: "",
  employment_status: "",
  biometric_code: "",
  office: "",
  whatsapp: "",
  facebook: "",
  linkedin: "",
  skype: "",
  twitter: "",
  about: "",
  base_location: "",
  region: "",
  line_name: "",
  regional_head: "",
  confirmation_status: "",
  blood_group: "",
  father_name: "",
  spouse_name: "",
  marital_status: "",
  marriage_date: "",
  nationality: "",
  bank_name: "",
  account_number: "",
  ifsc: "",
  pan: "",
  uan: "",
  agent_code: "",
  visa_country: "",
  visa_type: "",
  visa_expiry: "",
  weekly_off: "",
  shift_timing: "",
  employee_type: "",
  esic_eligible: "",
  induction: "",
  email_quota: "",
  pf_eligible: "",
  probation_period: "",
  notice_period: "",
  qualification: "",
  institute: "",
  aadhaar: "",
  specially_abled: "",
  emergency_phone: "",
  emergency_person: "",
  emergency_relation: "",
  education_lines: "",
  language_lines: "",
  photo: "",
};

function linesOf(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function shown(value: string | null | undefined) {
  const text = (value || "").trim();
  return text || "—";
}

function when(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 border-b border-[#f3f6f4] py-2 text-sm last:border-0">
      <div className="text-[#5c4d72]">{label}</div>
      <div className="font-medium text-[#14281c]">{value}</div>
    </div>
  );
}

function Field({
  label,
  name,
  form,
  editing,
  onChange,
}: {
  label: string;
  name: string;
  form: Record<string, string>;
  editing: boolean;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <label className="grid grid-cols-1 gap-1 border-b border-[#f3f6f4] py-2 text-sm last:border-0 sm:grid-cols-[160px_1fr] sm:gap-3">
      <span className="text-[#5c4d72]">{label}</span>
      {editing ? (
        <input
          value={form[name] || ""}
          onChange={(event) => onChange(name, event.target.value)}
          className="h-9 rounded-lg border border-[#d8ecdd] px-2"
        />
      ) : (
        <span className="font-medium text-[#14281c]">{shown(form[name])}</span>
      )}
    </label>
  );
}

function TeamBranch({ node }: { node: DeskNode }) {
  const title = [node.sales_title, departmentLabel(node.department)].filter(Boolean).join(" · ");
  return (
    <li className="mt-2">
      <div className="rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2">
        <div className="font-semibold text-[#390A5D]">
          {node.full_name}
          {node.sales_grade ? <span className="ml-1 text-xs text-[#5c4d72]">({node.sales_grade})</span> : null}
        </div>
        <div className="text-xs text-[#5c4d72]">{title || "Employee"} · {node.email}</div>
      </div>
      {node.children.length > 0 ? (
        <ul className="ml-4 border-l border-[#d8ecdd] pl-3">
          {node.children.map((child) => (
            <TeamBranch key={child.id} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function StaffProfile() {
  const [desk, setDesk] = useState<{ me: DeskPerson; chain: DeskPerson[]; team: DeskNode[] } | null>(null);
  const [form, setForm] = useState(BLANK);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Profile");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    let alive = true;
    getMyDesk()
      .then((row) => {
        if (!alive) return;
        setDesk(row);
        setForm({ ...BLANK, ...(row.me.hr_profile || {}) });
      })
      .catch(() => {
        if (alive) setDesk(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const uploadPhoto = async () => {
    if (!photoFile) return;
    const bitmap = await createImageBitmap(photoFile);
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const photo = canvas.toDataURL("image/jpeg", 0.82);
    const next = { ...form, photo };
    setSaving(true);
    try {
      const saved = await saveHrProfile(next);
      setForm({ ...BLANK, ...saved });
      setPhotoOpen(false);
      setPhotoFile(null);
      toast.success("Photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload the photo");
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveHrProfile(form);
      setForm({ ...BLANK, ...saved });
      setEditing(false);
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-[#10662A]" />
      </div>
    );
  }
  if (!desk) return <p className="text-sm text-red-700">Could not load profile</p>;

  const me = desk.me;
  const boss = desk.chain[0];
  const initial = (me.full_name || "?").trim().charAt(0).toUpperCase();
  const set = (name: string, value: string) => setForm((current) => ({ ...current, [name]: value }));

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
        <div className="flex flex-wrap gap-6">
          <button type="button" onClick={() => setPhotoOpen(true)} className="grid size-20 place-items-center overflow-hidden rounded-full bg-[#E8F7EC] font-display text-3xl font-bold text-[#10662A] ring-4 ring-[#E8F7EC]" aria-label="Update profile picture">
            {form.photo ? <img src={form.photo} alt="" className="h-full w-full object-cover" /> : initial}
          </button>
          <div className="min-w-[220px] flex-1">
            <h1 className="font-display text-2xl font-bold text-[#390A5D]">
              {me.full_name}
              {me.sales_grade ? <span className="ml-2 text-lg text-[#5c4d72]">({me.sales_grade})</span> : null}
            </h1>
            <p className="text-sm text-[#5c4d72]">Employee code · {me.employee_code}</p>
            <p className="mt-1 text-sm font-medium text-[#14281c]">{me.sales_title || "Employee"}</p>
            <p className="text-sm text-[#5c4d72]">{shown(form.office) === "—" ? "RupeeDial" : form.office}</p>
            <p className="text-sm text-[#5c4d72]">Date of join · {when(me.joined_at)}</p>
          </div>
          <div className="min-w-[260px] flex-1 text-sm">
            <Row label="Email" value={me.email} />
            <Row label="Birthday" value={shown(form.birthday)} />
            <Row label="Address" value={shown(form.address)} />
            <Row label="Gender" value={shown(form.gender)} />
            <Row label="Employment status" value={shown(form.employment_status)} />
            <Row label="Reports to" value={boss ? `${boss.full_name}${boss.sales_grade ? ` (${boss.sales_grade})` : ""}` : "—"} />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tab === item ? "bg-[#10662A] text-white" : "bg-white text-[#390A5D] border border-[#d8ecdd]"}`}
            >
              {item}
            </button>
          ))}
        </div>
        {tab !== "My team" && tab !== "Documents" ? (
          editing ? (
            <button type="button" onClick={() => void save()} disabled={saving} className="h-9 rounded-full bg-[#10662A] px-4 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="h-9 rounded-full border border-[#d8ecdd] bg-white px-4 text-sm font-semibold text-[#10662A]">
              Edit details
            </button>
          )
        ) : null}
      </div>

      {tab === "Profile" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
            <h2 className="font-semibold text-[#390A5D]">Contact details</h2>
            <Field label="Personal email" name="personal_email" form={form} editing={editing} onChange={set} />
            <Field label="Current address" name="address" form={form} editing={editing} onChange={set} />
            <Row label="Phone" value={shown(me.phone)} />
            <Field label="WhatsApp" name="whatsapp" form={form} editing={editing} onChange={set} />
          </section>
          <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
            <h2 className="font-semibold text-[#390A5D]">Social</h2>
            <Field label="Facebook" name="facebook" form={form} editing={editing} onChange={set} />
            <Field label="LinkedIn" name="linkedin" form={form} editing={editing} onChange={set} />
            <Field label="Skype" name="skype" form={form} editing={editing} onChange={set} />
            <Field label="Twitter" name="twitter" form={form} editing={editing} onChange={set} />
            <Field label="About me" name="about" form={form} editing={editing} onChange={set} />
          </section>
          <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
            <h2 className="font-semibold text-[#390A5D]">Employment</h2>
            <Row label="Department" value={departmentLabel(me.department) || "—"} />
            <Row label="Designation" value={me.sales_title || "—"} />
            <Row label="Seat" value={me.finance_level ? LEVEL[me.finance_level] || me.finance_level : "—"} />
            <Field label="Base location" name="base_location" form={form} editing={editing} onChange={set} />
            <Field label="Line" name="line_name" form={form} editing={editing} onChange={set} />
            <Field label="Region" name="region" form={form} editing={editing} onChange={set} />
            <Field label="Regional head" name="regional_head" form={form} editing={editing} onChange={set} />
            <Field label="Confirmation" name="confirmation_status" form={form} editing={editing} onChange={set} />
            <Field label="Weekly off" name="weekly_off" form={form} editing={editing} onChange={set} />
            <Field label="Shift timing" name="shift_timing" form={form} editing={editing} onChange={set} />
            <Field label="Employee type" name="employee_type" form={form} editing={editing} onChange={set} />
            <Field label="ESIC eligible" name="esic_eligible" form={form} editing={editing} onChange={set} />
            <Field label="Induction" name="induction" form={form} editing={editing} onChange={set} />
            <Field label="Email quota" name="email_quota" form={form} editing={editing} onChange={set} />
            <Field label="PF eligible" name="pf_eligible" form={form} editing={editing} onChange={set} />
            <Field label="Probation period" name="probation_period" form={form} editing={editing} onChange={set} />
            <Field label="Notice period" name="notice_period" form={form} editing={editing} onChange={set} />
            <Field label="Biometric code" name="biometric_code" form={form} editing={editing} onChange={set} />
            <Field label="Office" name="office" form={form} editing={editing} onChange={set} />
            <Field label="Birthday" name="birthday" form={form} editing={editing} onChange={set} />
            <Field label="Gender" name="gender" form={form} editing={editing} onChange={set} />
            <Field label="Employment status" name="employment_status" form={form} editing={editing} onChange={set} />
          </section>
          <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
            <h2 className="font-semibold text-[#390A5D]">Personal</h2>
            <Field label="Blood group" name="blood_group" form={form} editing={editing} onChange={set} />
            <Field label="Father's name" name="father_name" form={form} editing={editing} onChange={set} />
            <Field label="Spouse name" name="spouse_name" form={form} editing={editing} onChange={set} />
            <Field label="Marital status" name="marital_status" form={form} editing={editing} onChange={set} />
            <Field label="Date of marriage" name="marriage_date" form={form} editing={editing} onChange={set} />
            <Field label="Nationality" name="nationality" form={form} editing={editing} onChange={set} />
            <Field label="Qualification" name="qualification" form={form} editing={editing} onChange={set} />
            <Field label="Institute" name="institute" form={form} editing={editing} onChange={set} />
            <Field label="Aadhaar" name="aadhaar" form={form} editing={editing} onChange={set} />
            <Field label="Specially abled" name="specially_abled" form={form} editing={editing} onChange={set} />
          </section>
          <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
            <h2 className="font-semibold text-[#390A5D]">Emergency contact</h2>
            <Field label="Phone" name="emergency_phone" form={form} editing={editing} onChange={set} />
            <Field label="Contact person" name="emergency_person" form={form} editing={editing} onChange={set} />
            <Field label="Relation" name="emergency_relation" form={form} editing={editing} onChange={set} />
          </section>
          <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
            <h2 className="font-semibold text-[#390A5D]">Education</h2>
            {editing ? (
              <textarea value={form.education_lines} onChange={(event) => set("education_lines", event.target.value)} placeholder={"Course | College | Year | Percent"} className="mt-3 min-h-24 w-full rounded-xl border border-[#d8ecdd] p-3 text-sm" />
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead className="bg-[#0D4F20] text-left text-white">
                  <tr><th className="px-2 py-1.5">Course</th><th className="px-2 py-1.5">College</th><th className="px-2 py-1.5">Year</th><th className="px-2 py-1.5">%</th></tr>
                </thead>
                <tbody>
                  {linesOf(form.education_lines).length === 0 ? (
                    <tr><td className="px-2 py-2 text-[#5c4d72]" colSpan={4}>—</td></tr>
                  ) : linesOf(form.education_lines).map((line) => {
                    const [course, college, year, percent] = line.split("|").map((part) => part.trim());
                    return <tr key={line} className="border-b border-[#f3f6f4]"><td className="px-2 py-1.5">{course || "—"}</td><td className="px-2 py-1.5">{college || "—"}</td><td className="px-2 py-1.5">{year || "—"}</td><td className="px-2 py-1.5">{percent || "—"}</td></tr>;
                  })}
                </tbody>
              </table>
            )}
          </section>
          <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5 lg:col-span-2">
            <h2 className="font-semibold text-[#390A5D]">Languages</h2>
            {editing ? (
              <textarea value={form.language_lines} onChange={(event) => set("language_lines", event.target.value)} placeholder={"English | Fluent"} className="mt-3 min-h-20 w-full rounded-xl border border-[#d8ecdd] p-3 text-sm" />
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead className="bg-[#0D4F20] text-left text-white">
                  <tr><th className="px-2 py-1.5">Language</th><th className="px-2 py-1.5">Level</th></tr>
                </thead>
                <tbody>
                  {linesOf(form.language_lines).length === 0 ? (
                    <tr><td className="px-2 py-2 text-[#5c4d72]" colSpan={2}>—</td></tr>
                  ) : linesOf(form.language_lines).map((line) => {
                    const [language, level] = line.split("|").map((part) => part.trim());
                    return <tr key={line} className="border-b border-[#f3f6f4]"><td className="px-2 py-1.5">{language || "—"}</td><td className="px-2 py-1.5">{level || "—"}</td></tr>;
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>
      ) : null}

      {tab === "Bank & Statutory" ? (
        <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
          <h2 className="font-semibold text-[#390A5D]">Bank & statutory</h2>
          <Field label="Bank name" name="bank_name" form={form} editing={editing} onChange={set} />
          <Field label="Account number" name="account_number" form={form} editing={editing} onChange={set} />
          <Field label="IFSC" name="ifsc" form={form} editing={editing} onChange={set} />
          <Field label="PAN" name="pan" form={form} editing={editing} onChange={set} />
          <Field label="UAN" name="uan" form={form} editing={editing} onChange={set} />
        </section>
      ) : null}

      {tab === "Agent Details" ? (
        <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
          <h2 className="font-semibold text-[#390A5D]">Agent details</h2>
          <Row label="Employee code" value={me.employee_code} />
          <Field label="Agent code" name="agent_code" form={form} editing={editing} onChange={set} />
          <Row label="Department" value={departmentLabel(me.department) || "—"} />
          <Row label="Designation" value={me.sales_title || "—"} />
        </section>
      ) : null}

      {tab === "Documents" ? (
        <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
          <h2 className="font-semibold text-[#390A5D]">Documents</h2>
          <p className="mt-3 text-sm text-[#5c4d72]">No documents on this profile yet.</p>
        </section>
      ) : null}

      {tab === "Visa" ? (
        <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
          <h2 className="font-semibold text-[#390A5D]">Visa</h2>
          <Field label="Country" name="visa_country" form={form} editing={editing} onChange={set} />
          <Field label="Visa type" name="visa_type" form={form} editing={editing} onChange={set} />
          <Field label="Valid till" name="visa_expiry" form={form} editing={editing} onChange={set} />
        </section>
      ) : null}

      {photoOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#14281c]/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_24px_60px_rgba(16,102,42,0.18)]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#390A5D]">Update profile picture</h2>
              <button type="button" onClick={() => setPhotoOpen(false)} className="text-sm text-[#5c4d72]" aria-label="Close">✕</button>
            </div>
            <label className="mt-4 block text-sm text-[#5c4d72]">
              Upload file
              <input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => void uploadPhoto()} disabled={!photoFile || saving} className="h-10 rounded-full bg-[#10662A] px-5 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Uploading…" : "Upload"}
              </button>
              <button type="button" onClick={() => setPhotoOpen(false)} className="h-10 rounded-full border border-[#d8ecdd] px-5 text-sm font-semibold text-[#390A5D]">Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "My team" ? (
        <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
          <div className="flex items-center gap-2 font-semibold text-[#390A5D]">
            <Users className="size-4 text-[#10662A]" /> My team
          </div>
          {desk.team.length === 0 ? (
            <p className="mt-3 text-sm text-[#5c4d72]">Nobody reports to you yet.</p>
          ) : (
            <ul className="mt-3">
              {desk.team.map((node) => (
                <TeamBranch key={node.id} node={node} />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
