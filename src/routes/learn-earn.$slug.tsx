import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/learn-earn/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/auth", search: { next: `/dashboard/learn/${params.slug}` } });
  },
});
