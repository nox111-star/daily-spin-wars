-- 1. QUIZ: timer server-side
ALTER TABLE public.player_state ADD COLUMN IF NOT EXISTS pending_started_at timestamptz;

-- 2. SHOP: sblocco binario
ALTER TABLE public.shop_items ADD COLUMN IF NOT EXISTS unlock_mode text NOT NULL DEFAULT 'credits';
ALTER TABLE public.shop_items DROP CONSTRAINT IF EXISTS shop_items_unlock_mode_check;
ALTER TABLE public.shop_items ADD CONSTRAINT shop_items_unlock_mode_check CHECK (unlock_mode IN ('credits','video'));

-- 3. WEEKS: cornice corona del campione
ALTER TABLE public.weeks ADD COLUMN IF NOT EXISTS champion_frame text NOT NULL DEFAULT 'crown';

-- 4. AUTOMAZIONI
CREATE TABLE IF NOT EXISTS public.automation_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  run_at time NOT NULL DEFAULT '05:00',
  season_end_dow integer NOT NULL DEFAULT 7,
  clear_chat boolean NOT NULL DEFAULT true,
  refresh_wheel boolean NOT NULL DEFAULT true,
  wheel_template jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_run_date date,
  last_run_detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.automation_settings TO service_role;
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.automation_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- 5. DRAW QUIZ con timestamp
CREATE OR REPLACE FUNCTION public.draw_quiz()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); st public.player_state; q public.quizzes; diff text; pool text; idx int;
DECLARE base_pat text[] := ARRAY['medio','medio','difficile','difficile','impossibile'];
DECLARE bonus_pat text[] := ARRAY['medio','difficile','impossibile'];
DECLARE base int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'draw_quiz', 30, 60);
  st := public.sync_player(uid);
  IF st.pending_quiz IS NOT NULL THEN
    SELECT * INTO q FROM public.quizzes WHERE id = st.pending_quiz;
    RETURN jsonb_build_object('id', q.id, 'question', q.question, 'options', q.options, 'difficulty', q.difficulty,
      'seconds_left', greatest(0, 15 - extract(epoch FROM (now() - coalesce(st.pending_started_at, now())))::int));
  END IF;
  SELECT coalesce((value->>'base')::int, 5) INTO base FROM public.game_config WHERE key = 'tickets';
  IF st.base_left > 0 THEN
    pool := 'base'; idx := base - st.base_left; diff := base_pat[least(idx, 4) + 1];
  ELSIF st.bonus_left > 0 THEN
    pool := 'bonus'; idx := (3 - st.bonus_left); diff := bonus_pat[least(idx, 2) + 1];
  ELSE
    RAISE EXCEPTION 'ticket esauriti';
  END IF;

  SELECT * INTO q FROM public.quizzes z
   WHERE z.active AND z.difficulty = diff
     AND NOT EXISTS (SELECT 1 FROM public.quiz_history h WHERE h.user_id = uid AND h.quiz_id = z.id)
   ORDER BY random() LIMIT 1;
  IF NOT FOUND THEN
    SELECT * INTO q FROM public.quizzes z WHERE z.active
      AND NOT EXISTS (SELECT 1 FROM public.quiz_history h WHERE h.user_id = uid AND h.quiz_id = z.id)
      ORDER BY random() LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    SELECT * INTO q FROM public.quizzes z WHERE z.active AND z.difficulty = diff ORDER BY random() LIMIT 1;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'nessuna domanda disponibile'; END IF;

  INSERT INTO public.quiz_history (user_id, quiz_id) VALUES (uid, q.id) ON CONFLICT DO NOTHING;
  UPDATE public.player_state SET
    pending_quiz = q.id,
    pending_difficulty = q.difficulty,
    pending_started_at = now(),
    base_left = CASE WHEN pool = 'base' THEN base_left - 1 ELSE base_left END,
    bonus_left = CASE WHEN pool = 'bonus' THEN bonus_left - 1 ELSE bonus_left END
  WHERE user_id = uid;
  RETURN jsonb_build_object('id', q.id, 'question', q.question, 'options', q.options, 'difficulty', q.difficulty, 'seconds_left', 15);
