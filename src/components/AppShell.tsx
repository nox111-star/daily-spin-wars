import { Link, useNavigate } from "@tanstack/react-router";
import { Home, Target, ShoppingBag, MessageCircle, Sun, Moon, LogOut, Ticket, Coins, Shield } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { api, frameClass, type GameState } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/gioca", label: "Home", icon: Home },
  { to: "/missioni", label: "Missioni", icon: Target },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/chat", label: "Chat", icon: MessageCircle },
] as const;


export function useGameState() {
  return useQuery<GameState>({ queryKey: ["state"], queryFn: api.state, refetchInterval: 30000 });
}

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { data: state } = useGameState();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/gioca" className="shrink-0 text-2xl">
              🧠
            </Link>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-extrabold leading-none text-gradient-pop">
                Quizzly Squad
              </p>
              {state && (
                <p className="truncate text-xs text-muted-foreground">
                  {state.profile.username} · {state.profile.title}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {state && (
              <>
                <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-sm font-bold">
                  <Ticket className="h-4 w-4 text-primary" />
                  {state.tickets}
                </span>
                <span className="hidden items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-sm font-bold sm:flex">
                  <Coins className="h-4 w-4 text-warning" />
                  {state.profile.credits}
                </span>
                <Link to="/profilo" aria-label="Profilo">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full bg-card text-lg ${frameClass(state.profile.frame)}`}
                  >
                    {state.profile.avatar}
                  </span>
                </Link>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Cambia tema">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Esci">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-5xl gap-1 px-4 pb-2 md:flex">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted data-[status=active]:gradient-pop data-[status=active]:text-primary-foreground"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {state?.is_admin && (
            <Link
              to="/admin"
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted data-[status=active]:gradient-pop data-[status=active]:text-primary-foreground"
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}
        </nav>

      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-muted-foreground data-[status=active]:text-primary"
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
