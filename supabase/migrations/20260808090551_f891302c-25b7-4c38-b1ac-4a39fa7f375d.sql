
-- ============ TABLES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  avatar text NOT NULL DEFAULT '🐣',
  frame text NOT NULL DEFAULT 'none',
  title text NOT NULL DEFAULT 'Novellino',
  credits integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.player_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tickets integer NOT NULL DEFAULT 5,
  last_ticket_at timestamptz NOT NULL DEFAULT now(),
  team text,
  team_week date,
  wheel_free_date date,
  wheel_extra_date date,
  emergency_date date,
  emergency_count integer NOT NULL DEFAULT 0,
  week_ref date,
  week_points integer NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  quiz_answered integer NOT NULL DEFAULT 0,
  quiz_correct integer NOT NULL DEFAULT 0,
  wheel_spins integer NOT NULL DEFAULT 0,
  messages_sent integer NOT NULL DEFAULT 0,
  pending_quiz integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_state TO authenticated;
GRANT ALL ON public.player_state TO service_role;
ALTER TABLE public.player_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own state readable" ON public.player_state FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.weeks (
  week_start date PRIMARY KEY,
  team_a text NOT NULL,
  team_b text NOT NULL,
  prize_champion text NOT NULL,
  prize_team text NOT NULL,
  settled boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.weeks TO authenticated;
GRANT ALL ON public.weeks TO service_role;
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weeks readable" ON public.weeks FOR SELECT TO authenticated USING (true);

CREATE TABLE public.quizzes (
  id serial PRIMARY KEY,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct integer NOT NULL,
  quip text NOT NULL
);
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.missions (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  metric text NOT NULL,
  target integer NOT NULL,
  reward_name text NOT NULL,
  reward_type text NOT NULL,
  reward_value text NOT NULL,
  sort integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.missions TO authenticated;
GRANT ALL ON public.missions TO service_role;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "missions readable" ON public.missions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.shop_items (
  id text PRIMARY KEY,
  kind text NOT NULL,
  name text NOT NULL,
  value text NOT NULL,
  price integer NOT NULL,
  sort integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.shop_items TO authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop readable" ON public.shop_items FOR SELECT TO authenticated USING (true);

CREATE TABLE public.collection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_name text NOT NULL,
  item_value text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_value)
);
GRANT SELECT ON public.collection TO authenticated;
GRANT ALL ON public.collection TO service_role;
ALTER TABLE public.collection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own collection readable" ON public.collection FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  team text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages readable" ON public.messages FOR SELECT TO authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.current_week_start()
RETURNS date LANGUAGE sql STABLE SET search_path = public AS $fn$
  SELECT (date_trunc('week', now() AT TIME ZONE 'UTC'))::date;
$fn$;

CREATE OR REPLACE FUNCTION public.ensure_week()
RETURNS public.weeks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
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
  IF FOUND THEN RETURN w; END IF;
  n := (extract(epoch FROM ws)::bigint / 604800) % 4;
  INSERT INTO public.weeks (week_start, team_a, team_b, prize_champion, prize_team)
  VALUES (ws, names[n+1][1], names[n+1][2], champs[n+1], tprize[n+1])
  ON CONFLICT (week_start) DO NOTHING;
  SELECT * INTO w FROM public.weeks WHERE week_start = ws;
  RETURN w;
END; $fn$;

CREATE OR REPLACE FUNCTION public.sync_player(uid uuid)
RETURNS public.player_state LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE st public.player_state; gained integer; ws date := public.current_week_start();
BEGIN
  SELECT * INTO st FROM public.player_state WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF st.tickets >= 5 THEN
    UPDATE public.player_state SET last_ticket_at = now() WHERE user_id = uid;
  ELSE
    gained := floor(extract(epoch FROM (now() - st.last_ticket_at)) / 2400);
    IF gained > 0 THEN
      UPDATE public.player_state
      SET tickets = least(5, st.tickets + gained),
          last_ticket_at = CASE WHEN st.tickets + gained >= 5 THEN now()
                                ELSE st.last_ticket_at + (gained * interval '40 minutes') END
      WHERE user_id = uid;
    END IF;
  END IF;

  IF st.week_ref IS DISTINCT FROM ws THEN
    UPDATE public.player_state SET week_ref = ws, week_points = 0 WHERE user_id = uid;
  END IF;
  IF st.team_week IS DISTINCT FROM ws THEN
    UPDATE public.player_state SET team = NULL, team_week = NULL WHERE user_id = uid;
  END IF;
  IF st.emergency_date IS DISTINCT FROM (now() AT TIME ZONE 'UTC')::date THEN
    UPDATE public.player_state SET emergency_date = (now() AT TIME ZONE 'UTC')::date, emergency_count = 0 WHERE user_id = uid;
  END IF;

  SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  RETURN st;
