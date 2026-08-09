
REVOKE ALL ON FUNCTION public.sync_player(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.grant_item(uuid, text, text, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.consume_ad_token(uuid, uuid, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.rate_guard(uuid, text, int, int) FROM authenticated;
REVOKE ALL ON FUNCTION public.audit(uuid, text, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.settle_week(date) FROM authenticated;
REVOKE ALL ON FUNCTION public.require_admin() FROM authenticated;
REVOKE ALL ON FUNCTION public.ensure_proposal(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.team_counts(date) FROM authenticated;
REVOKE ALL ON FUNCTION public.can_join(text, date) FROM authenticated;
REVOKE ALL ON FUNCTION public.ensure_week() FROM authenticated;
REVOKE ALL ON FUNCTION public.ensure_wheel_schedule() FROM authenticated;

UPDATE public.shop_items SET video_price = greatest(1, round(price / 60.0)::int);

INSERT INTO public.quizzes (question, options, correct, quip, difficulty) VALUES
 ('Quante zampe ha un ragno?', '["6","8","10","12"]', 1, 'Otto: due in più di un insetto.', 'medio'),
 ('Qual è la capitale dell''Australia?', '["Sydney","Melbourne","Canberra","Perth"]', 2, 'Canberra, non Sydney!', 'medio'),
 ('Quanti minuti ha un''ora e mezza?', '["80","90","100","120"]', 1, 'Novanta tondi tondi.', 'medio'),
 ('Di che colore è il cavallo bianco di Napoleone?', '["Nero","Grigio","Bianco","Marrone"]', 2, 'La domanda conteneva la risposta.', 'medio'),
 ('Quanti lati ha un esagono?', '["5","6","7","8"]', 1, 'Sei, come le celle delle api.', 'medio'),
 ('In che anno è caduto il muro di Berlino?', '["1987","1989","1991","1993"]', 1, '1989, un autunno storico.', 'difficile'),
 ('Qual è l''elemento chimico con simbolo K?', '["Kripton","Potassio","Calcio","Carbonio"]', 1, 'K sta per Kalium, potassio.', 'difficile'),
 ('Quale pianeta ha il giorno più lungo?', '["Marte","Venere","Giove","Mercurio"]', 1, 'Venere: un giorno dura più di un suo anno.', 'difficile'),
 ('Chi ha scritto "Il nome della rosa"?', '["Calvino","Eco","Moravia","Pavese"]', 1, 'Umberto Eco, 1980.', 'difficile'),
 ('Quanti cuori ha un polpo?', '["1","2","3","4"]', 2, 'Tre cuori, sangue blu.', 'difficile'),
 ('Qual è il numero primo successivo a 113?', '["115","117","119","127"]', 3, '127: gli altri sono tutti divisibili.', 'impossibile'),
 ('Quale osso umano è il più lungo dopo il femore?', '["Omero","Tibia","Fibula","Radio"]', 1, 'La tibia, seconda solo al femore.', 'impossibile'),
 ('In quale anno fu inventato il post-it?', '["1968","1974","1980","1986"]', 2, 'Commercializzato nel 1980.', 'impossibile'),
 ('Quante corde ha un''arpa da concerto standard?', '["36","41","47","53"]', 2, 'Quarantasette corde.', 'impossibile'),
 ('Qual è la capitale del Kazakistan dal 2019?', '["Almaty","Astana","Nur-Sultan","Shymkent"]', 1, 'Astana, dopo il ritorno al vecchio nome.', 'impossibile');
