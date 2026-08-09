import { createFileRoute } from "@tanstack/react-router";
import { signAdPayload, safeEqual } from "@/lib/ads.server";

/**
 * Callback di ricompensa video (server-to-server).
 * Accetta solo richieste firmate con AD_CALLBACK_SECRET: qui viene marcata
 * la visione come verificata, unico modo per sbloccare le ricompense.
 */
export const Route = createFileRoute("/api/public/hooks/ad-reward")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["AD_CALLBACK_SECRET"];
        if (!secret) return new Response("not configured", { status: 500 });

        const raw = await request.text();
        const signature = request.headers.get("x-ad-signature") ?? "";
        const expected = await signAdPayload(raw, secret);
        if (!safeEqual(signature, expected)) return new Response("invalid signature", { status: 401 });

        let payload: { token?: string; ts?: number };
        try {
          payload = JSON.parse(raw) as { token?: string; ts?: number };
        } catch {
          return new Response("bad request", { status: 400 });
        }
        const token = payload.token;
        if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return new Response("bad request", { status: 400 });
        if (!payload.ts || Math.abs(Date.now() - payload.ts) > 5 * 60 * 1000) {
          return new Response("stale request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("ad_tokens")
          .update({ verified: true })
          .eq("id", token)
          .eq("consumed", false);
        if (error) return new Response("update failed", { status: 500 });

        return Response.json({ ok: true });
      },
    },
  },
});
