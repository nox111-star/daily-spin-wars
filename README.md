# Team Rally

Crea una Web App completa, performante e responsive in React, TypeScript e Tailwind CSS. L'app deve adattarsi perfettamente a qualsiasi risoluzione (Mobile, Tablet, Desktop) con un design 'Gaming-Casual' fresco, pulito, allegro e invitante. Includi un selettore di tema (Light/Dark Mode) per adattarsi alle preferenze dell'utente.

​Logica Anti-Cheat & Architettura:

​Implementa una gestione degli stati (ticket, timer, progressi) basata su backend/database (niente affidamento su localStorage o client-side state).

​Ogni timer (ricarica ticket, ruota giornaliera) deve essere sincronizzato con il timestamp del server per impedire qualsiasi modifica manuale della data/ora da parte dell'utente per imbrogliare.

​Funzionalità Principali:

​Sistema Squadre & Ruota delle Squadre:

​2 Squadre contrapposte che cambiano ogni settimana.

​Ingresso lunedì: Scelta libera della squadra.

​Ingresso da martedì: 'Ruota delle Squadre' per il bilanciamento 50/50.

​Cambio squadra tramite video: Possibile solo se il divario non supera il 52% vs 48%. Se l'altra squadra è al completo (>52%), il cambio è bloccato.

​Barra di progresso squadra in tempo reale sulla home.

​Gestione Risorse (Ticket & Bonus):

​Max 5 Ticket. Ricarica: 1 ogni 40 minuti (calcolati lato server).

​Recupero ticket emergenza: Max 3 volte al giorno tramite visione video pubblicitario (1 ticket per video visto) o mini-gioco fortuna (se si vince, 2 ticket, se si perde, 0).

​Ruota del Mattino: 1 giro gratis + 1 giro extra via video (resettabile solo al cambio giorno server-side).

​Sezione Missioni & Collezioni:

​Sezione Missioni: L'utente completa un obiettivo di gioco (es. rispondi a N quiz). Una volta completato, il premio (avatar, ecc.) diventa 'sbloccabile'; l'utente guarda 1 video per sbloccarlo definitivamente.

​Tutti i premi ottenuti (da missioni, shop, premi squadra, premi individuali) confluiscono nella Collezione Personale dell'utente, utilizzabili per personalizzare il profilo.

​Sezione Shop: Acquisto cornici e titoli tramite crediti guadagnati o video per sblocco definitivo.

​Catalogo iniziale: Selezione di base disponibile dal primo accesso.

​Vetrina Premi Settimanali (Dashboard):

​Widget 'Vetrina Premi': Mostra chiaramente 2 slot in palio per la settimana.

​Slot 1: 'Premio Campione' (per il 1° in classifica generale).

​Slot 2: 'Premio Squadra' (per tutti i membri della squadra vincitrice).

​Entrambi i premi andranno a finire nella collezione dei rispettivi vincitori.

​Quiz e Chat:

​Quiz: Trabocchetti logici, indovinelli subdoli, dettagli visivi. Risposte ironiche, intelligenti e rigorosamente pulite (zero volgarità).

​Chat: Interfaccia moderna con tag squadra e avatar. Tono goliardico e moderato.

​Requisiti Tecnici:

​Layout 'Mobile-First' che scala fluidamente su Tablet e PC.

​Interfaccia con menu di navigazione chiaro (Home, Missioni, Shop, Chat).

​Codice pulito, modulare e pronto per integrazioni future di SDK pubblicitari (AdMob/Unity) con logica di 'finti video' temporanea per testare i flussi.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/27b593a4-f663-4b12-8c50-e9d59d9fec56).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
