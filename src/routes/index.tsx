import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Roles } from "@/components/landing/Roles";
import { Flow } from "@/components/landing/Flow";
import { Modules } from "@/components/landing/Modules";
import { Products } from "@/components/landing/Products";
import { Community } from "@/components/landing/Community";
import { Pricing } from "@/components/landing/Pricing";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <Roles />
        <Flow />
        <Modules />
        <Products />
        <Community />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
