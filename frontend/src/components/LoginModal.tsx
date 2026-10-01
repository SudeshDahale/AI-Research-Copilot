import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { ArrowRight, Lock, Sparkles, X, CheckCircle2, ShieldCheck } from "lucide-react";

export function LoginModal() {
  const { isAuthModalOpen, closeLoginModal, modalOptions, loginUser } = useAuth();
  const [email, setEmail] = useState("shlok@mail.com");
  const [password, setPassword] = useState("test@123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Reset states when opened
  useEffect(() => {
    if (isAuthModalOpen) {
      setEmail("shlok@mail.com");
      setPassword("test@123");
      setError(null);
      setSuccess(false);
      setLoading(false);
    }
  }, [isAuthModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await loginUser(email, password);
      setSuccess(true);
      setTimeout(() => {
        closeLoginModal();
        if (modalOptions.onSuccess) {
          modalOptions.onSuccess();
        }
      }, 600);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Invalid credentials. Please log in with shlok@mail.com.");
      } else {
        setError("Unable to connect to server. Check credentials and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail("shlok@mail.com");
    setPassword("test@123");
    setError(null);
  };

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && closeLoginModal()}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl rounded-2xl">
        <div className="relative p-6 sm:p-7">
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
              <span className="inline-flex items-center gap-1 text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                <Lock className="h-3 w-3" /> Member Access
              </span>
            </div>

            <DialogTitle className="text-xl sm:text-2xl font-display font-semibold tracking-tight text-foreground pt-1">
              {modalOptions.title || "Log in to Arclight"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {modalOptions.message ||
                "Guests can discover and search papers freely. Log in to create curated workspaces, save collections, and run the AI Research Copilot."}
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <p className="font-medium text-base text-foreground">Welcome back, Shlok!</p>
              <p className="text-xs text-muted-foreground">Unlocking your workspaces and research tools...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5 relative">
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3.5 py-2.5 text-xs text-destructive flex items-center gap-2 animate-in fade-in">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80">Email address</label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="shlok@mail.com"
                  className="h-10 bg-background/80 border-border/80 focus:border-primary text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground/80">Password</label>
                  <button
                    type="button"
                    onClick={handleFillDemo}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Fill shlok@mail.com credentials
                  </button>
                </div>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="h-10 bg-background/80 border-border/80 focus:border-primary text-sm"
                />
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

                <button
                  type="button"
                  onClick={closeLoginModal}
                  className="w-full text-center py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Continue browsing papers as guest
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Authorized credentials: <strong>shlok@mail.com</strong> / <strong>test@123</strong></span>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
