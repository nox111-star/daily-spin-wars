import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ticket, Coins, Trophy, Users, Sparkles, RefreshCw, Video, Dices } from "lucide-react";
import { AppShell, useGameState } from "@/components/AppShell";
import { useAdPlayer } from "@/components/AdPlayer";
import { api, frameClass } from "@/lib/api";
import { Button } from "@/components/ui/button";


import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/gioca")({
  head: () => ({
    meta: [
      { title: "Home — Bubble Brawl" },
      { name: "description", content: "Barra squadre in tempo reale, ticket, ruota del mattino, quiz trabocchetto e vetrina premi settimanali." },
      { property: "og:title", content: "Bubble Brawl — la sfida settimanale a squadre" },
      { property: "og:description", content: "Gioca ai quiz, guadagna punti e porta la tua squadra alla vittoria." },
    ],
  }),
  component: HomePage,
});

function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => setLeft(seconds), [seconds]);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(t);
  }, [left]);
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function HomePage() {
  const { data: state, isLoading } = useGameState();
  const queryClient = useQueryClient();
  const { playAd, AdOverlay } = useAdPlayer();
  const [busy, setBusy] = useState(false);
  const [quiz, setQuiz] = useState<{ id: number; question: string; options: string[] } | null>(null);
  const [result, setResult] = useState<{ correct: boolean; answer: number; quip: string } | null>(null);
  const [wheelResult, setWheelResult] = useState<string | null>(null);

  const { data: board } = useQuery({ queryKey: ["leaderboard"], queryFn: api.leaderboard, refetchInterval: 30000 });
  const countdown = useCountdown(state?.next_ticket_seconds ?? 0);

  const refresh = () => queryClient.invalidateQueries();

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Azione non riuscita");
    } finally {
      setBusy(false);
    }
  }

  const pctA = state?.team_counts.pct_a ?? 50;

  const teamName = useMemo(() => {
    if (!state?.team) return null;
    return state.team === "A" ? state.week.team_a : state.week.team_b;
  }, [state]);

  if (isLoading || !state) {
    return (
      <AppShell>
        <p className="py-20 text-center text-muted-foreground">Caricamento in corso…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {AdOverlay}
      <div className="space-y-5">
        {/* SQUADRE */}
        <section className="pop-card p-5">
          <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <h2 className="flex min-w-0 items-center gap-2 text-xl font-extrabold">
              <Users className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate">Sfida della settimana</span>
            </h2>
            <Button variant="ghost" size="icon" onClick={refresh} aria-label="Aggiorna">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-1 flex items-baseline justify-between text-sm font-bold">
            <span className="text-[color:var(--team-a)]">{state.week.team_a}</span>
            <span className="text-[color:var(--team-b)]">{state.week.team_b}</span>
          </div>
          <div className="flex h-5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-[color:var(--team-a)] transition-all duration-500" style={{ width: `${pctA}%` }} />
            <div className="h-full flex-1 bg-[color:var(--team-b)] transition-all duration-500" />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{state.team_counts.a} giocatori · {state.team_counts.pct_a}%</span>
            <span>{state.team_counts.pct_b}% · {state.team_counts.b} giocatori</span>
          </div>

          {state.team ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full gradient-pop px-3 py-1 text-sm font-bold text-primary-foreground">
                Sei nei {teamName}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const seen = await playAd();
                    if (!seen) throw new Error("Video interrotto: cambio annullato");
                    await api.switchTeam();
                  }, "Squadra cambiata!")
                }
              >
                <Video className="mr-1.5 h-4 w-4" /> Cambia squadra (video)
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {state.is_monday ? (
                <>
                  <p className="text-sm text-muted-foreground">È lunedì: scegli liberamente la tua squadra.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => run(() => api.chooseTeam("A"), "Benvenuto in squadra!")}>
                      {state.week.team_a}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => run(() => api.chooseTeam("B"), "Benvenuto in squadra!")}
                    >
                      {state.week.team_b}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Da martedì l'ingresso passa dalla Ruota delle Squadre, per tenere il bilanciamento 50/50.
                  </p>
                  <Button
                    disabled={busy}
                    className="gradient-pop font-bold"
                    onClick={() =>
                      run(async () => {
                        const r = await api.spinTeamWheel();
                        toast.success(`La ruota ti assegna: ${r.team === "A" ? state.week.team_a : state.week.team_b}`);
                      })
                    }
                  >
                    <Dices className="mr-1.5 h-4 w-4" /> Gira la Ruota delle Squadre
                  </Button>
                </>
              )}
            </div>
          )}
        </section>

        {/* VETRINA PREMI */}
        <section className="pop-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold">
            <Trophy className="h-5 w-5 text-warning" /> Vetrina Premi
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Premio Campione</p>
              <p className="mt-1 text-lg font-extrabold">{state.week.prize_champion}</p>
              <p className="mt-1 text-xs text-muted-foreground">Al 1° posto della classifica generale</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Premio Squadra</p>
              <p className="mt-1 text-lg font-extrabold">{state.week.prize_team}</p>
              <p className="mt-1 text-xs text-muted-foreground">A tutti i membri della squadra vincitrice</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            I premi finiscono automaticamente nella collezione dei vincitori a fine settimana.
          </p>
        </section>

        {/* TICKET */}
        <section className="pop-card p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-xl font-extrabold">
                <Ticket className="h-5 w-5 text-primary" /> Ticket
              </h2>
              <p className="text-sm text-muted-foreground">
                {state.tickets >= 5 ? "Scorta piena!" : `Prossimo ticket tra ${countdown}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-1 text-2xl">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < state.tickets ? "" : "opacity-25 grayscale"}>
                  🎟️
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || state.emergency_left === 0}
              onClick={() =>
                run(async () => {
                  const seen = await playAd();
                  if (!seen) throw new Error("Video interrotto");
                  const r = await api.emergency("video");
                  toast.success(`+${r.gain} ticket`);
                })
              }
            >
              <Video className="mr-1.5 h-4 w-4" /> Video: +1 ticket
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || state.emergency_left === 0}
              onClick={() =>
                run(async () => {
                  const r = await api.emergency("game");
                  if (r.won) toast.success("Fortuna sfacciata: +2 ticket!");
                  else toast("Niente da fare stavolta: 0 ticket");
                })
              }
            >
              <Dices className="mr-1.5 h-4 w-4" /> Mini-gioco fortuna
            </Button>
            <span className="self-center text-xs text-muted-foreground">
              Recuperi rimasti oggi: {state.emergency_left}/3
            </span>
          </div>
        </section>

        {/* RUOTA DEL MATTINO */}
        <section className="pop-card p-5">
          <h2 className="mb-1 flex items-center gap-2 text-xl font-extrabold">
            <Sparkles className="h-5 w-5 text-warning" /> Ruota del Mattino
          </h2>
          <p className="text-sm text-muted-foreground">
            Un giro gratis al giorno, più un giro extra guardando un video. Si azzera al cambio giorno lato server.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              className="gradient-pop font-bold"
              disabled={busy || !state.wheel_free_available}
              onClick={() =>
                run(async () => {
                  const r = await api.spinWheel(false);
                  setWheelResult(r.label);
                })
              }
            >
              {state.wheel_free_available ? "Giro gratuito" : "Giro gratuito usato"}
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !state.wheel_extra_available || state.wheel_free_available}
              onClick={() =>
                run(async () => {
                  const seen = await playAd();
                  if (!seen) throw new Error("Video interrotto");
                  const r = await api.spinWheel(true);
                  setWheelResult(r.label);
                })
              }
            >
              <Video className="mr-1.5 h-4 w-4" /> Giro extra
            </Button>
          </div>
        </section>

        {/* QUIZ */}
        <section className="pop-card p-5">
          <h2 className="mb-1 text-xl font-extrabold">🧠 Quiz Trabocchetto</h2>
          <p className="text-sm text-muted-foreground">
            1 ticket a domanda. Risposta giusta: +10 punti squadra e +15 crediti.
          </p>
          <Button
            className="mt-3 w-full gradient-pop font-bold sm:w-auto"
            disabled={busy || state.tickets < 1}
            onClick={() =>
              run(async () => {
                const q = await api.drawQuiz();
                setResult(null);
                setQuiz(q);
              })
            }
          >
            {state.tickets < 1 ? "Ticket esauriti" : "Gioca una domanda"}
          </Button>
        </section>

        {/* CLASSIFICA */}
        <section className="pop-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold">
            <Coins className="h-5 w-5 text-warning" /> Classifica settimanale
          </h2>
          <ul className="space-y-2">
            {(board ?? []).slice(0, 10).map((row, i) => (
              <li key={row.username} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <span className="w-6 shrink-0 text-center font-extrabold text-muted-foreground">{i + 1}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-card ${frameClass(row.frame)}`}>
                    {row.avatar}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{row.username}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.team ? (row.team === "A" ? state.week.team_a : state.week.team_b) : "Senza squadra"}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 font-extrabold">{row.week_points}</span>
              </li>
            ))}
            {(board ?? []).length === 0 && <li className="text-sm text-muted-foreground">Nessun punteggio ancora.</li>}
          </ul>
        </section>
      </div>

      {/* DIALOG QUIZ */}
      <Dialog open={!!quiz} onOpenChange={(v) => !v && setQuiz(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-left text-lg leading-snug">{quiz?.question}</DialogTitle>
          </DialogHeader>
          {!result ? (
            <div className="space-y-2">
              {quiz?.options.map((opt, i) => (
                <Button
                  key={opt}
                  variant="secondary"
                  className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const r = await api.answerQuiz(quiz.id, i);
                      setResult(r);
                    })
                  }
                >
                  {opt}
                </Button>
              ))}
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <div className="text-5xl">{result.correct ? "🎉" : "🙃"}</div>
              <p className="font-extrabold">{result.correct ? "Esatto!" : "Ci sei cascato!"}</p>
              <p className="text-sm text-muted-foreground">{result.quip}</p>
              {!result.correct && quiz && (
                <p className="text-sm font-semibold">Risposta giusta: {quiz.options[result.answer]}</p>
              )}
              <Button className="w-full gradient-pop font-bold" onClick={() => setQuiz(null)}>
                Continua
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG RUOTA */}
      <Dialog open={!!wheelResult} onOpenChange={(v) => !v && setWheelResult(null)}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle className="text-center">Ruota del Mattino</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-5xl">🎡</div>
            <p className="text-lg font-extrabold text-gradient-pop">{wheelResult}</p>
            <Button className="w-full gradient-pop font-bold" onClick={() => setWheelResult(null)}>
              Fantastico
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
