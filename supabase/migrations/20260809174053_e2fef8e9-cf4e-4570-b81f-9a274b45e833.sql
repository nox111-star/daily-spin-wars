
-- ================= SYNC =================
CREATE OR REPLACE FUNCTION public.sync_player(uid uuid)
RETURNS public.player_state LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st public.player_state; ws date := public.current_week_start(); today date := (now() AT TIME ZONE 'UTC')::date;
DECLARE base int;
BEGIN
  SELECT * INTO st FROM public.player_state WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT coalesce((value->>'base')::int, 5) INTO base FROM public.game_config WHERE key = 'tickets';

  IF st.ticket_date IS DISTINCT FROM today THEN
    UPDATE public.player_state SET ticket_date = today, base_left = base, bonus_left = 0,
      videos_used = 0, quiz_index = 0, pending_quiz = NULL, pending_difficulty = NULL
    WHERE user_id = uid;
  END IF;

  IF st.week_ref IS DISTINCT FROM ws THEN
    UPDATE public.player_state SET week_ref = ws, week_points = 0 WHERE user_id = uid;
  END IF;

  IF st.team_week IS DISTINCT FROM ws THEN
    UPDATE public.player_state SET team = NULL, team_week = NULL, team_proposal = NULL, team_locked = false
    WHERE user_id = uid;
  END IF;

  SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  RETURN st;
END; $$;

-- ================= SQUADRE =================
CREATE OR REPLACE FUNCTION public.team_counts(ws date)
RETURNS TABLE(a int, b int) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) FILTER (WHERE team = 'A')::int, count(*) FILTER (WHERE team = 'B')::int
  FROM public.player_state WHERE team_week = ws AND team_locked;
$$;

CREATE OR REPLACE FUNCTION public.can_join(p_team text, ws date)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ca int; cb int; tot int; share numeric;
BEGIN
  SELECT a, b INTO ca, cb FROM public.team_counts(ws);
  tot := ca + cb;
  IF tot < 10 THEN RETURN true; END IF;
  share := (CASE WHEN p_team = 'A' THEN ca + 1 ELSE cb + 1 END)::numeric * 100 / (tot + 1);
  RETURN share <= 52;
END; $$;

CREATE OR REPLACE FUNCTION public.ensure_proposal(uid uuid)
RETURNS public.player_state LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st public.player_state; ws date := public.current_week_start(); ca int; cb int; pick text;
BEGIN
  st := public.sync_player(uid);
  IF st IS NULL OR st.team_locked THEN RETURN st; END IF;
  IF extract(isodow FROM (now() AT TIME ZONE 'UTC')) = 1 THEN RETURN st; END IF;
  IF st.team_proposal IS NOT NULL THEN RETURN st; END IF;
  SELECT a, b INTO ca, cb FROM public.team_counts(ws);
  IF ca < cb THEN pick := 'A'; ELSIF cb < ca THEN pick := 'B';
  ELSE pick := CASE WHEN random() < 0.5 THEN 'A' ELSE 'B' END; END IF;
  UPDATE public.player_state SET team_proposal = pick WHERE user_id = uid;
  SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  RETURN st;
END; $$;

CREATE OR REPLACE FUNCTION public.choose_team(p_team text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); st public.player_state; ws date := public.current_week_start();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'choose_team', 10, 60);
  IF p_team NOT IN ('A','B') THEN RAISE EXCEPTION 'squadra non valida'; END IF;
  IF extract(isodow FROM (now() AT TIME ZONE 'UTC')) <> 1 THEN RAISE EXCEPTION 'la scelta libera e disponibile solo il lunedi'; END IF;
  st := public.sync_player(uid);
  IF st.team_locked THEN RAISE EXCEPTION 'la tua squadra e gia definitiva per questa settimana'; END IF;
  UPDATE public.player_state SET team = p_team, team_week = ws, team_locked = true, team_proposal = p_team WHERE user_id = uid;
  PERFORM public.audit(uid, 'choose_team', jsonb_build_object('team', p_team));
  RETURN jsonb_build_object('team', p_team);