END; $fn$;

CREATE OR REPLACE FUNCTION public.grant_item(uid uuid, itype text, iname text, ivalue text, isource text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $fn$
  INSERT INTO public.collection (user_id, item_type, item_name, item_value, source)
  VALUES (uid, itype, iname, ivalue, isource)
  ON CONFLICT (user_id, item_type, item_value) DO NOTHING;
$fn$;

-- ============ BOOTSTRAP ============
CREATE OR REPLACE FUNCTION public.bootstrap_player(p_username text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); uname text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  uname := nullif(btrim(coalesce(p_username,'')), '');
  IF uname IS NULL THEN uname := 'Giocatore'; END IF;
  uname := left(uname, 20);
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid) THEN RETURN; END IF;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) LOOP
    uname := left(uname, 14) || floor(random()*9000+1000)::text;
  END LOOP;
  INSERT INTO public.profiles (id, username) VALUES (uid, uname);
  INSERT INTO public.player_state (user_id, week_ref) VALUES (uid, public.current_week_start());
  PERFORM public.grant_item(uid, 'avatar', 'Pulcino', '🐣', 'start');
  PERFORM public.grant_item(uid, 'avatar', 'Polpo', '🐙', 'start');
  PERFORM public.grant_item(uid, 'avatar', 'Volpe', '🦊', 'start');
  PERFORM public.grant_item(uid, 'frame', 'Nessuna cornice', 'none', 'start');
  PERFORM public.grant_item(uid, 'title', 'Novellino', 'Novellino', 'start');
END; $fn$;

-- ============ STATE ============
CREATE OR REPLACE FUNCTION public.get_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); st public.player_state; pr public.profiles; w public.weeks;
DECLARE ca integer; cb integer; tot integer; today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  w := public.ensure_week();
  st := public.sync_player(uid);
  IF st IS NULL THEN RETURN jsonb_build_object('needs_bootstrap', true, 'server_now', now()); END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = uid;
  SELECT count(*) INTO ca FROM public.player_state WHERE team = 'A' AND team_week = w.week_start;
  SELECT count(*) INTO cb FROM public.player_state WHERE team = 'B' AND team_week = w.week_start;
  tot := greatest(ca + cb, 1);
  RETURN jsonb_build_object(
    'server_now', now(),
    'is_monday', extract(isodow FROM (now() AT TIME ZONE 'UTC')) = 1,
    'profile', to_jsonb(pr),
    'tickets', st.tickets,
    'next_ticket_seconds', CASE WHEN st.tickets >= 5 THEN 0
      ELSE greatest(0, 2400 - floor(extract(epoch FROM (now() - st.last_ticket_at)))::int) END,
    'team', st.team,
    'week', to_jsonb(w),
    'team_counts', jsonb_build_object('a', ca, 'b', cb, 'total', ca + cb,
      'pct_a', round(ca::numeric * 100 / tot, 1), 'pct_b', round(cb::numeric * 100 / tot, 1)),
    'wheel_free_available', st.wheel_free_date IS DISTINCT FROM today,
    'wheel_extra_available', st.wheel_extra_date IS DISTINCT FROM today,
    'emergency_left', greatest(0, 3 - st.emergency_count),
    'stats', jsonb_build_object('quiz_answered', st.quiz_answered, 'quiz_correct', st.quiz_correct,
      'wheel_spins', st.wheel_spins, 'messages_sent', st.messages_sent,
      'week_points', st.week_points, 'total_points', st.total_points)
  );
END; $fn$;

