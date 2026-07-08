# Progetto: App Menù Settimanale Famiglia + Lista della Spesa

## Panoramica
Web-app per pianificare il menù settimanale della famiglia (4 persone: 2 adulti,
2 bambine), usata da Gioele e dalla moglie Giovanna su dispositivi separati
(soprattutto telefono), con dati condivisi e sincronizzati in tempo reale.
Dal menù composto, l'app genera automaticamente la lista della spesa
settimanale. **Il progetto è COMPLETO ed è online, in uso reale dalla
famiglia.**

## Link app pubblicata
**https://ggmassaro.github.io/Menu-famiglia/**

Repository GitHub: `ggmassaro/Menu-famiglia`, branch `main`, pubblicato via
GitHub Pages (Settings → Pages → Deploy from branch → main → /root).

## Stack tecnologico
- Frontend: HTML/CSS/JS vanilla + Bootstrap 5, architettura **Single Page
  Application (SPA)** — un solo file `index.html` con più "viste" (div)
  mostrate/nascoste via JavaScript (mai cambio di URL o ricaricamento pagina)
- Database: Supabase (Postgres, piano gratuito, progetto dedicato
  `menu-famiglia`, separato dal progetto "Spese Familiari")
- Hosting: GitHub Pages (gratuito)
- Autenticazione: Supabase Auth, email/password, 2 utenti (Gioele + Giovanna),
  stessi permessi di lettura/scrittura per entrambi
- Librerie esterne via CDN: Bootstrap 5.3.3, Supabase JS v2, html2pdf.js
  0.10.1 (per l'esportazione PDF del menù), Google Fonts (Fraunces, Plus
  Jakarta Sans)

## Metodo di lavoro adottato
- **Codice**: Claude fornisce prompt dettagliati da incollare in Claude
  Code, che crea/modifica i file veri sul computer di Gioele
- **SQL**: scritto direttamente in chat da Claude, incollato da Gioele
  nell'SQL Editor di Supabase
- **Stile grafico**: proposto con anteprime visive (widget) prima di ogni
  implementazione, iterando col feedback di Gioele prima di scrivere il
  prompt definitivo

## Persone e fattore porzione
| Nome | Ruolo | Fattore porzione | Colore identificativo |
|---|---|---|---|
| Gioele | Papà | 1,0 | Blu `#1E88E5` |
| Giovanna | Mamma | 0,9 | Magenta `#EC407A` |
| Clarissa | Figlia (5 anni) | 0,6 | Ambra `#FFB300` |
| Ludovica | Figlia (2 anni) | 0,5 | Verde `#66BB6A` |

