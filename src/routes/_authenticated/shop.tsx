import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Video, Coins, Check } from "lucide-react";
import { AppShell, useGameState } from "@/components/AppShell";
import { useAdPlayer } from "@/components/AdPlayer";
import { api } from "@/lib/api";
import { Cosmetic } from "@/lib/cosmetics";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Quizzly Squad" },
      { name: "description", content: "Acquista cornici, titoli e avatar con i crediti guadagnati oppure sbloccali guardando un video." },
      { property: "og:title", content: "Shop di Quizzly Squad" },
      { property: "og:description", content: "Cornici, titoli e avatar per personalizzare il tuo profilo giocatore." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { data: state } = useGameState();
  const { data: items } = useQuery({ queryKey: ["shop"], queryFn: api.shop });
  const { data: owned } = useQuery({ queryKey: ["collection"], queryFn: api.collection });
  const queryClient = useQueryClient();
  const { playAd, AdOverlay } = useAdPlayer();
  const [busy, setBusy] = useState<string | null>(null);

  const has = (kind: string, value: string) =>
    (owned ?? []).some((o) => o.item_type === kind && o.item_value === value);

  async function buy(id: string, videos: number | null) {
    setBusy(id);
    try {
      let tokens: string[] | null = null;
      if (videos) {
        tokens = [];
        for (let i = 0; i < videos; i++) {
          const token = await playAd(`shop:${id}`);
          if (!token) throw new Error("Video interrotto: sblocco annullato");
          tokens.push(token);
        }
      }
      await api.buyItem(id, tokens);
      toast.success("Aggiunto alla tua collezione!");
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Acquisto non riuscito");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      {AdOverlay}
      <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold">Shop</h1>
          <p className="text-sm text-muted-foreground">Cornici, titoli e avatar per il tuo profilo.</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-3 py-1.5 font-bold">
          <Coins className="h-4 w-4 text-warning" />
          {state?.profile.credits ?? 0}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(items ?? []).map((item) => {
          const ownedItem = has(item.kind, item.value);
          return (
            <article key={item.id} className="pop-card flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <Cosmetic
                  value={item.kind === "frame" ? item.value : "none"}
                  styles={state?.styles ?? {}}
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-muted text-2xl"
                >
                  {item.kind === "avatar" ? item.value : item.kind === "frame" ? "🖼️" : "🏷️"}
                </Cosmetic>
                <div className="min-w-0">
                  <h2 className="truncate font-extrabold">{item.name}</h2>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.kind}</p>
                </div>
              </div>
              {ownedItem ? (
                <span className="flex items-center gap-1 text-sm font-bold text-success">
                  <Check className="h-4 w-4" /> Nella collezione
                </span>
              ) : item.unlock_mode === "credits" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="gradient-pop font-bold"
                    disabled={busy === item.id}
                    onClick={() => buy(item.id, null)}
                  >
                    <Coins className="mr-1.5 h-4 w-4" /> Sblocca con {item.price} crediti
                  </Button>
                  <span className="text-xs text-muted-foreground">Solo crediti</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === item.id}
                    onClick={() => buy(item.id, item.video_price)}
                  >
                    <Video className="mr-1.5 h-4 w-4" /> Guarda {item.video_price} video
                  </Button>
                  <span className="text-xs text-muted-foreground">Solo video</span>
                </div>
              )}

            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