-- ============ TEAMS ============
CREATE OR REPLACE FUNCTION public.choose_team(p_team text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); st public.player_state; ws date := public.current_week_start();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_team NOT IN ('A','B') THEN RAISE EXCEPTION 'squadra non valida'; END IF;
  st := public.sync_player(uid);
  IF st.team IS NOT NULL THEN RAISE EXCEPTION 'sei gia in una squadra'; END IF;
  IF extract(isodow FROM (now() AT TIME ZONE 'UTC')) <> 1 THEN
    RAISE EXCEPTION 'la scelta libera e disponibile solo il lunedi';
  END IF;
  UPDATE public.player_state SET team = p_team, team_week = ws WHERE user_id = uid;
  RETURN jsonb_build_object('team', p_team);
END; $fn$;

CREATE OR REPLACE FUNCTION public.spin_team_wheel()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); st public.player_state; ws date := public.current_week_start();
DECLARE ca integer; cb integer; pick text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  st := public.sync_player(uid);
  IF st.team IS NOT NULL THEN RAISE EXCEPTION 'sei gia in una squadra'; END IF;
  SELECT count(*) INTO ca FROM public.player_state WHERE team = 'A' AND team_week = ws;
  SELECT count(*) INTO cb FROM public.player_state WHERE team = 'B' AND team_week = ws;
  IF ca < cb THEN pick := 'A';
  ELSIF cb < ca THEN pick := 'B';
  ELSE pick := CASE WHEN random() < 0.5 THEN 'A' ELSE 'B' END; END IF;
  UPDATE public.player_state SET team = pick, team_week = ws WHERE user_id = uid;
  RETURN jsonb_build_object('team', pick);
END; $fn$;

CREATE OR REPLACE FUNCTION public.switch_team_after_ad()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); st public.player_state; ws date := public.current_week_start();
DECLARE ca integer; cb integer; target text; tot integer; new_share numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  st := public.sync_player(uid);
  IF st.team IS NULL THEN RAISE EXCEPTION 'non hai ancora una squadra'; END IF;
  target := CASE WHEN st.team = 'A' THEN 'B' ELSE 'A' END;
  SELECT count(*) INTO ca FROM public.player_state WHERE team = 'A' AND team_week = ws;
  SELECT count(*) INTO cb FROM public.player_state WHERE team = 'B' AND team_week = ws;
  tot := greatest(ca + cb, 1);
  new_share := CASE WHEN target = 'A' THEN (ca + 1)::numeric ELSE (cb + 1)::numeric END * 100 / tot;
  IF new_share > 52 THEN
    RAISE EXCEPTION 'squadra al completo: il cambio sbilancerebbe oltre il 52%%';
  END IF;
  UPDATE public.player_state SET team = target WHERE user_id = uid;
  RETURN jsonb_build_object('team', target);
END; $fn$;

-- ============ TICKETS / WHEEL ============
CREATE OR REPLACE FUNCTION public.emergency_tickets(p_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); st public.player_state; gain integer; won boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_mode NOT IN ('video','game') THEN RAISE EXCEPTION 'modalita non valida'; END IF;
  st := public.sync_player(uid);
  IF st.emergency_count >= 3 THEN RAISE EXCEPTION 'hai esaurito i recuperi di oggi'; END IF;
  IF p_mode = 'video' THEN gain := 1;
  ELSE won := random() < 0.5; gain := CASE WHEN won THEN 2 ELSE 0 END; END IF;
  UPDATE public.player_state
  SET emergency_count = st.emergency_count + 1,
      tickets = least(5, st.tickets + gain),
      last_ticket_at = CASE WHEN least(5, st.tickets + gain) >= 5 THEN now() ELSE last_ticket_at END
  WHERE user_id = uid;
  RETURN jsonb_build_object('gain', gain, 'won', won, 'left', 2 - st.emergency_count);
END; $fn$;

