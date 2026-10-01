import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { enterAsGuest, login, getSession } from "@/lib/session";

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
  const [email, setEmail] = useState("shlok@mail.com");
  const [password, setPassword] = useState("test@123");
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
      await login(email, password);
      navigate({ to: "/search" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Incorrect email or password. Use registered credentials: shlok@mail.com / test@123");
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent shadow-md flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-display font-semibold text-xl tracking-tight">Arclight</span>
        </div>
        <button
          onClick={enterAsGuestAndGo}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 hover:border-foreground/30 bg-card/60 backdrop-blur-sm shadow-sm"
        >
          Continue as guest →
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col items-start px-6 pt-16 pb-20">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" /> Autonomous Research Copilot
        </div>

        <h1 className="font-display text-6xl leading-[1.02] tracking-tight md:text-7xl">
          Research,
          <br />
          <em className="text-muted-foreground">organized.</em>
        </h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground">
          Find, read, and synthesize scientific papers in one calm workspace. Discover 200M+ papers
          freely, or sign in to build curated workspaces with scoped AI agents.
        </p>

        <form onSubmit={submit} className="mt-8 flex w-full max-w-md flex-col gap-2.5">
          <div className="flex w-full flex-col sm:flex-row gap-2">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="shlok@mail.com"
              className="h-11 bg-card border-border/80 text-sm"
            />
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-11 sm:w-40 bg-card border-border/80 text-sm"
            />
            <Button type="submit" size="lg" className="h-11 shrink-0 font-medium shadow-md" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          {error && <p className="text-xs text-destructive font-medium">{error}</p>}
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-foreground/80">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Account: <strong>shlok@mail.com</strong> (password: <strong>test@123</strong>)
          </span>
          <span>•</span>
          <button
            type="button"
            onClick={enterAsGuestAndGo}
            className="text-primary hover:underline font-medium"
          >
            Or browse papers as guest
          </button>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl border-t border-border/60 px-6 py-6 text-xs text-muted-foreground flex items-center justify-between">
        <span>© 2026 Arclight</span>
        <span>ArXiv & Semantic Scholar Intelligence</span>
      </footer>
    </div>
  );
}
