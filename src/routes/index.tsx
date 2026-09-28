import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Products } from "@/components/landing/Products";
import { Flow } from "@/components/landing/Flow";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RupeeDial One — Loan CRM for DSAs" },
      {
        name: "description",
        content:
          "RupeeDial One: buy website leads, edit full form details, and run New → Disbursed for every loan product.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="landing-page min-h-screen bg-background text-foreground antialiased">
      <Nav />
      <main>
        <Hero />
        <Products />
        <Flow />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
