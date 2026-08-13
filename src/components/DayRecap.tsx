import { useState } from "react";
import { toast } from "sonner";
import { Share2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DayResult } from "@/lib/api";

const MARK: Record<string, { ok: string; ko: string }> = {
  medio: { ok: "🟢", ko: "⬜" },
  difficile: { ok: "🔵", ko: "⬜" },
  impossibile: { ok: "🟣", ko: "⬛" },
};

const FALLBACK = { ok: "🟢", ko: "⬜" };

function mark(r: DayResult) {
  const set = MARK[r.difficulty] ?? FALLBACK;
  return r.ok ? set.ok : set.ko;
}

/**
 * Riepilogo visivo della giornata: una griglia di pallini condivisibile
 * quando i ticket del giorno sono terminati.
 */
export function DayRecap({ results, points, teamName }: { results: DayResult[]; points: number; teamName?: string | null }) {
  const [copied, setCopied] = useState(false);
  if (results.length === 0) return null;

  const grid = results.map(mark).join("");
  const rows = [grid.match(/.{1,5}/gu) ?? [grid]].flat();
  const correct = results.filter((r) => r.ok).length;
  const today = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
  const text = [
    `Quizzly Squad ${today}`,
    `${correct}/${results.length} · ${points} punti${teamName ? ` · ${teamName}` : ""}`,
    ...rows,
  ].join("\n");

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Riepilogo copiato!");
      }
    } catch {
      /* condivisione annullata */
    }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-extrabold">Il tuo riepilogo di oggi</h3>
          <p className="text-xs text-muted-foreground">
            {correct} risposte giuste su {results.length} · {points} punti
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={share}>
          {copied ? <Copy className="mr-1.5 h-4 w-4" /> : <Share2 className="mr-1.5 h-4 w-4" />}
          Condividi
        </Button>
      </div>
      <div className="mt-3 space-y-1 font-mono text-2xl leading-none tracking-widest">
        {rows.map((row, i) => (
          <div key={i}>{row}</div>
        ))}
      </div>
    </div>
  );
}
