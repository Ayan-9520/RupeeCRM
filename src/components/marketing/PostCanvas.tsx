import { forwardRef } from "react";
import { patternStyle, type MarketingTemplate, type PartnerBranding, personalize } from "@/lib/marketing";

interface Props {
  template: MarketingTemplate;
  branding: PartnerBranding;
  customHeadline?: string;
  customBody?: string;
  imageUrl?: string | null;
}

export const PostCanvas = forwardRef<HTMLDivElement, Props>(
  ({ template, branding, customHeadline, customBody, imageUrl }, ref) => {
    const t = template.theme;
    const headline = personalize(customHeadline ?? template.headline, branding);
    const body = personalize(customBody ?? template.body ?? "", branding);
    const sub = personalize(template.subheadline ?? "", branding);

    return (
      <div
        ref={ref}
        style={{ ...patternStyle(t), width: 1080, height: 1080 }}
        className="relative flex flex-col p-16 font-display overflow-hidden"
      >
        {/* product image background */}
        {imageUrl && (
          <>
            <img
              src={imageUrl}
              alt=""
              crossOrigin="anonymous"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* dark gradient overlay for legible text */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${t.bg}E6 0%, ${t.bg}99 35%, ${t.bg}F2 100%)`,
              }}
            />
          </>
        )}

        {/* corner accent */}
        <div
          className="absolute -top-32 -right-32 size-80 rounded-full opacity-30"
          style={{ background: `radial-gradient(circle, ${t.accent} 0%, transparent 70%)` }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-2"
          style={{ background: t.accent }}
        />

        {/* brand chip */}
        <div className="relative flex items-center gap-3 mb-12">
          <div
            className="size-12 rounded-xl grid place-items-center font-bold text-2xl"
            style={{ background: t.accent, color: t.bg }}
          >
            {branding.company.charAt(0) || "L"}
          </div>
          <div className="leading-tight">
            <div className="text-xl font-bold">{branding.company || "RupeeDial"}</div>
            <div className="text-sm opacity-70">RupeeDial Partner</div>
          </div>
        </div>

        {/* headline */}
        <div className="relative flex-1 flex flex-col justify-center max-w-[820px]">
          <h1 className="text-7xl font-black leading-[0.95] tracking-tight mb-6 drop-shadow-lg">
            {headline}
          </h1>
          {sub && (
            <div
              className="inline-block self-start text-2xl font-semibold px-5 py-2 rounded-full mb-8"
              style={{ background: t.accent, color: t.bg }}
            >
              {sub}
            </div>
          )}
          {body && (
            <p className="text-2xl opacity-95 leading-snug max-w-[700px] drop-shadow">{body}</p>
          )}
        </div>

        {/* footer: CTA + contact */}
        <div className="relative flex items-end justify-between gap-6 mt-10">
          <div className="space-y-1.5">
            <div className="text-xl font-bold">{branding.name}</div>
            <div className="text-lg opacity-90">📞 {branding.phone}</div>
            {branding.email && <div className="text-base opacity-80">{branding.email}</div>}
          </div>
          <div
            className="text-3xl font-black px-8 py-5 rounded-2xl shadow-xl"
            style={{ background: t.accent, color: t.bg }}
          >
            {template.cta} →
          </div>
        </div>
      </div>
    );
  }
);
PostCanvas.displayName = "PostCanvas";
