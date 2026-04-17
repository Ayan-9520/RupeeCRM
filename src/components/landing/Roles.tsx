import { Crown, Briefcase, Phone, ClipboardCheck, Building, Megaphone, User } from "lucide-react";

const roles = [
  { icon: Crown, name: "Admin", desc: "Full platform control" },
  { icon: Briefcase, name: "DSA Partner", desc: "Buy leads & close loans" },
  { icon: Phone, name: "Telecaller", desc: "Qualify & schedule" },
  { icon: ClipboardCheck, name: "Sales Coordinator", desc: "Docs & lender routing" },
  { icon: Building, name: "Lender", desc: "Bank/NBFC case status" },
  { icon: Megaphone, name: "Affiliate", desc: "Earn via referrals" },
  { icon: User, name: "Customer", desc: "Apply & track loan" },
];

export function Roles() {
  return (
    <section id="platform" className="py-24 lg:py-32 bg-background border-t border-border">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-12 gap-12">
        <div className="lg:col-span-5">
          <div className="text-xs uppercase tracking-[0.2em] text-[oklch(0.5_0.16_165)] font-semibold">Built for Everyone</div>
          <h2 className="mt-3 text-3xl lg:text-5xl font-bold tracking-tight">
            Seven roles. <span className="text-gradient">One source of truth.</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            Role-based access control means each user sees exactly what they need. No clutter, no leaks,
            no fighting over spreadsheets.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {["JWT Auth", "RBAC", "Audit Trail", "Refund Policy", "WhatsApp Alerts"].map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-full bg-secondary border border-border text-xs font-medium text-foreground/80">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 grid sm:grid-cols-2 gap-3">
          {roles.map((r) => (
            <div key={r.name} className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-[oklch(0.78_0.16_165)] transition-smooth">
              <div className="size-11 rounded-xl bg-secondary grid place-items-center">
                <r.icon className="size-5 text-[oklch(0.35_0.11_240)]" />
              </div>
              <div>
                <div className="font-display font-semibold">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
