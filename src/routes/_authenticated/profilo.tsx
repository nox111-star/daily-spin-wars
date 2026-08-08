import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, useGameState } from "@/components/AppShell";
import { api, frameClass } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/profilo")({
  head: () => ({
    meta: [
      { title: "Profilo e Collezione — Bubble Brawl" },
      { name: "description", content: "La tua collezione personale: avatar, cornici e titoli ottenuti da missioni, shop e premi settimanali." },
      { property: "og:title", content: "Profilo di Bubble Brawl" },
      { property: "og:description", content: "Personalizza avatar, cornice e titolo con i premi che hai conquistato." },
    ],
  }),
  component: ProfilePage,
});

const GROUPS = [
  { type: "avatar", label: "Avatar" },
  { type: "frame", label: "Cornici" },
  { type: "title", label: "Titoli" },
] as const;

function ProfilePage() {
  const { data: state } = useGameState();
  const { data: items } = useQuery({ queryKey: ["collection"], queryFn: api.collection });
  const queryClient = useQueryClient();

  async function equip(type: string, value: string) {
    try {
      await api.equip(type, value);
      toast.success("Profilo aggiornato!");
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operazione non riuscita");
    }
  }

  return (
    <AppShell>
      <section className="pop-card mb-5 flex flex-wrap items-center gap-4 p-5">
        <span
          className={`grid h-20 w-20 shrink-0 place-items-center rounded-full bg-card text-4xl ${frameClass(state?.profile.frame ?? "none")}`}
        >
          {state?.profile.avatar ?? "🫧"}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-extrabold">{state?.profile.username}</h1>
          <p className="text-sm text-muted-foreground">{state?.profile.title}</p>
          <p className="mt-1 text-sm font-bold">
            {state?.stats.week_points ?? 0} punti settimana · {state?.stats.total_points ?? 0} totali
          </p>
        </div>
      </section>

      <h2 className="mb-3 font-display text-xl font-extrabold">Collezione personale</h2>
      <div className="space-y-5">
        {GROUPS.map((group) => {
          const list = (items ?? []).filter((i) => i.item_type === group.type);
          return (
            <section key={group.type}>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ancora niente qui. Completa missioni o visita lo shop.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((item) => {
                    const active =
                      (group.type === "avatar" && state?.profile.avatar === item.item_value) ||
                      (group.type === "frame" && state?.profile.frame === item.item_value) ||
                      (group.type === "title" && state?.profile.title === item.item_value);
                    return (
                      <div key={item.id} className="pop-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-xl ${
                              group.type === "frame" ? frameClass(item.item_value) : "av-frame"
                            }`}
                          >
                            {group.type === "avatar" ? item.item_value : group.type === "frame" ? "🖼️" : "🏷️"}
                          </span>
                          <span className="min-w-0 truncate text-sm font-bold">{item.item_name}</span>
                        </span>
                        <Button
                          size="sm"
                          variant={active ? "secondary" : "default"}
                          className={active ? "" : "gradient-pop font-bold"}
                          disabled={active}
                          onClick={() => equip(group.type, item.item_value)}
                        >
                          {active ? "In uso" : "Usa"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
