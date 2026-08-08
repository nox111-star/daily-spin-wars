import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Accedi a Bubble Brawl — Quiz a squadre" },
      { name: "description", content: "Entra in Bubble Brawl: scegli la squadra della settimana, gioca ai quiz trabocchetto e scala la classifica." },
      { property: "og:title", content: "Accedi a Bubble Brawl" },
      { property: "og:description", content: "Crea il tuo profilo e unisciti alla sfida settimanale a squadre." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/gioca", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (username.trim().length < 3) throw new Error("Il nickname deve avere almeno 3 caratteri");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Controlla la tua email per confermare l'account!");
          return;
        }
        await api.bootstrap(username);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const state = await api.state();
        if (state.needs_bootstrap) await api.bootstrap(email.split("@")[0] ?? "Giocatore");
      }
      navigate({ to: "/gioca", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Accesso non riuscito");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md pop-card p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="text-5xl">🫧</div>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-gradient-pop">Bubble Brawl</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "Crea il tuo profilo e scendi in campo" : "Bentornato, la squadra ti aspetta"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="username">Nickname</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                placeholder="CapitanBolla"
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <Button type="submit" className="w-full gradient-pop font-bold" disabled={loading}>
            {loading ? "Un attimo…" : mode === "signup" ? "Crea account" : "Entra"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
        >
          {mode === "signup" ? "Hai già un account? Accedi" : "Non hai un account? Registrati"}
        </button>
      </div>
    </div>
  );
}
