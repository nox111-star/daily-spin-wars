
-- ============ RUOLI ============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own roles readable" ON public.user_roles;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'accesso riservato agli amministratori'; END IF;
  RETURN uid;
END; $$;

-- ============ CONFIG ============
CREATE TABLE IF NOT EXISTS public.game_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_config TO authenticated;
GRANT ALL ON public.game_config TO service_role;
ALTER TABLE public.game_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "config readable" ON public.game_config;
CREATE POLICY "config readable" ON public.game_config FOR SELECT TO authenticated USING (true);

INSERT INTO public.game_config (key, value) VALUES
  ('rewards', '{"medio":{"points":10,"credits":15},"difficile":{"points":20,"credits":30},"impossibile":{"points":40,"credits":60}}'::jsonb),
  ('tickets', '{"base":5,"max_videos":3}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============ AUDIT + RATE LIMIT ============
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY,
  user_id uuid,
  action text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limits_lookup ON public.rate_limits (user_id, action, created_at DESC);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rate_guard(uid uuid, p_action text, p_max int, p_seconds int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  DELETE FROM public.rate_limits WHERE created_at < now() - interval '1 day';
  SELECT count(*) INTO n FROM public.rate_limits
    WHERE user_id = uid AND action = p_action AND created_at > now() - make_interval(secs => p_seconds);
  IF n >= p_max THEN RAISE EXCEPTION 'troppe richieste, riprova tra poco'; END IF;
  INSERT INTO public.rate_limits (user_id, action) VALUES (uid, p_action);
END; $$;

CREATE OR REPLACE FUNCTION public.audit(uid uuid, p_action text, p_detail jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_log (user_id, action, detail) VALUES (uid, p_action, p_detail);
$$;

-- ============ TOKEN VIDEO (server-to-server) ============
CREATE TABLE IF NOT EXISTS public.ad_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_tokens TO authenticated;
GRANT ALL ON public.ad_tokens TO service_role;
ALTER TABLE public.ad_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own tokens readable" ON public.ad_tokens;
CREATE POLICY "own tokens readable" ON public.ad_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.issue_ad_token(p_purpose text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); tid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.rate_guard(uid, 'issue_ad_token', 20, 300);
  DELETE FROM public.ad_tokens WHERE user_id = uid AND created_at < now() - interval '30 minutes';
  INSERT INTO public.ad_tokens (user_id, purpose) VALUES (uid, p_purpose) RETURNING id INTO tid;
  RETURN tid;
END; $$;

CREATE OR REPLACE FUNCTION public.consume_ad_token(uid uuid, p_token uuid, p_purpose text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.ad_tokens;
BEGIN
  SELECT * INTO t FROM public.ad_tokens WHERE id = p_token FOR UPDATE;
  IF NOT FOUND OR t.user_id <> uid OR t.purpose <> p_purpose THEN RAISE EXCEPTION 'video non valido'; END IF;
  IF NOT t.verified THEN RAISE EXCEPTION 'visione del video non confermata dal server'; END IF;
  IF t.consumed THEN RAISE EXCEPTION 'video gia utilizzato'; END IF;
  IF t.created_at < now() - interval '15 minutes' THEN RAISE EXCEPTION 'video scaduto'; END IF;
  UPDATE public.ad_tokens SET consumed = true WHERE id = p_token;
END; $$;

-- ============ SQUADRE ============
ALTER TABLE public.player_state
  ADD COLUMN IF NOT EXISTS team_proposal text,
  ADD COLUMN IF NOT EXISTS team_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ticket_date date,
  ADD COLUMN IF NOT EXISTS base_left integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS bonus_left integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS videos_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quiz_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_difficulty text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz NOT NULL DEFAULT now();

-- ============ QUIZ ============
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medio',
  ADD COLUMN IF NOT EXISTS points integer,
  ADD COLUMN IF NOT EXISTS credits integer,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

UPDATE public.quizzes SET difficulty = CASE (id % 3) WHEN 0 THEN 'medio' WHEN 1 THEN 'difficile' ELSE 'impossibile' END
WHERE difficulty = 'medio' AND points IS NULL;

CREATE TABLE IF NOT EXISTS public.quiz_history (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id integer NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quiz_id)
);
GRANT SELECT ON public.quiz_history TO authenticated;
GRANT ALL ON public.quiz_history TO service_role;
ALTER TABLE public.quiz_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own quiz history" ON public.quiz_history;
CREATE POLICY "own quiz history" ON public.quiz_history FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ CHAT PRESET ============
CREATE TABLE IF NOT EXISTS public.chat_presets (
  id text PRIMARY KEY,
  kind text NOT NULL,
  label text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.chat_presets TO authenticated;
GRANT ALL ON public.chat_presets TO service_role;
ALTER TABLE public.chat_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "presets readable" ON public.chat_presets;
CREATE POLICY "presets readable" ON public.chat_presets FOR SELECT TO authenticated USING (true);

INSERT INTO public.chat_presets (id, kind, label, sort) VALUES
  ('p1','phrase','Forza squadra!',1),
  ('p2','phrase','Che quiz assurdo 😅',2),
  ('p3','phrase','Ce la facciamo!',3),
  ('p4','phrase','Ci sono cascato di nuovo',4),
  ('p5','phrase','Buona fortuna a tutti',5),
  ('p6','phrase','Sto rimontando!',6),
  ('p7','phrase','Chi mi passa un ticket? 🎟️',7),
  ('p8','phrase','Vittoria in arrivo 🏆',8),
  ('s1','sticker','🔥',20),
  ('s2','sticker','🎉',21),
  ('s3','sticker','😂',22),
  ('s4','sticker','🧠',23),
  ('s5','sticker','💪',24),
  ('s6','sticker','😱',25),
  ('s7','sticker','👏',26),
  ('s8','sticker','🍀',27)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS preset_id text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'phrase';

-- ============ SHOP ============
ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS video_price integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- ============ RUOTA: CALENDARIO ============
CREATE TABLE IF NOT EXISTS public.wheel_days (
  day date PRIMARY KEY,
  prizes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wheel_days TO authenticated;
GRANT ALL ON public.wheel_days TO service_role;
ALTER TABLE public.wheel_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wheel readable" ON public.wheel_days;
CREATE POLICY "wheel readable" ON public.wheel_days FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.ensure_wheel_schedule()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d date; i int;
DECLARE base jsonb := '[{"label":"+10 crediti","credits":10,"points":0,"weight":30},
 {"label":"+25 crediti","credits":25,"points":0,"weight":25},
 {"label":"+50 crediti","credits":50,"points":0,"weight":18},
 {"label":"+5 punti","credits":0,"points":5,"weight":15},
 {"label":"+15 punti","credits":0,"points":15,"weight":8},
 {"label":"JACKPOT +100 crediti e +25 punti","credits":100,"points":25,"weight":4}]'::jsonb;
BEGIN
  FOR i IN 0..9 LOOP
    d := ((now() AT TIME ZONE 'UTC')::date + i);
    INSERT INTO public.wheel_days (day, prizes) VALUES (d, base) ON CONFLICT (day) DO NOTHING;
  END LOOP;
END; $$;

-- ============ SETTIMANE ============
ALTER TABLE public.weeks
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;
UPDATE public.weeks SET starts_at = coalesce(starts_at, week_start::timestamptz),
  ends_at = coalesce(ends_at, (week_start + 7)::timestamptz) WHERE starts_at IS NULL OR ends_at IS NULL;

-- ============ PULIZIA VECCHIE FUNZIONI ============
DROP FUNCTION IF EXISTS public.spin_team_wheel();
DROP FUNCTION IF EXISTS public.switch_team_after_ad();
DROP FUNCTION IF EXISTS public.emergency_tickets(text);
DROP FUNCTION IF EXISTS public.draw_quiz();
DROP FUNCTION IF EXISTS public.answer_quiz(integer, integer);
DROP FUNCTION IF EXISTS public.send_message(text);
DROP FUNCTION IF EXISTS public.buy_item(text, boolean);
DROP FUNCTION IF EXISTS public.choose_team(text);
DROP FUNCTION IF EXISTS public.spin_morning_wheel(boolean);
