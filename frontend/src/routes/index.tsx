import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arclight — Research, organized." },
      {
        name: "description",
        content: "A calm, scalable workspace for finding, reading, and synthesizing papers.",
      },
      { property: "og:title", content: "Arclight — Research, organized." },
      {
        property: "og:description",
        content: "A calm, scalable workspace for scientific research.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const enter = (mode: "user" | "guest") => {
    setSession(
      mode === "user"
        ? { mode: "user", name: email.split("@")[0] || "Researcher", email }
        : { mode: "guest", name: "Guest" },
    );
    navigate({ to: "/search" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-sm bg-primary" />
          <span className="font-display text-xl">Arclight</span>
        </div>
        <button
          onClick={() => enter("guest")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Continue as guest →
        </button>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col items-start px-6 pt-24 pb-16">
        <h1 className="font-display text-6xl leading-[1.02] tracking-tight md:text-7xl">
          Research,
          <br />
          <em className="text-muted-foreground">organized.</em>
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
          Find, read, and synthesize scientific papers in one calm workspace.
          Built for libraries of thousands.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enter("user");
          }}
          className="mt-10 flex w-full max-w-md gap-2"
        >
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@lab.edu"
            className="h-11 bg-card"
          />
          <Button type="submit" size="lg" className="h-11">
            Get started <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </form>

        <p className="mt-3 text-xs text-muted-foreground">
          Free for individual researchers. No credit card.
        </p>
      </main>

      <footer className="mx-auto max-w-5xl border-t border-border/60 px-6 py-6 text-xs text-muted-foreground">
        © 2026 Arclight
      </footer>
    </div>
  );
}
