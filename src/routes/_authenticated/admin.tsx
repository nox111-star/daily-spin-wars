import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Users, MessageSquare, HelpCircle, Activity } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { api, frameClass, type AdminOverview, type WheelPrize } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Pannello Admin — Quizzly Squad" },
      { name: "description", content: "Gestisci quiz, ruota giornaliera, sfide settimanali, chat e utenti attivi di Quizzly Squad." },
      { property: "og:title", content: "Pannello Admin di Quizzly Squad" },
      { property: "og:description", content: "Strumenti di amministrazione: quiz, premi, calendario e monitoraggio live." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const QUIZ_SAMPLE = `[
  {
    "question": "Quanti lati ha un esagono?",
    "options": ["5", "6", "7"],
    "correct": 1,
    "quip": "Esa = sei, facile no?",
    "difficulty": "medio"
  }
]`;

function AdminPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<AdminOverview>({
    queryKey: ["admin-overview"],
    queryFn: api.adminOverview,
    refetchInterval: 20000,
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] });

  if (error) {
    return (
      <AppShell>
        <div className="pop-card p-6 text-center">
          <h1 className="font-display text-xl font-extrabold">Area riservata</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Accesso riservato agli amministratori"}
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="mb-1 font-display text-2xl font-extrabold">Pannello Admin</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Gestisci contenuti, calendario premi e monitora la community in tempo reale.
      </p>

      {isLoading && <p className="text-muted-foreground">Caricamento…</p>}

      {data && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<Users className="h-4 w-4 text-primary" />} label="Giocatori" value={data.players} />
            <Stat icon={<Activity className="h-4 w-4 text-secondary" />} label="Online (5 min)" value={data.online} />
            <Stat icon={<HelpCircle className="h-4 w-4 text-warning" />} label="Quiz attivi" value={data.quizzes} />
            <Stat icon={<MessageSquare className="h-4 w-4 text-primary" />} label="Messaggi" value={data.messages} />
          </div>

          <Tabs defaultValue="quiz">
            <TabsList className="mb-4 flex w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="quiz">Quiz</TabsTrigger>
              <TabsTrigger value="wheel">Ruota 10 giorni</TabsTrigger>
              <TabsTrigger value="week">Sfida settimanale</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="live">Live monitor</TabsTrigger>
            </TabsList>

            <TabsContent value="quiz">
              <QuizBulk data={data} onDone={refresh} />
            </TabsContent>
            <TabsContent value="wheel">
              <WheelCalendar data={data} onDone={refresh} />
            </TabsContent>
            <TabsContent value="week">
              <WeekConfig data={data} onDone={refresh} />
            </TabsContent>
            <TabsContent value="chat">
              <ChatCleanup onDone={refresh} />
            </TabsContent>
            <TabsContent value="live">
              <LiveMonitor data={data} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="pop-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="font-display text-2xl font-extrabold">{value}</p>
    </div>
  );
}

/* ---------------- Bulk quiz ---------------- */

