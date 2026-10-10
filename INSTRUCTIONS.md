# Jeoparty — istruzioni rapide

**Requisiti:** Windows 11, Edge o Chrome, Node.js LTS ≥ 20 (`winget install OpenJS.NodeJS.LTS`).
**Avvio:** doppio clic su `start.bat` (oppure `npm start`): si apre http://localhost:3456. Per chiudere: Ctrl+C nella finestra nera.
**Come si gioca**
1. Nuova partita → squadre (2–6), modo di gioco e opzioni → 5 categorie (a mano o 🎲 Casuale) → Inizia.
2. **A turno** (default): ogni squadra sceglie una tessera e risponde da sola, poi tocca alla successiva. Con **Rubata**, se sbaglia possono provare le altre.
3. **Gara**: tutti si prenotano alzando la mano; chi risponde bene sceglie la prossima tessera.
4. ✓ = +punti; ✗ = −punti se la penalità è attiva (altrimenti 0). Vale anche rispondere solo col nome.
5. Daily Double: gioca solo la squadra di turno, puntando. Finite le tessere: Gran Finale con puntate segrete (giocano le squadre sopra zero).
6. Tasti: F schermo intero · Spazio risposta · 1–6 ✓ · Shift+1–6 ✗ · 0 nessuno · T timer · Ctrl+Z annulla · ? aiuto.

**Aggiungere una categoria:** copia `data/categories/_template.json` in `data/categories/<id>.json` (id minuscolo-con-trattini), compila 5 livelli con almeno 2 varianti, esegui `npm run validate` e ricarica la pagina.
