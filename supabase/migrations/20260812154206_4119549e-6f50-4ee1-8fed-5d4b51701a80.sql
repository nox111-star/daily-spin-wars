-- 1) COSMETIC STYLES (editor grafico dinamico)
CREATE TABLE IF NOT EXISTS public.cosmetic_styles (
  value text PRIMARY KEY,
  kind text NOT NULL DEFAULT 'frame',
  name text NOT NULL,
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cosmetic_styles TO authenticated;
GRANT ALL ON public.cosmetic_styles TO service_role;
ALTER TABLE public.cosmetic_styles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cosmetic styles readable" ON public.cosmetic_styles;
CREATE POLICY "cosmetic styles readable" ON public.cosmetic_styles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.admin_upsert_cosmetic_style(p_value text, p_kind text, p_name text, p_style jsonb, p_active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := public.require_admin();
BEGIN
  IF p_kind NOT IN ('frame','avatar','title') THEN RAISE EXCEPTION 'tipo non valido'; END IF;
  IF coalesce(btrim(p_value),'') = '' THEN RAISE EXCEPTION 'identificativo mancante'; END IF;
  INSERT INTO public.cosmetic_styles (value, kind, name, style, active, updated_at)
  VALUES (btrim(p_value), p_kind, p_name, coalesce(p_style,'{}'::jsonb), coalesce(p_active,true), now())
  ON CONFLICT (value) DO UPDATE SET kind = excluded.kind, name = excluded.name,
    style = excluded.style, active = excluded.active, updated_at = now();
  PERFORM public.audit(uid, 'admin_upsert_cosmetic_style', jsonb_build_object('value', p_value));
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_cosmetic_style(p_value text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := public.require_admin();
BEGIN
  DELETE FROM public.cosmetic_styles WHERE value = p_value;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- 2) STREAK + PREMIO SETTIMANALE
ALTER TABLE public.weeks ADD COLUMN IF NOT EXISTS streak_reward jsonb NOT NULL
  DEFAULT '{"type":"credits","amount":250,"label":"250 crediti","item_kind":"frame","item_name":"","item_value":""}'::jsonb;

ALTER TABLE public.player_state ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.player_state ADD COLUMN IF NOT EXISTS streak_date date;
ALTER TABLE public.player_state ADD COLUMN IF NOT EXISTS streak_prev integer NOT NULL DEFAULT 0;
ALTER TABLE public.player_state ADD COLUMN IF NOT EXISTS streak_missed integer NOT NULL DEFAULT 0;
ALTER TABLE public.player_state ADD COLUMN IF NOT EXISTS streak_rewards integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.grant_reward(uid uuid, p_reward jsonb, p_source text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t text := coalesce(p_reward->>'type','credits'); amt int := coalesce((p_reward->>'amount')::int, 0);
BEGIN
  IF t = 'credits' THEN
    UPDATE public.profiles SET credits = credits + greatest(amt,0) WHERE id = uid;
  ELSIF t = 'points' THEN
    UPDATE public.player_state SET week_points = week_points + greatest(amt,0),
      total_points = total_points + greatest(amt,0) WHERE user_id = uid;
  ELSE
    PERFORM public.grant_item(uid, coalesce(p_reward->>'item_kind','frame'),
      coalesce(nullif(p_reward->>'item_name',''), coalesce(p_reward->>'label','Premio')),
      coalesce(nullif(p_reward->>'item_value',''), 'none'), p_source);
  END IF;
  RETURN jsonb_build_object('type', t, 'amount', amt, 'label', coalesce(p_reward->>'label',''));
END; $$;

CREATE OR REPLACE FUNCTION public.touch_streak(uid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE st public.player_state; today date := (now() AT TIME ZONE 'UTC')::date; gap int;
DECLARE claimed jsonb := NULL; w public.weeks;
BEGIN
  SELECT * INTO st FROM public.player_state WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;

  IF st.streak_date IS NULL THEN
    UPDATE public.player_state SET streak_count = 1, streak_date = today, streak_missed = 0 WHERE user_id = uid;
  ELSIF st.streak_date < today THEN
    gap := today - st.streak_date;
    IF gap = 1 THEN
      UPDATE public.player_state SET streak_count = st.streak_count + 1, streak_date = today, streak_missed = 0 WHERE user_id = uid;
    ELSE
      UPDATE public.player_state SET streak_prev = st.streak_count, streak_missed = gap - 1,
        streak_count = 1, streak_date = today WHERE user_id = uid;
    END IF;
  END IF;

  SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  IF st.streak_count >= 7 THEN
    SELECT * INTO w FROM public.weeks WHERE week_start = public.current_week_start();
    claimed := public.grant_reward(uid, coalesce(w.streak_reward, '{}'::jsonb), 'streak');
    UPDATE public.player_state SET streak_count = 0, streak_prev = 0, streak_missed = 0,
      streak_rewards = streak_rewards + 1 WHERE user_id = uid;
    PERFORM public.audit(uid, 'streak_reward', claimed);
    SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'count', st.streak_count,
    'target', 7,
    'last_date', st.streak_date,
    'missed', st.streak_missed,
    'can_restore', st.streak_missed BETWEEN 1 AND 3 AND st.streak_prev > 0,
    'restore_videos', 2,
    'recoverable', st.streak_prev,
    'claimed', claimed
  );
END; $$;

CREATE OR REPLACE FUNCTION public.restore_streak(p_tokens uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); st public.player_state; t uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'restore_streak', 5, 300);
  PERFORM public.touch_streak(uid);
  SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  IF st.streak_missed < 1 OR st.streak_missed > 3 OR st.streak_prev <= 0 THEN
    RAISE EXCEPTION 'nessuna streak da recuperare';
  END IF;
  IF p_tokens IS NULL OR coalesce(array_length(p_tokens,1),0) < 2 THEN
    RAISE EXCEPTION 'servono 2 video per recuperare la streak';
  END IF;
  FOREACH t IN ARRAY p_tokens LOOP
    PERFORM public.consume_ad_token(uid, t, 'streak');
  END LOOP;
  UPDATE public.player_state SET streak_count = least(st.streak_prev + st.streak_missed, 6),
    streak_prev = 0, streak_missed = 0 WHERE user_id = uid;
  PERFORM public.audit(uid, 'restore_streak', jsonb_build_object('restored', st.streak_prev));
  SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  RETURN jsonb_build_object('count', st.streak_count);
END; $$;

-- 3) SETTIMANE CON DATE + ROLLOVER AUTOMATICO
CREATE OR REPLACE FUNCTION public.ensure_week()
RETURNS weeks LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w public.weeks; ws date := public.current_week_start(); n integer;
DECLARE names text[][] := ARRAY[
  ARRAY['Pinguini Ansiosi','Bradipi Turbo'],
  ARRAY['Ravioli Ribelli','Toast Bruciati'],
  ARRAY['Gatti Strateghi','Cani Ottimisti'],
  ARRAY['Calzini Spaiati','Ciabatte Volanti']
];
DECLARE champs text[] := ARRAY['Corona Glitter','Avatar Drago Chic','Titolo: Mente Suprema','Cornice Aurora'];
DECLARE tprize text[] := ARRAY['Cornice Squadra Oro','Avatar Mascotte','Titolo: Branco Vincente','Cornice Confetti'];
BEGIN
  SELECT * INTO w FROM public.weeks WHERE week_start = ws;
  IF FOUND THEN
    IF w.starts_at IS NULL OR w.ends_at IS NULL THEN
      UPDATE public.weeks SET starts_at = coalesce(starts_at, ws::timestamptz),
        ends_at = coalesce(ends_at, (ws + 7)::timestamptz) WHERE week_start = ws;
      SELECT * INTO w FROM public.weeks WHERE week_start = ws;
    END IF;
    RETURN w;
  END IF;
  n := (extract(epoch FROM ws)::bigint / 604800) % 4;
  INSERT INTO public.weeks (week_start, team_a, team_b, prize_champion, prize_team, starts_at, ends_at)
  VALUES (ws, names[n+1][1], names[n+1][2], champs[n+1], tprize[n+1], ws::timestamptz, (ws + 7)::timestamptz)
  ON CONFLICT (week_start) DO NOTHING;
  SELECT * INTO w FROM public.weeks WHERE week_start = ws;
  RETURN w;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_week(p_week_start date, p_team_a text, p_team_b text,
  p_prize_champion text, p_prize_team text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_champion_frame text DEFAULT 'crown', p_streak_reward jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := public.require_admin();
BEGIN
  INSERT INTO public.weeks (week_start, team_a, team_b, prize_champion, prize_team, starts_at, ends_at, champion_frame, streak_reward)
  VALUES (p_week_start, p_team_a, p_team_b, p_prize_champion, p_prize_team, p_starts_at, p_ends_at,
    coalesce(p_champion_frame,'crown'),
    coalesce(p_streak_reward, '{"type":"credits","amount":250,"label":"250 crediti"}'::jsonb))
  ON CONFLICT (week_start) DO UPDATE SET team_a = excluded.team_a, team_b = excluded.team_b,
    prize_champion = excluded.prize_champion, prize_team = excluded.prize_team,
    starts_at = excluded.starts_at, ends_at = excluded.ends_at, champion_frame = excluded.champion_frame,
    streak_reward = excluded.streak_reward;
  PERFORM public.audit(uid, 'admin_set_week', jsonb_build_object('week', p_week_start));
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Chiusura stagione: la classifica finale viene calcolata prima dell'azzeramento punti
CREATE OR REPLACE FUNCTION public.settle_week(p_week date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w public.weeks; champ record; wa int; wb int; win text; r record;
BEGIN
  SELECT * INTO w FROM public.weeks WHERE week_start = p_week FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'settimana inesistente'; END IF;
  IF w.settled THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;

  SELECT s.user_id, s.week_points INTO champ FROM public.player_state s
   WHERE s.week_ref = p_week AND s.week_points > 0
   ORDER BY s.week_points DESC, s.created_at ASC LIMIT 1;
  IF champ.user_id IS NOT NULL THEN
    PERFORM public.grant_item(champ.user_id, 'title', w.prize_champion, w.prize_champion, 'campione');
    PERFORM public.grant_item(champ.user_id, 'frame', 'Corona ' || to_char(p_week, 'DD/MM/YYYY'),
      coalesce(w.champion_frame, 'crown'), 'campione');
  END IF;

  SELECT coalesce(sum(week_points) FILTER (WHERE team = 'A'), 0),
         coalesce(sum(week_points) FILTER (WHERE team = 'B'), 0) INTO wa, wb
   FROM public.player_state WHERE week_ref = p_week;
  win := CASE WHEN wa >= wb THEN 'A' ELSE 'B' END;
  FOR r IN SELECT user_id FROM public.player_state WHERE week_ref = p_week AND team = win LOOP
    PERFORM public.grant_item(r.user_id, 'title', w.prize_team, w.prize_team, 'squadra');
  END LOOP;

  UPDATE public.player_state SET week_points = 0;
  UPDATE public.weeks SET settled = true WHERE week_start = p_week;
  PERFORM public.audit(NULL, 'settle_week', jsonb_build_object('week', p_week, 'winner', win,
    'champion', champ.user_id, 'points', champ.week_points));
  RETURN jsonb_build_object('ok', true, 'winner', win, 'points_a', wa, 'points_b', wb, 'champion', champ.user_id);
END; $$;

-- Job di rollover: chiude ogni settimana scaduta e apre la successiva
CREATE OR REPLACE FUNCTION public.run_rollover()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT week_start FROM public.weeks
    WHERE NOT settled AND ends_at IS NOT NULL AND ends_at <= now() ORDER BY week_start LOOP
    PERFORM public.settle_week(r.week_start);
    n := n + 1;
  END LOOP;
  PERFORM public.ensure_week();
  PERFORM public.ensure_wheel_schedule();
  RETURN jsonb_build_object('settled', n);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_run_rollover()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := public.require_admin();
BEGIN RETURN public.run_rollover(); END; $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  PERFORM cron.unschedule('quizzly-rollover');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('quizzly-rollover', '*/5 * * * *', $$SELECT public.run_rollover();$$);

-- 4) get_state con streak, premio settimanale e stili dinamici
CREATE OR REPLACE FUNCTION public.get_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); st public.player_state; pr public.profiles; w public.weeks;
DECLARE ca int; cb int; tot int; today date := (now() AT TIME ZONE 'UTC')::date; maxv int; mode text; other text; streak jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.run_rollover();
  w := public.ensure_week();
  IF NOT EXISTS (SELECT 1 FROM public.player_state WHERE user_id = uid) THEN
    RETURN jsonb_build_object('needs_bootstrap', true, 'server_now', now());
  END IF;
  st := public.ensure_proposal(uid);
  streak := public.touch_streak(uid);
  SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  SELECT * INTO pr FROM public.profiles WHERE id = uid;
  UPDATE public.profiles SET last_seen = now() WHERE id = uid;
  SELECT a, b INTO ca, cb FROM public.team_counts(w.week_start);
  tot := greatest(ca + cb, 1);
  SELECT coalesce((value->>'max_videos')::int, 3) INTO maxv FROM public.game_config WHERE key = 'tickets';

  IF st.team_locked THEN mode := 'locked';
  ELSIF extract(isodow FROM (now() AT TIME ZONE 'UTC')) = 1 THEN mode := 'monday_free';
  ELSE mode := 'proposal'; END IF;
  other := CASE WHEN st.team_proposal = 'A' THEN 'B' ELSE 'A' END;

  RETURN jsonb_build_object(
    'server_now', now(),
    'quiz_seconds', 15,
    'is_admin', public.has_role(uid, 'admin'),
    'profile', to_jsonb(pr),
    'tickets', st.base_left + st.bonus_left,
    'base_left', st.base_left,
    'bonus_left', st.bonus_left,
    'videos_used', st.videos_used,
    'videos_left', greatest(0, maxv - st.videos_used),
    'can_watch_ticket_video', st.base_left = 0 AND st.videos_used < maxv,
    'team', st.team,
    'streak', streak,
    'styles', coalesce((SELECT jsonb_object_agg(value, style) FROM public.cosmetic_styles WHERE active), '{}'::jsonb),
    'team_flow', jsonb_build_object(
      'mode', mode,
      'proposal', st.team_proposal,
      'can_swap', CASE WHEN mode = 'proposal' AND st.team_proposal IS NOT NULL
        THEN public.can_join(other, w.week_start) ELSE false END
    ),
    'week', to_jsonb(w),
    'team_counts', jsonb_build_object('a', ca, 'b', cb, 'total', ca + cb,
      'pct_a', round(ca::numeric * 100 / tot, 1), 'pct_b', round(cb::numeric * 100 / tot, 1)),
    'wheel_free_available', st.wheel_free_date IS DISTINCT FROM today,
    'wheel_extra_available', st.wheel_extra_date IS DISTINCT FROM today,
    'stats', jsonb_build_object('quiz_answered', st.quiz_answered, 'quiz_correct', st.quiz_correct,
      'wheel_spins', st.wheel_spins, 'messages_sent', st.messages_sent,
      'week_points', st.week_points, 'total_points', st.total_points)
  );
END; $$;

-- 5) overview admin con stili cosmetici
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ignored uuid := public.require_admin();
BEGIN
  RETURN jsonb_build_object(
    'players', (SELECT count(*) FROM public.profiles),
    'online', (SELECT count(*) FROM public.profiles WHERE last_seen > now() - interval '5 minutes'),
    'today_answers', (SELECT count(*) FROM public.quiz_history WHERE seen_at::date = (now() AT TIME ZONE 'UTC')::date),
    'messages', (SELECT count(*) FROM public.messages),
    'quizzes', (SELECT count(*) FROM public.quizzes WHERE active),
    'quiz_by_difficulty', (SELECT coalesce(jsonb_object_agg(difficulty, n), '{}'::jsonb) FROM
      (SELECT difficulty, count(*) n FROM public.quizzes WHERE active GROUP BY difficulty) s),
    'config', (SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) FROM public.game_config),
    'week', (SELECT to_jsonb(w) FROM public.weeks w WHERE w.week_start = public.current_week_start()),
    'wheel', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'prizes', prizes) ORDER BY day), '[]'::jsonb)
      FROM public.wheel_days WHERE day >= (now() AT TIME ZONE 'UTC')::date),
    'active_users', (SELECT coalesce(jsonb_agg(jsonb_build_object('username', username, 'avatar', avatar, 'last_seen', last_seen)
      ORDER BY last_seen DESC), '[]'::jsonb) FROM public.profiles WHERE last_seen > now() - interval '15 minutes'),
    'shop', (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.sort), '[]'::jsonb) FROM public.shop_items s),
    'presets', (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.sort), '[]'::jsonb) FROM public.chat_presets c),
    'styles', (SELECT coalesce(jsonb_agg(to_jsonb(cs) ORDER BY cs.name), '[]'::jsonb) FROM public.cosmetic_styles cs)
  );
END; $$;