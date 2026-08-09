# Ristrutturazione logica — Quizzly Squad

## Conferma della logica del "bivio" squadre

**Lunedì — scelta libera**
L'utente sceglie A o B. Alla conferma la squadra è **bloccata per tutta la settimana** (nessun cambio, nessun video, nessuna ruota).

**Martedì → domenica — assegnazione automatica "di nascosto"**
Il server calcola in silenzio la squadra che riequilibra verso il 50/50 e la propone. Poi:

- **Caso 1 — scambio possibile** (passare all'altra squadra la lascia entro il 52%):
  due bottoni → `Accetta la squadra` (blocca la proposta) e `Cambia squadra (Guarda Video)` (video completato → assegna l'altra squadra e blocca).
- **Caso 2 — scambio non possibile** (l'altra squadra supererebbe il 52%):
  solo `Accetta la squadra`, con accanto il testo statico **"L'altra squadra è al completo"**.

In entrambi i casi, dopo accettazione o cambio la squadra è **definitiva fino al reset settimanale**. La proposta è generata e conservata dal server: ricaricare la pagina non la rigenera, e il client non può dichiarare la propria squadra.

## Conferma delle misure server-side

- Ogni azione critica (proposta/accettazione squadra, consumo ticket, estrazione e valutazione quiz, assegnazione punti/crediti, acquisti, riscatti) resta in funzioni `SECURITY DEFINER` sul database, con `now()` del server. Il client invia solo l'intento.
- Le tabelle restano in sola lettura per l'utente: nessuna `INSERT/UPDATE` diretta, nemmeno sui propri punti.
- Il quiz corrente è memorizzato lato server: la risposta corretta non viene mai inviata prima della risposta.
- Ruolo admin in tabella `user_roles` separata + funzione `has_role` (mai un flag sul profilo).

## Due punti da chiarire prima di procedere

1. **Rate limiting**: la piattaforma non ha oggi una primitiva di rate limiting. Posso implementare un limite ad-hoc nel database (contatore per utente/azione con finestra temporale) — protegge da script banali, non è un WAF. Procedo con questa versione ad-hoc salvo diversa indicazione.
2. **Callback video server-to-server**: richiede un SDK reale (AdMob/Unity) che chiami un nostro endpoint. Predispongo l'endpoint pubblico firmato (`/api/public/hooks/ad-reward`) e un flusso a token: il server emette un token di visione, il video lo consuma. Finché il player è simulato, il token viene validato dal server ma "confermato" dal simulatore: sarà sufficiente collegare l'SDK per chiudere il cerchio.

## Piano modulare

**Modulo 1 — Squadre**
`team_proposals` (proposta server, stato pending/locked), riscrittura di `get_state` con blocco `team_flow` (`mode: monday_free | proposal | locked`, `can_swap`), nuove RPC `accept_team`, `swap_team_with_ad`. Rimozione di `choose_team` libera fuori dal lunedì, `spin_team_wheel`, `switch_team_after_ad`.

**Modulo 2 — Ticket**
5 ticket base per sessione settimanale/giornaliera, **niente ricarica a 40 minuti**. Fino a 3 video → +1 ciascuno (max 8). Il bottone video resta disabilitato finché i 5 base non sono esauriti (validato anche dal server).

**Modulo 3 — Quiz**
`quizzes` con `difficulty` (medio/difficile/impossibile) e `points`/`credits` per domanda. `quiz_history` per utente: nessuna ripetizione finché esistono domande non viste. Sessione base a ordine fisso M, M, D, D, I; sessione bonus M, D, I. Estrazione e valutazione server-side.

**Modulo 4 — Chat**
Input libero rimosso. Catalogo `chat_presets` (frasi + sticker) gestito da admin; `send_message` accetta solo un `preset_id` valido. Ogni riga mostra avatar, cornice, nome, titolo e badge squadra.

**Modulo 5 — Shop e profilo**
`shop_items` con doppio sblocco: prezzo in crediti **oppure** N video (entrambi configurabili da admin). Collezione ed equipaggiamento invariati nella UX, con card più leggibili.

**Modulo 6 — Home e UI**
Home ricostruita mobile-first: hero squadra/bivio, vetrina premi grafica (card premio campione e premio squadra con illustrazione), ticket, quiz, classifica. Identità utente completa (nome, avatar, cornice, squadra, titolo) in Home, Classifica e Chat.

**Modulo 7 — Pannello Admin** (`/admin`, protetto da `has_role`)
- Bulk import quiz (incolla CSV/JSON) con difficoltà, punti e crediti.
- Calendario ruota del mattino a 10 giorni, generato automaticamente e modificabile.
- Configuratore sfide settimanali: data/ora, nomi squadre, premio campione e premio squadra.
- Distribuzione premi automatica al reset: corona unica al campione, premio a tutta la squadra vincitrice, azzeramento punti settimanali.
- Pulizia chat programmata.
- Live monitor utenti attivi.
Le automazioni girano via job schedulati che chiamano un endpoint interno.

**Modulo 8 — Anti-cheat trasversale**
Rate limit ad-hoc per utente/azione, endpoint ricompensa video firmato, audit log delle azioni sensibili.

## Note tecniche

Le migrazioni verranno proposte una per modulo, per poterle rivedere. Le funzioni esistenti non più coerenti con le specifiche (`spin_team_wheel`, `switch_team_after_ad`, ricarica ticket a 40 minuti, `send_message` con testo libero) vengono sostituite, non affiancate.
