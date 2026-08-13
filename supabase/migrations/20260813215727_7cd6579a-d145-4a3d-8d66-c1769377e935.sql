-- 1. player_state: risultati giornalieri per il riepilogo condivisibile
ALTER TABLE public.player_state
  ADD COLUMN IF NOT EXISTS day_results jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. sync_player: i bonus non si azzerano piu' ogni giorno
CREATE OR REPLACE FUNCTION public.sync_player(uid uuid)
 RETURNS player_state
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE st public.player_state; ws date := public.current_week_start(); today date := (now() AT TIME ZONE 'UTC')::date;
DECLARE base int;
BEGIN
  SELECT * INTO st FROM public.player_state WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT coalesce((value->>'base')::int, 5) INTO base FROM public.game_config WHERE key = 'tickets';

  IF st.ticket_date IS DISTINCT FROM today THEN
    UPDATE public.player_state SET ticket_date = today, base_left = base,
      videos_used = 0, quiz_index = 0, pending_quiz = NULL, pending_difficulty = NULL,
      pending_started_at = NULL, day_results = '[]'::jsonb
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
END; $function$;

-- 3. answer_quiz: registra l'esito nel riepilogo giornaliero
CREATE OR REPLACE FUNCTION public.answer_quiz(p_id integer, p_choice integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); st public.player_state; q public.quizzes; ok boolean; pts int := 0; cr int := 0; conf jsonb; expired boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'answer_quiz', 30, 60);
  SELECT * INTO st FROM public.player_state WHERE user_id = uid FOR UPDATE;
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
    total_points = total_points + pts,
    day_results = coalesce(day_results, '[]'::jsonb) || jsonb_build_object(
      'difficulty', q.difficulty, 'ok', ok, 'expired', coalesce(expired, false), 'points', pts)
  WHERE user_id = uid;
  IF cr > 0 THEN UPDATE public.profiles SET credits = credits + cr WHERE id = uid; END IF;
  RETURN jsonb_build_object('correct', ok, 'answer', q.correct, 'quip', q.quip, 'points', pts, 'credits', cr,
    'difficulty', q.difficulty, 'expired', coalesce(expired, false));
END; $function$;

-- 4. claim_ad_ticket: video sbloccati solo a base E bonus esauriti
CREATE OR REPLACE FUNCTION public.claim_ad_ticket(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); st public.player_state; maxv int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'claim_ad_ticket', 10, 300);
  st := public.sync_player(uid);
  SELECT coalesce((value->>'max_videos')::int, 3) INTO maxv FROM public.game_config WHERE key = 'tickets';
  IF st.base_left > 0 OR st.bonus_left > 0 THEN RAISE EXCEPTION 'usa prima i ticket disponibili'; END IF;
  IF st.videos_used >= maxv THEN RAISE EXCEPTION 'hai gia usato tutti i video di oggi'; END IF;
  PERFORM public.consume_ad_token(uid, p_token, 'ticket');
  UPDATE public.player_state SET bonus_left = bonus_left + 1, videos_used = videos_used + 1 WHERE user_id = uid;
  RETURN jsonb_build_object('bonus_left', st.bonus_left + 1, 'videos_left', maxv - st.videos_used - 1);
END; $function$;

-- 5. spin_morning_wheel: restituisce indice dello spicchio e premi del giorno
CREATE OR REPLACE FUNCTION public.spin_morning_wheel(p_extra boolean, p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); st public.player_state; today date := (now() AT TIME ZONE 'UTC')::date;
DECLARE prizes jsonb; total numeric := 0; r numeric; acc numeric := 0; idx int := 0; chosen jsonb; chosen_idx int := 0; e jsonb;
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
  SELECT sum(coalesce((x->>'weight')::numeric, 1)) INTO total FROM jsonb_array_elements(prizes) x;
  IF coalesce(total, 0) <= 0 THEN total := 1; END IF;
  r := random() * total;
  FOR e IN SELECT x FROM jsonb_array_elements(prizes) x LOOP
    acc := acc + coalesce((e->>'weight')::numeric, 1);
    IF r <= acc AND chosen IS NULL THEN chosen := e; chosen_idx := idx; END IF;
    idx := idx + 1;
  END LOOP;
  IF chosen IS NULL THEN
    SELECT x INTO chosen FROM jsonb_array_elements(prizes) x LIMIT 1;
    chosen_idx := 0;
  END IF;

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
  RETURN jsonb_build_object('label', chosen->>'label', 'credits', coalesce((chosen->>'credits')::int,0),
    'points', coalesce((chosen->>'points')::int,0), 'index', chosen_idx, 'prizes', prizes);
END; $function$;

