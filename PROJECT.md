# Progetto: App Tracciamento Spese Familiari

## Panoramica
Web-app per tracciare le spese quotidiane familiari, usata da due persone (marito e moglie) su telefoni separati, con dati condivisi e sincronizzati in tempo reale.

## Stack tecnologico
- Frontend: HTML/CSS/JS vanilla + Bootstrap
- Database: Supabase (Postgres, piano gratuito, sincronizzazione in tempo reale tramite Supabase Realtime)
- Hosting: GitHub Pages (gratuito)
- Autenticazione: Supabase Auth, email/password (da definire nel dettaglio in fase tecnica)

Nota: inizialmente scelto Firebase Firestore, poi sostituito con Supabase perché
Firebase richiede il collegamento di una carta di credito anche solo per creare
il database Firestore (pur restando nelle soglie gratuite). Supabase non richiede
alcun metodo di pagamento sul piano gratuito. Compromesso accettato: i progetti
gratuiti Supabase vanno in pausa dopo 7 giorni di inattività e vanno "risvegliati"
manualmente dal pannello di controllo.

## Vincoli di progetto
- Deve essere completamente gratuito (nessun servizio a pagamento)
- Niente riconoscimento automatico scontrini (inserimento sempre manuale)
- Nessuna notifica push (limite della web-app rispetto a un'app nativa)
- Sviluppato tramite Claude Code, con requisiti definiti in chat su Claude.ai

## Modello dati

### Spesa (collezione principale)
| Campo | Tipo | Obbligatorio |
|---|---|---|
| Data | Data | Sì |
| Importo | Numero (€) | Sì |
| Voce spesa | Stringa (da lista dropdown estendibile) | Sì |
| Gruppo spesa | Stringa (da lista dropdown estendibile) | Sì |
| Metodo pagamento | Contanti / Carta | Sì |
| Chi ha inserito | Automatico (da autenticazione utente) | Automatico |
| Nota | Testo libero | No |

Funzionalità richieste: modifica e cancellazione di una spesa già inserita.

### Voce spesa — lista iniziale (estendibile dall'utente)
Alimentari, Pulizia Casa/Vestiti, Bollette, Igiene personale, Farmaci, Trasporti/Carburante, Abbigliamento Bimbe, Abbigliamento Adulti, Colazione, Pranzo, Cena, Scuola, Cani, Veterinario, Babysitter, Attrazioni, Palestra, Piscina, Abbonamenti, Assicurazioni, Investimenti

### Gruppo spesa — lista iniziale (estendibile dall'utente)
Supermercato, Negozio, Bar, Ristorante, Online, Farmacia, Benzinaio, Gite Familiari, Professionisti, Sport

### Budget (collezione separata)
| Campo | Tipo | Note |
|---|---|---|
| Nome | Testo libero | Es. "Spesa per vivere", "Piscina" |
| Voci spesa incluse | Array di Voce spesa | Selezione libera, una o più |
| Gruppi spesa inclusi | Array di Gruppo spesa | Selezione libera, uno o più |
| Importo mensile | Numero (€) | |
| Mese/Anno di riferimento | Data | |

- Budget mensile, unico e condiviso per la famiglia (non per persona)
- A inizio mese, proporre in automatico l'importo/composizione del mese precedente (modificabile dall'utente prima di confermare)
- Un budget può combinare Voci e/o Gruppi spesa a piacere; più budget indipendenti possono coesistere

## Dashboard richiesta
- Totale speso per mese, filtrabile per mese, con ripartizione per Voce spesa e per Gruppo spesa
- Confronto Actual vs Budget per ogni budget creato: importo speso, budget impostato, spazio residuo, segnalazione visiva quando il budget è raggiunto/superato
- Grafico di trend nel tempo (andamento mese su mese)
- Esportazione dati in Excel/CSV

