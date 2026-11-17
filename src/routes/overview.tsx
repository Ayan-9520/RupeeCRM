import { createFileRoute, Link } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Products } from "@/components/landing/Products";
import { Flow } from "@/components/landing/Flow";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "Products and how it works — RupeeOne" },
      { name: "description", content: "RupeeDial products in RupeeOne, and the path from a lead to disbursement." },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  return (
    <div className="min-h-screen bg-white text-[#14281c]">
      <Nav />
      <main className="pt-16">
        <Products />
        <Flow />
        <section className="bg-[#F4FBF6] py-16">
          <div className="mx-auto max-w-3xl px-5 text-center">
            <h2 className="font-display text-2xl font-bold text-[#390A5D]">Work these products as a partner</h2>
            <p className="mt-2 text-sm text-[#5c4d72]">Apply with your details. The login is sent after RupeeDial approves you.</p>
            <Link to="/become-partner" className="mt-5 inline-flex rounded-full bg-[#10662A] px-5 py-3 text-sm font-semibold text-white">
              Become a partner
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
