import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { AppShell, useGameState } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { api, frameClass } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Bubble Brawl" },
      { name: "description", content: "Chat in tempo reale con tag squadra e avatar: sfottò leggeri, zero volgarità." },
      { property: "og:title", content: "Chat di Bubble Brawl" },
      { property: "og:description", content: "Parla con la tua squadra e sfida gli avversari a colpi di battute." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { data: state } = useGameState();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({ queryKey: ["messages"], queryFn: api.messages });

  const authorIds = useMemo(() => [...new Set((messages ?? []).map((m) => m.user_id))], [messages]);
  const { data: authors } = useQuery({
    queryKey: ["authors", authorIds],
    queryFn: () => api.profilesByIds(authorIds),
    enabled: authorIds.length > 0,
  });

  useEffect(() => {
    const channel = supabase
      .channel("chat-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.sendMessage(text);
      setText("");
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Messaggio non inviato");
    } finally {
      setSending(false);
    }
  }

  const profileOf = (id: string) => (authors ?? []).find((a) => a.id === id);
  const teamLabel = (team: string | null) =>
    !team ? null : team === "A" ? state?.week.team_a : state?.week.team_b;

  return (
    <AppShell>
      <h1 className="mb-1 font-display text-2xl font-extrabold">Chat</h1>
      <p className="mb-4 text-sm text-muted-foreground">Sfottò sì, cattiveria no. Qui si gioca per ridere.</p>

      <div className="pop-card flex h-[65vh] flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {(messages ?? []).map((m) => {
            const author = profileOf(m.user_id);
            const mine = m.user_id === state?.profile.id;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-lg ${frameClass(author?.frame ?? "none")}`}
                >
                  {author?.avatar ?? "🫧"}
                </span>
                <div className={`min-w-0 max-w-[78%] ${mine ? "text-right" : ""}`}>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">{author?.username ?? "Giocatore"}</span>
                    {m.team && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground"
                        style={{ backgroundColor: m.team === "A" ? "var(--team-a)" : "var(--team-b)" }}
                      >
                        {teamLabel(m.team)}
                      </span>
                    )}
                  </p>
                  <p
                    className={`mt-1 inline-block break-words rounded-2xl px-3 py-2 text-sm ${
                      mine ? "gradient-pop text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {m.content}
                  </p>
                </div>
              </div>
            );
          })}
          {(messages ?? []).length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Nessun messaggio. Rompi il ghiaccio!</p>
          )}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder="Scrivi qualcosa di simpatico…"
          />
          <Button type="submit" size="icon" className="shrink-0 gradient-pop" disabled={sending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
