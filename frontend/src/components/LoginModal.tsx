import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { PROFESSIONS, getProfessionInfo } from "@/lib/professions";
import {
  ArrowRight,
  Lock,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  User,
  Mail,
  GraduationCap,
  BookOpen,
  Cpu,
  Activity,
  Lightbulb,
  Briefcase,
} from "lucide-react";

export function LoginModal() {
  const navigate = useNavigate();
  const { isAuthModalOpen, closeLoginModal, modalOptions, loginUser, registerUser } = useAuth();

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
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ name: string; profession: string } | null>(null);

  // Sync tab and reset when opened
  useEffect(() => {
    if (isAuthModalOpen) {
      setActiveTab(modalOptions.defaultTab || "login");
      setLoginIdentifier("shlok@mail.com");
      setLoginPassword("test@123");
      setSignupUsername("");
      setSignupEmail("");
      setSignupPassword("");
      setSignupProfession("Academic Researcher / Faculty");
      setError(null);
      setSuccessData(null);
      setLoading(false);
    }
  }, [isAuthModalOpen, modalOptions]);

  const selectedProfessionInfo = getProfessionInfo(signupProfession);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const session = await loginUser(loginIdentifier, loginPassword);
      setSuccessData({
        name: session.name,
        profession: session.profession || "Academic Researcher",
      });

      setTimeout(() => {
        closeLoginModal();
        if (modalOptions.onSuccess) {
          modalOptions.onSuccess();
        } else {
          navigate({ to: "/search" });
        }
      }, 750);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Invalid credentials. Please check your username/email and password.");
      } else {
        setError("Unable to connect to server. Check credentials and try again.");
      }
    } finally {
      setLoading(false);
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

    setLoading(true);

    try {
      const session = await registerUser({
        username: signupUsername,
        email: signupEmail,
        password: signupPassword,
        profession: signupProfession,
      });

      setSuccessData({
        name: session.name,
        profession: session.profession || signupProfession,
      });

      setTimeout(() => {
        closeLoginModal();
        if (modalOptions.onSuccess) {
          modalOptions.onSuccess();
        } else {
          navigate({ to: "/search" });
        }
      }, 850);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to create account. Email or username may already exist.");
      } else {
        setError("Unable to connect to server. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setLoginIdentifier("shlok@mail.com");
    setLoginPassword("test@123");
    setError(null);
  };

  // Helper to render profession icon
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
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && closeLoginModal()}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl rounded-2xl max-h-[90vh] flex flex-col">
        <div className="relative p-6 sm:p-7 overflow-y-auto">
          {/* Background Ambient Glow */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-44 w-72 rounded-full bg-primary/20 blur-3xl" />

          <DialogHeader className="text-left space-y-2 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/25">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="font-display font-semibold text-lg tracking-tight">Arclight</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                <Lock className="h-3 w-3" /> Member Access
              </span>
            </div>

            <DialogTitle className="text-xl sm:text-2xl font-display font-semibold tracking-tight text-foreground pt-1">
              {activeTab === "login"
                ? modalOptions.title || "Log in to Arclight"
                : "Create Your Account"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {activeTab === "login"
                ? modalOptions.message ||
                  "Guests can discover and search papers freely. Log in to create curated workspaces, save collections, and run the AI Research Copilot."
                : "Create an account tailored to your profession. Unlock scoped AI synthesis, literature reviews, and persistent research workspaces."}
            </DialogDescription>
          </DialogHeader>

          {/* Success Screen */}
          {successData ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-sm">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <p className="font-medium text-base text-foreground">
                  Welcome to Arclight, {successData.name}!
                </p>
                <div className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                  <Briefcase className="h-3 w-3" /> {successData.profession}
                </div>
              </div>
              <p className="text-xs text-muted-foreground max-w-xs">
                Your research copilot has been personalized for your profession. Unlocking workspaces...
              </p>
            </div>
          ) : (
            <div className="mt-4 relative">
              {/* Tabs Switcher */}
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
                  Sign In
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
                  Create Account
                </button>
              </div>

              {error && (
                <div className="mb-3.5 rounded-lg bg-destructive/10 border border-destructive/30 px-3.5 py-2.5 text-xs text-destructive flex items-center gap-2 animate-in fade-in">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* LOGIN FORM */}
              {activeTab === "login" && (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground/80">
                      Username or Email address
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        required
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder="e.g. shlok@mail.com or shlok"
                        className="h-10 pl-9 bg-background/80 border-border/80 focus:border-primary text-sm"
                      />
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
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
                        className="h-10 pl-9 bg-background/80 border-border/80 focus:border-primary text-sm"
                      />
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <Button
                      type="submit"
                      size="default"
                      disabled={loading}
                      className="w-full h-10 font-medium text-sm shadow-md bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                    >
                      {loading ? (
                        "Signing in..."
                      ) : (
                        <>
                          Sign in to continue <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("signup");
                          setError(null);
                        }}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Don't have an account? Sign up
                      </button>

                      <button
                        type="button"
                        onClick={closeLoginModal}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Continue as guest
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>
                      Demo credentials: <strong>shlok@mail.com</strong> / <strong>test@123</strong>
                    </span>
                  </div>
                </form>
              )}

              {/* SIGNUP FORM */}
              {activeTab === "signup" && (
                <form onSubmit={handleSignupSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground/80">Username</label>
                      <div className="relative">
                        <Input
                          type="text"
                          required
                          value={signupUsername}
                          onChange={(e) => setSignupUsername(e.target.value)}
                          placeholder="e.g. alex_rivers"
                          className="h-9.5 pl-8.5 bg-background/80 border-border/80 focus:border-primary text-xs sm:text-sm"
                        />
                        <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground/80">Email address</label>
                      <div className="relative">
                        <Input
                          type="email"
                          required
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          placeholder="alex@univ.edu"
                          className="h-9.5 pl-8.5 bg-background/80 border-border/80 focus:border-primary text-xs sm:text-sm"
                        />
                        <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground/80">Creating Password</label>
                    <div className="relative">
                      <Input
                        type="password"
                        required
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="h-9.5 pl-8.5 bg-background/80 border-border/80 focus:border-primary text-xs sm:text-sm"
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
                      className="w-full h-9.5 rounded-lg border border-border/80 bg-background/90 px-3 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none"
                    >
                      {PROFESSIONS.map((prof) => (
                        <option key={prof.id} value={prof.label}>
                          {prof.label} ({prof.category})
                        </option>
                      ))}
                    </select>

                    {/* Profession-Based Personalized Experience Card */}
                    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-2.5 text-xs text-foreground/90 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-medium text-primary">
                        {renderProfessionIcon(selectedProfessionInfo.icon)}
                        <span>Experience for {selectedProfessionInfo.badge}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        {selectedProfessionInfo.experienceDescription}
                      </p>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {selectedProfessionInfo.focusAreas.map((focus) => (
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

                  <div className="pt-2 flex flex-col gap-2">
                    <Button
                      type="submit"
                      size="default"
                      disabled={loading}
                      className="w-full h-10 font-medium text-sm shadow-md bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                    >
                      {loading ? (
                        "Creating Account..."
                      ) : (
                        <>
                          Create Account & Sign In <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("login");
                          setError(null);
                        }}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Already have an account? Sign in
                      </button>

                      <button
                        type="button"
                        onClick={closeLoginModal}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Continue as guest
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
