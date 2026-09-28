import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

export function MarketingUpgradeGate({
  title = "Growth plan required",
  description = "Upgrade to Growth or Pro to unlock this marketing tool.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#d8ecdd] bg-gradient-to-br from-[#E8F7EC] to-white p-8 text-center max-w-lg mx-auto">
      <div className="size-12 rounded-xl bg-[#10662A]/15 grid place-items-center mx-auto">
        <Lock className="size-5 text-[#10662A]" />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-[#390A5D]">{title}</h2>
      <p className="mt-2 text-sm text-[#5c4d72]">{description}</p>
      <Link
        to="/dashboard/billing"
        className="inline-flex mt-5 rounded-xl bg-[#10662A] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#0d5222]"
      >
        View plans
      </Link>
    </div>
  );
}