END; $$;

CREATE OR REPLACE FUNCTION public.accept_team()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); st public.player_state; ws date := public.current_week_start();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'accept_team', 10, 60);
  st := public.ensure_proposal(uid);
  IF st.team_locked THEN RAISE EXCEPTION 'la tua squadra e gia definitiva'; END IF;
  IF st.team_proposal IS NULL THEN RAISE EXCEPTION 'nessuna proposta disponibile'; END IF;
  UPDATE public.player_state SET team = st.team_proposal, team_week = ws, team_locked = true WHERE user_id = uid;
  PERFORM public.audit(uid, 'accept_team', jsonb_build_object('team', st.team_proposal));
  RETURN jsonb_build_object('team', st.team_proposal);
END; $$;

CREATE OR REPLACE FUNCTION public.swap_team(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); st public.player_state; ws date := public.current_week_start(); other text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'swap_team', 10, 300);
  st := public.ensure_proposal(uid);
  IF st.team_locked THEN RAISE EXCEPTION 'la tua squadra e gia definitiva'; END IF;
  IF st.team_proposal IS NULL THEN RAISE EXCEPTION 'nessuna proposta disponibile'; END IF;
  other := CASE WHEN st.team_proposal = 'A' THEN 'B' ELSE 'A' END;
  IF NOT public.can_join(other, ws) THEN RAISE EXCEPTION 'L''altra squadra e al completo'; END IF;
  PERFORM public.consume_ad_token(uid, p_token, 'swap_team');
  UPDATE public.player_state SET team = other, team_proposal = other, team_week = ws, team_locked = true WHERE user_id = uid;
  PERFORM public.audit(uid, 'swap_team', jsonb_build_object('team', other));
  RETURN jsonb_build_object('team', other);
END; $$;

-- ================= TICKET =================
CREATE OR REPLACE FUNCTION public.claim_ad_ticket(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); st public.player_state; maxv int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'claim_ad_ticket', 10, 300);
  st := public.sync_player(uid);
  SELECT coalesce((value->>'max_videos')::int, 3) INTO maxv FROM public.game_config WHERE key = 'tickets';
  IF st.base_left > 0 THEN RAISE EXCEPTION 'finisci prima i ticket gratuiti'; END IF;
  IF st.videos_used >= maxv THEN RAISE EXCEPTION 'hai gia usato tutti i video di oggi'; END IF;
  PERFORM public.consume_ad_token(uid, p_token, 'ticket');
  UPDATE public.player_state SET bonus_left = bonus_left + 1, videos_used = videos_used + 1 WHERE user_id = uid;
  RETURN jsonb_build_object('bonus_left', st.bonus_left + 1, 'videos_left', maxv - st.videos_used - 1);
END; $$;

-- ================= QUIZ =================
CREATE OR REPLACE FUNCTION public.draw_quiz()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    RETURN jsonb_build_object('id', q.id, 'question', q.question, 'options', q.options, 'difficulty', q.difficulty);
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
    SELECT * INTO q FROM public.quizzes z WHERE z.active AND z.difficulty = diff ORDER BY random() LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    SELECT * INTO q FROM public.quizzes z WHERE z.active ORDER BY random() LIMIT 1;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'nessuna domanda disponibile'; END IF;

  INSERT INTO public.quiz_history (user_id, quiz_id) VALUES (uid, q.id) ON CONFLICT DO NOTHING;
  UPDATE public.player_state SET
    pending_quiz = q.id,
    pending_difficulty = q.difficulty,
    base_left = CASE WHEN pool = 'base' THEN base_left - 1 ELSE base_left END,
    bonus_left = CASE WHEN pool = 'bonus' THEN bonus_left - 1 ELSE bonus_left END
  WHERE user_id = uid;
  RETURN jsonb_build_object('id', q.id, 'question', q.question, 'options', q.options, 'difficulty', q.difficulty);
END; $$;