END; $function$;

-- 6. ANSWER QUIZ con timeout server-side
CREATE OR REPLACE FUNCTION public.answer_quiz(p_id integer, p_choice integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); st public.player_state; q public.quizzes; ok boolean; pts int := 0; cr int := 0; conf jsonb; expired boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'answer_quiz', 30, 60);
  SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  IF st.pending_quiz IS DISTINCT FROM p_id THEN RAISE EXCEPTION 'quiz non valido'; END IF;
  SELECT * INTO q FROM public.quizzes WHERE id = p_id;
  expired := st.pending_started_at IS NOT NULL AND now() > st.pending_started_at + interval '17 seconds';
  ok := (NOT expired) AND p_choice >= 0 AND q.correct = p_choice;
  IF ok THEN
    SELECT value INTO conf FROM public.game_config WHERE key = 'rewards';
    pts := coalesce(q.points, (conf->q.difficulty->>'points')::int, 10);
    cr := coalesce(q.credits, (conf->q.difficulty->>'credits')::int, 15);
  END IF;
  UPDATE public.player_state SET
    pending_quiz = NULL, pending_difficulty = NULL, pending_started_at = NULL,
    quiz_answered = quiz_answered + 1,
    quiz_correct = quiz_correct + CASE WHEN ok THEN 1 ELSE 0 END,
    week_points = week_points + pts,
    total_points = total_points + pts
  WHERE user_id = uid;
  IF cr > 0 THEN UPDATE public.profiles SET credits = credits + cr WHERE id = uid; END IF;
  RETURN jsonb_build_object('correct', ok, 'answer', q.correct, 'quip', q.quip, 'points', pts, 'credits', cr,
    'difficulty', q.difficulty, 'expired', coalesce(expired, false));
END; $function$;

