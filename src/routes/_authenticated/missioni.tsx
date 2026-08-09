import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Video, Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAdPlayer } from "@/components/AdPlayer";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/missioni")({
  head: () => ({
    meta: [
      { title: "Missioni — Quizzly Squad" },
      { name: "description", content: "Completa obiettivi di gioco e sblocca avatar, cornici e titoli per la tua collezione personale." },
      { property: "og:title", content: "Missioni di Quizzly Squad" },
      { property: "og:description", content: "Obiettivi, ricompense e sblocchi per personalizzare il tuo profilo." },
    ],
  }),
  component: MissionsPage,
});

function MissionsPage() {
  const { data: missions, isLoading } = useQuery({ queryKey: ["missions"], queryFn: api.missions });
  const queryClient = useQueryClient();
  const { playAd, AdOverlay } = useAdPlayer();
  const [busy, setBusy] = useState<string | null>(null);

  async function unlock(id: string) {
    setBusy(id);
    try {
      const token = await playAd(`mission:${id}`);
      if (!token) throw new Error("Video interrotto: premio non sbloccato");
      const r = await api.claimMission(id);
      toast.success(`Sbloccato: ${r.reward}`);
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sblocco non riuscito");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      {AdOverlay}
      <h1 className="mb-1 font-display text-2xl font-extrabold">Missioni</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Completa l'obiettivo, poi guarda un video per sbloccare definitivamente il premio.
      </p>

      {isLoading && <p className="text-muted-foreground">Caricamento…</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {(missions ?? []).map((m) => {
          const done = m.progress >= m.target;
          return (
            <article key={m.id} className="pop-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-extrabold">{m.title}</h2>
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
                  {m.progress}/{m.target}
                </span>
              </div>
              <Progress value={(m.progress / m.target) * 100} className="mt-3 h-2" />
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <p className="min-w-0 truncate text-sm font-semibold">🎁 {m.reward_name}</p>
                {m.claimed ? (
                  <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-success">
                    <Check className="h-4 w-4" /> Ottenuto
                  </span>
                ) : (
                  <Button
                    size="sm"
                    className="shrink-0 gradient-pop font-bold"
                    disabled={!done || busy === m.id}
                    onClick={() => unlock(m.id)}
                  >
                    <Video className="mr-1.5 h-4 w-4" />
                    {done ? "Sblocca" : "In corso"}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
