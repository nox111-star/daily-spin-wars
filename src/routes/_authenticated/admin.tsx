import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Users, MessageSquare, HelpCircle, Activity } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { api, frameClass, type AdminOverview, type Automation, type ShopItem, type WheelPrize } from "@/lib/api";
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
              <TabsTrigger value="wheel">Ruota 10 giorni</TabsTrigger>
              <TabsTrigger value="week">Sfida settimanale</TabsTrigger>
              <TabsTrigger value="shop">Shop</TabsTrigger>
              <TabsTrigger value="auto">Automazioni</TabsTrigger>
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
            <TabsContent value="shop">
              <ShopAdmin data={data} onDone={refresh} />
            </TabsContent>
            <TabsContent value="auto">
              <AutomationPanel />
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

/* ---------------- Automation ---------------- */

const DOW = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

function AutomationPanel() {
  const { data, refetch, isLoading } = useQuery({ queryKey: ["automation"], queryFn: api.adminGetAutomation, retry: false });
  const [form, setForm] = useState<Automation | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isLoading || !form) return <p className="text-muted-foreground">Caricamento…</p>;

  const set = (patch: Partial<Automation>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const updatePrize = (i: number, patch: Partial<WheelPrize>) =>
    set({ wheel_template: form.wheel_template.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      await api.adminSetAutomation(form);
      toast.success("Automazione aggiornata");
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
      const r = await api.adminRunAutomation();
      toast.success(r.ok ? "Automazione eseguita" : r.reason ?? "Nessuna operazione da eseguire");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Esecuzione non riuscita");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pop-card p-4">
      <h2 className="font-display text-lg font-extrabold">Pilota automatico</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        All'orario indicato il sistema aggiorna la ruota del mattino, svuota la chat e — nel giorno di fine stagione —
        assegna il premio alla squadra prima in classifica, la cornice corona al campione individuale e azzera i punti
        di tutti.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Switch id="au-enabled" checked={form.enabled} onCheckedChange={(v) => set({ enabled: v })} />
          <Label htmlFor="au-enabled">Automazione attiva</Label>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="au-time">Orario di esecuzione</Label>
          <Input
            id="au-time"
            type="time"
            value={form.run_at.slice(0, 5)}
            onChange={(e) => set({ run_at: `${e.target.value}:00` })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="au-dow">Giorno di fine stagione</Label>
          <select
            id="au-dow"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={form.season_end_dow}
            onChange={(e) => set({ season_end_dow: Number(e.target.value) })}
          >
            {DOW.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-center gap-2">
          <div className="flex items-center gap-2">
            <Switch id="au-chat" checked={form.clear_chat} onCheckedChange={(v) => set({ clear_chat: v })} />
            <Label htmlFor="au-chat">Svuota la chat</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="au-wheel" checked={form.refresh_wheel} onCheckedChange={(v) => set({ refresh_wheel: v })} />
            <Label htmlFor="au-wheel">Aggiorna la ruota del mattino</Label>
          </div>
        </div>
      </div>

      <h3 className="mb-2 mt-5 font-extrabold">Premi della ruota generata</h3>
      <div className="space-y-2">
        {form.wheel_template.map((p, i) => (
          <div key={i} className="grid gap-2 rounded-xl bg-muted/50 p-2 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
            <Input value={p.label} placeholder="Etichetta" onChange={(e) => updatePrize(i, { label: e.target.value })} />
            <Input
              type="number"
              value={p.credits}
              placeholder="Crediti"
              onChange={(e) => updatePrize(i, { credits: Number(e.target.value) })}
            />
            <Input
              type="number"
              value={p.points}
              placeholder="Punti"
              onChange={(e) => updatePrize(i, { points: Number(e.target.value) })}
            />
            <Input
              type="number"
              value={p.weight}
              placeholder="Peso"
              onChange={(e) => updatePrize(i, { weight: Number(e.target.value) })}
            />
            <Button
              variant="ghost"
              onClick={() => set({ wheel_template: form.wheel_template.filter((_, idx) => idx !== i) })}
            >
              Rimuovi
            </Button>
          </div>
        ))}
        {form.wheel_template.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessun premio: la ruota resterà quella attuale.</p>
        )}
      </div>
      <Button
        variant="outline"
        className="mt-2"
        onClick={() => set({ wheel_template: [...form.wheel_template, { label: "", credits: 0, points: 0, weight: 10 }] })}
      >
        Aggiungi premio
      </Button>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? "Salvo…" : "Salva automazione"}
        </Button>
        <Button variant="outline" onClick={runNow} disabled={busy}>
          Esegui adesso
        </Button>
        <span className="text-xs text-muted-foreground">
          Ultima esecuzione: {form.last_run_date ?? "mai"}
        </span>
      </div>
    </section>
  );
}