## Log decisioni chiave
- [Data odierna] Definiti requisiti completi tramite briefing in chat su Claude.ai
- Scelto inizialmente Firebase Firestore, poi sostituito con Supabase perché Firebase 
  richiede una carta di credito collegata per creare il database (anche restando 
  nelle soglie gratuite), mentre Supabase no
- Rimossa la funzione di riconoscimento foto scontrino per mantenere il progetto gratuito al 100%
- Risolta sovrapposizione tra Voce spesa e Gruppo spesa (Bar/Ristorante spostati a Gruppo spesa; sostituiti in Voce spesa con Colazione/Pranzo/Cena)
- Budget semplificato a solo periodo mensile (niente settimanale, per ora)

## Stato di avanzamento
- [x] Creazione account GitHub
- [x] Creazione account/progetto Supabase
- [x] Setup struttura progetto in Claude Code
- [x] Connessione a Supabase configurata nel codice
- [x] Autenticazione utenti configurata (email/password, registrazione pubblica disattivata, 2 utenti creati)
- [x] Tabelle database create (spese, budget, voci_spesa, gruppi_spesa) con regole di sicurezza (RLS)
- [x] Login/logout funzionante nell'app (testato: errore credenziali, accesso, logout)
- [x] Form inserimento spesa funzionante (testato: salvataggio, modifica, cancellazione, aggiunta nuove voci/gruppi)
- [x] Dashboard con grafici funzionante (testato: totali, torte, trend, export CSV, layout mobile)
- [x] Funzionalità Budget funzionante (testato: creazione, actual vs budget, colori soglia, modifica, eliminazione, copia dal mese precedente)

