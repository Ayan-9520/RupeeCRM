import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/rewards")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/learn" });
  },
});
