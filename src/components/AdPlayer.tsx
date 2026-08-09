import { useCallback, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { confirmAdView } from "@/lib/ads.functions";

/**
 * Player pubblicitario.
 * Flusso anti-cheat: il server emette un token di visione, il video viene riprodotto,
 * poi la conferma passa da una chiamata firmata server-to-server. Solo un token
 * verificato dal server sblocca la ricompensa.
 *
 * Per collegare un SDK reale (AdMob / Unity) basta sostituire la simulazione
 * mantenendo la firma `playAd(purpose): Promise<string | null>` (ritorna il token).
 */
export function useAdPlayer() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const playAd = useCallback(async (purpose: string): Promise<string | null> => {
    setError(null);
    setProgress(0);
    setOpen(true);
    try {
      const token = await api.issueAdToken(purpose);

      const completed = await new Promise<boolean>((resolve) => {
        const started = Date.now();
        const duration = 5000;
        const timer = window.setInterval(() => {
          const pct = Math.min(100, ((Date.now() - started) / duration) * 100);
          setProgress(pct);
          if (pct >= 100) {
            window.clearInterval(timer);
            cancelRef.current = null;
            resolve(true);
          }
        }, 100);
        cancelRef.current = () => {
          window.clearInterval(timer);
          cancelRef.current = null;
          resolve(false);
        };
      });

      if (!completed) {
        setOpen(false);
        return null;
      }

      await confirmAdView({ data: { token } });
      setOpen(false);
      return token;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video non disponibile");
      setOpen(false);
      return null;
    }
  }, []);

  const AdOverlay = (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          cancelRef.current?.();
          setOpen(false);
        }
      }}
    >
      <DialogContent className="max-w-sm border-0 gradient-pop text-primary-foreground">
        <div className="space-y-4 py-4 text-center">
          <div className="text-5xl">🎬</div>
          <h3 className="text-xl font-bold">Video in corso…</h3>
          <p className="text-sm opacity-90">
            Guarda il video fino alla fine: la ricompensa viene confermata dal server.
          </p>
          <Progress value={progress} className="h-2 bg-white/30" />
          {error && <p className="text-sm font-semibold">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );

  return { playAd, AdOverlay };
}
