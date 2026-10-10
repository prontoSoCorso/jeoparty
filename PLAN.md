# Jeoparty — Piano di progetto

> **Stato:** Fase 2 (implementazione) in corso. Piano approvato dopo la revisione: le decisioni prese sono in §11, quelle maturate durante lo sviluppo in §12.
> Jeoparty è un quiz in stile Jeopardy per serate tra amici: in italiano, offline, su un solo schermo, con un conduttore in carne e ossa.

**Indice:** [1. Obiettivo e stack](#1-obiettivo-e-scelte-di-stack) · [2. Struttura](#2-struttura-delle-cartelle) · [3. Schema dati](#3-schema-dati) · [4. Catalogo](#4-catalogo-categorie) · [5. Flusso di gioco](#5-flusso-di-gioco-e-schermate) · [6. Avvio](#6-avvio-in-localhost) · [7. INSTRUCTIONS.md](#7-contenuto-di-instructionsmd) · [8. Licenza e README](#8-licenza-readme-e-proprietà-intellettuale) · [9. Fasi e test](#9-fasi-di-implementazione-e-test) · [10. Fuori scope e rischi](#10-fuori-scope-idee-future-e-rischi) · [11. Decisioni prese](#11-decisioni-prese) · [12. Decisioni in corso d'opera](#12-decisioni-in-corso-dopera) · [Appendice A: LICENSE](#appendice-a--testo-di-license)

---

## 1. Obiettivo e scelte di stack

Un PC collegato alla TV (schermo duplicato), tu che conduci con mouse e tastiera, 2–6 squadre che rispondono a voce. Gira in localhost su Windows 11: niente account, niente servizi a pagamento, niente connessione.

| Livello | Scelta | Perché |
|---|---|---|
| Frontend | HTML + CSS + JavaScript vanilla, ES modules nativi, nessun build | Per 8 schermate un framework non serve: modifichi un file e ricarichi la pagina. |
| Server | Node.js con soli moduli built-in (`node:http`, `fs`, `path`, `url`, `child_process`) | Aprendo i file con `file://` il browser blocca ES modules e `fetch()` dei JSON: serve un server statico minimo. |
| Dati | JSON statici: un file per categoria + un indice generato | Leggibili, modificabili a mano, versionabili, validabili. |
| Stato partita | `localStorage` del browser | Sopravvive a refresh e chiusura; niente database né backend. |
| Audio | Web Audio API (suoni sintetizzati) | Nessun file audio, nessun problema di copyright. |
| Qualità | `node --test` + `scripts/validate.js` | Zero dipendenze anche per test e validazione. |

**Perché è adatto a OneDrive e Windows**
- **Zero dipendenze:** nessuna cartella `node_modules`; `npm start` funziona senza `npm install`.
- **Pochi file piccoli** (un centinaio, < 1 MB). A runtime l'app non scrive nella cartella: lo stato vive nel browser. Unica eccezione: `data/index.json`, riscritto solo se il contenuto cambia.
- **Percorsi robusti:** tutto è risolto da `import.meta.url` con `fileURLToPath`, quindi spazi e lettere accentate nel percorso di OneDrive non creano problemi. Nomi di file ASCII e corti, lontani dal limite di 260 caratteri.
- **Solo loopback** (`127.0.0.1` e `::1`): nessun avviso del Firewall di Windows, nessuna esposizione in rete.
- **`start.bat` solo ASCII e con fine riga CRLF** (imposto da `.gitattributes`): `cmd` non sbaglia codifica né parsing.
- **Offline:** se OneDrive usa "File su richiesta", imposta la cartella su *Mantieni sempre su questo dispositivo*.

**Alternative scartate:** Vite/React/Svelte (50–150 MB di `node_modules` da sincronizzare più una fase di build, senza benefici reali qui); Electron (pesante); un unico HTML con i dati incorporati (funziona da `file://` ma perde moduli e JSON separati); `python -m http.server` (non gestisce porta, browser e indice).

> Node.js v24.20.0 installato (verificato all'inizio della Fase 2).

---

## 2. Struttura delle cartelle

```text
jeoparty/
├─ PLAN.md                 # questo piano
├─ README.md               # brevissimo: descrizione, avvio rapido, licenza, disclaimer
├─ INSTRUCTIONS.md         # istruzioni d'uso super brevi (≤ 15 righe)
├─ LICENSE                 # tutti i diritti riservati (IT + traduzione EN), vedi Appendice A
├─ package.json            # script npm; "type": "module", "private": true, zero dipendenze
├─ start.bat               # avvio con doppio clic: controlla Node e lancia il server
├─ .gitignore              # snello: node_modules, log, file di sistema Windows/OneDrive, .vscode/
├─ .gitattributes          # eol=lf ovunque, eol=crlf per *.bat
├─ .editorconfig           # UTF-8 senza BOM, LF, indentazione 2 spazi
│
├─ server/                 # Node, solo built-in; mai servito al browser
│  ├─ server.js            # entry: argomenti e porta, istanza unica, avvio, apertura browser
│  ├─ static.js            # file statici: MIME, no-store, CSP, anti path-traversal, solo GET/HEAD
│  └─ open-browser.js      # apre il browser predefinito (Windows: start "")
│
├─ public/                 # tutto ciò che arriva al browser (servito su /)
│  ├─ index.html           # unica pagina; nessuno script inline
│  ├─ favicon.svg          # icona originale
│  ├─ css/
│  │  ├─ base.css          # variabili (palette, font, --scala), reset, tipografia da TV
│  │  ├─ components.css    # bottoni, modali, toast, chip, card, barra punteggi
│  │  └─ screens.css       # layout delle singole schermate
│  └─ js/
│     ├─ main.js           # bootstrap, schermata derivata dallo stato, errori globali, ripresa
│     ├─ strings.js        # tutti i testi dell'interfaccia (italiano) in un unico posto
│     ├─ state.js          # store: azione → nuovo stato → salvataggio → render
│     ├─ storage.js        # localStorage sicuro (try/catch), versioni e migrazioni
│     ├─ rules.js          # PURO: modi di gioco, punteggi, turni, Daily Double, Gran Finale, annulla
│     ├─ content.js        # carica indice e categorie; PURO: pesca varianti senza ripetizioni
│     ├─ random.js         # RNG (crypto.getRandomValues, o con seme per i test), scelta pesata
│     ├─ audio.js          # effetti sonori sintetizzati, volume e muto
│     ├─ timer.js          # countdown basato su timestamp, con pausa e ripresa
│     ├─ keyboard.js       # scorciatoie (event.code: indipendenti dal layout italiano)
│     ├─ dom.js            # helper h()/qs() per creare DOM senza framework
│     ├─ components/       # scorebar.js, modal.js, toast.js
│     └─ screens/          # home, setup, categories, board, clue, wager, final, end (.js)
│
├─ data/
│  ├─ index.json           # GENERATO (da validate e all'avvio del server): non modificarlo a mano
│  └─ categories/
│     ├─ _template.json    # modello; i file che iniziano con "_" sono ignorati (bozze)
│     ├─ violetta.json     # un file per categoria; nome file = id
│     └─ …                 # 47 categorie in totale
│
├─ scripts/
│  ├─ validate.js          # CLI: valida i contenuti, rigenera l'indice, --report scrive DA-VERIFICARE.md
│  └─ lib/catalog.js       # lettura categorie + regole di validazione (usato da server, CLI e test)
│
├─ tests/                  # node --test
│  ├─ rules.test.js        # modi di gioco, turni, rubata, penalità, Daily Double, annulla, finale
│  ├─ content.test.js      # pesca varianti, anti-ripetizione, "solo verificati", casuale
│  ├─ validate.test.js     # il validatore riconosce ogni tipo di errore
│  ├─ static.test.js       # il server non esce dalla sua radice (path traversal)
│  └─ fixtures/            # categorie volutamente rotte
│
└─ docs/
   ├─ CONTENUTI.md         # guida di stile, scala di difficoltà, verifica dei fatti, copyright
   ├─ ARCHITETTURA.md      # moduli, stato, azioni, persistenza (breve)
   ├─ TEST-MANUALE.md      # checklist da spuntare prima di una serata
   └─ DA-VERIFICARE.md     # GENERATO da validate --report (ignorato da git)
```

**Logica dell'organizzazione**
- Confini netti: `public/` è il browser, `server/` e `scripts/` sono Node, `data/` sono i contenuti, `tests/` e `docs/` la qualità. Chi scrive domande tocca solo `data/`.
- I moduli marcati PURO non usano né DOM né rete, quindi si testano direttamente con `node --test`.
- Rendering semplice: ogni schermata esporta una funzione che costruisce il proprio DOM a partire dallo stato; `main.js` la ridisegna a ogni azione (DOM piccolo, nessun virtual DOM). I campi di testo aggiornano lo stato senza ridisegnare; il timer aggiorna solo la sua barra.
- Docs brevi: massimo ~40 righe per file.

**Convenzioni di naming**

| Cosa | Regola | Esempio |
|---|---|---|
| File e cartelle | kebab-case, ASCII, senza spazi né accenti | `trap-italiana.json`, `open-browser.js` |
| id categoria | `^[a-z0-9]+(-[a-z0-9]+)*$`, uguale al nome file, mai rinominato (lo usa lo storico) | `high-school-musical` |
| Bozze | prefisso `_` = ignorato da indice e gioco | `_bozza-calcio.json` |
| JavaScript | ES modules; `camelCase` per funzioni e variabili, `UPPER_SNAKE` per costanti | `pickVariant`, `MAX_TEAMS` |
| CSS | classi kebab-case in stile BEM leggero, variabili `--*` | `.board__cell--used`, `--c-board` |
| JSON | UTF-8 senza BOM, LF, indentazione 2 spazi | |
| Chiavi localStorage | prefisso + versione | `jeoparty:v1:game` |
| Documenti | in radice in MAIUSCOLO, scritti in italiano | `INSTRUCTIONS.md` |

---

## 3. Schema dati

### 3.1 File di categoria `data/categories/<id>.json`

| Campo | Tipo | Obbl. | Regole |
|---|---|---|---|
| `id` | string | ✓ | kebab-case ASCII, uguale al nome file, unico |
| `name` | string | ✓ | ≤ 24 caratteri consigliati (intestazione del tabellone) |
| `group` | `"classiche"` \| `"custom"` \| `"inventate"` | ✓ | |
| `emoji` | string | ✓ | una emoji; **niente bandiere** (Windows le mostra come lettere) |
| `description` | string | ✓ | una riga, ≤ 90 caratteri; spiega anche i formati speciali |
| `clues` | array | ✓ | esattamente 5 livelli: 200, 400, 600, 800, 1000 |
| `clues[].value` | number | ✓ | |
| `clues[].variants` | array | ✓ | almeno 2 varianti; **almeno 3 per le Custom** |
| `variants[].clue` | string | ✓ | affermazione, ≤ 200 caratteri (2–3 righe in TV) |
| `variants[].answer` | string | ✓ | in forma di domanda, termina con `?` |
| `variants[].accept` | string[] | – | altre risposte accettabili (aiuto per il conduttore) |
| `variants[].notes` | string | – | curiosità o chiarimento mostrato dopo la risposta |
| `variants[].source` | string | – | URL reale della fonte consultata; obbligatorio se `verified` è `true`; mai mostrato in gioco |
| `variants[].verified` | boolean | ✓ | `true` solo con fonte consultata e indicata in `source`; altrimenti `false` |

Esempio (livelli 400–800 omessi):

```jsonc
{
  "id": "high-school-musical",
  "name": "High School Musical",
  "group": "custom",
  "emoji": "🏀",
  "description": "La saga Disney Channel dei Wildcats della East High.",
  "clues": [
    {
      "value": 200,
      "variants": [
        {
          "clue": "Capitano della squadra di basket della East High, scopre di amare il palcoscenico; lo interpreta Zac Efron.",
          "answer": "Chi è Troy Bolton?",
          "accept": ["Troy"],
          "source": "https://it.wikipedia.org/wiki/High_School_Musical",
          "verified": true
        },
        { "clue": "…", "answer": "…", "verified": false },
        { "clue": "…", "answer": "…", "verified": false }
      ]
    },
    // … livelli 400, 600, 800 e 1000 con la stessa struttura …
  ]
}
```

### 3.2 Indice `data/index.json` (generato, non si modifica a mano)

```json
{
  "schemaVersion": 1,
  "groups": [
    { "id": "classiche", "name": "Classiche" },
    { "id": "custom", "name": "Custom" },
    { "id": "inventate", "name": "Inventate" }
  ],
  "categories": [
    {
      "id": "high-school-musical",
      "name": "High School Musical",
      "group": "custom",
      "emoji": "🏀",
      "description": "La saga Disney Channel dei Wildcats della East High.",
      "file": "categories/high-school-musical.json",
      "variants": 15,
      "unverified": 2,
      "playableVerified": true
    }
  ]
}
```

L'indice contiene solo le categorie valide: una categoria con errori non arriva mai al tabellone. `unverified` alimenta il badge "⚠ n da verificare" nella scelta delle categorie. `playableVerified` dice se la categoria è giocabile in modalità "solo verificati", cioè se ha almeno una variante verificata per ogni livello. Niente timestamp nel file: se il contenuto non cambia, il file non viene riscritto (nessuna modifica inutile per git e OneDrive).

### 3.3 Formato indizio/risposta

- **Stile Jeopardy.** L'indizio è un'affermazione che indica la risposta con "questo/questa…". Nel JSON `answer` è scritta in forma di domanda: `Chi è/sono…?` per le persone, `Cos'è/Cosa sono…?` per cose, luoghi e opere; ammessi anche `Dov'è`, `Quando`, `Quanti`, `Qual è`. `accept` elenca le forme brevi.
- **Forma di domanda sempre facoltativa:** alla rivelazione si mostra `answer` così com'è; i giocatori possono rispondere anche solo col nome. Nessuna impostazione.

Formati speciali (la descrizione della categoria li spiega a schermo):

| Categoria | Come funziona | Esempio di risposta |
|---|---|---|
| Prima & Dopo | due titoli/frasi fusi sulla parola in comune | "Cos'è *La vita è bella ciao*?" |
| Fa rima con… | due parole in rima | "Cos'è un gatto matto?" |
| Cos'hanno in comune? | tre elementi, si indovina il legame | "Cosa sono le lune di Giove?" |
| Domande stupide | la risposta è già nell'indizio | "Cos'è il bianco?" (il cavallo di Napoleone) |
| Emoji-rebus | indizio = emoji + tipo (film/canzone/proverbio) | "Cos'è *Il re leone*?" |

**Scala di difficoltà**

| Valore | Chi la sa |
|---|---|
| 200 | quasi tutti, anche chi non conosce il tema |
| 400 | la maggior parte del gruppo |
| 600 | chi segue un po' il tema |
| 800 | gli appassionati |
| 1000 | i fan sfegatati: dettagli e retroscena |

**Regole sui contenuti** (dettagliate in `docs/CONTENUTI.md`)
- Niente testi di canzoni né passaggi di libri o film, nemmeno un verso: ammessi titoli, artisti, album, anni, personaggi e curiosità.
- Indizi originali: mai copiati dal vero Jeopardy o da altri quiz.
- Date esplicite invece di "attualmente" o "l'ultimo": i fatti invecchiano, le date no (per l'AI sempre).
- Persone reali: solo fatti pubblici e documentati, tono affettuoso, niente gossip non verificato, salute, reati o persone private.
- Meglio un indizio facile e sicuro che uno brillante ma incerto: mai scrivere un dato di cui non si è sicuri.
- `verified: true` **solo** se la fonte è stata davvero consultata (WebSearch/WebFetch) e il suo URL reale è in `source`. "Certo e notorio" non basta: in tutti gli altri casi `false`.

### 3.4 Validazione: `npm run validate` (solo moduli built-in)

| Controllo | Esito |
|---|---|
| JSON valido (con file e posizione dell'errore) | errore |
| BOM UTF-8 (rimosso in lettura e segnalato; il Blocco note a volte lo aggiunge) | avviso |
| Campi obbligatori presenti, del tipo giusto e non vuoti dopo il trim | errore |
| `id` uguale al nome file, in kebab-case, unico; `group` ammesso | errore |
| Esattamente 5 livelli 200→1000, ciascuno con almeno 2 varianti | errore |
| Custom con meno di 3 varianti per livello | avviso |
| Indizio duplicato (normalizzato: minuscole, senza accenti né punteggiatura), nella stessa categoria o in altre | errore |
| Stessa risposta ripetuta nella stessa categoria | avviso |
| Campi sconosciuti (es. il refuso `anwser`) | avviso |
| `answer` senza `?` finale o senza un interrogativo ammesso all'inizio | avviso |
| `verified: true` senza `source`; `source` che non è un URL http(s) | avviso |
| Lunghezze: indizio > 200, risposta > 60, nome > 24, descrizione > 90 caratteri | avviso |
| Emoji bandiera, spazi doppi/iniziali/finali, caratteri di controllo | avviso |
| Testo tra virgolette di oltre 8 parole (possibile citazione o testo di canzone) | avviso |
| Riepilogo: categorie per gruppo, varianti totali, `verified: false` per categoria | info |

Esce con codice 1 se ci sono errori; `--strict` tratta gli avvisi come errori; `--report` scrive `docs/DA-VERIFICARE.md` (gli indizi `verified: false`, raggruppati per categoria). Al termine rigenera `data/index.json` escludendo le categorie con errori.

### 3.5 Stato salvato nel browser

| Chiave `localStorage` | Contenuto |
|---|---|
| `jeoparty:v1:game` | partita in corso, salvata a ogni azione |
| `jeoparty:v1:settings` | preferenze: audio, volume, dimensione testo (`scala`), ultime opzioni e squadre usate |
| `jeoparty:v1:history` | varianti e categorie già uscite (anti-ripetizione) |
| `jeoparty:v1:flags` | indizi segnalati con 🚩 durante il gioco |

```jsonc
{
  "v": 1,
  "view": "game",              // home | game
  "phase": "board",            // setup | categories | board | wager | clue | final | end
  "options": {
    "mode": "turn",            // "turn" = A turno, "race" = Gara
    "steal": false,            // Rubata (solo in "A turno")
    "penalty": true,           // Penalità per risposta sbagliata
    "timer": { "enabled": true, "seconds": 30 },
    "dailyDoubles": 1, "final": true, "onlyVerified": false
  },
  "teams": [{ "id": "t1", "name": "Squadra 1", "color": "#E69F00", "score": 400 }],
  "turn": "t1",                // squadra di turno: sceglie la tessera (in "A turno" risponde anche)
  "board": {
    "categories": [{ "id": "violetta", "name": "Violetta", "emoji": "💜" }],
    "cells": [[{ "value": 200, "clue": "…", "answer": "…", "key": "violetta:200:1",
                 "dd": false, "used": true, "takenBy": "t1", "results": { "t1": "correct" } }]]
  },
  "current": { "col": 0, "row": 2, "owner": "t1", "stage": "owner",
               "revealed": false, "resolved": false, "wager": null, "results": {} },
  "final": null,
  "undo": []                   // ultimi 30 stati, per Annulla
}
```

Il testo degli indizi pescati viene copiato nello stato: la partita si riprende identica anche se nel frattempo i JSON cambiano.

---

## 4. Catalogo categorie

**Totale: 47 categorie** (24 Classiche, 5 Custom, 18 Inventate). Minimo 495 varianti: 3 per livello nelle Custom (75), 2 per livello nelle altre (420).

### 4.1 Fonti per le Classiche

Ho avuto accesso al web: ricerche e consultazioni fatte il 10/10/2026 con WebSearch/WebFetch. Da ogni fonte ho preso **solo nomi e temi delle categorie** (più le regole di gioco da F4), **nessun indizio**.

| Rif. | Fonte | Cosa ne ho preso |
|---|---|---|
| F1 | Fox News, ["Jeopardy's top 10 most common categories"](https://www.foxnews.com/entertainment/jeopardys-top-10-most-common-categories): analisi di Patrick Tullao su tutte le puntate 1984–2012; stessa classifica su [CinemaBlend](https://www.cinemablend.com/television/10-Most-Common-Jeopardy-Categories-70856.html) | Top 10: Before & After (547 apparizioni), Science, Literature, American History, Potpourri, World History, Word Origins, Colleges & Universities, History, Sports (342) |
| F2 | Slate, J. Singer-Vine (2011), ["Jeopardy! trivia: the most common categories… Plus: where to find the Daily Doubles"](https://www.slate.com/articles/arts/culturebox/2011/02/ill_take_jeopardy_trivia_for_200_alex.html), su dati J! Archive (~3.400 puntate) | Categorie frequenti nel primo round: Stupid Answers, Nature, Hodgepodge, Science, State Capitals. Posizione dei Daily Double: 92% nelle tre righe più basse, la cella più frequente è nella quarta riga |
| F3 | TriviaBliss, ["32 Real Jeopardy! Categories and How They Work"](https://triviabliss.com/jeopardy-categories/) | Formati ricorrenti (Before & After, Rhyme Time, Stupid Answers, Common Bonds…) e temi da studiare secondo Ken Jennings: Shakespeare, World Capitals, Potent Potables |
| F4 | Wikipedia, ["Jeopardy!"](https://en.wikipedia.org/wiki/Jeopardy!) | Regole di Daily Double, Final Jeopardy! e controllo del tabellone (nessuna categoria) |
| CG | Conoscenza generale, non da fonte | Mythology, Opera, World Geography / Bodies of Water / Islands, The Body Human, Movies |

J! Archive (j-archive.com) è la fonte primaria dei dati di F2: non l'ho consultato direttamente.
*Prima & Dopo* (Before & After, la n. 1 in assoluto) e *Corpo umano* (The Body Human) sono categorie classiche del programma: per questo stanno tra le Classiche.

### 4.2 Classiche (24): 22 adattate al pubblico italiano + 2 fedeli all'originale

| id | Nome | Emoji | Descrizione | Ispirata a | Fonte |
|---|---|---|---|---|---|
| `prima-e-dopo` | Prima & Dopo | 🔗 | Due titoli o frasi fusi: la fine del primo è l'inizio del secondo. | Before & After | F1 n.1, F3 |
| `scienza` | Scienza | 🔬 | Chimica, fisica e biologia: i fondamentali e qualche trabocchetto. | Science | F1 n.2, F2 |
| `letteratura` | Letteratura | 📚 | Romanzi, poeti e personaggi, italiani e stranieri. | Literature | F1 n.3 |
| `storia-italia` | Storia d'Italia | 📜 | Dall'Unità alla Repubblica: date, volti e svolte. | American History (adattata) | F1 n.4 |
| `storia-americana` | Storia americana | 🗽 | Presidenti, guerre e svolte degli Stati Uniti. | American History (fedele) | F1 n.4 |
| `minestrone` | Minestrone | 🍲 | Un po' di tutto, senza un tema preciso. | Potpourri / Hodgepodge | F1 n.5, F2 |
| `storia-mondo` | Storia del mondo | ⏳ | Imperi, rivoluzioni e guerre che hanno cambiato tutto. | World History / History | F1 n.6 e n.9 |
| `etimologie` | Etimologie | 🔤 | Da dove vengono le parole che usiamo ogni giorno. | Word Origins | F1 n.7 |
| `universita` | Università | 🎓 | Atenei storici, lauree, CFU ed Erasmus. | Colleges & Universities (adattata) | F1 n.8 |
| `sport` | Sport | 🏅 | Campioni, record e regole: calcio e non solo. | Sports | F1 n.10 |
| `domande-stupide` | Domande stupide | 🤡 | La risposta è già nell'indizio… se te ne accorgi. | Stupid Answers | F2, F3 |
| `animali-natura` | Animali & natura | 🦁 | Record, stranezze e abitudini di animali e piante. | Nature / Animals | F2, CG |
| `regioni` | Regioni & capoluoghi | 📍 | L'Italia regione per regione. | State Capitals (adattata) | F2 |
| `capitali-usa` | Capitali degli Stati USA | 🏙️ | Le capitali dei 50 Stati: spesso non sono le città più famose. | State Capitals (fedele) | F2 |
| `capitali` | Capitali del mondo | 🌍 | Dalle più facili alle impossibili. | World Capitals | F3 |
| `brindisi` | Brindisi! | 🍷 | Vini, cocktail e liquori, in versione italiana. | Potent Potables | F3 |
| `shakespeare` | Shakespeare all'italiana | 🪶 | Il Bardo e le sue opere ambientate in Italia. | Shakespeare | F3 |
| `fa-rima` | Fa rima con… | 🎶 | Ogni risposta è una coppia di parole in rima. | Rhyme Time | F3 |
| `in-comune` | Cos'hanno in comune? | 🤝 | Tre elementi, un solo filo che li lega. | Common Bonds | F3 |
| `geografia` | Geografia del mondo | 🗺️ | Paesi, confini, fiumi, isole e montagne. | World Geography / Bodies of Water / Islands | CG |
| `mitologia` | Mitologia | 🏛️ | Dei, eroi e mostri greci, romani e nordici. | Mythology | CG |
| `opera-lirica` | Opera lirica | 🎭 | Verdi, Puccini, Rossini e i loro personaggi. | Opera | CG |
| `corpo-umano` | Corpo umano & medicina | 🫀 | Ossa, organi e grandi scoperte mediche. | The Body Human | CG |
| `cinema` | Cinema | 🎬 | Film, registi e Oscar, da Fellini a Nolan. | Movies | CG |

### 4.3 Custom (5): obbligatorie, almeno 3 varianti per livello

| id | Nome | Emoji | Descrizione |
|---|---|---|---|
| `violetta` | Violetta | 💜 | La telenovela musicale argentina di Disney Channel (2012–2015). |
| `high-school-musical` | High School Musical | 🏀 | La saga Disney Channel dei Wildcats della East High. |
| `trap-italiana` | Trap italiana | 🔥 | Artisti, album, featuring e record della scena trap italiana. |
| `ai` | AI | 🤖 | Intelligenza artificiale: da Turing a ChatGPT, con date precise. |
| `trash-italiano` | Trash italiano | 🗑️ | Il meglio del peggio della TV e del web italiani. |

### 4.4 Inventate (18)

| id | Nome | Emoji | Descrizione |
|---|---|---|---|
| `meme` | Meme & internet | 😂 | Meme storici, video virali e leggende del web. |
| `cartoni-2000` | Cartoni anni 2000 | 🧚 | Winx, W.I.T.C.H., SpongeBob & co.: l'infanzia davanti alla TV. |
| `anime-manga` | Anime & manga | 🍥 | Dragon Ball, One Piece, Naruto, Pokémon e le loro sigle italiane. |
| `sanremo` | Sanremo | 🌺 | Vincitori, gaffe e momenti iconici del Festival. |
| `tormentoni` | Tormentoni estivi | 🏖️ | Le hit dell'estate dagli anni 2000 a oggi: titoli e artisti. |
| `videogiochi` | Videogiochi | 🎮 | Console, personaggi e titoli leggendari. |
| `disney-pixar` | Disney & Pixar | 🏰 | Classici, principesse, cattivi e film d'animazione. |
| `harry-potter` | Harry Potter | ⚡ | Case, incantesimi, creature e retroscena del mondo magico. |
| `serie-tv` | Serie TV | 🍿 | Da Friends a Mare Fuori: binge-watching certificato. |
| `reality-talent` | Reality & talent | 🎙️ | X Factor, Amici, MasterChef, Il Collegio: vincitori e giudici. |
| `roma` | Roma e dintorni | 🛵 | Quartieri, monumenti, romanesco e gite fuori porta. |
| `nomi-d-arte` | Nomi d'arte | 🕶️ | Il vero nome dietro cantanti, rapper e star. |
| `emoji-rebus` | Emoji-rebus | 🧩 | Indovina film, canzoni e proverbi da una fila di emoji. |
| `roba-da-boomer` | Roba da boomer | 📼 | L'Italia dei nostri genitori: lire, Carosello, gettoni. |
| `merendine` | Merendine & snack | 🍫 | Storia e curiosità degli snack della nostra infanzia. |
| `medici-in-tv` | Medici in TV | 🩺 | Dr. House, Grey's Anatomy, Scrubs, Doc: la corsia in serie. |
| `leggende-bufale` | Leggende & bufale | 👽 | Leggende metropolitane, misteri e fake news smontate. |
| `slang` | Slang & neologismi | 🗣️ | Cringe, boomer, petaloso: le parole nuove dell'italiano. |

Confini tra categorie vicine, per evitare doppioni: *Trash italiano* = momenti e personaggi trash di TV e web; *Reality & talent* = format, vincitori e giudici; *Meme & internet* = cultura web internazionale; *Sanremo* / *Tormentoni* / *Trap* = rispettivamente Festival, hit estive e scena trap; *Storia americana* / *Capitali degli Stati USA* restano fedeli all'originale.

---

## 5. Flusso di gioco e schermate

### 5.1 Flusso

```text
Home ─► Setup ─► Categorie ─► Tabellone ⇄ Indizio
 │                               │   └─► Daily Double: Puntata ─► Indizio
 └─ Riprendi partita ────────────┘
                 tessere finite ─► Gran Finale (se attiva) ─► Fine/podio ─► Rivincita | Nuova | Home
```

### 5.2 Schermate

| Schermata | Cosa mostra | Azioni principali |
|---|---|---|
| Home | titolo; "Riprendi" se c'è una partita salvata | Nuova partita · Riprendi · Regole · Impostazioni (audio, dimensione testo S/M/L, copia segnalazioni, azzera storico) |
| Setup | 2–6 squadre con nome modificabile e colore automatico; opzioni (le ultime usate vengono ricordate) | +/− squadra; **Modo di gioco** (A turno / Gara); Rubata (solo A turno); Penalità per risposta sbagliata; timer on/off e durata; numero di Daily Double; Gran Finale; solo verificati; chi inizia; dimensione testo |
| Categorie | 5 slot in alto; griglia di card (emoji, nome, descrizione, ⚠ da verificare) | ricerca (ignora gli accenti: "citta" trova "Città"); filtro per gruppo; clic per aggiungere/togliere; riordino; **🎲 Casuale** (riempie gli slot vuoti dai gruppi spuntati); **🔄** rilancio del singolo slot; *Inizia* solo con esattamente 5 |
| Tabellone | 5 colonne × 5 valori, intestazioni con emoji; barra punteggi con "🎯 Tocca a: Squadra X" | apri tessera (clic oppure frecce + Invio); clic su una squadra = diventa di turno; menu ⚙: annulla, correggi punteggi, rinomina, vai al Gran Finale, termina, Home |
| Indizio | a tutto schermo: categoria, valore, descrizione (utile per i formati speciali), testo grande, barra del timer | Mostra risposta; ✓/✗ delle squadre che possono rispondere; Nessuno/Salta; 🚩 segnala; torna al tabellone |
| Puntata | squadra che gioca, limiti minimo/massimo | importo + tasti rapidi; conferma |
| Gran Finale | categoria → puntate nascoste → indizio con musica originale → rivelazione | vedi 5.3 |
| Fine | podio (con pari merito), classifica completa, coriandoli | Rivincita (stesse squadre) · Nuova partita · Home |

### 5.3 Regole e logica

**Modo di gioco** (Setup; nello stato `options.mode` e `options.steal`)
- **A turno (una domanda a testa)**, default. L'ordine è quello delle squadre nel Setup; la prima è casuale oppure scelta dal conduttore. La squadra di turno sceglie la tessera e risponde **da sola**: a schermo ci sono solo i suoi ✓/✗ (più Nessuno/Salta). Chiusa la tessera, il turno passa **sempre** alla squadra successiva, qualunque sia l'esito. Il timer vale per la squadra che risponde.
- **Rubata** (solo in "A turno", default off): se la squadra di turno sbaglia, possono provare le altre a partire dalla successiva; la prima ✓ prende i punti, le ✗ seguono la regola della penalità; il turno passa comunque alla successiva in ordine. Non vale per il Daily Double.
- **Gara (stile TV: chi risponde bene sceglie)**. Tutti possono prenotarsi (mano alzata o colpo sul tavolo) e il conduttore decide chi è arrivato prima. Chi risponde bene sceglie la prossima tessera; se nessuno indovina, sceglie di nuovo chi aveva scelto (F4).
- In entrambe: la barra dei punteggi evidenzia la squadra di turno ("🎯 Tocca a: …"); il conduttore la cambia cliccando sul nome; Annulla ripristina anche il turno; le scorciatoie 1–6 / Shift+1–6 valgono per le squadre che in quel momento possono rispondere.

**Indizio e punteggi**
- ✓ = +valore: chiude la tessera e mostra la risposta.
- ✗ con **Penalità per risposta sbagliata** attiva (default) = −valore, anche sotto zero. Con penalità disattivata ✗ vale 0, la squadra resta esclusa da quell'indizio e nessun punteggio scende mai sotto zero.
- In Gara, se sbagliano tutte la risposta si rivela da sola. *Nessuno/Salta* = nessuna variazione. *Mostra risposta* è sempre disponibile.
- La forma di domanda è facoltativa: vale anche solo il nome.
- La tessera usata si oscura, con un pallino del colore di chi l'ha presa. Errori del conduttore: *Annulla* (Ctrl+Z, fino a 30 passi) e correzione manuale dei punteggi.

**Daily Double**
- Quanti: 1 (impostabile da 0 a 2). Vengono piazzati a inizio partita e salvati nello stato, così un refresh non li sposta; restano invisibili finché non vengono scelti.
- Dove: mai nella riga da 200. Pesi per riga: 400 → 8%, 600 → 27%, 800 → 40%, 1000 → 25%. In TV il 92% cade nelle tre righe più basse e la riga più frequente è la quarta (F2). Con 2 Daily Double, colonne diverse.
- Gioca solo la squadra di turno, niente rubata. Puntata minima 5, massima = il maggiore tra il proprio punteggio e 1000 (F4). Tasti rapidi: 500, metà, "Tutto o niente".
- Esito sempre a rischio, anche senza penalità: ✓ +puntata, ✗ −puntata (senza penalità il punteggio si ferma a zero).
- Dopo: in "A turno" il turno passa alla successiva (conta come la sua tessera); in "Gara" sceglie di nuovo la stessa squadra.

**Timer**
- On/off nel Setup; durata 5–60 s, default 30 s, la stessa per indizi e Gran Finale.
- Parte da solo all'apertura dell'indizio (e riparte per la rubata); T lo mette in pausa e lo riprende. Negli ultimi 5 s fa tic; allo zero suona "tempo scaduto" e la barra diventa rossa.
- Non assegna punti da solo: decide sempre il conduttore. Dopo un refresh riparte da capo.

**Gran Finale** (attiva di default, disattivabile)
- Categoria casuale fra quelle non presenti sul tabellone (il conduttore può rilanciarla una volta prima di mostrare l'indizio); si usa una variante da 1000. Nessun contenuto extra.
- Giocano solo le squadre con punteggio > 0; se non ce n'è nessuna si va direttamente alla fine.
- Per ogni squadra il conduttore digita la puntata (da 0 al punteggio) in un campo mascherato mentre le altre non guardano, oppure la squadra la scrive su carta → indizio con 30 s e musica originale, risposte scritte su carta → rivelazione dalla squadra con meno punti fino alla prima: ✓/✗ ± puntata → classifica finale.
- In caso di pareggio si mostrano i pari merito (niente spareggio).
- Si può passare al Gran Finale prima di finire il tabellone (menu ⚙).

**Persistenza**
- Salvataggio a ogni azione in `jeoparty:v1:game` (vedi 3.5). Un refresh riporta esattamente alla stessa schermata.
- Dalla Home, se c'è una partita in corso: *Riprendi* oppure *Nuova* (con conferma prima di sovrascrivere).
- Stato corrotto o di una versione vecchia: reset con messaggio e copia di backup in `jeoparty:v1:game:backup`.
- Attenzione: `localStorage` è legato all'origine, e `http://localhost:3456`, `http://localhost:3457` e `http://127.0.0.1:3456` sono tre origini diverse. Per questo la porta resta fissa e il server riapre l'istanza già attiva (§6).
- Rigiocabilità: lo storico privilegia varianti e categorie mai uscite. Quando finiscono, ricomincia il giro.

### 5.4 Scorciatoie da tastiera

Sono ignorate mentre si scrive in un campo. Usano `event.code`, quindi Shift+1 funziona anche con la tastiera italiana (che con Shift produce `!`). Le cifre valgono solo per le squadre che in quel momento possono rispondere (in "A turno" di solito solo quella di turno).

| Tasto | Contesto | Azione |
|---|---|---|
| Frecce, Invio | Tabellone | sposta la selezione, apre la tessera |
| Spazio | Indizio | mostra la risposta |
| 1…6 | Indizio | ✓ squadra 1…6 |
| Shift + 1…6 | Indizio | ✗ squadra 1…6 |
| 0 oppure N | Indizio | Nessuno/Salta |
| T | Indizio | mette in pausa o riprende il timer |
| Invio / Esc | Indizio concluso | torna al tabellone |
| F | ovunque | schermo intero |
| M | ovunque | audio on/off |
| Ctrl+Z (oppure U) | ovunque | annulla l'ultima azione |
| ? | ovunque | guida alle scorciatoie |

### 5.5 TV, grafica e accessibilità
- Layout 16:9 con misure in `vw`/`vh` e `clamp()`; testo dell'indizio intorno al 5% della larghezza; margini di sicurezza contro l'overscan delle TV.
- **Dimensione testo S/M/L:** tre pulsanti nelle Impostazioni e nel Setup; variabile CSS `--scala` sul root, salvata in `jeoparty:v1:settings`. Il ridimensionamento con `vw`/`clamp()` resta.
- Grafica originale: tabellone blu notte, valori dorati, testo bianco, font di sistema (Segoe UI, Arial Black). Nessun font, logo o elemento grafico del programma.
- Colori delle squadre dalla palette Okabe-Ito (distinguibili anche da chi è daltonico), con il nome sempre visibile accanto al colore. Contrasto ≥ 7:1 per il testo degli indizi; `prefers-reduced-motion` rispettato; focus sempre visibile.
- Schermo intero con la Fullscreen API (tasto F o pulsante, perché serve un gesto dell'utente). Screen Wake Lock per evitare che lo schermo vada in standby durante la partita.
- I testi dei JSON vengono inseriti con `textContent`, mai con `innerHTML`.

### 5.6 Audio (Web Audio, tutto sintetizzato)
Selezione tessera (blip), rivelazione (glissando), risposta giusta (arpeggio maggiore), sbagliata (ronzio grave), tic e tempo scaduto, fanfara originale per il Daily Double, loop d'attesa originale per il Gran Finale (non ispirato alla musica del programma), applausi finali (rumore filtrato). Volume e muto vengono salvati. L'AudioContext si attiva al primo clic, come impongono le regole sull'autoplay dei browser.

---

## 6. Avvio in localhost

**Prerequisiti:** Windows 11; Edge o Chrome aggiornati; Node.js LTS ≥ 20 (installato: v24). Nessun `npm install`: il progetto non ha dipendenze.

**Comandi** (dalla cartella del progetto)

```powershell
npm start                          # porta 3456, apre il browser su http://localhost:3456
node server/server.js --port 4000  # porta diversa (funziona uguale in PowerShell e cmd)
$env:PORT = 4000; npm start        # porta tramite variabile d'ambiente (PowerShell)
set "PORT=4000" & npm start        # idem in cmd (le virgolette evitano lo spazio finale)
node server/server.js --no-open    # non aprire il browser
npm run validate                   # controlla i contenuti e rigenera data/index.json
npm test                           # test automatici (node --test)
```

In alternativa: **doppio clic su `start.bat`**, che accetta gli stessi argomenti (`start.bat --port 4000`). Per fermare il server: Ctrl+C nella finestra.

**Comportamento del server**

| Aspetto | Comportamento |
|---|---|
| Porta | `--port`, poi `PORT`, poi 3456 (valori ammessi 1024–65535) |
| Interfacce | solo 127.0.0.1 (più ::1 se disponibile): niente Firewall, niente rete |
| Porta occupata da Jeoparty | rilevata con `GET /__jeoparty`: non avvia un doppione, apre solo il browser |
| Porta occupata da altro, o riservata da Windows (EADDRINUSE/EACCES) | prova 3457…3466 e avvisa che la partita salvata resta legata alla porta 3456 |
| Rotte | `/` → `public/`; `/data/*` → `data/` (solo `.json`); `/__jeoparty` → stato; tutto il resto 404 |
| Header | `Cache-Control: no-store` (una modifica ai JSON si vede con un refresh); `Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'` (nessuna risorsa esterna, nessuno script inline); `X-Content-Type-Options: nosniff` |
| Sicurezza | solo GET/HEAD; URL decodificati in modo sicuro; blocco di `..`, `\`, byte nulli e file nascosti; il percorso risolto deve restare dentro la radice |
| All'avvio | rigenera `data/index.json` se è cambiato, stampa URL e numero di categorie (e avvisa se qualcuna è esclusa per errori) |
| Browser | `start "" "http://localhost:PORTA"` su Windows (`open`/`xdg-open` altrove); `--no-open` o `JEOPARTY_NO_OPEN=1` per disattivarlo |

**`start.bat`**: solo ASCII (niente lettere accentate nei messaggi) e fine riga CRLF, verificati sui byte. Controlla che `node` esista e sia ≥ 20, poi esegue `node server\server.js %*`; in caso di errore resta aperto con `pause`.

**Risoluzione dei problemi**

| Sintomo | Causa probabile | Soluzione |
|---|---|---|
| "Node.js non è installato" | Node assente, oppure PATH non aggiornato | `winget install OpenJS.NodeJS.LTS`, poi riapri il terminale o Esplora file |
| PowerShell: "impossibile caricare il file npm.ps1… l'esecuzione di script è disabilitata" | ExecutionPolicy predefinita di Windows | usa `start.bat`, `npm.cmd start` o `node server/server.js`, oppure `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| In PowerShell `npm start -- --port 4000` ignora la porta | il wrapper `npm.ps1` può perdere il `--` | usa `node server/server.js --port 4000` oppure `$env:PORT` |
| "Porta 3456 occupata" | un altro programma | lascia lavorare il fallback, o usa `--port`; per trovare il colpevole: `netstat -ano \| findstr :3456` |
| EACCES sulla porta | porte riservate da Hyper-V/WSL/Docker | `netsh interface ipv4 show excludedportrange protocol=tcp`, poi scegli una porta fuori da quegli intervalli |
| Pagina bianca o errore sui moduli | pagina aperta come `file://`, o cache | apri l'URL `http://localhost:…` stampato dal server; Ctrl+F5; F12 → Console |
| La partita salvata "è sparita" | porta o host diversi (= origine diversa) | riapri esattamente lo stesso URL (stessa porta) |
| Nessun suono | autoplay bloccato fino al primo clic, oppure muto | clicca nella pagina; tasto M; volume di Windows |
| Lo schermo intero non parte | il browser richiede un gesto dell'utente | premi F o il pulsante |
| `start.bat` bloccato da SmartScreen | file estratto da uno zip scaricato | Proprietà → Sblocca, oppure usa `npm start` |
| Offline non parte, file mancanti | file di OneDrive "solo online" | sulla cartella: *Mantieni sempre su questo dispositivo* |
| Bordi tagliati sulla TV | overscan | sulla TV "Adatta allo schermo" o "Just scan"; l'app ha già margini di sicurezza |

---

## 7. Contenuto di INSTRUCTIONS.md

≤ 15 righe: requisiti, avvio, come si gioca (con le due modalità, rubata e penalità), tasti principali, come aggiungere una categoria. Il testo definitivo è nel file `INSTRUCTIONS.md`.

---

## 8. Licenza, README e proprietà intellettuale

**Licenza**
- Testo definitivo in [Appendice A](#appendice-a--testo-di-license) e nel file `LICENSE`: italiano più traduzione inglese fedele, titolare `Lorenzo Corso (prontoSoCorso)`.
- In `package.json`: `"license": "SEE LICENSE IN LICENSE"` e `"private": true`, per evitare pubblicazioni accidentali su npm.
- È una licenza *source-available*, non open source. Se il repository GitHub è pubblico, i Termini di servizio di GitHub permettono comunque agli altri utenti di visualizzarlo e di farne il fork sulla piattaforma; la licenza vieta tutto il resto. (Nota informativa, non consulenza legale.)

**README brevissimo** (max ~20 righe): titolo e una riga di descrizione; avvio rapido in 3 comandi; rimando a `INSTRUCTIONS.md`; una riga sulla licenza; disclaimer sul marchio in italiano e in inglese (una frase ciascuno). Niente screenshot né sezioni lunghe.

**Proprietà intellettuale: regole del progetto**
- Nessun logo, font (Korinna, Swiss 911), musica (compreso il tema *Think!*), effetto sonoro o elemento grafico ufficiale. Un tabellone blu generico va bene.
- "Gran Finale" al posto di "Final Jeopardy!" (che è un marchio). "Daily Double" resta: è un termine generico, nato nelle scommesse ippiche.
- Indizi originali; dalle fonti solo nomi e temi delle categorie.
- Niente testi di canzoni o di libri; titoli, nomi e date sì.
- Nome "Jeoparty" confermato, anche a schermo, accompagnato dal disclaimer.

---

## 9. Fasi di implementazione e test

| # | Milestone | Contenuto | Criterio di accettazione | Stato |
|---|---|---|---|---|
| M0 | Fondamenta | `package.json`, server (statico, porta, istanza unica, browser), `start.bat`, `.gitignore`/`.gitattributes`/`.editorconfig`, LICENSE, README e bozza di INSTRUCTIONS, pagina vuota | `npm start` e il doppio clic su `start.bat` aprono http://localhost:3456; un secondo avvio riusa la stessa istanza; con la porta occupata scatta il fallback con avviso; senza Node compare un messaggio chiaro; `/../package.json` e le sue varianti codificate danno 404; nessuna `node_modules` | ✅ |
| M1 | Dati e validazione | schema, `_template.json`, `catalog.js`, `validate.js`, indice generato, test con fixture, **6 categorie complete** (le 5 Custom con ≥ 3 varianti per livello + 1 Classica) | `npm run validate` passa sui dati reali e fallisce su ogni fixture indicando file, livello e variante; `npm test` passa | ✅ |
| M2 | Setup e scelta categorie | Home, Setup (modo di gioco, rubata, penalità, opzioni ricordate, dimensione testo), Categorie (manuale, 🎲, 🔄) | impossibile iniziare con un numero di categorie diverso da 5; il rilancio non crea mai doppioni; "citta" trova "Città…"; il filtro per gruppo vale anche per il casuale | ⏳ |
| M3 | Gioco base | tabellone, indizio, ✓/✗/Nessuno, modi A turno (con rubata) e Gara, penalità on/off, cambio manuale del turno, annulla, correzione, salvataggio e ripresa, scorciatoie, schermo intero, fine partita semplice | una partita completa di 25 tessere si gioca **solo da tastiera in entrambe le modalità** (A turno e Gara); un refresh in qualunque momento (anche a indizio aperto) ripristina lo stato identico; Annulla ripristina punti, tessera e turno | ⏳ |
| M4 | Daily Double, timer, audio | piazzamento pesato, puntata, timer configurabile, suoni, Wake Lock | mai un Daily Double nella riga da 200; limiti di puntata rispettati (con punteggio negativo il massimo è 1000); dopo il Daily Double il turno segue la regola della modalità; timer automatico, on/off e pausa; il muto resta salvato | ⏳ |
| M5 | Gran Finale e fine partita | flusso del finale, puntate mascherate, podio con pari merito, rivincita, 🚩 segnalazioni con "Copia segnalazioni" | squadre a ≤ 0 escluse; puntate tra 0 e il punteggio; classifica corretta con pari merito; la rivincita tiene le squadre, azzera i punti e pesca varianti nuove; "Copia segnalazioni" copia id, categoria e testo | ⏳ |
| M6 | Contenuti completi, in lotti | C1 Custom (in M1), C2 Inventate (18), C3 Classiche (24); verifica dei fatti sul web, obbligatoria per le categorie di nicchia | 47 categorie; Custom 5 livelli × ≥ 3 varianti, le altre × ≥ 2; `validate` senza errori; `docs/DA-VERIFICARE.md` generato | ⏳ |
| M7 | Rifinitura | contrasto e dimensioni, README/INSTRUCTIONS/docs definitivi, elenco di ciò che non ho potuto provare | checklist manuale pronta; le prove su TV vera e Lighthouse restano a te | ⏳ |

M6 può procedere in parallelo da M1 in poi, perché lo schema è già fissato. A fine milestone: `npm test`, `npm run validate`, prova reale del server via HTTP e commit locale.

**Test automatici** (`npm test`): `rules` (A turno: ordine di rotazione e passaggio del turno dopo ✓/✗/Salta; rubata; Gara; penalità on/off; Daily Double in entrambe le modalità e limiti di puntata; annulla del turno; Gran Finale; classifica con pari merito), `content` (pesca senza ripetizioni, ripartenza quando le varianti finiscono, filtro "solo verificati", casuale e rilancio senza doppioni, ricerca senza accenti, pesi dei Daily Double con seme fisso), `validate` (una fixture per ogni tipo di errore), `static` (path traversal).

**Checklist di test manuale** (diventerà `docs/TEST-MANUALE.md`)
- [ ] Doppio clic su `start.bat` dal percorso OneDrive (spazi e accenti); `npm start` da PowerShell e da cmd
- [ ] Senza Node (in una finestra cmd: `set PATH=C:\Windows\System32`, poi `start.bat`): messaggio chiaro
- [ ] Porta occupata da un altro programma: fallback con avviso; secondo avvio di Jeoparty: stessa istanza
- [ ] Wi-Fi spento: tutto funziona; in DevTools → Rete nessuna richiesta esterna
- [ ] Setup con 2 e con 6 squadre; nomi lunghi, con accenti ed emoji; opzioni ricordate alla partita successiva
- [ ] Categorie: ricerca, filtro per gruppo, blocco a 5, riordino, 🎲 con filtro, 🔄 senza doppioni
- [ ] A turno: solo i pulsanti della squadra di turno; il turno passa sempre alla successiva; con Rubata provano le altre
- [ ] Gara: ✓, più ✗ di fila, tutti ✗, Nessuno; chi indovina sceglie
- [ ] Penalità on (punteggio sotto zero) e off (✗ = 0, mai sotto zero)
- [ ] Daily Double nelle due modalità: limiti minimo/massimo, punteggio negativo, esito ±, turno successivo
- [ ] Timer: automatico, on/off, pausa con T, scadenza (suono, nessun punto assegnato in automatico)
- [ ] Refresh e chiusura del browser in ogni schermata: ripresa identica
- [ ] Annulla su più passi (anche il turno); correzione manuale dei punteggi; cambio turno cliccando sul nome
- [ ] Gran Finale: esclusione delle squadre a ≤ 0, puntate mascherate, rivelazione in ordine, classifica, pari merito
- [ ] Fine: podio, Rivincita, Nuova partita
- [ ] 🚩 Segnala e "Copia segnalazioni"; dimensione testo S/M/L
- [ ] TV 1080p a circa 3 m: indizio leggibile, nessun bordo tagliato, schermo che non va in standby
- [ ] Audio: tutti i suoni; muto e volume restano salvati
- [ ] "Solo verificati" esclude le varianti con `verified: false`

---

## 10. Fuori scope, idee future e rischi

**Fuori scope per la v1 (idee future)**

| Idea | Note |
|---|---|
| Spareggio dopo il Gran Finale | in v1 un pareggio mostra i pari merito |
| Esporta/importa partita | in v1 la partita resta legata a browser e porta |
| Vista conduttore su un secondo schermo | esclusa: si usa un solo schermo duplicato. Fattibile con BroadcastChannel o evento `storage`, senza server |
| Buzzer dai telefoni (rete locale) | escluso. Richiederebbe l'ascolto su 0.0.0.0 (avviso del Firewall), una pagina per mobile e un canale in tempo reale (Server-Sent Events + POST) |
| Doppio round | valori 400–2000 e 2 Daily Double, come il "Double Jeopardy!" televisivo |
| Editor delle categorie nel browser | un modulo che genera e scarica il JSON già validato |
| Indizi con immagini o audio | attenzione al copyright: niente estratti di canzoni |
| Statistiche tra partite | squadre e giocatori ricorrenti, record |
| Pacchetti di domande | importare ed esportare set di categorie |
| Temi grafici, interfaccia in inglese | `strings.js` è già predisposto |

**Rischi**

| Rischio | Impatto | Mitigazione |
|---|---|---|
| Fatti errati o invecchiati (soprattutto Trap, Trash, AI, Violetta) | alto | `verified` solo con `source` consultata, date esplicite, `DA-VERIFICARE.md`, 🚩 in gioco, tua revisione |
| Mole dei contenuti (≥ 495 varianti) | alto (tempi) | lotti, priorità alle Custom, template, validatore; si gioca già con le 6 categorie di M1 |
| Copyright (testi, citazioni) | medio | regola "solo titoli, nomi e date"; avviso del validatore sulle citazioni lunghe |
| Marchio "Jeopardy!" e nome del progetto | medio | disclaimer, nessun asset ufficiale, "Gran Finale" |
| Partita "persa" cambiando porta o host | medio | porta fissa e istanza unica |
| OneDrive: file solo online, conflitti su `.git` se usato da più PC | medio | *Mantieni sempre su questo dispositivo*; lavorare da un solo PC |
| PowerShell blocca `npm.ps1` | basso | `start.bat`, `npm.cmd`, `node …` diretto, istruzioni nel troubleshooting |
| Regole dei browser su audio e schermo intero | basso | attivazione al primo gesto, messaggi chiari |
| Leggibilità sulla TV | medio | testo S/M/L, margini contro l'overscan; prova reale a tuo carico |
| Emoji non supportate su Windows (bandiere) | basso | niente bandiere; avviso del validatore |
| Contenuti "trash" offensivi o diffamatori | medio | linee guida: solo fatti pubblici documentati, tono affettuoso, niente persone private o minori |

---

## 11. Decisioni prese

Risposte alle domande aperte della Fase 1 e modifiche richieste dopo la revisione (prevalgono sul resto del piano).

1. **Licenza:** `Copyright (c) 2026 Lorenzo Corso (prontoSoCorso)` in italiano e in inglese; resto del testo identico.
2. **Nome e porta:** "Jeoparty" confermato, anche a schermo; porta 3456.
3. **Gran Finale:** inclusa, attiva di default e disattivabile; squadre con punteggio ≤ 0 escluse; niente spareggio (pari merito).
4. **Un solo schermo** (PC duplicato sulla TV): niente vista conduttore, niente buzzer in rete.
5. **Forma di domanda** sempre facoltativa, senza impostazione.
6. **Timer** automatico all'apertura dell'indizio; default 30 s (indizi e Gran Finale), range 5–60 s, on/off nel Setup, pausa con T.
7. **Catalogo** approvato (tono adulto ok, sempre fatti pubblici e documentati) + `storia-americana` e `capitali-usa`: 47 categorie.
8. **`.gitignore`** breve: `node_modules`, log, file di sistema Windows/OneDrive, `.vscode/`, `docs/DA-VERIFICARE.md`.
9. **Penalità per risposta sbagliata** (Setup, on di default, ultime opzioni ricordate): se off, ✗ non toglie punti, la squadra resta esclusa dall'indizio e nessun punteggio scende sotto zero; Daily Double e Gran Finale restano a rischio.
10. **Fuori dalla v1:** spareggio ed esporta/importa partita.
11. **Segnalazioni 🚩:** nelle Impostazioni il pulsante "Copia segnalazioni" copia negli appunti id, categoria e testo delle varianti segnalate.
12. **CSP:** `default-src 'self'; style-src 'self' 'unsafe-inline'`; nessuno script inline.
13. **`verified`:** `true` solo con fonte consultata davvero e URL reale in `source`; il validatore avvisa se manca.
14. **Varianti:** almeno 3 per livello nelle Custom, almeno 2 nelle altre.
15. **README e docs brevissimi** (README ~20 righe, docs ~40 righe ciascuno).
16. **Modo di gioco:** "A turno" (default, con Rubata facoltativa) e "Gara", come descritto in §5.3.
17. **Dimensione testo S/M/L:** pulsanti in Impostazioni e Setup, variabile `--scala`, salvata nelle impostazioni.

---

## 12. Decisioni in corso d'opera

Scelte prese durante lo sviluppo, quando un requisito era ambiguo (si è scelta la soluzione più semplice).

- **Node nel PATH:** Node è installato, ma la sessione di VS Code aperta prima dell'installazione non lo vede; in sviluppo ho usato `C:\Program Files\nodejs` direttamente. Per te basta riaprire il terminale.
- **Niente router a hash:** la schermata deriva dallo stato salvato (`view` + `phase`); un refresh riporta sempre lì.
- **Rubata:** dopo l'errore della squadra di turno si attivano i pulsanti di tutte le altre, mostrati in ordine a partire dalla successiva; il conduttore dà la parola in quell'ordine. Il timer riparte per la rubata.
- **Penalità off:** il limite "mai sotto zero" vale per ogni variazione, Daily Double e Gran Finale compresi (che restano comunque a rischio fino a zero).
- **Custom con meno di 3 varianti:** avviso del validatore (non errore), così una nuova categoria personale con 2 varianti resta giocabile; i test verificano che le 5 Custom fornite ne abbiano almeno 3.
- **Timer:** un'unica durata per indizi e Gran Finale; dopo un refresh riparte da capo.

---

## Appendice A — Testo di LICENSE

```text
Copyright (c) 2026 Lorenzo Corso (prontoSoCorso)

Tutti i diritti riservati.

Il codice sorgente e i contenuti (inclusa la banca di domande) presenti in questo repository sono accessibili pubblicamente esclusivamente a scopo di consultazione, studio personale e recensione.

SENZA IL PREVIO CONSENSO SCRITTO DELL'AUTORE, È SEVERAMENTE VIETATO:
1. Copiare, modificare o ridistribuire il codice e i contenuti (in parte o nella loro interezza).
2. Utilizzare il software, o sue parti derivate, per scopi commerciali o di lucro.
3. Vendere, noleggiare o concedere in licenza il software a terzi.

Il software viene fornito "così com'è", senza garanzie di alcun tipo.

---

English translation

Copyright (c) 2026 Lorenzo Corso (prontoSoCorso)

All rights reserved.

The source code and the content (including the question bank) in this repository are publicly accessible solely for the purposes of consultation, personal study and review.

WITHOUT THE AUTHOR'S PRIOR WRITTEN CONSENT, IT IS STRICTLY PROHIBITED TO:
1. Copy, modify or redistribute the code and the content (in part or in their entirety).
2. Use the software, or parts derived from it, for commercial or profit-making purposes.
3. Sell, rent or license the software to third parties.

The software is provided "as is", without warranties of any kind.
```
