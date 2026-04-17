import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-14 bg-background border-t border-border">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-mint-gradient grid place-items-center shadow-mint">
              <Sparkles className="size-5 text-primary" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold tracking-tight">LeadMines</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground -mt-0.5">by MoneyMines</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground max-w-sm">
            India's premium lead marketplace and DSA growth platform for financial products.
          </p>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider font-semibold text-foreground/80">Platform</div>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li><a href="#modules" className="hover:text-foreground transition-smooth">Modules</a></li>
            <li><a href="#pricing" className="hover:text-foreground transition-smooth">Pricing</a></li>
            <li><a href="#community" className="hover:text-foreground transition-smooth">Community</a></li>
          </ul>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider font-semibold text-foreground/80">Company</div>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li><a href="#" className="hover:text-foreground transition-smooth">About MoneyMines</a></li>
            <li><a href="#" className="hover:text-foreground transition-smooth">Contact</a></li>
            <li><a href="#" className="hover:text-foreground transition-smooth">Privacy & Refund</a></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 lg:px-8 mt-12 pt-6 border-t border-border flex flex-col sm:flex-row justify-between gap-3 text-xs text-muted-foreground">
        <div>© {new Date().getFullYear()} MoneyMines Technologies Pvt Ltd. All rights reserved.</div>
        <div>Made in India 🇮🇳</div>
      </div>
    </footer>
  );
}
