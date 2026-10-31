# Architettura

Due pezzi, zero dipendenze: un piccolo server Node (solo moduli built-in) e una pagina web in JavaScript puro, senza build.

## Server (`server/`)
- `server.js`: legge porta e opzioni, rigenera `data/index.json`, si mette in ascolto solo su 127.0.0.1 e ::1, riconosce un'istanza già attiva (`GET /__jeoparty`), apre il browser.
- `static.js`: serve `public/` su `/` e i JSON di `data/` su `/data/`; solo GET/HEAD, header di sicurezza (CSP senza script inline), blocco del path traversal.

## Browser (`public/js/`)
| Modulo | Ruolo |
|---|---|
| `main.js` | avvio, azioni, scelta della schermata dallo stato, tastiera globale, menu e finestre |
| `rules.js` | **puro**: modi di gioco, turni, punteggi, Daily Double, Gran Finale, Annulla |
| `content.js` | caricamento di indice e categorie; **puro**: pesca senza ripetizioni, casuale, rilancio |
| `state.js`, `storage.js` | store con salvataggio immediato in `localStorage` (chiavi `jeoparty:v1:*`) |
| `audio.js` | suoni sintetizzati con Web Audio e musica del Gran Finale |
| `screens/` | una funzione per schermata: home, setup, categories, board, wager, clue, final, end |
| `components/` | barra di gioco, punteggi, timer, finestre modali, avvisi, 🚩, dimensione testo |

## Flusso di un'azione
1. Un clic o un tasto chiama `ctx.dispatch({ type: 'CORRECT', teamId })`.
2. `rules.reduce` restituisce un nuovo stato (mai modificato sul posto) e, per le azioni annullabili, salva quello precedente nella pila di Annulla (massimo 30).
3. Lo store salva la partita in `jeoparty:v1:game` e ridisegna: la schermata dipende solo da `view` e `phase`, quindi un refresh riporta esattamente lì.
4. Dopo il disegno: timer, musica e Wake Lock si allineano allo stato; parte l'eventuale suono.

## Contenuti
- Un file per categoria in `data/categories/<id>.json`; i file che iniziano con `_` sono bozze ignorate.
- `scripts/validate.js` (e il server all'avvio) controlla tutto con `scripts/lib/catalog.js` e rigenera `data/index.json` con le sole categorie valide.
- All'inizio della partita il testo degli indizi viene copiato nello stato: la partita si riprende uguale anche se i JSON cambiano.
- Lo storico (`jeoparty:v1:history`) fa uscire prima le varianti mai giocate.

## Test
- `npm test`: regole, pesca dei contenuti, validatore con fixture rotte, path traversal.
- Le prove nel browser (Chrome headless con il DevTools Protocol) sono script esterni al repository.