CREATE OR REPLACE FUNCTION public.spin_morning_wheel(p_extra boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); st public.player_state; today date := (now() AT TIME ZONE 'UTC')::date;
DECLARE r numeric; label text; credits integer := 0; tickets integer := 0; points integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  st := public.sync_player(uid);
  IF p_extra THEN
    IF st.wheel_extra_date = today THEN RAISE EXCEPTION 'giro extra gia usato oggi'; END IF;
    IF st.wheel_free_date IS DISTINCT FROM today THEN RAISE EXCEPTION 'usa prima il giro gratuito'; END IF;
  ELSE
    IF st.wheel_free_date = today THEN RAISE EXCEPTION 'giro gratuito gia usato oggi'; END IF;
  END IF;
  r := random();
  IF r < 0.30 THEN label := '+10 crediti'; credits := 10;
  ELSIF r < 0.55 THEN label := '+25 crediti'; credits := 25;
  ELSIF r < 0.75 THEN label := '+1 ticket'; tickets := 1;
  ELSIF r < 0.88 THEN label := '+2 ticket'; tickets := 2;
  ELSIF r < 0.96 THEN label := '+50 crediti'; credits := 50;
  ELSE label := 'JACKPOT: +100 crediti e +15 punti'; credits := 100; points := 15;
  END IF;
  UPDATE public.player_state SET
    wheel_free_date = CASE WHEN p_extra THEN wheel_free_date ELSE today END,
    wheel_extra_date = CASE WHEN p_extra THEN today ELSE wheel_extra_date END,
    wheel_spins = wheel_spins + 1,
    tickets = least(5, tickets + tickets),
    week_points = week_points + points,
    total_points = total_points + points
  WHERE user_id = uid;
  UPDATE public.player_state SET tickets = least(5, st.tickets + tickets) WHERE user_id = uid;
  UPDATE public.profiles SET credits = credits + credits WHERE id = uid;
  RETURN jsonb_build_object('label', label, 'credits', credits, 'tickets', tickets, 'points', points);
END; $fn$;

-- ============ QUIZ ============
CREATE OR REPLACE FUNCTION public.draw_quiz()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); st public.player_state; q public.quizzes;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  st := public.sync_player(uid);
  IF st.tickets < 1 THEN RAISE EXCEPTION 'ticket esauriti'; END IF;
  SELECT * INTO q FROM public.quizzes ORDER BY random() LIMIT 1;
  UPDATE public.player_state
  SET pending_quiz = q.id,
      tickets = st.tickets - 1,
      last_ticket_at = CASE WHEN st.tickets = 5 THEN now() ELSE last_ticket_at END
  WHERE user_id = uid;
  RETURN jsonb_build_object('id', q.id, 'question', q.question, 'options', q.options);
END; $fn$;

CREATE OR REPLACE FUNCTION public.answer_quiz(p_id integer, p_choice integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); st public.player_state; q public.quizzes; ok boolean; pts integer := 0; cr integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  IF st.pending_quiz IS DISTINCT FROM p_id THEN RAISE EXCEPTION 'quiz non valido'; END IF;
  SELECT * INTO q FROM public.quizzes WHERE id = p_id;
  ok := (q.correct = p_choice);
  IF ok THEN pts := 10; cr := 15; END IF;
  UPDATE public.player_state SET
    pending_quiz = NULL,
    quiz_answered = quiz_answered + 1,
    quiz_correct = quiz_correct + CASE WHEN ok THEN 1 ELSE 0 END,
    week_points = week_points + pts,
    total_points = total_points + pts
  WHERE user_id = uid;
  IF cr > 0 THEN UPDATE public.profiles SET credits = credits + cr WHERE id = uid; END IF;
  RETURN jsonb_build_object('correct', ok, 'answer', q.correct, 'quip', q.quip, 'points', pts, 'credits', cr);
END; $fn$;

-- ============ MISSIONS / SHOP / PROFILE / CHAT ============
CREATE OR REPLACE FUNCTION public.list_missions()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); st public.player_state;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', m.id, 'title', m.title, 'description', m.description, 'target', m.target,
    'reward_name', m.reward_name, 'reward_type', m.reward_type, 'reward_value', m.reward_value,
    'progress', least(CASE m.metric
        WHEN 'quiz_answered' THEN st.quiz_answered
        WHEN 'quiz_correct' THEN st.quiz_correct
        WHEN 'wheel_spins' THEN st.wheel_spins
        WHEN 'messages_sent' THEN st.messages_sent
        ELSE 0 END, m.target),
    'claimed', EXISTS (SELECT 1 FROM public.collection c WHERE c.user_id = uid AND c.item_type = m.reward_type AND c.item_value = m.reward_value)
  ) ORDER BY m.sort) FROM public.missions m), '[]'::jsonb);
