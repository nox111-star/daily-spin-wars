import { useCallback, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

/**
 * Simulatore di video pubblicitario.
 * Sostituire questo componente con l'SDK reale (AdMob / Unity Ads):
 * basta mantenere la stessa firma `playAd(): Promise<boolean>`.
 */
export function useAdPlayer() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resolver, setResolver] = useState<{ fn: (v: boolean) => void } | null>(null);

  const playAd = useCallback(() => {
    setProgress(0);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolver({ fn: resolve });
      const started = Date.now();
      const duration = 3000;
      const timer = window.setInterval(() => {
        const pct = Math.min(100, ((Date.now() - started) / duration) * 100);
        setProgress(pct);
        if (pct >= 100) {
          window.clearInterval(timer);
          setOpen(false);
          setResolver(null);
          resolve(true);
        }
      }, 100);
    });
  }, []);

  const AdOverlay = (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && resolver) {
          resolver.fn(false);
          setResolver(null);
          setOpen(false);
        }
      }}
    >
      <DialogContent className="max-w-sm border-0 gradient-pop text-primary-foreground">
        <div className="space-y-4 py-4 text-center">
          <div className="text-5xl">🎬</div>
          <h3 className="text-xl font-bold">Video in corso…</h3>
          <p className="text-sm opacity-90">Spazio pubblicitario di prova (SDK non ancora collegato)</p>
          <Progress value={progress} className="h-2 bg-white/30" />
        </div>
      </DialogContent>
    </Dialog>
  );

  return { playAd, AdOverlay };
}
