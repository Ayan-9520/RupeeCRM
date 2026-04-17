import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Phone, Mail, Globe, MapPin } from "lucide-react";

export interface CardData {
  full_name: string;
  designation?: string | null;
  company_name?: string | null;
  phone: string;
  email?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  city?: string | null;
  photo_url?: string | null;
  logo_url?: string | null;
  products?: string[];
  theme?: { bg?: string; accent?: string; text?: string };
  qrValue: string;
}

export const VisitingCardCanvas = forwardRef<HTMLDivElement, { data: CardData }>(
  ({ data }, ref) => {
    const bg = data.theme?.bg ?? "#0c2340";
    const accent = data.theme?.accent ?? "#2dd4a8";
    const text = data.theme?.text ?? "#ffffff";

    return (
      <div
        ref={ref}
        style={{ background: bg, color: text, width: 1050, height: 600 }}
        className="relative font-display overflow-hidden flex"
      >
        {/* Left side: identity */}
        <div className="flex-1 p-10 flex flex-col justify-between relative">
          <div
            className="absolute -top-24 -left-24 size-64 rounded-full opacity-20"
            style={{ background: accent }}
          />
          <div className="relative">
            <div className="flex items-center gap-3 mb-8">
              {data.logo_url ? (
                <img src={data.logo_url} alt="" className="size-12 rounded-lg object-cover" crossOrigin="anonymous" />
              ) : (
                <div
                  className="size-12 rounded-xl grid place-items-center text-2xl font-bold"
                  style={{ background: accent, color: bg }}
                >
                  {(data.company_name?.charAt(0) ?? "L").toUpperCase()}
                </div>
              )}
              <div className="leading-tight">
                <div className="text-xl font-bold">{data.company_name ?? "LeadMines"}</div>
                <div className="text-xs opacity-60 uppercase tracking-widest">Authorised Partner</div>
              </div>
            </div>

            <h1 className="text-5xl font-black tracking-tight">{data.full_name}</h1>
            {data.designation && (
              <div
                className="inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-semibold"
                style={{ background: accent, color: bg }}
              >
                {data.designation}
              </div>
            )}
          </div>

          <div className="space-y-2 text-base">
            <div className="flex items-center gap-2.5"><Phone className="size-4" style={{ color: accent }} /> {data.phone}</div>
            {data.email && <div className="flex items-center gap-2.5"><Mail className="size-4" style={{ color: accent }} /> {data.email}</div>}
            {data.website && <div className="flex items-center gap-2.5"><Globe className="size-4" style={{ color: accent }} /> {data.website}</div>}
            {data.city && <div className="flex items-center gap-2.5"><MapPin className="size-4" style={{ color: accent }} /> {data.city}</div>}
          </div>
        </div>

        {/* Right side: products + QR */}
        <div className="w-[380px] p-10 flex flex-col justify-between" style={{ background: `${accent}15` }}>
          <div>
            <div className="text-xs uppercase tracking-widest opacity-60 mb-3">Products Offered</div>
            <div className="flex flex-wrap gap-2">
              {(data.products && data.products.length > 0
                ? data.products
                : ["Personal Loan", "Business Loan", "Insurance"]
              ).map((p) => (
                <span
                  key={p}
                  className="text-xs font-semibold px-3 py-1 rounded-full border"
                  style={{ borderColor: accent, color: text }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl self-end">
            <QRCodeSVG value={data.qrValue} size={180} level="M" />
            <div className="text-[10px] text-center mt-2 font-semibold tracking-widest text-black uppercase">Scan to connect</div>
          </div>
        </div>
      </div>
    );
  }
);
VisitingCardCanvas.displayName = "VisitingCardCanvas";