CREATE OR REPLACE FUNCTION public.answer_quiz(p_id integer, p_choice integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); st public.player_state; q public.quizzes; ok boolean; pts int := 0; cr int := 0; conf jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'answer_quiz', 30, 60);
  SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  IF st.pending_quiz IS DISTINCT FROM p_id THEN RAISE EXCEPTION 'quiz non valido'; END IF;
  SELECT * INTO q FROM public.quizzes WHERE id = p_id;
  ok := (q.correct = p_choice);
  IF ok THEN
    SELECT value INTO conf FROM public.game_config WHERE key = 'rewards';
    pts := coalesce(q.points, (conf->q.difficulty->>'points')::int, 10);
    cr := coalesce(q.credits, (conf->q.difficulty->>'credits')::int, 15);
  END IF;
  UPDATE public.player_state SET
    pending_quiz = NULL, pending_difficulty = NULL,
    quiz_answered = quiz_answered + 1,
    quiz_correct = quiz_correct + CASE WHEN ok THEN 1 ELSE 0 END,
    week_points = week_points + pts,
    total_points = total_points + pts
  WHERE user_id = uid;
  IF cr > 0 THEN UPDATE public.profiles SET credits = credits + cr WHERE id = uid; END IF;
  RETURN jsonb_build_object('correct', ok, 'answer', q.correct, 'quip', q.quip, 'points', pts, 'credits', cr, 'difficulty', q.difficulty);
END; $$;

-- ================= CHAT =================
CREATE OR REPLACE FUNCTION public.send_message(p_preset text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); st public.player_state; pre public.chat_presets;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'send_message', 10, 60);
  SELECT * INTO pre FROM public.chat_presets WHERE id = p_preset AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'messaggio non valido'; END IF;
  st := public.sync_player(uid);
  INSERT INTO public.messages (user_id, content, team, preset_id, kind) VALUES (uid, pre.label, st.team, pre.id, pre.kind);
  UPDATE public.player_state SET messages_sent = messages_sent + 1 WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- ================= SHOP =================
CREATE OR REPLACE FUNCTION public.buy_item(p_id text, p_tokens uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); it public.shop_items; cr int; t uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'buy_item', 20, 60);
  SELECT * INTO it FROM public.shop_items WHERE id = p_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'oggetto inesistente'; END IF;
  IF EXISTS (SELECT 1 FROM public.collection WHERE user_id = uid AND item_type = it.kind AND item_value = it.value) THEN
    RAISE EXCEPTION 'lo possiedi gia';
  END IF;
  IF p_tokens IS NULL OR array_length(p_tokens, 1) IS NULL THEN
    SELECT credits INTO cr FROM public.profiles WHERE id = uid;
    IF cr < it.price THEN RAISE EXCEPTION 'crediti insufficienti'; END IF;
    UPDATE public.profiles SET credits = credits - it.price WHERE id = uid;
  ELSE
    IF array_length(p_tokens, 1) < it.video_price THEN RAISE EXCEPTION 'servono % video', it.video_price; END IF;
    FOREACH t IN ARRAY p_tokens LOOP
      PERFORM public.consume_ad_token(uid, t, 'shop:' || it.id);
    END LOOP;
  END IF;
  PERFORM public.grant_item(uid, it.kind, it.name, it.value, CASE WHEN p_tokens IS NULL THEN 'shop' ELSE 'video' END);
  RETURN jsonb_build_object('ok', true);
END; $$;

