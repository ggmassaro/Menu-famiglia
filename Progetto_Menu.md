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
carne_rossa/carne_bianca/pesce/legumi/formaggi_uova/verdura/cereali/frutta),
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
  `#F2B705` (testo scuro), frutta `#9C27B0` (testo bianco)
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

---

## Aggiornamento post-pubblicazione (sessione successiva)

### Icona app e PWA
- Icona dell'app creata da zero con Claude (Pillow/Python, generata direttamente
  in chat, non tramite Claude Code): sfondo diviso in 4 quadranti colorati
  (uno per persona, stessi colori identificativi), cerchio bianco centrale,
  forchetta e coltello (stessa lunghezza) disegnati dentro
- File generati: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
  (quadrato pieno senza trasparenza, per iOS), `favicon-32.png`,
  `favicon-16.png`, `favicon.ico` — tutti dentro cartella `icons/` nel progetto
- **Corretto un problema di aliasing**: le icone erano generate disegnando
  le linee direttamente alla dimensione finale (risultato "sgranato"/con bordi
  seghettati). Soluzione: tecnica del sovracampionamento — disegnare a una
  risoluzione 4 volte più grande e rimpicciolire con filtro LANCZOS, che
  produce bordi lisci. Da ricordare per qualsiasi icona/immagine generata in
  futuro con Pillow o strumenti simili
- Aggiunto `manifest.json` (nome app, colori, icone, `display: standalone`)
  e i tag `<link rel="icon">`, `<link rel="apple-touch-icon">`,
  `<link rel="manifest">` in `index.html`
- **App installata sulla home del telefono** (Android: Chrome → Aggiungi a
  schermata Home; iOS: Safari → Condividi → Aggiungi a Home) — funziona come
  una vera app, schermo intero, senza barra del browser
- Nota per il futuro: se si aggiorna l'icona dopo che è già stata installata
  sul telefono, il dispositivo tiene una copia in cache. Serve rimuovere
  l'icona dalla home e rifare "Aggiungi a Home" da capo per vedere la nuova
  versione

### Caricamento massivo di 58 nuove ricette
- Gioele ha fornito un elenco di piatti di uso frequente in famiglia
- Claude ha proposto categoria pasto/alimentare/adatto_a/ingredienti per
  ciascuno (basandosi sulle grammature del piano alimentare CREA di Gioele
  dove pertinente), Gioele ha corretto alcuni punti prima della generazione:
  - "Riso con piselli" spostato da Cereali a **Legumi** (i piselli sono un
    legume, incoerenza iniziale corretta)
  - Quantità di pasta/riso/patate standardizzate sul **valore "pranzo"**
    del piano CREA (90g pasta, 270g patate), non il valore cena, per
    coerenza in tutte le ricette con doppio tag pranzo+cena
  - **Patate**: categorizzate come **Cereali**, non Verdura — il piano CREA
    le tratta come fonte di carboidrati/primo piatto, non come contorno
  - **Insalate** (tonno, uova, mozzarella): categoria **Verdura**,
    `adatto_a: adulti`
  - **Patate con paprika**: `adatto_a: adulti`
  - Tutte le altre 55 ricette: `adatto_a: tutti`
- Il file SQL è stato generato con uno script Python (scritto ed eseguito
  da Claude nel proprio ambiente) invece che scritto a mano, per ridurre il
  rischio di errori di battitura su un volume così alto di dati — stessa
  struttura CTE già usata nel file `dati_iniziali.sql` originale
- **Totale ricette nel database dopo questo caricamento: 64** (6 originali
  + 58 nuove)

### Suggerimento automatico quantità ingredienti
- Nuovo file `js/suggerimenti-ingredienti.js`: dizionario di grammature
  di riferimento (fonte: tabella grammature del piano CREA di Gioele),
  con voci sia per pranzo sia per cena
- Mentre si scrive il nome di un ingrediente nel form ricetta, appare un
  suggerimento cliccabile ("Suggerito dal tuo piano: X g") che precompila
  quantità e unità; resta sempre facoltativo, l'utente può ignorarlo o
  modificare liberamente
