import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { enterAsGuest, loginOrRegister, getSession } from "@/lib/session";

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
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSession().then((session) => {
      if (!cancelled && session) {
        navigate({ to: "/search", replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const enterAsGuestAndGo = () => {
    enterAsGuest();
    navigate({ to: "/search" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Tries to log in first; if there's no account with this email yet,
      // loginOrRegister creates one — same one-field "Get started" flow as
      // before, backed by real accounts instead of localStorage.
      await loginOrRegister(email, password, email.split("@")[0] || "Researcher");
      navigate({ to: "/search" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-sm bg-primary" />
          <span className="font-display text-xl">Arclight</span>
        </div>
        <button
          onClick={enterAsGuestAndGo}
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

        <form onSubmit={submit} className="mt-10 flex w-full max-w-md flex-col gap-2">
          <div className="flex w-full gap-2">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@lab.edu"
              className="h-11 bg-card"
            />
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-11 w-40 bg-card"
            />
            <Button type="submit" size="lg" className="h-11 shrink-0" disabled={submitting}>
              {submitting ? "..." : "Get started"} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <p className="mt-3 text-xs text-muted-foreground">
          Free for individual researchers. No credit card. New here? The same
          form creates your account — just pick a password (min 8 characters).
        </p>
      </main>

      <footer className="mx-auto max-w-5xl border-t border-border/60 px-6 py-6 text-xs text-muted-foreground">
        © 2026 Arclight
      </footer>
    </div>
  );
}