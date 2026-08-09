import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Quizzly Squad — Quiz a squadre, ogni settimana" },
      {
        name: "description",
        content:
          "Due squadre, una settimana, quiz trabocchetto e premi. Ticket, ruote e classifiche sincronizzati col server: si vince col cervello, non con l'orologio.",
      },
      { property: "og:title", content: "Quizzly Squad — Quiz a squadre" },
      { property: "og:description", content: "Scegli la squadra, rispondi ai quiz e conquista i premi settimanali." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: "⚔️", title: "Due squadre, una settimana", text: "Lunedì scegli, da martedì decide la Ruota delle Squadre. Sempre 50/50." },
  { icon: "🎟️", title: "Ticket con timer server", text: "5 ticket max, uno ogni 40 minuti. Cambiare l'ora del telefono non serve a nulla." },
  { icon: "🧠", title: "Quiz trabocchetto", text: "Indovinelli subdoli e risposte ironiche. Puliti, ma non facili." },
  { icon: "🏆", title: "Vetrina premi", text: "Premio Campione e Premio Squadra, ogni settimana, dritti in collezione." },
];

function Landing() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/gioca", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <span className="font-display text-xl font-extrabold text-gradient-pop">🧠 Quizzly Squad</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Cambia tema">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Link to="/auth">
            <Button className="gradient-pop font-bold">Entra</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20">
        <section className="py-10 text-center sm:py-16">
          <p className="mb-3 inline-block rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Nuova sfida ogni lunedì
          </p>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-6xl">
            Quiz a squadre, <span className="text-gradient-pop">senza scorciatoie</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Ticket, timer e classifiche vivono sul server. Tu porta solo il cervello e un po' di faccia tosta.
          </p>
          <Link to="/auth" className="mt-7 inline-block">
            <Button size="lg" className="gradient-pop px-8 text-base font-extrabold">
              Gioca gratis
            </Button>
          </Link>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.title} className="pop-card p-5">
              <div className="text-3xl">{f.icon}</div>
              <h2 className="mt-2 text-lg font-extrabold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
