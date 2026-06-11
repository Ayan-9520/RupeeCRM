import {
  Megaphone, Bot, Store, KanbanSquare, Headphones, ClipboardList,
  Building2, LayoutDashboard, Users2, GraduationCap, Link2, Wallet, Shield,
} from "lucide-react";

const modules = [
  { icon: Megaphone, title: "Lead Generation", desc: "Landing pages, WhatsApp API, Meta + Google webhooks straight into the CRM." },
  { icon: Bot, title: "AI Verification", desc: "OTP, duplicate detection & cold/warm/hot scoring on every lead." },
  { icon: Store, title: "Leadboard Marketplace", desc: "DSAs browse, filter & buy verified leads. Masked numbers until purchase." },
  { icon: KanbanSquare, title: "CRM Pipeline", desc: "Drag-and-drop Kanban from New Lead → Disbursed with notes & docs." },
  { icon: Headphones, title: "Call Center Panel", desc: "Caller dashboard, call status, lead assignment & follow-up scheduling." },
  { icon: ClipboardList, title: "Sales Coordinator", desc: "Verify leads, upload documents, route to the right lender." },
  { icon: Building2, title: "Lender Portal", desc: "Banks & NBFCs update status: Approved · Pending · Disbursed · Rejected." },
  { icon: LayoutDashboard, title: "Partner Dashboard", desc: "Wallet, lead history, case tracking & live commission tracker." },
  { icon: Users2, title: "Community Feed", desc: "Reels, posts, leaderboard — a LinkedIn for top-performing DSAs." },
  { icon: GraduationCap, title: "Training & Certification", desc: "Webinars, product one-pagers & badges to onboard new partners." },
  { icon: Link2, title: "Affiliate System", desc: "Influencers earn 1–5% per disbursal via tracked referral links." },
  { icon: Wallet, title: "Wallet & Payments", desc: "Razorpay recharge, bonus credits, deductions & full transaction log." },
  { icon: Shield, title: "Admin & RBAC", desc: "Manage users, lead pricing, commissions, content & analytics — JWT secured." },
];

export function Modules() {
  return (
    <section id="modules" className="py-24 lg:py-32 relative">
      <div className="absolute inset-0 wa-pattern opacity-30" />
      <div className="absolute inset-0 bg-secondary/60" />
      <div className="relative max-w-7xl mx-auto px-5 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--wa-green)] font-bold">13 Modules</div>
          <h2 className="mt-3 text-3xl lg:text-5xl font-bold tracking-tight">
            Everything a DSA partner network needs.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Stop stitching together six tools. LeadMines ships every workflow your team runs — under one login.
          </p>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {modules.map((m, i) => (
            <div
              key={m.title}
              className="group relative rounded-2xl bg-card border border-border p-6 hover:shadow-elevated hover:-translate-y-1 hover:border-[var(--wa-green)]/30 transition-smooth"
            >
              <div className="flex items-start justify-between">
                <div className="size-11 rounded-xl bg-[var(--wa-green)] grid place-items-center shadow-mint group-hover:scale-110 transition-smooth">
                  <m.icon className="size-5 text-white" strokeWidth={2.2} />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground/60">M{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-5 font-display font-semibold text-lg">{m.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
