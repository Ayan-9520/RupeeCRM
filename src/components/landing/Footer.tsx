import { Link } from "@tanstack/react-router";
import { RUPEEDIAL_PRODUCT_MENUS, RUPEEDIAL_SITE } from "@/lib/rupeedial-products";

export function Footer() {
  return (
    <footer className="border-t border-[#d8ecdd] py-12 bg-white">
      <div className="max-w-6xl mx-auto px-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="size-8 rounded-full bg-[#10662A] grid place-items-center text-white font-display font-bold text-sm">
              R
            </span>
            <span className="font-display font-bold text-lg text-[#10662A] lowercase">
              rupeedial <span className="normal-case text-[#390A5D]">One</span>
            </span>
          </Link>
          <p className="mt-3 text-sm text-[#5c4d72] max-w-xs leading-relaxed">
            Official RupeeDial CRM — marketplace, pipeline, and disbursal in one place.
          </p>
        </div>

        {RUPEEDIAL_PRODUCT_MENUS.slice(0, 3).map((menu) => (
          <div key={menu.title}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#10662A]">{menu.title}</div>
            <ul className="mt-3 space-y-1.5 text-sm text-[#5c4d72]">
              {menu.items.slice(0, 5).map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-5 mt-10 pt-6 border-t border-[#d8ecdd] flex flex-col sm:flex-row justify-between gap-3 text-xs text-[#5c4d72]">
        <div>© {new Date().getFullYear()} RupeeDial One. All rights reserved.</div>
        <a href={RUPEEDIAL_SITE} target="_blank" rel="noreferrer" className="hover:text-[#10662A] font-semibold">
          rupeedial.com
        </a>
      </div>
    </footer>
  );
}