END; $fn$;

CREATE OR REPLACE FUNCTION public.claim_mission(p_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); st public.player_state; m public.missions; prog integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  SELECT * INTO m FROM public.missions WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'missione inesistente'; END IF;
  prog := CASE m.metric
    WHEN 'quiz_answered' THEN st.quiz_answered
    WHEN 'quiz_correct' THEN st.quiz_correct
    WHEN 'wheel_spins' THEN st.wheel_spins
    WHEN 'messages_sent' THEN st.messages_sent ELSE 0 END;
  IF prog < m.target THEN RAISE EXCEPTION 'missione non ancora completata'; END IF;
  PERFORM public.grant_item(uid, m.reward_type, m.reward_name, m.reward_value, 'missione');
  RETURN jsonb_build_object('ok', true, 'reward', m.reward_name);
END; $fn$;

CREATE OR REPLACE FUNCTION public.buy_item(p_id text, p_with_ad boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); it public.shop_items; cr integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO it FROM public.shop_items WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'oggetto inesistente'; END IF;
  IF EXISTS (SELECT 1 FROM public.collection WHERE user_id = uid AND item_type = it.kind AND item_value = it.value) THEN
    RAISE EXCEPTION 'lo possiedi gia';
  END IF;
  IF NOT p_with_ad THEN
    SELECT credits INTO cr FROM public.profiles WHERE id = uid;
    IF cr < it.price THEN RAISE EXCEPTION 'crediti insufficienti'; END IF;
    UPDATE public.profiles SET credits = credits - it.price WHERE id = uid;
  END IF;
  PERFORM public.grant_item(uid, it.kind, it.name, it.value, CASE WHEN p_with_ad THEN 'video' ELSE 'shop' END);
  RETURN jsonb_build_object('ok', true);
END; $fn$;

CREATE OR REPLACE FUNCTION public.equip_item(p_type text, p_value text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_type NOT IN ('avatar','frame','title') THEN RAISE EXCEPTION 'tipo non valido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.collection WHERE user_id = uid AND item_type = p_type AND item_value = p_value) THEN
    RAISE EXCEPTION 'oggetto non in collezione';
  END IF;
  UPDATE public.profiles SET
    avatar = CASE WHEN p_type = 'avatar' THEN p_value ELSE avatar END,
    frame = CASE WHEN p_type = 'frame' THEN p_value ELSE frame END,
    title = CASE WHEN p_type = 'title' THEN p_value ELSE title END
  WHERE id = uid;
  RETURN jsonb_build_object('ok', true);
END; $fn$;

CREATE OR REPLACE FUNCTION public.send_message(p_content text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); st public.player_state; body text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  body := left(btrim(coalesce(p_content, '')), 300);
  IF body = '' THEN RAISE EXCEPTION 'messaggio vuoto'; END IF;
  st := public.sync_player(uid);
  IF EXISTS (SELECT 1 FROM public.messages WHERE user_id = uid AND created_at > now() - interval '2 seconds') THEN
    RAISE EXCEPTION 'stai scrivendo troppo in fretta';
  END IF;
  INSERT INTO public.messages (user_id, content, team) VALUES (uid, body, st.team);
  UPDATE public.player_state SET messages_sent = messages_sent + 1 WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true);
END; $fn$;

CREATE OR REPLACE FUNCTION public.leaderboard()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $fn$
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
    SELECT p.username, p.avatar, p.frame, p.title, s.team, s.week_points
    FROM public.player_state s JOIN public.profiles p ON p.id = s.user_id
    WHERE s.week_ref = public.current_week_start()
    ORDER BY s.week_points DESC, p.username ASC LIMIT 25
  ) x;
$fn$;

