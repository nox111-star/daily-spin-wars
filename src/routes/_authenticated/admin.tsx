import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Users, MessageSquare, HelpCircle, Activity } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  api,
  frameClass,
  type AdminOverview,
  type CosmeticRow,
  type JobName,
  type ShopItem,
  type StreakReward,
  type WheelPrize,
} from "@/lib/api";
import {
  ANIMATIONS,
  CROWN_ANIMATIONS,
  CROWN_PRESETS,
  DEFAULT_STYLE,
  CrownBadge,
  cosmeticAnimClass,
  cosmeticCss,
  type CosmeticStyle,
} from "@/lib/cosmetics";

import { Switch } from "@/components/ui/switch";
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
              <TabsTrigger value="wheel">Ruota 10 gg</TabsTrigger>
              <TabsTrigger value="week">Sfida settimanale</TabsTrigger>
              <TabsTrigger value="streak">Streak 7 gg</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="shop">Shop</TabsTrigger>
              <TabsTrigger value="styles">Editor grafico</TabsTrigger>
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
            <TabsContent value="streak">
              <StreakSection />
            </TabsContent>
            <TabsContent value="shop">
              <ShopAdmin data={data} onDone={refresh} />
            </TabsContent>
            <TabsContent value="styles">
              <StyleStudio data={data} onDone={refresh} />
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

      <JobScheduler
        job="wheel"
        payload={{ prizes }}
        description="All'orario indicato la ruota dei prossimi 10 giorni viene rigenerata con i premi qui sopra."
        payloadHint="Salvando la pianificazione vengono memorizzati i premi attualmente visibili come modello automatico."
      />
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
  const [reward, setReward] = useState<StreakReward>(
    w?.streak_reward ?? { type: "credits", amount: 250, label: "250 crediti" },
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.adminSetWeek({
        ...form,
        streak_reward: reward,
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
        {field("champion_frame", "Cornice corona campione (es. crown, gold, aurora)")}
        {field("starts_at", "Apertura sfida", "datetime-local")}
        {field("ends_at", "Chiusura sfida", "datetime-local")}
      </div>

      <h3 className="mt-5 font-display text-base font-extrabold">Premio streak 7 giorni</h3>
      <p className="mb-2 text-sm text-muted-foreground">
        Assegnato automaticamente al 7° accesso consecutivo. Gli utenti ne vedono l'anteprima nell'app.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="rw-type">Tipo di premio</Label>
          <select
            id="rw-type"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={reward.type}
            onChange={(e) => setReward((r) => ({ ...r, type: e.target.value as StreakReward["type"] }))}
          >
            <option value="credits">Crediti</option>
            <option value="points">Punti</option>
            <option value="item">Cosmetico (avatar / cornice / titolo)</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rw-label">Etichetta mostrata ai giocatori</Label>
          <Input
            id="rw-label"
            value={reward.label}
            onChange={(e) => setReward((r) => ({ ...r, label: e.target.value }))}
          />
        </div>
        {reward.type !== "item" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="rw-amount">Quantità</Label>
            <Input
              id="rw-amount"
              type="number"
              min={0}
              value={reward.amount}
              onChange={(e) => setReward((r) => ({ ...r, amount: Math.max(0, Number(e.target.value)) }))}
            />
          </div>
        ) : (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="rw-kind">Tipo cosmetico</Label>
              <select
                id="rw-kind"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={reward.item_kind ?? "frame"}
                onChange={(e) =>
                  setReward((r) => ({ ...r, item_kind: e.target.value as NonNullable<StreakReward["item_kind"]> }))
                }
              >
                <option value="frame">Cornice</option>
                <option value="avatar">Avatar</option>
                <option value="title">Titolo</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rw-name">Nome cosmetico</Label>
              <Input
                id="rw-name"
                value={reward.item_name ?? ""}
                onChange={(e) => setReward((r) => ({ ...r, item_name: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rw-value">Identificativo (dall'editor grafico)</Label>
              <Input
                id="rw-value"
                value={reward.item_value ?? ""}
                onChange={(e) => setReward((r) => ({ ...r, item_value: e.target.value }))}
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? "Salvo…" : "Salva sfida"}
        </Button>
        <Button variant="outline" onClick={settle} disabled={busy || !form.week_start}>
          Distribuisci premi ora
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            api
              .adminRunRollover()
              .then((r) => toast.success(`Rollover eseguito — ${r.settled} settimane chiuse`))
              .then(onDone)
              .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Rollover non riuscito"))
          }
        >
          Forza rollover
        </Button>
        {w?.settled && <span className="text-xs font-semibold text-muted-foreground">Settimana già chiusa</span>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Il rollover automatico gira in background: alla scadenza dell'orario di fine, la classifica viene calcolata e i
        premi assegnati senza intervento manuale.
      </p>

      <JobScheduler
        job="week"
        description="All'orario indicato chiude la stagione: distribuisce titolo di squadra e cornice corona al campione, azzera i punti e apre la nuova settimana con nomi e premi aggiornati."
      />
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

      <JobScheduler
        job="chat"
        payload={{ keep_hours: hours }}
        description="All'orario indicato la chat viene svuotata automaticamente."
        payloadHint="Salvando la pianificazione viene memorizzato il numero di ore da conservare indicato qui sopra."
      />
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

/* ---------------- Shop admin ---------------- */

const EMPTY_ITEM: ShopItem = {
  id: "",
  kind: "frame",
  name: "",
  value: "",
  unlock_mode: "credits",
  price: 100,
  video_price: 2,
  active: true,
  sort: 0,
};

function ShopAdmin({ data, onDone }: { data: AdminOverview; onDone: () => void }) {
  const [item, setItem] = useState<ShopItem>(EMPTY_ITEM);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<ShopItem>) => setItem((i) => ({ ...i, ...patch }));

  async function save() {
    setBusy(true);
    try {
      if (!item.id.trim() || !item.name.trim() || !item.value.trim()) throw new Error("Compila id, nome e valore");
      await api.adminUpsertShopItem({
        ...item,
        price: item.unlock_mode === "credits" ? Math.max(1, item.price) : 0,
        video_price: item.unlock_mode === "video" ? Math.max(1, item.video_price) : 0,
      });
      toast.success("Oggetto salvato");
      setItem(EMPTY_ITEM);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.adminDeleteShopItem(id);
      toast.success("Oggetto rimosso");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rimozione non riuscita");
    }
  }

  return (
    <section className="pop-card p-4">
      <h2 className="font-display text-lg font-extrabold">Shop — sblocco binario</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Ogni oggetto si sblocca <strong>solo con crediti</strong> oppure <strong>solo guardando N video</strong>. La
        regola la decidi qui e il giocatore non può cambiarla.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="it-id">ID univoco</Label>
          <Input id="it-id" value={item.id} onChange={(e) => set({ id: e.target.value })} placeholder="frame_neon" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="it-name">Nome visualizzato</Label>
          <Input id="it-name" value={item.name} onChange={(e) => set({ name: e.target.value })} placeholder="Cornice Neon" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="it-kind">Tipo</Label>
          <select
            id="it-kind"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={item.kind}
            onChange={(e) => set({ kind: e.target.value as ShopItem["kind"] })}
          >
            <option value="avatar">Avatar</option>
            <option value="frame">Cornice</option>
            <option value="title">Titolo</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="it-value">Valore (emoji avatar / id cornice / testo titolo)</Label>
          <Input id="it-value" value={item.value} onChange={(e) => set({ value: e.target.value })} placeholder="neon" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="it-mode">Modalità di sblocco</Label>
          <select
            id="it-mode"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={item.unlock_mode}
            onChange={(e) => set({ unlock_mode: e.target.value as ShopItem["unlock_mode"] })}
          >
            <option value="credits">Solo crediti</option>
            <option value="video">Solo video</option>
          </select>
        </div>
        {item.unlock_mode === "credits" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="it-price">Prezzo in crediti</Label>
            <Input
              id="it-price"
              type="number"
              min={1}
              value={item.price}
              onChange={(e) => set({ price: Number(e.target.value) })}
            />
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="it-videos">Numero di video richiesti</Label>
            <Input
              id="it-videos"
              type="number"
              min={1}
              value={item.video_price}
              onChange={(e) => set({ video_price: Number(e.target.value) })}
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="it-sort">Ordine</Label>
          <Input id="it-sort" type="number" value={item.sort} onChange={(e) => set({ sort: Number(e.target.value) })} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch id="it-active" checked={item.active} onCheckedChange={(v) => set({ active: v })} />
          <Label htmlFor="it-active">Attivo nello shop</Label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? "Salvo…" : "Salva oggetto"}
        </Button>
        <Button variant="outline" onClick={() => setItem(EMPTY_ITEM)}>
          Nuovo oggetto
        </Button>
      </div>

      <h3 className="mb-2 mt-6 font-extrabold">Oggetti in catalogo</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {data.shop.map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-2">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card text-lg ${
              s.kind === "frame" ? frameClass(s.value) : frameClass("none")
            }`}>
              {s.kind === "avatar" ? s.value : s.kind === "frame" ? "🖼️" : "🏷️"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {s.name} {!s.active && <span className="text-xs text-muted-foreground">(disattivo)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.kind} · {s.unlock_mode === "credits" ? `${s.price} crediti` : `${s.video_price} video`}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setItem(s)}>
              Modifica
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(s.id)}>
              Elimina
            </Button>
          </li>
        ))}
        {data.shop.length === 0 && <li className="text-sm text-muted-foreground">Nessun oggetto in catalogo.</li>}
      </ul>
    </section>
  );
}

/* ---------------- Pilota automatico per sezione ---------------- */

const JOB_LABEL: Record<JobName, string> = {
  wheel: "Aggiornamento ruota (10 giorni)",
  week: "Nuova stagione e premi",
  streak: "Reset streak 7 giorni",
  chat: "Svuotamento chat",
};

function JobScheduler({
  job,
  description,
  payload,
  payloadHint,
}: {
  job: JobName;
  description: string;
  payload?: Record<string, unknown>;
  payloadHint?: string;
}) {
  const { data, refetch, isLoading } = useQuery({ queryKey: ["admin-jobs"], queryFn: api.adminListJobs, retry: false });
  const current = data?.[job];
  const [enabled, setEnabled] = useState(false);
  const [runAt, setRunAt] = useState("05:00");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!current) return;
    setEnabled(current.enabled);
    setRunAt((current.run_at ?? "05:00:00").slice(0, 5));
  }, [current]);

  async function save() {
    setBusy(true);
    try {
      await api.adminSetJob(job, enabled, `${runAt}:00`, payload ?? current?.payload ?? {});
      toast.success("Pilota automatico aggiornato");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setBusy(true);
    try {
      const r = await api.adminRunJob(job);
      toast.success(r.ok ? "Attività eseguita" : (r.reason ?? "Nessuna azione"));
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Esecuzione non riuscita");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Caricamento pilota automatico…</p>;

  return (
    <div className="mt-4 rounded-2xl border border-secondary/40 bg-secondary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-extrabold">Pilota automatico — {JOB_LABEL[job]}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id={`job-${job}`} checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor={`job-${job}`}>{enabled ? "Attivo" : "Disattivo"}</Label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`time-${job}`}>Ora di esecuzione (UTC)</Label>
          <Input
            id={`time-${job}`}
            type="time"
            value={runAt}
            onChange={(e) => setRunAt(e.target.value)}
            className="w-36"
          />
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? "Salvo…" : "Salva pianificazione"}
        </Button>
        <Button variant="outline" onClick={runNow} disabled={busy}>
          Esegui adesso
        </Button>
        <span className="text-xs text-muted-foreground">Ultima esecuzione: {current?.last_run_date ?? "mai"}</span>
      </div>
      {payloadHint && <p className="mt-2 text-xs text-muted-foreground">{payloadHint}</p>}
    </div>
  );
}

function StreakSection() {
  return (
    <section className="pop-card p-4">
      <h2 className="font-display text-lg font-extrabold">Streak 7 giorni</h2>
      <p className="text-sm text-muted-foreground">
        Il premio della streak si configura nella sezione "Sfida settimanale" e viene accreditato automaticamente al 7°
        accesso consecutivo. Qui puoi pianificare l'azzeramento della streak per tutti i giocatori.
      </p>
      <JobScheduler
        job="streak"
        description="All'orario indicato la streak di tutti i giocatori riparte da zero e inizia un nuovo ciclo di 7 giorni."
      />
    </section>
  );
}

/* ---------------- Editor grafico cosmetici ---------------- */

function StyleStudio({ data, onDone }: { data: AdminOverview; onDone: () => void }) {
  const [draft, setDraft] = useState<CosmeticRow>({
    value: "",
    kind: "frame",
    name: "",
    style: { ...DEFAULT_STYLE },
    active: true,
  });
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<CosmeticStyle>) => setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }));

  async function save() {
    if (!draft.value.trim() || !draft.name.trim()) {
      toast.error("Servono identificativo e nome");
      return;
    }
    setBusy(true);
    try {
      await api.adminUpsertCosmeticStyle(draft);
      toast.success("Stile salvato: già disponibile nell'app");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setBusy(false);
    }
  }

  async function remove(value: string) {
    try {
      await api.adminDeleteCosmeticStyle(value);
      toast.success("Stile eliminato");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eliminazione non riuscita");
    }
  }

  return (
    <section className="pop-card p-4">
      <h2 className="font-display text-lg font-extrabold">Editor grafico cosmetici</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Crea cornici, avatar e titoli con animazioni personalizzate. I parametri vengono salvati nel database e
        renderizzati dinamicamente ovunque nell'app (shop, profilo, chat, classifiche).
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cs-value">Identificativo (univoco)</Label>
            <Input
              id="cs-value"
              placeholder="rainbow-hop"
              value={draft.value}
              onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cs-name">Nome visibile</Label>
            <Input
              id="cs-name"
              placeholder="Arcobaleno Saltellante"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cs-kind">Tipo</Label>
            <select
              id="cs-kind"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={draft.kind}
              onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as CosmeticRow["kind"] }))}
            >
              <option value="frame">Cornice</option>
              <option value="avatar">Avatar</option>
              <option value="title">Titolo</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cs-anim">Animazione</Label>
            <select
              id="cs-anim"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={draft.style.animation ?? "none"}
              onChange={(e) => set({ animation: e.target.value as NonNullable<CosmeticStyle["animation"]> })}
            >
              {ANIMATIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cs-c1">Colore principale</Label>
            <Input
              id="cs-c1"
              type="color"
              className="h-10 w-24 p-1"
              value={draft.style.border_color ?? "#FF4D8D"}
              onChange={(e) => set({ border_color: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cs-c2">Colore secondario</Label>
            <Input
              id="cs-c2"
              type="color"
              className="h-10 w-24 p-1"
              value={draft.style.border_color_2 ?? "#00C2FF"}
              onChange={(e) => set({ border_color_2: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cs-bstyle">Stile bordo</Label>
            <select
              id="cs-bstyle"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={draft.style.border_style ?? "solid"}
              onChange={(e) => set({ border_style: e.target.value as NonNullable<CosmeticStyle["border_style"]> })}
            >
              <option value="solid">solid</option>
              <option value="dashed">dashed</option>
              <option value="dotted">dotted</option>
              <option value="double">double</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cs-bw">Spessore bordo (px)</Label>
            <Input
              id="cs-bw"
              type="number"
              min={0}
              max={12}
              value={draft.style.border_width ?? 3}
              onChange={(e) => set({ border_width: Math.max(0, Number(e.target.value)) })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cs-glow">Bagliore</Label>
            <Input
              id="cs-glow"
              type="number"
              min={0}
              max={40}
              value={draft.style.glow ?? 0}
              onChange={(e) => set({ glow: Math.max(0, Number(e.target.value)) })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cs-speed">Velocità animazione (s)</Label>
            <Input
              id="cs-speed"
              type="number"
              min={0.2}
              step={0.1}
              value={draft.style.speed ?? 2}
              onChange={(e) => set({ speed: Math.max(0.2, Number(e.target.value)) })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="cs-bg"
              checked={Boolean(draft.style.bg)}
              onCheckedChange={(v) => set({ bg: v ? "gradient" : "" })}
            />
            <Label htmlFor="cs-bg">Sfondo sfumato</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="cs-active"
              checked={draft.active}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, active: v }))}
            />
            <Label htmlFor="cs-active">Attivo</Label>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cs-crown">Corona sopra la cornice</Label>
            <select
              id="cs-crown"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={draft.style.crown ?? ""}
              onChange={(e) => set({ crown: e.target.value })}
            >
              {CROWN_PRESETS.map((c) => (
                <option key={c || "none"} value={c}>
                  {c || "nessuna"}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cs-crown-anim">Animazione corona</Label>
            <select
              id="cs-crown-anim"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={draft.style.crown_animation ?? "none"}
              onChange={(e) => set({ crown_animation: e.target.value as NonNullable<CosmeticStyle["crown_animation"]> })}
            >
              {CROWN_ANIMATIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cs-crown-size">Dimensione corona (px)</Label>
            <Input
              id="cs-crown-size"
              type="number"
              min={8}
              max={64}
              value={draft.style.crown_size ?? 18}
              onChange={(e) => set({ crown_size: Math.max(8, Number(e.target.value)) })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cs-crown-offset">Distanza dall'alto (px)</Label>
            <Input
              id="cs-crown-offset"
              type="number"
              min={0}
              max={48}
              value={draft.style.crown_offset ?? 10}
              onChange={(e) => set({ crown_offset: Math.max(0, Number(e.target.value)) })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cs-crown-tilt">Inclinazione corona (°)</Label>
            <Input
              id="cs-crown-tilt"
              type="number"
              min={-90}
              max={90}
              value={draft.style.crown_tilt ?? 0}
              onChange={(e) => set({ crown_tilt: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-muted/40 p-6">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Anteprima live</span>
          <span
            className={`grid h-20 w-20 place-items-center rounded-full bg-card text-3xl ${cosmeticAnimClass(draft.style)}`}
            style={cosmeticCss(draft.style)}
          >
            🐣
          </span>
          <span className="text-sm font-extrabold">{draft.name || "Nuovo stile"}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? "Salvo…" : "Salva stile"}
        </Button>
        <Button variant="outline" onClick={() => setDraft((d) => ({ ...d, style: { ...DEFAULT_STYLE } }))}>
          Ripristina parametri
        </Button>
      </div>

      <h3 className="mt-6 font-display text-base font-extrabold">Stili esistenti</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data.styles ?? []).map((s) => (
          <div key={s.value} className="flex items-center gap-3 rounded-2xl border border-border p-3">
            <span
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card text-xl ${cosmeticAnimClass(s.style)}`}
              style={cosmeticCss(s.style)}
            >
              {s.kind === "title" ? "🏷️" : "🐣"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">{s.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {s.kind} · {s.value} {s.active ? "" : "· disattivo"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <Button size="sm" variant="outline" onClick={() => setDraft({ ...s })}>
                Modifica
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(s.value)}>
                Elimina
              </Button>
            </div>
          </div>
        ))}
        {(data.styles ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nessuno stile personalizzato: creane uno qui sopra.</p>
        )}
      </div>
    </section>
  );
}