**Somma fattori famiglia = 3,0** (usata per convertire quantità "per tutta la
famiglia" in quantità "per 1 porzione adulto standard": totale famiglia ÷ 3,0).
Il calcolo è integrato **direttamente nel form di creazione ricetta** (non più
manuale): l'utente sceglie se una quantità inserita è "per tutta la famiglia"
o "già per porzione adulto", il programma converte in automatico.

## Modello dati (Supabase/Postgres) — 5 tabelle, tutte con RLS attiva
Policy RLS su tutte le tabelle: solo utenti autenticati possono
leggere/scrivere (nessuna distinzione di ruolo tra Gioele e Giovanna).

### `persone`
id, nome, ruolo, fattore_porzione, created_at

### `ricette`
id, nome, categoria_pasto (**array** di testo — multi-selezione tra
colazione/spuntino/pranzo/merenda/cena), categoria_alimentare (uno tra
carne_rossa/carne_bianca/pesce/legumi/formaggi_uova/verdura/cereali),
adatto_a (adulti/bambini/tutti), note, created_at

### `ingredienti`
id, ricetta_id (FK → ricette, ON DELETE CASCADE), nome, quantita (per 1
porzione adulto standard), unita (g/ml/pezzi), arrotonda_a_pezzo (booleano)

**Regola arrotondamento a pezzo**: per ingredienti indivisibili (uova, ecc.),
il calcolo per persona è `Math.max(1, Math.round(quantita_base ×
fattore_porzione))`, applicato **per singola persona prima di sommare**, mai
sul totale finale.

### `menu_settimanale`
id, settimana_inizio (date, lunedì della settimana), giorno
(lunedi..domenica), tipo_pasto (colazione/spuntino/pranzo/merenda/cena),
ricetta_id (FK → ricette, **blocca la cancellazione** della ricetta se
referenziata — errore Postgres `23503`, intercettato e mostrato in modo
comprensibile), persone_assegnate (array di uuid)

**Importante**: ogni combinazione giorno+pasto può avere **più righe**
(più ricette abbinate, es. secondo + contorno), ciascuna con le proprie
persone assegnate.

### `lista_spesa`
id, settimana_inizio, ingrediente, quantita_totale, unita,
categoria_reparto (non popolato attivamente), stato
(da_comprare/comprato/gia_in_dispensa), is_manuale (booleano)

**Regola di rigenerazione**: il bottone "Genera/Aggiorna" cancella e ricrea
**solo** le righe con `is_manuale = false`; le voci aggiunte a mano
(`is_manuale = true`) non vengono mai toccate. Nota nota: se si rigenera a
metà settimana, lo stato "comprato" delle righe non manuali viene perso
(comportamento accettato da Gioele, non ancora risolto con un
salva/ripristina stato).

## Funzionalità implementate

### Autenticazione
Login/logout per i due utenti, sessione persistente via Supabase Auth.
Router centralizzato (`js/router.js`) gestisce quale vista mostrare in base
allo stato della sessione.

### Libretto Ricette
- Visualizzazione a card con filtri cliccabili per categoria alimentare
- Creazione ricetta: form con categoria pasto multi-selezione (checkbox →
  chip), categoria alimentare, adatto a, note, righe ingredienti dinamiche
  (aggiungi/rimuovi), calcolatore automatico famiglia→porzione
- Modifica ricetta: stesso form precompilato, riusa
  `caricaRicettaPerModifica()`; salvataggio con UPDATE + cancella/ricrea
  ingredienti
- Eliminazione ricetta: con conferma, bloccata se la ricetta è ancora usata
  nel menù (in qualsiasi settimana, passata o futura)

### Menù Settimanale
- Selettore settimana (calcola automaticamente il lunedì di riferimento da
  qualsiasi data scelta)
- Griglia a 7 card giorno (struttura attuale: elenco verticale, non tab —
  valutato e accettato per ora anche su mobile)
- Aggiunta/rimozione ricette per ogni giorno/pasto, con selezione multipla
  delle persone assegnate (checkbox)
- **Riepilogo nutrizionale settimanale** in fondo alla vista: conta le
  ricette per categoria alimentare pianificate nella settimana e le
  confronta con soglie reali (fonte: Linee Guida CREA per una Sana
  Alimentazione + World Cancer Research Fund per la carne rossa):
  - Carne rossa: soglia massima 3/settimana (avviso se superata)
  - Carne bianca: 2-3/settimana (informativo)
  - Pesce: 2-3/settimana (informativo)
  - Legumi: 3-4/settimana (informativo)
  - Formaggi-Uova, Cereali, Verdura: solo conteggio, nessuna soglia (limiti
    del modello dati spiegati a schermo)
  - Testo di disclaimer sempre visibile: indicazioni generali, non un
    consiglio medico personalizzato, specialmente per le bambine
- **Esportazione PDF**: bottone "Scarica PDF del menù", genera una griglia
  stampabile (giorni in colonna, pasti in riga, orientamento landscape),
  nascondendo automaticamente le righe pasto senza nessuna ricetta in tutta
  la settimana. Badge colorati per categoria + pallini persona, legenda in
  fondo. Implementato con `html2pdf.js`; corretto un bug per cui il PDF
  usciva vuoto (tecnica del "doppio requestAnimationFrame" per dare tempo al
  browser di disegnare il contenuto prima della cattura).

### Lista della Spesa
- Generazione automatica dal menù della settimana selezionata (somma per
  ingrediente, arrotondamento a pezzo per persona prima di sommare)
- Checkbox "comprato" con aggiornamento visivo immediato (ottimistico) e
  persistenza su Supabase
- Voci manuali aggiungibili/eliminabili in autonomia, mai toccate dalla
  rigenerazione automatica

## Stile grafico (completato)
Sistema di design definito con Claude tramite anteprime iterative prima di
ogni implementazione.

**Palette:**
- Sfondo app: verde salvia chiarissimo `#F3F6F1` con 4 sfumature radiali
  molto tenui (10%/8% opacità) nei colori corallo/indaco/rosa/verde acqua,
  fisse in `background-attachment: fixed`
- Font titoli: **Fraunces** (serif, corsivo, peso 600/700)
- Font testo: **Plus Jakarta Sans**
- Colore d'azione (bottoni, checkbox, link): **diverso per sezione**, tramite
  variabili CSS ereditate dal contenitore di vista:
  - Menù Settimanale → blu `#1E88C7`
  - Ricette (incl. form nuova/modifica) → giallo `#FFC107` (testo scuro)
  - Lista Spesa → fucsia `#E91E8C`
  - Default/fallback (es. login) → verde acqua `#00BFA6`
- Colori categoria alimentare (badge pieni, usati ovunque compaia una
  ricetta): carne_rossa `#E4572E`, carne_bianca `#CC7A3D`, pesce `#1E88C7`,
  legumi `#7C8A28`, formaggi_uova `#B1527A`, verdura `#3F8C46`, cereali
  `#F2B705` (testo scuro)
- Colori giorno (solo per la fascia colorata in cima a ogni card giorno nel
  menù, puramente per orientamento visivo): stessi 7 colori delle categorie,
  riusati in rotazione fissa lun→dom
- Home: palette dedicata a sé (blu, giallo, fucsia sulle 3 card principali,
  diversa/più intensa rispetto al resto), con card a colore pieno, numeri
  giganti semi-trasparenti come elemento tipografico decorativo-funzionale

**Componenti ricorrenti**: card bianche con ombra leggera e bordo
arrotondato (14-20px), badge/chip a pillola, pallini colorati per persona
(anche sovrapposti a effetto "gruppo" dentro i badge ricetta), bottone
"torna indietro" a pillola bianca (non più link Bootstrap), filtri a chip
cliccabili nel libretto ricette.

**Vincolo rispettato**: nessuna icona decorativa (preferenza esplicita di
Gioele) — solo colore, forma, tipografia.

## Decisioni tecniche chiave (cronologiche)
- Multi-pagina inizialmente, poi **convertito in SPA** su richiesta esplicita
  di Gioele (coerenza con progetto precedente "Spese Familiari")
- Categoria pasto passata da scelta singola a **multi-selezione** dopo
  obiezione di Gioele (una ricetta può andare bene sia a pranzo che a cena)
- Una combinazione giorno+pasto può avere **più ricette abbinate**
- Yogurt/latticini non hanno categoria propria, rientrano in
  "Formaggi-Uova" — limite noto, non ancora risolto
- Le soglie nutrizionali usano fonti realmente verificate (CREA, WCRF), non
  genericamente attribuite all'OMS quando l'OMS non specifica frequenze
  settimanali precise

## Bug noti e risolti nel percorso (utile per debug futuro)
- **Live Server necessario in locale**: i file usano `type="module"`,
  quindi non si possono aprire con doppio click (`file://`), serve
  l'estensione Live Server di VS Code
- **GitHub Pages, propagazione lenta**: dopo push multipli ravvicinati può
  volerci diversi minuti prima che il sito online rifletta i file corretti;
  in caso di dubbio, controllare il banner verde in Settings → Pages e fare
  hard refresh (Ctrl+Shift+R) o provare in incognito
- **Case-sensitivity**: GitHub Pages distingue maiuscole/minuscole nei nomi
  file/cartelle, a differenza di Windows in locale — causa di bottoni che
  "non fanno nulla" per file non trovati (verificare sempre la Console per
  errori 404)
- **html2pdf.js e contenuto nascosto**: nascondere il contenuto da
  stampare con `position:absolute; left:-9999px` produce PDF vuoti;
  soluzione: overlay bianco a schermo intero + contenuto renderizzato
  normalmente + doppio `requestAnimationFrame` prima della cattura

## Cosa NON è stato implementato (deciso di rimandare/scartare)
- Riconoscimento automatico prezzi/offerte supermercato (nessuna soluzione
  gratuita affidabile trovata)
- Categoria "Latticini" separata da "Formaggi-Uova"
- Salvataggio/ripristino dello stato "comprato" quando si rigenera la lista
  spesa a metà settimana
- Esportazione PDF della lista della spesa (fatto solo per il menù)
- Storico dei menù settimanali passati (proposta iniziale, mai confermata)
- Favicon/icona dell'app per la schermata home del telefono
- Vista "un giorno alla volta" per il menù su mobile (valutata, per ora
  tenuta come elenco verticale di tutti e 7 i giorni)

## Stato di avanzamento
- [x] Setup Supabase, schema, RLS
- [x] Autenticazione 2 utenti
- [x] Conversione a SPA
- [x] Libretto ricette: visualizza, crea, modifica, elimina
- [x] Composizione menù settimanale (multi-ricetta per slot)
- [x] Generazione lista della spesa + voci manuali
- [x] Motore di feedback nutrizionale (soglie CREA/WCRF)
- [x] Stile grafico completo su tutte le viste + Home ridisegnata
- [x] Esportazione PDF del menù settimanale a griglia
- [x] Pubblicazione su GitHub Pages — **app online e in uso reale**

## Prossimi passi possibili (da confermare con Gioele quando riprende)
1. Favicon/icona app per la schermata home del telefono
2. Eventuale PDF della lista della spesa
3. Bug fix e rifiniture emersi dall'uso reale con Giovanna
4. Eventuale storico menù passati