-- 6. settle_week: fix distribuzione premi di fine stagione
CREATE OR REPLACE FUNCTION public.settle_week(p_week date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w public.weeks; champ_id uuid; champ_pts int; wa int; wb int; win text; r record; n int := 0;
BEGIN
  SELECT * INTO w FROM public.weeks WHERE week_start = p_week FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.ensure_week();
    SELECT * INTO w FROM public.weeks WHERE week_start = p_week FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'settimana inesistente'; END IF;
  END IF;
  IF w.settled THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;

  SELECT s.user_id, s.week_points INTO champ_id, champ_pts FROM public.player_state s
   WHERE s.week_ref = p_week AND s.week_points > 0
   ORDER BY s.week_points DESC, s.created_at ASC LIMIT 1;

  IF champ_id IS NOT NULL THEN
    PERFORM public.grant_item(champ_id, 'title', w.prize_champion, w.prize_champion, 'campione');
    PERFORM public.grant_item(champ_id, 'frame', 'Corona ' || to_char(p_week, 'DD/MM/YYYY'),
      coalesce(nullif(w.champion_frame, ''), 'crown'), 'campione');
  END IF;

  SELECT coalesce(sum(week_points) FILTER (WHERE team = 'A'), 0),
         coalesce(sum(week_points) FILTER (WHERE team = 'B'), 0) INTO wa, wb
   FROM public.player_state WHERE week_ref = p_week;
  win := CASE WHEN wa >= wb THEN 'A' ELSE 'B' END;

  FOR r IN SELECT user_id FROM public.player_state WHERE week_ref = p_week AND team = win LOOP
    PERFORM public.grant_item(r.user_id, 'title', w.prize_team, w.prize_team, 'squadra');
    n := n + 1;
  END LOOP;

  UPDATE public.player_state SET week_points = 0;
  UPDATE public.weeks SET settled = true WHERE week_start = p_week;
  PERFORM public.audit(NULL, 'settle_week', jsonb_build_object('week', p_week, 'winner', win,
    'champion', champ_id, 'points', champ_pts, 'team_rewarded', n));
  RETURN jsonb_build_object('ok', true, 'winner', win, 'points_a', wa, 'points_b', wb,
    'champion', champ_id, 'team_rewarded', n);
END; $function$;

-- 7. Pianificazione per singola sezione
CREATE TABLE IF NOT EXISTS public.auto_jobs (
  job text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  run_at time NOT NULL DEFAULT '05:00:00',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_date date,
  last_run_detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.auto_jobs TO service_role;
ALTER TABLE public.auto_jobs ENABLE ROW LEVEL SECURITY;

INSERT INTO public.auto_jobs (job) VALUES ('wheel'), ('week'), ('streak'), ('chat')
ON CONFLICT (job) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_list_jobs()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ignored uuid := public.require_admin();
BEGIN
  RETURN coalesce((SELECT jsonb_object_agg(j.job, to_jsonb(j)) FROM public.auto_jobs j), '{}'::jsonb);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_set_job(p_job text, p_enabled boolean, p_run_at time, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := public.require_admin();
BEGIN
  IF p_job NOT IN ('wheel','week','streak','chat') THEN RAISE EXCEPTION 'attivita non valida'; END IF;
  INSERT INTO public.auto_jobs (job, enabled, run_at, payload, updated_at)
  VALUES (p_job, coalesce(p_enabled,false), coalesce(p_run_at, '05:00'::time), coalesce(p_payload,'{}'::jsonb), now())
  ON CONFLICT (job) DO UPDATE SET enabled = excluded.enabled, run_at = excluded.run_at,
    payload = excluded.payload, updated_at = now();
  PERFORM public.audit(uid, 'admin_set_job', jsonb_build_object('job', p_job, 'enabled', p_enabled));
  RETURN jsonb_build_object('ok', true);
END; $function$;

CREATE OR REPLACE FUNCTION public.run_job(p_job text, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE j public.auto_jobs; today date := (now() AT TIME ZONE 'UTC')::date; detail jsonb := '{}'::jsonb;
DECLARE n int; d date; i int; tpl jsonb; hrs int;
BEGIN
  SELECT * INTO j FROM public.auto_jobs WHERE job = p_job;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'attivita inesistente'); END IF;
  IF NOT p_force THEN
    IF NOT j.enabled THEN RETURN jsonb_build_object('ok', false, 'reason', 'disattivata'); END IF;
    IF j.last_run_date = today THEN RETURN jsonb_build_object('ok', false, 'reason', 'gia eseguita oggi'); END IF;
    IF (now() AT TIME ZONE 'UTC')::time < j.run_at THEN RETURN jsonb_build_object('ok', false, 'reason', 'orario non raggiunto'); END IF;
  END IF;

  IF p_job = 'wheel' THEN
    tpl := j.payload->'prizes';
    IF tpl IS NOT NULL AND jsonb_array_length(tpl) > 0 THEN
      FOR i IN 0..9 LOOP
        d := today + i;
        INSERT INTO public.wheel_days (day, prizes) VALUES (d, tpl)
        ON CONFLICT (day) DO UPDATE SET prizes = excluded.prizes;
      END LOOP;
      detail := jsonb_build_object('wheel_days', 10);
    ELSE
      PERFORM public.ensure_wheel_schedule();
      detail := jsonb_build_object('wheel_days', 'default');
    END IF;

  ELSIF p_job = 'week' THEN
    detail := public.settle_week(public.current_week_start());
    PERFORM public.ensure_week();

  ELSIF p_job = 'streak' THEN
    UPDATE public.player_state SET streak_count = 0, streak_date = NULL, streak_prev = 0, streak_missed = 0;
    GET DIAGNOSTICS n = ROW_COUNT;
    detail := jsonb_build_object('streak_reset', n);

  ELSIF p_job = 'chat' THEN
    hrs := greatest(coalesce((j.payload->>'keep_hours')::int, 0), 0);
    DELETE FROM public.messages WHERE created_at < now() - make_interval(hours => hrs);
    GET DIAGNOSTICS n = ROW_COUNT;
    detail := jsonb_build_object('messages_deleted', n);
  END IF;

  UPDATE public.auto_jobs SET last_run_date = today, last_run_detail = detail, updated_at = now() WHERE job = p_job;
  PERFORM public.audit(NULL, 'run_job', jsonb_build_object('job', p_job, 'detail', detail));
  RETURN jsonb_build_object('ok', true, 'detail', detail);
END; $function$;

CREATE OR REPLACE FUNCTION public.run_jobs()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; out_j jsonb := '{}'::jsonb;
BEGIN
  FOR r IN SELECT job FROM public.auto_jobs WHERE enabled ORDER BY job LOOP
    out_j := out_j || jsonb_build_object(r.job, public.run_job(r.job, false));
  END LOOP;
  RETURN out_j;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_run_job(p_job text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := public.require_admin();
BEGIN
  RETURN public.run_job(p_job, true);
END; $function$;

-- 8. run_rollover esegue anche le attivita' pianificate
CREATE OR REPLACE FUNCTION public.run_rollover()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT week_start FROM public.weeks
    WHERE NOT settled AND ends_at IS NOT NULL AND ends_at <= now() ORDER BY week_start LOOP
    PERFORM public.settle_week(r.week_start);
    n := n + 1;
  END LOOP;
  PERFORM public.ensure_week();
  PERFORM public.ensure_wheel_schedule();
  PERFORM public.run_jobs();
  RETURN jsonb_build_object('settled', n);
END; $function$;

-- 9. get_state: riepilogo giornaliero, premi ruota e gerarchia ticket
CREATE OR REPLACE FUNCTION public.get_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); st public.player_state; pr public.profiles; w public.weeks;
DECLARE ca int; cb int; tot int; today date := (now() AT TIME ZONE 'UTC')::date; maxv int; mode text; other text; streak jsonb;
DECLARE wheel jsonb;
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
  SELECT prizes INTO wheel FROM public.wheel_days WHERE day = today;

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
    'can_watch_ticket_video', st.base_left = 0 AND st.bonus_left = 0 AND st.videos_used < maxv,
    'day_results', coalesce(st.day_results, '[]'::jsonb),
    'wheel_prizes', coalesce(wheel, '[]'::jsonb),
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
END; $function$;

-- 10. admin_overview: include le pianificazioni
CREATE OR REPLACE FUNCTION public.admin_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'jobs', (SELECT coalesce(jsonb_object_agg(j.job, to_jsonb(j)), '{}'::jsonb) FROM public.auto_jobs j),
    'active_users', (SELECT coalesce(jsonb_agg(jsonb_build_object('username', username, 'avatar', avatar, 'last_seen', last_seen)
      ORDER BY last_seen DESC), '[]'::jsonb) FROM public.profiles WHERE last_seen > now() - interval '15 minutes'),
    'shop', (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.sort), '[]'::jsonb) FROM public.shop_items s),
    'presets', (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.sort), '[]'::jsonb) FROM public.chat_presets c),
    'styles', (SELECT coalesce(jsonb_agg(to_jsonb(cs) ORDER BY cs.name), '[]'::jsonb) FROM public.cosmetic_styles cs)
  );
END; $function$;