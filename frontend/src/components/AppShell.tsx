import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Search, Library, FileText, LogOut, LogIn, Plus, FolderKanban, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/search", label: "Discover", icon: Search, guestAllowed: true },
  { to: "/workflow", label: "Workspaces", icon: FolderKanban, guestAllowed: false },
  { to: "/library", label: "Library", icon: Library, guestAllowed: false },
  { to: "/review", label: "Reviews", icon: FileText, guestAllowed: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, isGuest, loading, logoutUser, openLoginModal } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/" });
    }
  }, [loading, session, navigate]);

  if (!session) return null;

  const initials = session.name
    ? session.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "G";

  return (
    <div className="stage-bg relative flex min-h-screen w-full">
      <aside
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
        }}
        data-open={open}
        className="group/sidebar fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-sidebar/80 backdrop-blur-md shadow-[4px_0_24px_-16px_rgba(15,23,42,0.15)] transition-[width] duration-300 ease-out md:flex w-16 data-[open=true]:w-56"
      >
        <div className="flex items-center gap-2 px-4 py-5">
          <div className="h-6 w-6 shrink-0 rounded-md bg-gradient-to-br from-primary to-accent shadow-md" />
          <span className="whitespace-nowrap font-display text-lg opacity-0 transition-opacity duration-200 group-data-[open=true]/sidebar:opacity-100">
            Arclight
          </span>
        </div>

        <div className="px-2">
          <Link to="/search">
            <Button
              size="sm"
              className="btn-pop w-full justify-start gap-2 overflow-hidden shadow-md"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-data-[open=true]/sidebar:opacity-100">
                New search
              </span>
            </Button>
          </Link>
        </div>

        <nav className="mt-6 flex-1 space-y-0.5 px-2">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            const requiresAuth = !item.guestAllowed && isGuest;

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={(e) => {
                  if (requiresAuth) {
                    e.preventDefault();
                    openLoginModal({
                      title: `Log in to access ${item.label}`,
                      message: `${item.label} and AI research features require an account to prevent token usage. Log in to continue.`,
                      onSuccess: () => navigate({ to: item.to }),
                    });
                  }
                }}
                className={`nav-item group/nav flex items-center justify-between rounded-md px-3 py-2 text-sm transition-all ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground hover:translate-x-0.5"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 shrink-0 transition-transform group-hover/nav:scale-110" />
                  <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-data-[open=true]/sidebar:opacity-100">
                    {item.label}
                  </span>
                </div>
                {requiresAuth && (
                  <Lock className="h-3 w-3 text-muted-foreground/60 opacity-0 transition-opacity duration-200 group-data-[open=true]/sidebar:opacity-100" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          {isGuest ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 rounded-md px-1.5 py-1.5 bg-muted/30">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground shadow-sm">
                  G
                </div>
                <div className="min-w-0 flex-1 overflow-hidden opacity-0 transition-opacity duration-200 group-data-[open=true]/sidebar:opacity-100">
                  <div className="truncate text-xs font-semibold text-sidebar-foreground">Guest Mode</div>
                  <div className="truncate text-[10px] text-muted-foreground">Search only</div>
                </div>
                <button
                  className="btn-pop shrink-0 rounded-md p-1.5 text-primary hover:bg-primary/10 transition-colors"
                  onClick={() =>
                    openLoginModal({
                      title: "Log in to Arclight",
                      message: "Sign in to save papers into workspaces and unlock the full AI Research Copilot.",
                    })
                  }
                  title="Log in"
                  aria-label="Log in"
                >
                  <LogIn className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md px-1.5 py-1.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-medium text-primary-foreground shadow-sm">
                {initials}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden opacity-0 transition-opacity duration-200 group-data-[open=true]/sidebar:opacity-100">
                <div className="truncate text-sm text-sidebar-foreground">{session.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {session.email || "Member"}
                </div>
              </div>
              <button
                className="btn-pop shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                onClick={async () => {
                  await logoutUser();
                  navigate({ to: "/" });
                }}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="relative z-10 min-w-0 flex-1 md:pl-16">{children}</main>
    </div>
  );
}