-- ================= RUOTA =================
CREATE OR REPLACE FUNCTION public.spin_morning_wheel(p_extra boolean, p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); st public.player_state; today date := (now() AT TIME ZONE 'UTC')::date;
DECLARE prizes jsonb; total numeric := 0; r numeric; acc numeric := 0; item jsonb; chosen jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'wheel', 10, 300);
  st := public.sync_player(uid);
  IF p_extra THEN
    IF st.wheel_extra_date = today THEN RAISE EXCEPTION 'giro extra gia usato oggi'; END IF;
    IF st.wheel_free_date IS DISTINCT FROM today THEN RAISE EXCEPTION 'usa prima il giro gratuito'; END IF;
    PERFORM public.consume_ad_token(uid, p_token, 'wheel');
  ELSE
    IF st.wheel_free_date = today THEN RAISE EXCEPTION 'giro gratuito gia usato oggi'; END IF;
  END IF;

  PERFORM public.ensure_wheel_schedule();
  SELECT w.prizes INTO prizes FROM public.wheel_days w WHERE w.day = today;
  SELECT sum(coalesce((e->>'weight')::numeric, 1)) INTO total FROM jsonb_array_elements(prizes) e;
  r := random() * total;
  FOR item IN SELECT e FROM jsonb_array_elements(prizes) e LOOP
    acc := acc + coalesce((item->>'weight')::numeric, 1);
    IF r <= acc THEN chosen := item; EXIT; END IF;
  END LOOP;
  IF chosen IS NULL THEN SELECT e INTO chosen FROM jsonb_array_elements(prizes) e LIMIT 1; END IF;

  UPDATE public.player_state SET
    wheel_free_date = CASE WHEN p_extra THEN wheel_free_date ELSE today END,
    wheel_extra_date = CASE WHEN p_extra THEN today ELSE wheel_extra_date END,
    wheel_spins = wheel_spins + 1,
    week_points = week_points + coalesce((chosen->>'points')::int, 0),
    total_points = total_points + coalesce((chosen->>'points')::int, 0)
  WHERE user_id = uid;
  IF coalesce((chosen->>'credits')::int, 0) > 0 THEN
    UPDATE public.profiles SET credits = credits + (chosen->>'credits')::int WHERE id = uid;
  END IF;
  RETURN jsonb_build_object('label', chosen->>'label', 'credits', coalesce((chosen->>'credits')::int,0), 'points', coalesce((chosen->>'points')::int,0));
END; $$;

-- ================= STATO =================
CREATE OR REPLACE FUNCTION public.get_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END; $$;