## Fase di costruzione conclusa
Tutte le funzionalità pianificate sono state costruite, testate e pubblicate 
online (https://ggmassaro.github.io/Spese-Famiglia/), con stile grafico 
personalizzato (tema scuro, gradiente viola-rosa-arancione su azioni principali, 
palette blu-azzurro per categorie, icona famiglia stilizzata per la schermata 
home) e rifiniture di leggibilità/layout mobile.

## Prossimi passi: fase di uso reale
- Test con la moglie dal suo account/telefono (sincronizzazione in tempo reale)
- Uso quotidiano per alcuni giorni/settimane
- Verificare se le liste Voce/Gruppo spesa coprono bene le spese reali
- Raccogliere eventuali problemi o nuove esigenze emerse dall'uso, da affrontare 
  con lo stesso metodo (briefing in chat -> prompt per Claude Code -> test)

Rifiniture aggiuntive completate e testate:
- Contrasto testo grigio migliorato (label, testo secondario, legende/assi Chart.js)
- Layout mobile "Spese recenti" a card verticali sotto i 576px (prima gestito da 
  classi Bootstrap d-none/d-sm-block non funzionanti correttamente, ora media 
  query esplicita in style.css)
- Titolo header ridotto su mobile per stare su una riga
- Placeholder select "Voce/Gruppo spesa" accorciati

Nota tecnica ricorrente: il deploy di GitHub Pages a volte fallisce con 
"Deployment failed, try again later" (visibile su github.com/[utente]/[repo]/actions, 
job "deploy" con X rossa). Soluzione rapida: far fare a Claude Code una modifica 
minima (es. commento vuoto) + nuovo commit/push, che fa ripartire il deploy da 
zero. In alternativa, "Re-run failed jobs" direttamente su GitHub Actions. 
A volte un run resta bloccato su "Queued" per diversi minuti: in quel caso, 
un nuovo commit/push crea comunque un nuovo tentativo indipendente che di 
solito procede normalmente.
Dopo ogni deploy riuscito, ricordarsi che le PWA installate ("Installa" su home 
screen) cachano in modo più aggressivo del browser normale: se le modifiche non 
si vedono, rimuovere l'icona dalla home, svuotare cache del browser, verificare 
le modifiche da browser normale, poi reinstallare l'icona.

Ulteriori evoluzioni completate e testate:
- Metodi di pagamento estesi: Contanti, Carta, Satispay, Bonifico
- Nuovo campo "Conto" su ogni spesa (Condiviso/Gioele/Giovanna), colonna 
  facoltativa su Supabase per non rompere le spese esistenti (rimaste senza 
  valore, da sistemare manualmente se necessario)
- Palette colori grafici resa più contrastata (alternanza toni caldi/freddi)
- Nuovo grafico "Per Conto" in Dashboard
- Fix bug: selezione Voci/Gruppi nel form Budget si azzerava durante la 
  compilazione; risolto sostituendo il <select multiple> nativo con una lista 
  di checkbox (più chiara e usabile anche su mobile)
- Aggiunta gestione/cancellazione di Voci spesa e Gruppi spesa (pulsante 
  "Gestisci voci/gruppi")

Ulteriori evoluzioni completate e testate:
- Card visivamente separate (sfondo distinto + bordo + ombra) tra "Nuova Spesa"/
  "Spese recenti" e "Nuovo Budget"/"Budget del mese" (causa: .tab-content aveva 
  lo stesso sfondo delle card interne, rendendo la separazione strutturale 
  invisibile)
- Modello Gruppi spesa riorganizzato: ogni Gruppo ora corrisponde a un Budget 
  dedicato (relazione 1:1 mantenuta manualmente dall'utente sui dati esistenti). 
  I vecchi budget personalizzati (basati su Voci o su più Gruppi insieme) restano 
  comunque supportati dalla struttura flessibile sottostante
- Creazione automatica di un Budget quando si aggiunge un nuovo Gruppo spesa 
  (da form Inserisci Spesa o da "Gestisci voci/gruppi"): chiede l'importo 
  mensile, default 0 se annullato/non valido
- Controllo "spese non coperte da nessun budget" nel tab Budget: banner di 
  avviso con conteggio e dettaglio, calcolato sul mese selezionato
- Tab "Inserisci Spesa" rinominato in "Spese"
- Riepilogo "Totale speso vs Totale budget" nel tab Budget, con barra e badge 
  a tre soglie (verde <90%, giallo 90-100%, rosso >100%), stesso stile delle 
  card budget singole
- Formato numerico italiano uniformato ovunque (punto migliaia, virgola 
  decimali, 2 decimali sempre) tramite funzione unica formatEuro()

In sospeso: 
- Conferma se il campo "Conto" debba avere "Condiviso" preselezionato di default
- Correzione visualizzazione su iPhone (in attesa di screenshot per capire il 
  problema specifico)

Ulteriori evoluzioni completate e testate:
- Filtri sull'elenco "Spese recenti" (Voce, Gruppo, Conto, Mese, Metodo pagamento), 
  combinabili con AND; senza filtri attivi mostra le ultime 20, con filtri attivi 
  mostra tutte le corrispondenze
- Dettaglio spese di un Budget: click sulla card apre un elenco con tutte le 
  spese che contribuiscono a quel calcolo Actual vs Budget

Nota tecnica: layout mobile "Spese recenti" (card verticali invece di tabella) 
confermato funzionante su telefono reale dopo correzione (le regole erano 
inizialmente gestite da classi utility Bootstrap invece che da una media query 
dedicata in style.css - risolto centralizzando tutto in un blocco 
@media (max-width: 576px)). Minore: titolo header ancora su due righe su 
mobile, non bloccante, da valutare se sistemare.

Nota tecnica emersa durante i test: dopo ogni pubblicazione di modifiche al 
codice (git push), la cache del browser sul telefono può mostrare temporaneamente 
la versione precedente. Soluzione: svuotare la cache del browser o aprire in 
modalità incognito. Non riguarda i dati (spese/budget), solo i file di codice, 
e non sarà un problema nell'uso quotidiano una volta che il codice smetterà 
di cambiare frequentemente.
- [x] Deploy su GitHub Pages (anticipato per consentire test su mobile: https://ggmassaro.github.io/Spese-Famiglia/)
