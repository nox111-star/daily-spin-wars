
CREATE OR REPLACE FUNCTION public.spin_morning_wheel(p_extra boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); st public.player_state; today date := (now() AT TIME ZONE 'UTC')::date;
DECLARE r numeric; v_label text; v_credits integer := 0; v_tickets integer := 0; v_points integer := 0;
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
  IF r < 0.30 THEN v_label := '+10 crediti'; v_credits := 10;
  ELSIF r < 0.55 THEN v_label := '+25 crediti'; v_credits := 25;
  ELSIF r < 0.75 THEN v_label := '+1 ticket'; v_tickets := 1;
  ELSIF r < 0.88 THEN v_label := '+2 ticket'; v_tickets := 2;
  ELSIF r < 0.96 THEN v_label := '+50 crediti'; v_credits := 50;
  ELSE v_label := 'JACKPOT! +100 crediti e +15 punti'; v_credits := 100; v_points := 15;
  END IF;
  UPDATE public.player_state SET
    wheel_free_date = CASE WHEN p_extra THEN wheel_free_date ELSE today END,
    wheel_extra_date = CASE WHEN p_extra THEN today ELSE wheel_extra_date END,
    wheel_spins = wheel_spins + 1,
    tickets = least(5, st.tickets + v_tickets),
    week_points = week_points + v_points,
    total_points = total_points + v_points
  WHERE user_id = uid;
  IF v_credits > 0 THEN UPDATE public.profiles SET credits = credits + v_credits WHERE id = uid; END IF;
  RETURN jsonb_build_object('label', v_label, 'credits', v_credits, 'tickets', v_tickets, 'points', v_points);
END; $fn$;

REVOKE EXECUTE ON FUNCTION public.ensure_week() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_player(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_item(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_week_start() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.bootstrap_player(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_state() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.choose_team(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spin_team_wheel() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.switch_team_after_ad() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.emergency_tickets(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spin_morning_wheel(boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.draw_quiz() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.answer_quiz(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_missions() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_mission(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.buy_item(text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.equip_item(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_message(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leaderboard() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.bootstrap_player(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.choose_team(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spin_team_wheel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.switch_team_after_ad() TO authenticated;
GRANT EXECUTE ON FUNCTION public.emergency_tickets(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spin_morning_wheel(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.draw_quiz() TO authenticated;
GRANT EXECUTE ON FUNCTION public.answer_quiz(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_missions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buy_item(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_item(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_week_start() TO authenticated;
