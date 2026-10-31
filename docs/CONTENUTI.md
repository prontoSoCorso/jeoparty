# Come scrivere le domande

## File e campi
- Un file per categoria: `data/categories/<id>.json` (id minuscolo-con-trattini, uguale al nome del file). Parti da `_template.json`.
- 5 livelli (200, 400, 600, 800, 1000) con almeno 2 varianti ciascuno, almeno 3 per le Custom. In partita ne esce una a caso, prima quelle mai giocate.
- Ogni variante: `clue` (indizio), `answer` (risposta), `accept` (altre forme accettate, facoltativo), `notes` (curiosità mostrata dopo, facoltativo), `source` (URL della fonte), `verified`.

## Stile
- L'indizio è un'affermazione, max ~150 caratteri: "Questa città…", "Il cantante che nel 2013…". Una sola risposta giusta possibile.
- La risposta è una domanda: "Chi è…?", "Cos'è…?", "Dov'è…?", "Qual è…?". A voce vale anche solo il nome.
- Date esplicite ("nel 2023") invece di "attualmente" o "l'ultimo": i fatti invecchiano.
- Formati speciali, spiegati nella descrizione della categoria: Prima & Dopo (due titoli fusi), Fa rima con… (coppia in rima), Cos'hanno in comune? (tre elementi, un legame), Domande stupide (la risposta è nell'indizio), Emoji-rebus (tipo + emoji).

## Difficoltà
| Valore | Chi la sa |
|---|---|
| 200 | quasi tutti, anche chi non segue il tema |
| 400 | la maggior parte del gruppo |
| 600 | chi segue un po' il tema |
| 800 | gli appassionati |
| 1000 | i fan sfegatati: dettagli e retroscena |

## Regole
- Niente testi di canzoni né passaggi di libri o film: solo titoli, nomi, anni e fatti.
- Indizi originali, mai copiati da Jeopardy! o da altri quiz.
- Persone reali: solo fatti pubblici e documentati, tono affettuoso, niente gossip, salute, reati, minori.
- `verified: true` solo dopo aver controllato davvero una fonte affidabile, con il suo URL in `source`; altrimenti `false`. Meglio un indizio facile e sicuro che uno brillante ma dubbio.
- Niente emoji bandiera (Windows le mostra come lettere).

## Controllo e correzioni
1. `npm run validate`: errori (la categoria non entra in gioco) e avvisi, con file, livello e variante.
2. `node scripts/validate.js --report` scrive `docs/DA-VERIFICARE.md` con tutte le varianti `verified: false`.
3. In partita, 🚩 Segnala salva un indizio dubbio; in Impostazioni → "Copia segnalazioni" trovi id (`categoria:valore:variante`, variante contata da 0), categoria e testo da correggere.
