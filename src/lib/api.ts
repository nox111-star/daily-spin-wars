import { supabase } from "@/integrations/supabase/client";

/**
 * Tutte le azioni di gioco passano da funzioni sul database (SECURITY DEFINER)
 * che usano l'orario del server: il client non puo' modificare timer, ticket o punti.
 * Ogni funzione applica anche un limite di frequenza per utente.
 */
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
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

export type Difficulty = "medio" | "difficile" | "impossibile";

export type TeamFlow = {
  mode: "monday_free" | "proposal" | "locked";
  proposal: "A" | "B" | null;
  can_swap: boolean;
};

export type GameState = {
  needs_bootstrap?: boolean;
  server_now: string;
  quiz_seconds: number;
  is_admin: boolean;
  profile: { id: string; username: string; avatar: string; frame: string; title: string; credits: number };
  tickets: number;
  base_left: number;
  bonus_left: number;
  videos_used: number;
  videos_left: number;
  can_watch_ticket_video: boolean;
  team: "A" | "B" | null;
  team_flow: TeamFlow;
  week: {
    week_start: string;
    team_a: string;
    team_b: string;
    prize_champion: string;
    prize_team: string;
    champion_frame: string;
    starts_at: string | null;
    ends_at: string | null;
  };
  team_counts: { a: number; b: number; total: number; pct_a: number; pct_b: number };
  wheel_free_available: boolean;
  wheel_extra_available: boolean;
  stats: {
    quiz_answered: number;
    quiz_correct: number;
    wheel_spins: number;
    messages_sent: number;
    week_points: number;
    total_points: number;
  };
};

export type TeamStanding = { team: "A" | "B"; name: string; points: number; members: number };

export type Automation = {
  enabled: boolean;
  run_at: string;
  season_end_dow: number;
  clear_chat: boolean;
  refresh_wheel: boolean;
  wheel_template: WheelPrize[];
  last_run_date: string | null;
  last_run_detail: Record<string, unknown> | null;
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
  unlock_mode: "credits" | "video";
  price: number;
  video_price: number;
  active: boolean;
  sort: number;
};

export type CollectionItem = {
  id: string;
  item_type: "avatar" | "frame" | "title";
  item_name: string;
  item_value: string;
  source: string;
};

export type ChatPreset = { id: string; kind: "phrase" | "sticker"; label: string; sort: number };