- Caso speciale per le uova: suggerisce sempre "2 pezzi" con arrotondamento
  a pezzo attivo, mai un peso in grammi
- Se la ricetta ha sia "pranzo" sia "cena" selezionati, usa il valore
  pranzo come default (stessa convenzione già adottata per patate/pasta)

### Selezione ricetta dal libretto durante la composizione del menù
- Problema riscontrato: con 64 ricette, il vecchio menu a tendina nel form
  "+ Aggiungi ricetta" del Menù Settimanale era troppo lungo/scomodo
- Soluzione implementata: flusso a due passaggi tramite un nuovo modulo
  condiviso `js/stato-selezione.js` (evita dipendenze circolari tra
  `menu.js` e `ricette.js`):
  1. Click su "+ Aggiungi" per un giorno/pasto → si apre il Libretto
     Ricette in "modalità selezione" (banner in cima, filtro pasto
     pre-impostato automaticamente sul tipo di pasto richiesto)
  2. L'utente sfoglia/filtra le ricette (per categoria alimentare E per
     categoria pasto, filtri combinabili) e clicca "Aggiungi qui" sulla
     card scelta
  3. Si torna al Menù Settimanale con un piccolo form già pronto (ricetta
     già fissata, solo le checkbox delle persone da spuntare) per
     confermare l'inserimento
- Aggiunto anche un secondo gruppo di filtri a chip nel Libretto Ricette,
  per categoria pasto (Colazione/Spuntino/Pranzo/Merenda/Cena), oltre a
  quelli già esistenti per categoria alimentare

### Accordion nel Menù Settimanale
- Le 7 card giorno ora partono **chiuse** di default (solo la fascia
  colorata con il nome è visibile), tranne il **giorno corrente**, che
  parte già aperto
- Click sulla fascia colorata per aprire/chiudere il contenuto (pasti,
  ricette assegnate, bottoni aggiungi/rimuovi)
- Risolve anche, di riflesso, il problema dello scroll lunghissimo su
  mobile di cui si era discusso in una fase precedente

### Promemoria "pianifica la settimana prossima"
- Nuovo file `js/promemoria-home.js`
- Ogni **venerdì**, se la settimana successiva non ha ancora nessun pasto
  pianificato, compare un banner nella Home sotto le 3 card principali
- Il banner offre un bottone "Usa come base la settimana scorsa": copia
  tutte le righe di `menu_settimanale` dell'ultima settimana pianificata
  nella settimana successiva (stesso giorno/pasto/ricetta/persone), così
  Gioele parte da un menù già pronto invece che da zero, e poi lo
  modifica/conferma
- Il pulsante di duplicazione è disponibile solo se la settimana
  successiva è **completamente vuota** (protezione contro sovrascritture
  accidentali se per eccezione fosse già stata parzialmente pianificata)

## Stato di avanzamento (aggiornato)
- [x] Tutto quanto già completato nella sessione precedente
- [x] Icona app + manifest + installazione su home telefono (con fix
      anti-aliasing)
- [x] Caricamento massivo di 58 ricette aggiuntive (totale: 64 ricette)
- [x] Suggerimento automatico quantità ingredienti dal piano alimentare
- [x] Selezione ricetta dal libretto (con filtri) durante composizione menù
- [x] Filtri per categoria pasto nel libretto ricette
- [x] Accordion (apri/chiudi) per i giorni del Menù Settimanale
- [x] Promemoria del venerdì con proposta di duplicare il menù precedente

## Prossimi passi possibili (aggiornato)
1. Eventuale PDF della lista della spesa (non ancora fatto, solo il menù)
2. Categoria "Latticini" separata da "Formaggi-Uova" (mai risolto)
3. Salvataggio/ripristino stato "comprato" alla rigenerazione lista spesa
4. Bug fix e rifiniture emerse dall'uso reale con Giovanna e le bambine
