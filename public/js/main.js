// Avvio dell'app (segnaposto di M0: le schermate arrivano da M2).
const app = document.getElementById('app');
const box = document.createElement('div');
box.className = 'placeholder';
const title = document.createElement('h1');
title.textContent = 'Jeoparty';
const text = document.createElement('p');
text.textContent = 'Il server funziona. Le schermate di gioco sono in arrivo.';
box.append(title, text);
app.append(box);
