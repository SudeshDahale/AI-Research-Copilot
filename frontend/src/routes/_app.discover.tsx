import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/discover")({
  beforeLoad: () => {
    throw redirect({ to: "/search" });
  },
  component: () => null,
});