-- ============ SEED CONTENT ============
INSERT INTO public.quizzes (question, options, correct, quip) VALUES
('Un contadino ha 17 pecore. Tutte tranne 9 scappano. Quante ne restano?', '["8","9","17","0"]', 1, 'Tutte TRANNE 9: ne restano 9. Le altre sono in tour.'),
('Quanti mesi dell''anno hanno 28 giorni?', '["1","2","12","6"]', 2, 'Tutti e 12 ne hanno almeno 28. Febbraio non è speciale, è solo timido.'),
('Cosa pesa di più: un chilo di piume o un chilo di piombo?', '["Le piume","Il piombo","Pesano uguale","Dipende dal vento"]', 2, 'Un chilo è un chilo. Le piume occupano solo più spazio nell''armadio.'),
('Se corri una gara e superi il secondo, in che posizione sei?', '["Primo","Secondo","Terzo","Ultimo"]', 1, 'Prendi il posto del secondo. Il primo sta ancora davanti, sorridendo.'),
('Un aereo si schianta al confine tra due Paesi. Dove si seppelliscono i sopravvissuti?', '["Nel primo Paese","Nel secondo","Da nessuna parte","A metà"]', 2, 'I sopravvissuti di solito preferiscono restare non seppelliti.'),
('Quante volte puoi sottrarre 10 da 100?', '["10","1","0","100"]', 1, 'Una sola: dopo non è più 100.'),
('Hai una candela, una stufa e una lampada. Cosa accendi per primo?', '["La candela","La stufa","La lampada","Il fiammifero"]', 3, 'Prima il fiammifero, poi la gara di illuminazione.'),
('Cosa aumenta se la dividi con qualcuno?', '["La pizza","La gioia","Il conto","Il divano"]', 1, 'La gioia. La pizza purtroppo segue altre leggi.'),
('Quale parola è scritta in modo sbagliato in tutti i dizionari?', '["Sbagliato","Errore","Dizionario","Parola"]', 0, '"Sbagliato" è scritta proprio così: sbagliato.'),
('Due madri e due figlie vanno al cinema, ma comprano solo 3 biglietti. Perché?', '["Uno è entrato gratis","Sono nonna, madre e figlia","Hanno barato","Un biglietto è doppio"]', 1, 'Nonna, madre e figlia: tre persone, quattro ruoli.'),
('Cosa puoi tenere in mano senza mai toccarlo?', '["Il fumo","La tua ombra","Un segreto","L''aria"]', 1, 'La tua ombra: sempre con te, mai davvero afferrabile.'),
('Ho città ma niente case, monti ma niente alberi. Cosa sono?', '["Un sogno","Una mappa","Un quadro","Un videogioco"]', 1, 'Una mappa. Bellissima, ma pessima per un picnic.'),
('Se un gallo depone un uovo sul tetto, da che lato rotola?', '["Destra","Sinistra","I galli non depongono uova","Dipende dal tetto"]', 2, 'I galli non depongono uova. Fine dell''indagine.'),
('Quale numero, letto allo specchio, resta identico?', '["69","808","12","91"]', 1, '808 regge benissimo lo specchio.');

INSERT INTO public.missions (id, title, description, metric, target, reward_name, reward_type, reward_value, sort) VALUES
('m_quiz_5','Riscaldamento','Rispondi a 5 quiz','quiz_answered',5,'Avatar Robot','avatar','🤖',1),
('m_quiz_correct_5','Cervello Acceso','Indovina 5 quiz','quiz_correct',5,'Titolo: Furbetto','title','Furbetto',2),
('m_wheel_3','Giramondo','Gira la ruota 3 volte','wheel_spins',3,'Avatar Unicorno','avatar','🦄',3),
('m_chat_10','Anima della Chat','Manda 10 messaggi in chat','messages_sent',10,'Cornice Bolle','frame','bubbles',4),
('m_quiz_25','Maratoneta','Rispondi a 25 quiz','quiz_answered',25,'Titolo: Maratoneta','title','Maratoneta',5);

INSERT INTO public.shop_items (id, kind, name, value, price, sort) VALUES
('f_neon','frame','Cornice Neon','neon',120,1),
('f_gold','frame','Cornice Oro','gold',260,2),
('f_candy','frame','Cornice Caramella','candy',180,3),
('f_ice','frame','Cornice Ghiaccio','ice',200,4),
('t_pro','title','Titolo: Pro Player','Pro Player',150,5),
('t_gentile','title','Titolo: Gentiluomo','Gentiluomo',90,6),
('t_leggenda','title','Titolo: Leggenda','Leggenda',400,7),
('a_drago','avatar','Avatar Drago','🐲',300,8),
('a_panda','avatar','Avatar Panda','🐼',140,9),
('a_alieno','avatar','Avatar Alieno','👾',160,10);
