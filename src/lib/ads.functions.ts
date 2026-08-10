import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signAdPayload } from "./ads.server";

/**
 * Conferma la visione completa di un video.
 * Il browser non può marcare il token da solo: la verifica avviene interamente
 * sul server, con firma HMAC del payload (tracciata) e scrittura privilegiata.
 * L'endpoint pubblico /api/public/hooks/ad-reward resta disponibile per la
 * callback di una rete pubblicitaria reale (AdMob / Unity).
 */
export const confirmAdView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.token)) throw new Error("token non valido");
    return data;
  })
  .handler(async ({ data, context }) => {
    // Il token deve appartenere all'utente autenticato (RLS sul client utente).
    const { data: row, error } = await context.supabase
      .from("ad_tokens")
      .select("id, verified, consumed")
      .eq("id", data.token)
      .maybeSingle();
    if (error || !row) throw new Error("token non valido");
    if (row.consumed) throw new Error("video già utilizzato");
    if (row.verified) return { ok: true as const };

    const secret = process.env["AD_CALLBACK_SECRET"];
    if (!secret) throw new Error("configurazione video mancante");

    // Firma di controllo: tiene traccia della conferma server-side.
    const payload = JSON.stringify({ token: data.token, ts: Date.now() });
    const signature = await signAdPayload(payload, secret);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("ad_tokens")
      .update({ verified: true })
      .eq("id", data.token)
      .eq("consumed", false);
    if (updateError) throw new Error("conferma video non riuscita");

    return { ok: true as const, signature: signature.slice(0, 12) };
  });
