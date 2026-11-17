import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/learn-earn/")({
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { next: "/dashboard/learn" } });
  },
});
