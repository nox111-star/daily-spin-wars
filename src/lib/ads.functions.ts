import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signAdPayload } from "./ads.server";

/**
 * Conferma la visione completa di un video.
 * Il browser non può marcare il token da solo: questa funzione firma la richiesta
 * con un segreto server-side e chiama l'endpoint di ricompensa (server-to-server).
 */
export const confirmAdView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.token)) throw new Error("token non valido");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ad_tokens")
      .select("id, user_id, verified")
      .eq("id", data.token)
      .maybeSingle();
    if (error || !row) throw new Error("token non valido");

    const secret = process.env["AD_CALLBACK_SECRET"];
    if (!secret) throw new Error("configurazione video mancante");

    const body = JSON.stringify({ token: data.token, ts: Date.now() });
    const signature = await signAdPayload(body, secret);
    const origin = new URL(getRequestUrl()).origin;

    const res = await fetch(`${origin}/api/public/hooks/ad-reward`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ad-signature": signature },
      body,
    });
    if (!res.ok) throw new Error("conferma video non riuscita");
    return { ok: true as const };
  });
