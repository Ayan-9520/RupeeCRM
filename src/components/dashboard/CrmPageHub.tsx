import { Link } from "@tanstack/react-router";
import { ArrowRight, Lightbulb } from "lucide-react";

export type CrmHubLink = {
  label: string;
  to: string;
  desc?: string;
};

type Props = {
  title: string;
  description: string;
  links: CrmHubLink[];
  tip?: string;
};

export function CrmPageHub({ title, description, links, tip }: Props) {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#390A5D]">{title}</h1>
        <p className="text-[#5c4d72] mt-1 text-sm">{description}</p>
      </div>

      <div className="rounded-2xl border border-[#d8ecdd] bg-white p-5 shadow-[0_4px_20px_rgba(16,102,42,0.05)] space-y-2">
        {links.map((link) => (
          <Link
            key={link.to + link.label}
            to={link.to}
            className="group flex items-center gap-3 rounded-xl border border-[#d8ecdd] px-4 py-3.5 hover:border-[#10662A]/40 hover:bg-[#E8F7EC]/70 transition-all"
          >
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm text-[#390A5D]">{link.label}</div>
              {link.desc && <div className="text-xs text-[#5c4d72] mt-0.5">{link.desc}</div>}
            </div>
            <ArrowRight className="size-4 text-[#10662A] opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
        ))}
      </div>

      {tip && (
        <div className="rounded-xl border border-[#d8ecdd] bg-[#f5fcf7] px-4 py-3 flex items-start gap-2.5 text-sm text-[#5c4d72]">
          <Lightbulb className="size-4 text-[#10662A] shrink-0 mt-0.5" />
          <span>{tip}</span>
        </div>
      )}
    </div>
  );
}