function QuizBulk({ data, onDone }: { data: AdminOverview; onDone: () => void }) {
  const [raw, setRaw] = useState(QUIZ_SAMPLE);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Serve un array JSON di domande");
      const r = await api.adminBulkQuiz(parsed);
      toast.success(`${r.inserted} domande importate`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import non riuscito");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pop-card p-4">
      <h2 className="font-display text-lg font-extrabold">Bulk import quiz</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Incolla un array JSON. Campi: <code>question</code>, <code>options</code>, <code>correct</code> (indice da 0),{" "}
        <code>quip</code>, <code>difficulty</code> (medio / difficile / impossibile), opzionali <code>points</code> e{" "}
        <code>credits</code>.
      </p>
      <Textarea rows={12} value={raw} onChange={(e) => setRaw(e.target.value)} className="font-mono text-xs" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={busy}>
          {busy ? "Importo…" : "Importa domande"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Attive per difficoltà:{" "}
          {Object.entries(data.quiz_by_difficulty).map(([k, v]) => `${k}: ${v}`).join(" · ") || "nessuna"}
        </p>
      </div>
    </section>
  );
}

/* ---------------- Wheel calendar ---------------- */

const EMPTY_PRIZE: WheelPrize = { label: "", credits: 0, points: 0, weight: 10 };

function WheelCalendar({ data, onDone }: { data: AdminOverview; onDone: () => void }) {
  const days = data.wheel.slice(0, 10);
  const [selected, setSelected] = useState(days[0]?.day ?? "");
  const current = days.find((d) => d.day === selected);
  const [prizes, setPrizes] = useState<WheelPrize[]>(current?.prizes ?? []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPrizes(days.find((d) => d.day === selected)?.prizes ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, data]);

  function update(i: number, patch: Partial<WheelPrize>) {
    setPrizes((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function save() {
    setBusy(true);
    try {
      if (prizes.length === 0) throw new Error("Aggiungi almeno un premio");
      await api.adminSetWheelDay(selected, prizes);
      toast.success("Calendario aggiornato");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pop-card p-4">
      <h2 className="font-display text-lg font-extrabold">Ruota del mattino — 10 giorni</h2>
      <p className="mb-3 text-sm text-muted-foreground">Seleziona un giorno e personalizza i premi e i loro pesi.</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {days.map((d) => (
          <button
            key={d.day}
            onClick={() => setSelected(d.day)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              d.day === selected ? "gradient-pop text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {new Date(d.day).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {prizes.map((p, i) => (
          <div key={i} className="grid gap-2 rounded-xl bg-muted/50 p-2 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
            <Input value={p.label} placeholder="Etichetta" onChange={(e) => update(i, { label: e.target.value })} />
            <Input
              type="number"
              value={p.credits}
              placeholder="Crediti"
              onChange={(e) => update(i, { credits: Number(e.target.value) })}
            />
            <Input
              type="number"
              value={p.points}
              placeholder="Punti"
              onChange={(e) => update(i, { points: Number(e.target.value) })}
            />
            <Input
              type="number"
              value={p.weight}
              placeholder="Peso"
              onChange={(e) => update(i, { weight: Number(e.target.value) })}
            />
            <Button variant="ghost" onClick={() => setPrizes((x) => x.filter((_, idx) => idx !== i))}>
              Rimuovi
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setPrizes((p) => [...p, { ...EMPTY_PRIZE }])}>
          Aggiungi premio
        </Button>
        <Button onClick={save} disabled={busy || !selected}>
          {busy ? "Salvo…" : "Salva giornata"}
        </Button>
      </div>
    </section>
  );
}

/* ---------------- Weekly challenge ---------------- */

function WeekConfig({ data, onDone }: { data: AdminOverview; onDone: () => void }) {
  const w = data.week;
  const [form, setForm] = useState({
    week_start: w?.week_start ?? "",
    team_a: w?.team_a ?? "",
    team_b: w?.team_b ?? "",
    prize_champion: w?.prize_champion ?? "",
    prize_team: w?.prize_team ?? "",
    champion_frame: w?.champion_frame ?? "crown",
    starts_at: toLocalInput(w?.starts_at),
    ends_at: toLocalInput(w?.ends_at),
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.adminSetWeek({
        ...form,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : "",
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : "",
      });
      toast.success("Sfida settimanale aggiornata");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setBusy(false);
    }
  }

  async function settle() {
    if (!form.week_start) return;
    setBusy(true);
    try {
      const r = await api.adminSettleWeek(form.week_start);
      toast.success(r.winner ? `Premi distribuiti — squadra ${r.winner}` : "Settimana già chiusa");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chiusura non riuscita");
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string, type = "text") => (
    <div className="grid gap-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <section className="pop-card p-4">
      <h2 className="font-display text-lg font-extrabold">Configuratore sfida settimanale</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Nomi squadre, premi e finestra temporale. Alla chiusura i premi vengono distribuiti e i punti settimanali azzerati.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("week_start", "Inizio settimana (lunedì)", "date")}
        {field("team_a", "Nome Squadra A")}
        {field("team_b", "Nome Squadra B")}
        {field("prize_champion", "Premio campione")}
        {field("prize_team", "Premio squadra vincente")}
        {field("starts_at", "Apertura sfida", "datetime-local")}
        {field("ends_at", "Chiusura sfida", "datetime-local")}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? "Salvo…" : "Salva sfida"}
        </Button>
        <Button variant="outline" onClick={settle} disabled={busy || !form.week_start}>
          Distribuisci premi ora
        </Button>
        {w?.settled && <span className="text-xs font-semibold text-muted-foreground">Settimana già chiusa</span>}
      </div>
    </section>
  );
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------------- Chat cleanup ---------------- */

function ChatCleanup({ onDone }: { onDone: () => void }) {
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);

  async function clear() {
    setBusy(true);
    try {
      const r = await api.adminClearChat(hours);
      toast.success(`${r.deleted} messaggi eliminati`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pulizia non riuscita");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pop-card p-4">
      <h2 className="font-display text-lg font-extrabold">Pulizia chat</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Elimina i messaggi più vecchi del numero di ore indicato. Usa 0 per svuotare completamente la chat.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="hours">Ore da conservare</Label>
          <Input
            id="hours"
            type="number"
            min={0}
            value={hours}
            onChange={(e) => setHours(Math.max(0, Number(e.target.value)))}
            className="w-32"
          />
        </div>
        <Button variant="destructive" onClick={clear} disabled={busy}>
          {busy ? "Pulisco…" : "Pulisci chat"}
        </Button>
      </div>
    </section>
  );
}

/* ---------------- Live monitor ---------------- */

function LiveMonitor({ data }: { data: AdminOverview }) {
  const users = data.active_users;
  const answers = data.today_answers;
  const rows = useMemo(
    () =>
      users.map((u) => ({
        ...u,
        ago: Math.max(0, Math.round((Date.now() - new Date(u.last_seen).getTime()) / 60000)),
      })),
    [users],
  );

  return (
    <section className="pop-card p-4">
      <h2 className="font-display text-lg font-extrabold">Live monitor</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Utenti attivi negli ultimi 15 minuti · {answers} risposte quiz oggi · aggiornamento automatico.
      </p>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nessun utente attivo al momento.</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map((u) => (
          <li key={u.username} className="flex items-center gap-3 rounded-xl bg-muted/50 p-2">
            <span className={`grid h-9 w-9 place-items-center rounded-full bg-card text-lg ${frameClass("none")}`}>
              {u.avatar}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{u.username}</p>
              <p className="text-xs text-muted-foreground">{u.ago === 0 ? "adesso" : `${u.ago} min fa`}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
