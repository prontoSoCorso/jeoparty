# Prova manuale prima di una serata

Le parti marcate ★ non le ho potute provare io: richiedono la TV, l'audio o Windows "dal vivo".

## Avvio
- [ ] ★ Doppio clic su `start.bat` dalla cartella OneDrive: si apre http://localhost:3456
- [ ] `npm start` da PowerShell e da cmd; un secondo avvio riapre la stessa istanza
- [ ] ★ Wi-Fi spento: tutto funziona (F12 → Rete: nessuna richiesta esterna)
- [ ] ★ Edge oltre a Chrome

## Partita
- [ ] Setup con 2 e con 6 squadre, nomi con accenti ed emoji; opzioni ricordate la volta dopo
- [ ] Categorie: ricerca, filtri, 🎲 Casuale, 🔄 rilancio, Inizia solo con 5
- [ ] A turno: risponde solo la squadra di turno; con Rubata provano le altre; il turno passa sempre
- [ ] Gara: chi indovina sceglie; se sbagliano tutti si vede la risposta
- [ ] Penalità sì (punteggio sotto zero) e no (✗ = 0, mai sotto zero)
- [ ] Daily Double nelle due modalità: limiti della puntata, esito ±, turno dopo
- [ ] Timer: parte da solo, T pausa, tic negli ultimi 5 s, a zero nessun punto automatico
- [ ] Ctrl+Z su più passi (anche il turno); correzione dei punteggi; clic sul nome = cambio turno
- [ ] Refresh (F5) in ogni schermata: si riprende identica
- [ ] Gran Finale: esclusi i ≤ 0, puntate a puntini o su carta, rivelazione dal punteggio più basso
- [ ] Fine: podio con pari merito, Rivincita, Nuova partita
- [ ] 🚩 Segnala e Impostazioni → Copia segnalazioni; dimensione testo S/M/L

## TV e audio
- [ ] ★ TV 1080p da circa 3 m: indizio leggibile, niente bordi tagliati (overscan), testo S/M/L
- [ ] ★ Schermo intero con F; lo schermo non va in standby durante la partita
- [ ] ★ Suoni: tessera, giusta, sbagliata, tic, tempo scaduto, fanfara del Daily Double, musica del finale, applausi
- [ ] ★ Muto (M) e volume restano salvati dopo un refresh

## Contenuti
- [ ] `npm run validate` senza errori
- [ ] Ripasso di `docs/DA-VERIFICARE.md` (`node scripts/validate.js --report`)
- [ ] "Solo indizi verificati" esclude le varianti `verified: false`
