import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ticket, Coins, Trophy, Users, Sparkles, RefreshCw, Video, Lock, Crown, Shield, Timer } from "lucide-react";
import { AppShell, useGameState } from "@/components/AppShell";
import { useAdPlayer } from "@/components/AdPlayer";
import { api, frameClass, difficultyLabel, difficultyTone, type Difficulty } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/gioca")({
  head: () => ({
    meta: [
      { title: "Home — Quizzly Squad" },
      {
        name: "description",
        content: "Squadra della settimana, ticket giornalieri, ruota del mattino, quiz a difficoltà crescente e vetrina premi.",
      },
      { property: "og:title", content: "Quizzly Squad — la sfida settimanale a squadre" },
      { property: "og:description", content: "Gioca ai quiz, guadagna punti e porta la tua squadra alla vittoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: state, isLoading } = useGameState();
  const queryClient = useQueryClient();
  const { playAd, AdOverlay } = useAdPlayer();
  const [busy, setBusy] = useState(false);
  const [quiz, setQuiz] = useState<{ id: number; question: string; options: string[]; difficulty: Difficulty } | null>(null);
  const [result, setResult] = useState<{ correct: boolean; answer: number; quip: string; points: number } | null>(null);
  const [wheelResult, setWheelResult] = useState<string | null>(null);

  const { data: board } = useQuery({ queryKey: ["leaderboard"], queryFn: api.leaderboard, refetchInterval: 30000 });

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

  const teamName = useMemo(() => {
    if (!state) return null;
    const t = state.team ?? state.team_flow.proposal;
    if (!t) return null;
    return t === "A" ? state.week.team_a : state.week.team_b;
  }, [state]);

  if (isLoading || !state) {
    return (
      <AppShell>
        <p className="py-20 text-center text-muted-foreground">Caricamento in corso…</p>
      </AppShell>
    );
  }

  const flow = state.team_flow;
  const pctA = state.team_counts.pct_a;

  return (
    <AppShell>
      {AdOverlay}
      <div className="space-y-5">
        {/* SQUADRE */}
        <section className="pop-card overflow-hidden">
          <div className="gradient-pop px-5 py-4 text-primary-foreground">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="flex min-w-0 items-center gap-2 text-lg font-extrabold sm:text-xl">
                <Users className="h-5 w-5 shrink-0" />
                <span className="truncate">Sfida della settimana</span>
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={refresh}
                aria-label="Aggiorna"
                className="text-primary-foreground hover:bg-white/20"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm font-bold">
              <span className="min-w-0 truncate text-[color:var(--team-a)]">{state.week.team_a}</span>
              <span className="min-w-0 truncate text-right text-[color:var(--team-b)]">{state.week.team_b}</span>
            </div>
            <div className="flex h-5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-[color:var(--team-a)] transition-all duration-500" style={{ width: `${pctA}%` }} />
              <div className="h-full flex-1 bg-[color:var(--team-b)] transition-all duration-500" />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>
                {state.team_counts.a} giocatori · {state.team_counts.pct_a}%
              </span>
              <span>
                {state.team_counts.pct_b}% · {state.team_counts.b} giocatori
              </span>
            </div>

            {flow.mode === "locked" && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full gradient-pop px-3 py-1 text-sm font-bold text-primary-foreground">
                  <Shield className="h-4 w-4" /> Sei nei {teamName}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Squadra definitiva per questa settimana
                </span>
              </div>
            )}

            {flow.mode === "monday_free" && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  È lunedì: scegli liberamente la squadra. <strong>La scelta è definitiva</strong> per tutta la settimana.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button disabled={busy} onClick={() => run(() => api.chooseTeam("A"), "Squadra confermata!")}>
                    {state.week.team_a}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => run(() => api.chooseTeam("B"), "Squadra confermata!")}
                  >
                    {state.week.team_b}
                  </Button>
                </div>
              </div>
            )}

            {flow.mode === "proposal" && (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-border bg-muted/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Squadra assegnata</p>
                  <p className="mt-1 text-xl font-extrabold text-gradient-pop">{teamName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Assegnazione automatica per tenere le squadre in equilibrio.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    className="gradient-pop font-bold"
                    disabled={busy}
                    onClick={() => run(() => api.acceptTeam(), "Squadra confermata!")}
                  >
                    Accetta la squadra
                  </Button>
                  {flow.can_swap ? (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const token = await playAd("swap_team");
                          if (!token) throw new Error("Video non completato: cambio annullato");
                          await api.swapTeam(token);
                        }, "Squadra cambiata e confermata!")
                      }
                    >
                      <Video className="mr-1.5 h-4 w-4" /> Cambia squadra (Guarda Video)
                    </Button>
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">L'altra squadra è al completo</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* VETRINA PREMI */}
        <section className="pop-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold">
            <Trophy className="h-5 w-5 text-warning" /> Vetrina Premi
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl border border-warning/40 bg-gradient-to-br from-warning/20 to-transparent p-5">
              <Crown className="absolute -right-3 -top-3 h-20 w-20 text-warning/20" />
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Premio Campione</p>
              <p className="mt-1 text-lg font-extrabold">{state.week.prize_champion}</p>
              <p className="mt-1 text-xs text-muted-foreground">Corona unica al 1° posto della classifica</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-secondary/40 bg-gradient-to-br from-secondary/20 to-transparent p-5">
              <Users className="absolute -right-3 -top-3 h-20 w-20 text-secondary/20" />
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Premio Squadra</p>
              <p className="mt-1 text-lg font-extrabold">{state.week.prize_team}</p>
              <p className="mt-1 text-xs text-muted-foreground">A tutti i membri della squadra vincitrice</p>
            </div>
          </div>
        </section>

        {/* TICKET */}
        <section className="pop-card p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-xl font-extrabold">
                <Ticket className="h-5 w-5 text-primary" /> Ticket
              </h2>
              <p className="text-sm text-muted-foreground">
                {state.base_left} base · {state.bonus_left} bonus · video rimasti {state.videos_left}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1 text-xl">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={`b${i}`} className={i < state.base_left ? "" : "opacity-25 grayscale"}>
                  🎟️
                </span>
              ))}
              {Array.from({ length: state.bonus_left }).map((_, i) => (
                <span key={`x${i}`}>⭐</span>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !state.can_watch_ticket_video}
              onClick={() =>
                run(async () => {
                  const token = await playAd("ticket");
                  if (!token) throw new Error("Video non completato");
                  await api.claimAdTicket(token);
                }, "+1 ticket")
              }
            >
              <Video className="mr-1.5 h-4 w-4" /> Video: +1 ticket
            </Button>
            <span className="text-xs text-muted-foreground">
              {state.base_left > 0 ? "Disponibile a ticket base esauriti" : `Video usati: ${state.videos_used}/3`}
            </span>
          </div>
        </section>

        {/* RUOTA */}
        <section className="pop-card p-5">
          <h2 className="mb-1 flex items-center gap-2 text-xl font-extrabold">
            <Sparkles className="h-5 w-5 text-warning" /> Ruota del Mattino
          </h2>
          <p className="text-sm text-muted-foreground">
            Un giro gratis al giorno più un giro extra con video. I premi seguono il calendario impostato dallo staff.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              className="gradient-pop font-bold"
              disabled={busy || !state.wheel_free_available}
              onClick={() =>
                run(async () => {
                  const r = await api.spinWheel(false, null);
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
                  const token = await playAd("wheel");
                  if (!token) throw new Error("Video non completato");
                  const r = await api.spinWheel(true, token);
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
            Sessione base: 2 medi, 2 difficili, 1 impossibile. Sessione bonus: 1 medio, 1 difficile, 1 impossibile.
            Nessuna domanda si ripete.
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
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card ${frameClass(row.frame)}`}>
                    {row.avatar}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{row.username}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.title} · {row.team ? (row.team === "A" ? state.week.team_a : state.week.team_b) : "Senza squadra"}
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
            {quiz && (
              <span
                className={`mb-1 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-bold ${difficultyTone[quiz.difficulty]}`}
              >
                {difficultyLabel[quiz.difficulty]}
              </span>
            )}
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
              <p className="font-extrabold">{result.correct ? `Esatto! +${result.points} punti` : "Ci sei cascato!"}</p>
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