-- 7. SHOP: acquisto binario
CREATE OR REPLACE FUNCTION public.buy_item(p_id text, p_tokens uuid[])
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); it public.shop_items; cr int; t uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'buy_item', 20, 60);
  SELECT * INTO it FROM public.shop_items WHERE id = p_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'oggetto inesistente'; END IF;
  IF EXISTS (SELECT 1 FROM public.collection WHERE user_id = uid AND item_type = it.kind AND item_value = it.value) THEN
    RAISE EXCEPTION 'lo possiedi gia';
  END IF;
  IF it.unlock_mode = 'credits' THEN
    IF p_tokens IS NOT NULL AND array_length(p_tokens, 1) IS NOT NULL THEN
      RAISE EXCEPTION 'questo oggetto si sblocca solo con i crediti';
    END IF;
    SELECT credits INTO cr FROM public.profiles WHERE id = uid;
    IF cr < it.price THEN RAISE EXCEPTION 'crediti insufficienti'; END IF;
    UPDATE public.profiles SET credits = credits - it.price WHERE id = uid;
  ELSE
    IF p_tokens IS NULL OR coalesce(array_length(p_tokens, 1), 0) < it.video_price THEN
      RAISE EXCEPTION 'servono % video per sbloccare questo oggetto', it.video_price;
    END IF;
    FOREACH t IN ARRAY p_tokens LOOP
      PERFORM public.consume_ad_token(uid, t, 'shop:' || it.id);
    END LOOP;
  END IF;
  PERFORM public.grant_item(uid, it.kind, it.name, it.value, CASE WHEN it.unlock_mode = 'credits' THEN 'shop' ELSE 'video' END);
  RETURN jsonb_build_object('ok', true);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_upsert_shop_item(p_id text, p_kind text, p_name text, p_value text, p_price integer, p_video_price integer, p_sort integer, p_active boolean, p_unlock_mode text DEFAULT 'credits')
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := public.require_admin();
BEGIN
  IF p_unlock_mode NOT IN ('credits','video') THEN RAISE EXCEPTION 'modalita di sblocco non valida'; END IF;
  INSERT INTO public.shop_items (id, kind, name, value, price, video_price, sort, active, unlock_mode)
  VALUES (p_id, p_kind, p_name, p_value, greatest(coalesce(p_price,0),0), greatest(coalesce(p_video_price,0),0), p_sort, p_active, p_unlock_mode)
  ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, name = excluded.name, value = excluded.value,
    price = excluded.price, video_price = excluded.video_price, sort = excluded.sort, active = excluded.active,
    unlock_mode = excluded.unlock_mode;
  PERFORM public.audit(uid, 'admin_upsert_shop_item', jsonb_build_object('id', p_id));
  RETURN jsonb_build_object('ok', true);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_delete_shop_item(p_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := public.require_admin();
BEGIN
  UPDATE public.shop_items SET active = false WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END; $function$;

-- 8. CLASSIFICA SQUADRE
CREATE OR REPLACE FUNCTION public.team_leaderboard()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE ws date := public.current_week_start(); w public.weeks; pa int; pb int; ma int; mb int;
BEGIN
  SELECT * INTO w FROM public.weeks WHERE week_start = ws;
  SELECT coalesce(sum(week_points) FILTER (WHERE team = 'A'), 0), coalesce(sum(week_points) FILTER (WHERE team = 'B'), 0),
         count(*) FILTER (WHERE team = 'A'), count(*) FILTER (WHERE team = 'B')
    INTO pa, pb, ma, mb FROM public.player_state WHERE week_ref = ws;
  RETURN jsonb_build_array(
    jsonb_build_object('team', 'A', 'name', coalesce(w.team_a, 'Squadra A'), 'points', pa, 'members', ma),
    jsonb_build_object('team', 'B', 'name', coalesce(w.team_b, 'Squadra B'), 'points', pb, 'members', mb)
  );
END; $function$;

-- 9. SETTLE con cornice corona configurabile
CREATE OR REPLACE FUNCTION public.settle_week(p_week date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w public.weeks; champ record; wa int; wb int; win text; r record;
BEGIN
  SELECT * INTO w FROM public.weeks WHERE week_start = p_week FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'settimana inesistente'; END IF;
  IF w.settled THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;

  SELECT s.user_id, s.week_points INTO champ FROM public.player_state s
   WHERE s.week_ref = p_week ORDER BY s.week_points DESC LIMIT 1;
  IF champ.user_id IS NOT NULL AND champ.week_points > 0 THEN
    PERFORM public.grant_item(champ.user_id, 'title', w.prize_champion, w.prize_champion, 'campione');
    PERFORM public.grant_item(champ.user_id, 'frame', 'Corona ' || to_char(p_week, 'DD/MM/YYYY'), coalesce(w.champion_frame, 'crown'), 'campione');
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
  PERFORM public.audit(NULL, 'settle_week', jsonb_build_object('week', p_week, 'winner', win));
  RETURN jsonb_build_object('ok', true, 'winner', win, 'points_a', wa, 'points_b', wb);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_set_week(p_week_start date, p_team_a text, p_team_b text, p_prize_champion text, p_prize_team text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_champion_frame text DEFAULT 'crown')
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := public.require_admin();
BEGIN
  INSERT INTO public.weeks (week_start, team_a, team_b, prize_champion, prize_team, starts_at, ends_at, champion_frame)
  VALUES (p_week_start, p_team_a, p_team_b, p_prize_champion, p_prize_team, p_starts_at, p_ends_at, coalesce(p_champion_frame,'crown'))
  ON CONFLICT (week_start) DO UPDATE SET team_a = excluded.team_a, team_b = excluded.team_b,
    prize_champion = excluded.prize_champion, prize_team = excluded.prize_team,
    starts_at = excluded.starts_at, ends_at = excluded.ends_at, champion_frame = excluded.champion_frame;
  PERFORM public.audit(uid, 'admin_set_week', jsonb_build_object('week', p_week_start));
  RETURN jsonb_build_object('ok', true);
END; $function$;

-- 10. PILOTA AUTOMATICO
CREATE OR REPLACE FUNCTION public.run_automation(p_force boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE cfg public.automation_settings; today date := (now() AT TIME ZONE 'UTC')::date;
DECLARE detail jsonb := '{}'::jsonb; n int; d date; i int; settled jsonb;
BEGIN
  SELECT * INTO cfg FROM public.automation_settings WHERE id LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'nessuna configurazione'); END IF;
  IF NOT p_force THEN
    IF NOT cfg.enabled THEN RETURN jsonb_build_object('ok', false, 'reason', 'automazione disattivata'); END IF;
    IF cfg.last_run_date = today THEN RETURN jsonb_build_object('ok', false, 'reason', 'gia eseguita oggi'); END IF;
    IF (now() AT TIME ZONE 'UTC')::time < cfg.run_at THEN RETURN jsonb_build_object('ok', false, 'reason', 'orario non raggiunto'); END IF;
  END IF;

  IF cfg.refresh_wheel AND jsonb_array_length(cfg.wheel_template) > 0 THEN
    FOR i IN 0..9 LOOP
      d := today + i;
      INSERT INTO public.wheel_days (day, prizes) VALUES (d, cfg.wheel_template)
      ON CONFLICT (day) DO UPDATE SET prizes = excluded.prizes;
    END LOOP;
    detail := detail || jsonb_build_object('wheel_days', 10);
  ELSE
    PERFORM public.ensure_wheel_schedule();
  END IF;

  IF cfg.clear_chat THEN
    DELETE FROM public.messages;
    GET DIAGNOSTICS n = ROW_COUNT;
    detail := detail || jsonb_build_object('messages_deleted', n);
  END IF;

  IF extract(isodow FROM (now() AT TIME ZONE 'UTC')) = cfg.season_end_dow THEN
    settled := public.settle_week(public.current_week_start());
    detail := detail || jsonb_build_object('season', settled);
    PERFORM public.ensure_week();
  END IF;

  UPDATE public.automation_settings SET last_run_date = today, last_run_detail = detail, updated_at = now() WHERE id;
  PERFORM public.audit(NULL, 'run_automation', detail);
  RETURN jsonb_build_object('ok', true, 'detail', detail);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_get_automation()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE ignored uuid := public.require_admin();
BEGIN
  RETURN coalesce((SELECT to_jsonb(a) FROM public.automation_settings a WHERE a.id LIMIT 1), '{}'::jsonb);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_set_automation(p_enabled boolean, p_run_at time, p_season_end_dow integer, p_clear_chat boolean, p_refresh_wheel boolean, p_wheel_template jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := public.require_admin();
BEGIN
  IF p_season_end_dow < 1 OR p_season_end_dow > 7 THEN RAISE EXCEPTION 'giorno non valido'; END IF;
  INSERT INTO public.automation_settings (id, enabled, run_at, season_end_dow, clear_chat, refresh_wheel, wheel_template, updated_at)
  VALUES (true, p_enabled, p_run_at, p_season_end_dow, p_clear_chat, p_refresh_wheel, coalesce(p_wheel_template, '[]'::jsonb), now())
  ON CONFLICT (id) DO UPDATE SET enabled = excluded.enabled, run_at = excluded.run_at,
    season_end_dow = excluded.season_end_dow, clear_chat = excluded.clear_chat,
    refresh_wheel = excluded.refresh_wheel, wheel_template = excluded.wheel_template, updated_at = now();
  PERFORM public.audit(uid, 'admin_set_automation', jsonb_build_object('enabled', p_enabled));
  RETURN jsonb_build_object('ok', true);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_run_automation()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := public.require_admin();
BEGIN
  RETURN public.run_automation(true);
END; $function$;

REVOKE ALL ON FUNCTION public.run_automation(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_automation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_automation(boolean, time, integer, boolean, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_run_automation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_shop_item(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_shop_item(text, text, text, text, integer, integer, integer, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_week(date, text, text, text, text, timestamptz, timestamptz, text) TO authenticated;

-- 11. TRIGGER REGISTRAZIONE
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uname text;
BEGIN
  uname := nullif(btrim(coalesce(NEW.raw_user_meta_data->>'username', '')), '');
  IF uname IS NULL THEN uname := split_part(coalesce(NEW.email, 'Giocatore'), '@', 1); END IF;
  uname := left(coalesce(nullif(uname,''), 'Giocatore'), 20);
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) LOOP
    uname := left(uname, 14) || floor(random()*9000+1000)::text;
  END LOOP;

  INSERT INTO public.profiles (id, username) VALUES (NEW.id, uname) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.player_state (user_id, week_ref) VALUES (NEW.id, public.current_week_start()) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT (user_id, role) DO NOTHING;
  PERFORM public.grant_item(NEW.id, 'avatar', 'Pulcino', '🐣', 'start');
  PERFORM public.grant_item(NEW.id, 'avatar', 'Polpo', '🐙', 'start');
  PERFORM public.grant_item(NEW.id, 'avatar', 'Volpe', '🦊', 'start');
  PERFORM public.grant_item(NEW.id, 'frame', 'Nessuna cornice', 'none', 'start');
  PERFORM public.grant_item(NEW.id, 'title', 'Novellino', 'Novellino', 'start');
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- bootstrap_player resta come rete di sicurezza e assegna anche il ruolo standard
CREATE OR REPLACE FUNCTION public.bootstrap_player(p_username text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); uname text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'user') ON CONFLICT (user_id, role) DO NOTHING;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid) THEN
    INSERT INTO public.player_state (user_id, week_ref) VALUES (uid, public.current_week_start()) ON CONFLICT (user_id) DO NOTHING;
    RETURN;
  END IF;
  uname := left(coalesce(nullif(btrim(coalesce(p_username,'')), ''), 'Giocatore'), 20);
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) LOOP
    uname := left(uname, 14) || floor(random()*9000+1000)::text;
  END LOOP;
  INSERT INTO public.profiles (id, username) VALUES (uid, uname);
  INSERT INTO public.player_state (user_id, week_ref) VALUES (uid, public.current_week_start()) ON CONFLICT (user_id) DO NOTHING;
  PERFORM public.grant_item(uid, 'avatar', 'Pulcino', '🐣', 'start');
  PERFORM public.grant_item(uid, 'avatar', 'Polpo', '🐙', 'start');
  PERFORM public.grant_item(uid, 'avatar', 'Volpe', '🦊', 'start');
  PERFORM public.grant_item(uid, 'frame', 'Nessuna cornice', 'none', 'start');
  PERFORM public.grant_item(uid, 'title', 'Novellino', 'Novellino', 'start');
END; $function$;

-- 12. get_state: espone cornice campione e durata quiz
CREATE OR REPLACE FUNCTION public.get_state()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); st public.player_state; pr public.profiles; w public.weeks;
DECLARE ca int; cb int; tot int; today date := (now() AT TIME ZONE 'UTC')::date; maxv int; mode text; other text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  w := public.ensure_week();
  PERFORM public.ensure_wheel_schedule();
  IF NOT EXISTS (SELECT 1 FROM public.player_state WHERE user_id = uid) THEN
    RETURN jsonb_build_object('needs_bootstrap', true, 'server_now', now());
  END IF;
  st := public.ensure_proposal(uid);
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
END; $function$;