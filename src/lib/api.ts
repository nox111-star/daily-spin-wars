import { supabase } from "@/integrations/supabase/client";

/**
 * Tutte le azioni di gioco passano da funzioni sul database (SECURITY DEFINER)
 * che usano l'orario del server: il client non puo' modificare timer, ticket o punti.
 */
type RpcName = string;

async function rpc<T>(fn: RpcName, args?: Record<string, unknown>): Promise<T> {
  const client = supabase as unknown as {
    rpc: (name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(cleanError(error.message));
  return data as T;
}

function cleanError(message: string) {
  return message.replace(/^.*?:\s*/, "").trim() || "Qualcosa è andato storto";
}

export type GameState = {
  needs_bootstrap?: boolean;
  server_now: string;
  is_monday: boolean;
  profile: { id: string; username: string; avatar: string; frame: string; title: string; credits: number };
  tickets: number;
  next_ticket_seconds: number;
  team: "A" | "B" | null;
  week: { week_start: string; team_a: string; team_b: string; prize_champion: string; prize_team: string };
  team_counts: { a: number; b: number; total: number; pct_a: number; pct_b: number };
  wheel_free_available: boolean;
  wheel_extra_available: boolean;
  emergency_left: number;
  stats: {
    quiz_answered: number;
    quiz_correct: number;
    wheel_spins: number;
    messages_sent: number;
    week_points: number;
    total_points: number;
  };
};

export type Mission = {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  claimed: boolean;
  reward_name: string;
  reward_type: string;
  reward_value: string;
};

export type ShopItem = {
  id: string;
  kind: "avatar" | "frame" | "title";
  name: string;
  value: string;
  price: number;
  sort: number;
};

export type CollectionItem = {
  id: string;
  item_type: "avatar" | "frame" | "title";
  item_name: string;
  item_value: string;
  source: string;
};

export type ChatMessage = {
  id: string;
  user_id: string;
  content: string;
  team: "A" | "B" | null;
  created_at: string;
};

export type LeaderRow = {
  username: string;
  avatar: string;
  frame: string;
  title: string;
  team: "A" | "B" | null;
  week_points: number;
};

export const api = {
  bootstrap: (username: string) => rpc<void>("bootstrap_player", { p_username: username }),
  state: () => rpc<GameState>("get_state"),
  chooseTeam: (team: "A" | "B") => rpc<{ team: string }>("choose_team", { p_team: team }),
  spinTeamWheel: () => rpc<{ team: "A" | "B" }>("spin_team_wheel"),
  switchTeam: () => rpc<{ team: "A" | "B" }>("switch_team_after_ad"),
  emergency: (mode: "video" | "game") =>
    rpc<{ gain: number; won: boolean; left: number }>("emergency_tickets", { p_mode: mode }),
  spinWheel: (extra: boolean) =>
    rpc<{ label: string; credits: number; tickets: number; points: number }>("spin_morning_wheel", { p_extra: extra }),
  drawQuiz: () => rpc<{ id: number; question: string; options: string[] }>("draw_quiz"),
  answerQuiz: (id: number, choice: number) =>
    rpc<{ correct: boolean; answer: number; quip: string; points: number; credits: number }>("answer_quiz", {
      p_id: id,
      p_choice: choice,
    }),
  missions: () => rpc<Mission[]>("list_missions"),
  claimMission: (id: string) => rpc<{ ok: boolean; reward: string }>("claim_mission", { p_id: id }),
  buyItem: (id: string, withAd: boolean) => rpc<{ ok: boolean }>("buy_item", { p_id: id, p_with_ad: withAd }),
  equip: (type: string, value: string) => rpc<{ ok: boolean }>("equip_item", { p_type: type, p_value: value }),
  sendMessage: (content: string) => rpc<{ ok: boolean }>("send_message", { p_content: content }),
  leaderboard: () => rpc<LeaderRow[]>("leaderboard"),

  async shop(): Promise<ShopItem[]> {
    const { data, error } = await supabase.from("shop_items").select("*").order("sort");
    if (error) throw new Error(cleanError(error.message));
    return (data ?? []) as ShopItem[];
  },
  async collection(): Promise<CollectionItem[]> {
    const { data, error } = await supabase
      .from("collection")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(cleanError(error.message));
    return (data ?? []) as CollectionItem[];
  },
  async messages(): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(cleanError(error.message));
    return ((data ?? []) as ChatMessage[]).reverse();
  },
  async profilesByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from("profiles").select("id, username, avatar, frame, title").in("id", ids);
    if (error) throw new Error(cleanError(error.message));
    return data ?? [];
  },
};

export const frameClass = (frame: string) => {
  switch (frame) {
    case "neon":
      return "av-neon";
    case "gold":
      return "av-gold";
    case "candy":
      return "av-candy";
    case "ice":
      return "av-ice";
    case "bubbles":
      return "av-bubbles";
    case "aurora":
      return "av-aurora";
    case "confetti":
      return "av-confetti";
    default:
      return "av-frame";
  }
};