export type ChatMessage = {
  id: string;
  user_id: string;
  content: string;
  kind: string;
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

export type AdminOverview = {
  players: number;
  online: number;
  today_answers: number;
  messages: number;
  quizzes: number;
  quiz_by_difficulty: Record<string, number>;
  config: Record<string, unknown>;
  week: {
    week_start: string;
    team_a: string;
    team_b: string;
    prize_champion: string;
    prize_team: string;
    starts_at: string | null;
    ends_at: string | null;
    settled: boolean;
  } | null;
  wheel: { day: string; prizes: WheelPrize[] }[];
  active_users: { username: string; avatar: string; last_seen: string }[];
  shop: ShopItem[];
  presets: ChatPreset[];
};

export type WheelPrize = { label: string; credits: number; points: number; weight: number };

export const api = {
  bootstrap: (username: string) => rpc<void>("bootstrap_player", { p_username: username }),
  state: () => rpc<GameState>("get_state"),

  issueAdToken: (purpose: string) => rpc<string>("issue_ad_token", { p_purpose: purpose }),

  chooseTeam: (team: "A" | "B") => rpc<{ team: string }>("choose_team", { p_team: team }),
  acceptTeam: () => rpc<{ team: "A" | "B" }>("accept_team"),
  swapTeam: (token: string) => rpc<{ team: "A" | "B" }>("swap_team", { p_token: token }),

  claimAdTicket: (token: string) => rpc<{ bonus_left: number; videos_left: number }>("claim_ad_ticket", { p_token: token }),

  spinWheel: (extra: boolean, token: string | null) =>
    rpc<{ label: string; credits: number; points: number }>("spin_morning_wheel", { p_extra: extra, p_token: token }),

  drawQuiz: () => rpc<{ id: number; question: string; options: string[]; difficulty: Difficulty }>("draw_quiz"),
  answerQuiz: (id: number, choice: number) =>
    rpc<{ correct: boolean; answer: number; quip: string; points: number; credits: number; difficulty: Difficulty }>(
      "answer_quiz",
      { p_id: id, p_choice: choice },
    ),

  missions: () => rpc<Mission[]>("list_missions"),
  claimMission: (id: string) => rpc<{ ok: boolean; reward: string }>("claim_mission", { p_id: id }),
  buyItem: (id: string, tokens: string[] | null) => rpc<{ ok: boolean }>("buy_item", { p_id: id, p_tokens: tokens }),
  equip: (type: string, value: string) => rpc<{ ok: boolean }>("equip_item", { p_type: type, p_value: value }),
  sendMessage: (presetId: string) => rpc<{ ok: boolean }>("send_message", { p_preset: presetId }),
  leaderboard: () => rpc<LeaderRow[]>("leaderboard"),

  // ---- admin ----
  adminOverview: () => rpc<AdminOverview>("admin_overview"),
  adminSetConfig: (key: string, value: unknown) => rpc<{ ok: boolean }>("admin_set_config", { p_key: key, p_value: value }),
  adminBulkQuiz: (items: unknown[]) => rpc<{ inserted: number }>("admin_bulk_quiz", { p_items: items }),
  adminSetWheelDay: (day: string, prizes: WheelPrize[]) =>
    rpc<{ ok: boolean }>("admin_set_wheel_day", { p_day: day, p_prizes: prizes }),
  adminClearChat: (hours: number) => rpc<{ deleted: number }>("admin_clear_chat", { p_hours: hours }),
  adminSettleWeek: (week: string) => rpc<{ ok: boolean; winner?: string }>("admin_settle_week", { p_week: week }),
  adminSetWeek: (w: {
    week_start: string;
    team_a: string;
    team_b: string;
    prize_champion: string;
    prize_team: string;
    starts_at: string;
    ends_at: string;
  }) =>
    rpc<{ ok: boolean }>("admin_set_week", {
      p_week_start: w.week_start,
      p_team_a: w.team_a,
      p_team_b: w.team_b,
      p_prize_champion: w.prize_champion,
      p_prize_team: w.prize_team,
      p_starts_at: w.starts_at,
      p_ends_at: w.ends_at,
    }),
  adminUpsertShopItem: (i: ShopItem) =>
    rpc<{ ok: boolean }>("admin_upsert_shop_item", {
      p_id: i.id,
      p_kind: i.kind,
      p_name: i.name,
      p_value: i.value,
      p_price: i.price,
      p_video_price: i.video_price,
      p_sort: i.sort,
      p_active: i.active,
    }),
  adminUpsertPreset: (p: ChatPreset & { active: boolean }) =>
    rpc<{ ok: boolean }>("admin_upsert_preset", {
      p_id: p.id,
      p_kind: p.kind,
      p_label: p.label,
      p_sort: p.sort,
      p_active: p.active,
    }),

  // ---- letture dirette (sola lettura, protette da RLS) ----
  async shop(): Promise<ShopItem[]> {
    const { data, error } = await supabase.from("shop_items").select("*").eq("active", true).order("sort");
    if (error) throw new Error(cleanError(error.message));
    return (data ?? []) as unknown as ShopItem[];
  },
  async presets(): Promise<ChatPreset[]> {
    const { data, error } = await supabase.from("chat_presets").select("*").eq("active", true).order("sort");
    if (error) throw new Error(cleanError(error.message));
    return (data ?? []) as unknown as ChatPreset[];
  },
  async collection(): Promise<CollectionItem[]> {
    const { data, error } = await supabase.from("collection").select("*").order("created_at", { ascending: true });
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
    return ((data ?? []) as unknown as ChatMessage[]).reverse();
  },
  async profilesByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar, frame, title")
      .in("id", ids);
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
    case "crown":
      return "av-gold";
    default:
      return "av-frame";
  }
};

export const difficultyLabel: Record<Difficulty, string> = {
  medio: "Medio",
  difficile: "Difficile",
  impossibile: "Impossibile",
};

export const difficultyTone: Record<Difficulty, string> = {
  medio: "bg-secondary/15 text-secondary",
  difficile: "bg-warning/15 text-warning",
  impossibile: "bg-destructive/15 text-destructive",
};
