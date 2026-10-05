import { createFileRoute } from "@tanstack/react-router";
import { TeleSalesHub } from "@/components/dashboard/TeleSalesHub";

export const Route = createFileRoute("/dashboard/calls")({
  head: () => ({ meta: [{ title: "TeleSales — RupeeDial One" }] }),
  component: TeleSalesHub,
});
