import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Lock,
  User,
  Mail,
  GraduationCap,
  BookOpen,
  Cpu,
  Activity,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PROFESSIONS, getProfessionInfo } from "@/lib/professions";

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
  const { session, loading, loginUser, registerUser, loginAsGuest } = useAuth();

  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState("shlok@mail.com");
  const [loginPassword, setLoginPassword] = useState("test@123");

  // Signup form state
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupProfession, setSignupProfession] = useState("Academic Researcher / Faculty");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/search", replace: true });
    }
  }, [loading, session, navigate]);

  const enterAsGuestAndGo = () => {
    loginAsGuest();
    navigate({ to: "/search" });
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginUser(loginIdentifier, loginPassword);
      navigate({ to: "/search" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(
          "Incorrect username/email or password. Please verify your credentials or create a new account.",
        );
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signupUsername.trim()) {
      setError("Please choose a username.");
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await registerUser({
        username: signupUsername,
        email: signupEmail,
        password: signupPassword,
        profession: signupProfession,
      });
      navigate({ to: "/search" });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to create account. Email or username already taken.");
      } else {
        setError("Unable to connect to server. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillDemo = () => {
    setLoginIdentifier("shlok@mail.com");
    setLoginPassword("test@123");
    setError(null);
  };

  const selectedProfInfo = getProfessionInfo(signupProfession);

  const renderProfessionIcon = (icon: string) => {
    switch (icon) {
      case "GraduationCap":
        return <GraduationCap className="h-4 w-4 text-primary" />;
      case "BookOpen":
        return <BookOpen className="h-4 w-4 text-primary" />;
      case "Cpu":
        return <Cpu className="h-4 w-4 text-primary" />;
      case "Activity":
        return <Activity className="h-4 w-4 text-primary" />;
      case "Lightbulb":
        return <Lightbulb className="h-4 w-4 text-primary" />;
      default:
        return <Sparkles className="h-4 w-4 text-primary" />;
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

      <main className="mx-auto flex w-full max-w-2xl flex-col items-start px-6 pt-10 pb-16">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" /> Autonomous Research Copilot
        </div>

        <h1 className="font-display text-5xl sm:text-6xl leading-[1.02] tracking-tight md:text-7xl">
          Research,
          <br />
          <em className="text-muted-foreground">organized.</em>
        </h1>
        <p className="mt-5 max-w-lg text-sm sm:text-base leading-relaxed text-muted-foreground">
          Find, read, and synthesize scientific papers in one calm workspace. Discover 200M+ papers
          freely, or sign in to build curated workspaces tailored to your research profession.
        </p>

        {/* AUTH BOX */}
        <div className="mt-8 w-full max-w-lg rounded-2xl border border-border/80 bg-card/80 p-5 sm:p-6 backdrop-blur-xl shadow-xl">
          {/* Tabs */}
          <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-xl mb-4 text-xs font-medium border border-border/60">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setError(null);
              }}
              className={`py-1.5 px-3 rounded-lg transition-all ${
                activeTab === "login"
                  ? "bg-card text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In (Existing User)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("signup");
                setError(null);
              }}
              className={`py-1.5 px-3 rounded-lg transition-all ${
                activeTab === "signup"
                  ? "bg-card text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create Account (New User)
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 px-3.5 py-2.5 text-xs text-destructive flex items-center gap-2 animate-in fade-in">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SIGN IN VIEW */}
          {activeTab === "login" && (
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground/80">
                    Username or Email address
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="e.g. shlok@mail.com or username"
                      className="h-10 pl-9 bg-background border-border/80 text-sm"
                    />
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground/80">Password</label>
                    <button
                      type="button"
                      onClick={handleFillDemo}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Fill demo credentials
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Password"
                      className="h-10 pl-9 bg-background border-border/80 text-sm"
                    />
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <Button
                  type="submit"
                  size="default"
                  className="h-10 w-full font-medium shadow-md gap-1.5"
                  disabled={submitting}
                >
                  {submitting ? (
                    "Signing in..."
                  ) : (
                    <>
                      Sign in <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-2 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 text-foreground/80 text-[11px]">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Demo: <strong>shlok@mail.com</strong> / <strong>test@123</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("signup");
                    setError(null);
                  }}
                  className="text-primary hover:underline font-medium text-xs"
                >
                  Need an account? Sign up
                </button>
              </div>
            </form>
          )}

          {/* CREATE ACCOUNT VIEW */}
          {activeTab === "signup" && (
            <form onSubmit={handleSignupSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground/80">Username</label>
                  <div className="relative">
                    <Input
                      type="text"
                      required
                      value={signupUsername}
                      onChange={(e) => setSignupUsername(e.target.value)}
                      placeholder="e.g. alex_rivers"
                      className="h-9.5 pl-8.5 bg-background border-border/80 text-xs sm:text-sm"
                    />
                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground/80">
                    Mail ID (Email address)
                  </label>
                  <div className="relative">
                    <Input
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="alex@univ.edu"
                      className="h-9.5 pl-8.5 bg-background border-border/80 text-xs sm:text-sm"
                    />
                    <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground/80">Creating Password</label>
                <div className="relative">
                  <Input
                    type="password"
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create a strong password (min. 6 chars)"
                    className="h-9.5 pl-8.5 bg-background border-border/80 text-xs sm:text-sm"
                  />
                  <Lock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground/80">
                    Working Profession
                  </label>
                  <span className="text-[10px] text-primary font-medium">
                    Personalizes Copilot UX
                  </span>
                </div>

                <select
                  value={signupProfession}
                  onChange={(e) => setSignupProfession(e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-border/80 bg-background px-3 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  {PROFESSIONS.map((prof) => (
                    <option key={prof.id} value={prof.label}>
                      {prof.label} ({prof.category})
                    </option>
                  ))}
                </select>

                {/* Live tailored experience preview */}
                <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-2.5 text-xs text-foreground/90 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-medium text-primary">
                    {renderProfessionIcon(selectedProfInfo.icon)}
                    <span>Experience for {selectedProfInfo.badge}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    {selectedProfInfo.experienceDescription}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {selectedProfInfo.focusAreas.map((focus) => (
                      <span
                        key={focus}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-background border border-border/70 text-foreground/80"
                      >
                        ✓ {focus}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <Button
                  type="submit"
                  size="default"
                  className="h-10 w-full font-medium shadow-md gap-1.5"
                  disabled={submitting}
                >
                  {submitting ? (
                    "Creating Account..."
                  ) : (
                    <>
                      Create Account & Start Researching <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-1 pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("login");
                    setError(null);
                  }}
                  className="text-primary hover:underline font-medium text-xs"
                >
                  Already have an account? Sign in
                </button>
                <button
                  type="button"
                  onClick={enterAsGuestAndGo}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Or browse as guest
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={enterAsGuestAndGo}
            className="text-primary hover:underline font-medium"
          >
            Or browse 200M+ papers as guest →
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