-- ================= ADMIN =================
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    'presets', (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.sort), '[]'::jsonb) FROM public.chat_presets c)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_config(p_key text, p_value jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_admin();
BEGIN
  INSERT INTO public.game_config (key, value, updated_at) VALUES (p_key, p_value, now())
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();
  PERFORM public.audit(uid, 'admin_set_config', jsonb_build_object('key', p_key));
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_bulk_quiz(p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_admin(); e jsonb; n int := 0;
BEGIN
  FOR e IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (e->>'difficulty') NOT IN ('medio','difficile','impossibile') THEN
      RAISE EXCEPTION 'difficolta non valida: %', e->>'difficulty';
    END IF;
    IF jsonb_array_length(e->'options') < 2 THEN RAISE EXCEPTION 'servono almeno 2 opzioni'; END IF;
    INSERT INTO public.quizzes (question, options, correct, quip, difficulty, points, credits)
    VALUES (e->>'question', e->'options', (e->>'correct')::int, coalesce(e->>'quip',''), e->>'difficulty',
      nullif(e->>'points','')::int, nullif(e->>'credits','')::int);
    n := n + 1;
  END LOOP;
  PERFORM public.audit(uid, 'admin_bulk_quiz', jsonb_build_object('count', n));
  RETURN jsonb_build_object('inserted', n);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_quizzes()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ignored uuid := public.require_admin();
BEGIN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id DESC) FROM public.quizzes q), '[]'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_quiz(p_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_admin();
BEGIN
  UPDATE public.quizzes SET active = false WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_week(p_week_start date, p_team_a text, p_team_b text, p_prize_champion text, p_prize_team text, p_starts_at timestamptz, p_ends_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_admin();
BEGIN
  INSERT INTO public.weeks (week_start, team_a, team_b, prize_champion, prize_team, starts_at, ends_at)
  VALUES (p_week_start, p_team_a, p_team_b, p_prize_champion, p_prize_team, p_starts_at, p_ends_at)
  ON CONFLICT (week_start) DO UPDATE SET team_a = excluded.team_a, team_b = excluded.team_b,
    prize_champion = excluded.prize_champion, prize_team = excluded.prize_team,
    starts_at = excluded.starts_at, ends_at = excluded.ends_at;
  PERFORM public.audit(uid, 'admin_set_week', jsonb_build_object('week', p_week_start));
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_wheel_day(p_day date, p_prizes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_admin();
BEGIN
  INSERT INTO public.wheel_days (day, prizes) VALUES (p_day, p_prizes)
  ON CONFLICT (day) DO UPDATE SET prizes = excluded.prizes;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_clear_chat(p_hours integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_admin(); n int;
BEGIN
  DELETE FROM public.messages WHERE created_at < now() - make_interval(hours => greatest(p_hours, 0));
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.audit(uid, 'admin_clear_chat', jsonb_build_object('deleted', n));
  RETURN jsonb_build_object('deleted', n);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_shop_item(p_id text, p_kind text, p_name text, p_value text, p_price integer, p_video_price integer, p_sort integer, p_active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_admin();
BEGIN
  INSERT INTO public.shop_items (id, kind, name, value, price, video_price, sort, active)
  VALUES (p_id, p_kind, p_name, p_value, p_price, p_video_price, p_sort, p_active)
  ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, name = excluded.name, value = excluded.value,
    price = excluded.price, video_price = excluded.video_price, sort = excluded.sort, active = excluded.active;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_preset(p_id text, p_kind text, p_label text, p_sort integer, p_active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_admin();
BEGIN
  INSERT INTO public.chat_presets (id, kind, label, sort, active) VALUES (p_id, p_kind, p_label, p_sort, p_active)
  ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, label = excluded.label, sort = excluded.sort, active = excluded.active;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.settle_week(p_week date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.weeks; champ record; wa int; wb int; win text; r record;
BEGIN
  SELECT * INTO w FROM public.weeks WHERE week_start = p_week FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'settimana inesistente'; END IF;
  IF w.settled THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;

  SELECT s.user_id, s.week_points INTO champ FROM public.player_state s
   WHERE s.week_ref = p_week ORDER BY s.week_points DESC LIMIT 1;
  IF champ.user_id IS NOT NULL AND champ.week_points > 0 THEN
    PERFORM public.grant_item(champ.user_id, 'title', w.prize_champion, w.prize_champion, 'campione');
    PERFORM public.grant_item(champ.user_id, 'frame', 'Corona Campione', 'crown', 'campione');
  END IF;

  SELECT coalesce(sum(week_points) FILTER (WHERE team = 'A'), 0),
         coalesce(sum(week_points) FILTER (WHERE team = 'B'), 0) INTO wa, wb
   FROM public.player_state WHERE week_ref = p_week;
  win := CASE WHEN wa >= wb THEN 'A' ELSE 'B' END;
  FOR r IN SELECT user_id FROM public.player_state WHERE week_ref = p_week AND team = win LOOP
    PERFORM public.grant_item(r.user_id, 'title', w.prize_team, w.prize_team, 'squadra');
  END LOOP;

  UPDATE public.player_state SET week_points = 0 WHERE week_ref = p_week;
  UPDATE public.weeks SET settled = true WHERE week_start = p_week;
  PERFORM public.audit(NULL, 'settle_week', jsonb_build_object('week', p_week, 'winner', win));
  RETURN jsonb_build_object('ok', true, 'winner', win, 'points_a', wa, 'points_b', wb);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_settle_week(p_week date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.require_admin();
BEGIN
  RETURN public.settle_week(p_week);
END; $$;

CREATE OR REPLACE FUNCTION public.leaderboard()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
    SELECT p.username, p.avatar, p.frame, p.title, s.team, s.week_points
    FROM public.player_state s JOIN public.profiles p ON p.id = s.user_id
    WHERE s.week_ref = public.current_week_start()
    ORDER BY s.week_points DESC, p.username ASC LIMIT 25
  ) x;
$$;

-- ================= PERMESSI FUNZIONI =================
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;
