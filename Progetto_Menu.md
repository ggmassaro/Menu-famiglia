# Progetto: App Menù Settimanale Famiglia + Lista della Spesa

## Panoramica
Web-app per pianificare il menù settimanale della famiglia (4 persone: 2 adulti,
2 bambine), usata da Gioele e dalla moglie su dispositivi separati, con dati
condivisi e sincronizzati in tempo reale. Dal menù composto, l'app genera
automaticamente la lista della spesa settimanale.

## Stack tecnologico
- Frontend: HTML/CSS/JS vanilla + Bootstrap
- Database: Supabase (Postgres, piano gratuito, sincronizzazione in tempo reale
  tramite Supabase Realtime) — stesso stack già validato nel progetto
  "Spese Familiari"
- Hosting: GitHub Pages (gratuito)
- Autenticazione: Supabase Auth, email/password, 2 utenti (Gioele + moglie),
  stessi permessi di lettura/scrittura per entrambi (nessun ruolo admin
  differenziato)

## Vincoli di progetto
- Budget zero assoluto, nessun servizio a pagamento
- Nessun calcolo calorico/macronutrienti: solo organizzazione pasti e quantità
  ingredienti
- Nessun riconoscimento automatico prezzi/offerte supermercato in questa fase
  (rimandato a eventuale fase 2, con inserimento manuale prezzi come unica
  opzione realistica a costo zero)
- Feedback nutrizionale basato su soglie da fonti ufficiali (OMS/WHO, World
  Cancer Research Fund), non un consiglio medico personalizzato

## Persone e fattore porzione
| Nome | Ruolo | Fattore porzione |
|---|---|---|
| Gioele | Papà | 1,0 |
| Giovanna | Mamma | 0,9 |
| Clarissa | Figlia (5 anni) | 0,6 |
| Ludovica | Figlia (2 anni) | 0,5 |

**Somma fattori famiglia = 3,0** (usata per convertire quantità "per tutta la
famiglia" in quantità "per 1 porzione adulto standard": totale famiglia ÷ 3,0)

Logica confermata: se una persona non mangia un piatto del menù (es. variante
diversa), semplicemente non viene inclusa in "Persone assegnate" per quel
pasto — il fattore porzione da solo non serve a rappresentare "porzione
ridotta della stessa ricetta".

## Modello dati (aggiornato)

### Ricette (libretto)
| Campo | Tipo | Note |
|---|---|---|
| Nome | Testo | |
| Categoria pasto | **Multi-selezione**: Colazione / Spuntino / Pranzo / Merenda / Cena | AGGIORNATO: non più scelta singola. Serve solo da filtro comodo in fase di composizione menù, non è una regola nutrizionale |
| Categoria alimentare | Carne rossa / Carne bianca / Pesce / Legumi / Formaggi-Uova / Verdura / Cereali | Una sola per ricetta. Limite noto e accettato: ingredienti secondari (es. zucchine in una frittata) non vengono conteggiati a parte dal motore nutrizionale |
| Tag "adatto a" | Adulti / Bambini / Tutti | |
| Note | Testo libero | Allergie, varianti, sostituzioni, condimenti a piacere (sale, olio) non quantificati |
| Ingredienti | Lista: nome, quantità per 1 porzione standard adulto, unità, flag "arrotonda a pezzo indivisibile" | Vedi regola arrotondamento sotto |

### Regola: arrotondamento ingredienti "a pezzo indivisibile"
Per ingredienti come uova, fette, wurstel ecc. (unità "pezzi"), il calcolo è:
```
Quantità calcolata = quantità_base × fattore_persona
Se flag "a pezzo indivisibile" = Sì:
    arrotonda al numero intero più vicino (minimo 1)
```
Il totale in lista spesa somma i pezzi **già arrotondati per singola persona**,
non arrotonda il totale famiglia a posteriori.

### Menù Settimanale (aggiornato)
- Ogni combinazione **Giorno + Tipo pasto può contenere più ricette abbinate**
  (es. Lunedì-Cena: Salmone alla piastra + Carote al forno), non una sola
  ricetta per slot come previsto originariamente
- Ogni ricetta abbinata mantiene il proprio campo "Persone assegnate"
  indipendente (es. contorno per tutti, secondo solo per adulti)

### Ingredienti: fonte di riferimento per le grammature
Confermato l'uso del piano alimentare personale di Gioele (redatto da biologo
nutrizionista, doc. "Gioele_Massaro_alimentazione_050526.pdf") come base di
riferimento per le quantità "per 1 porzione adulto standard", quando la
categoria di alimento è presente nel documento (cereali, secondi piatti,
verdure, frutta). Le indicazioni comportamentali/di reflusso specifiche per
Gioele NON vengono usate nel motore di feedback nutrizionale familiare, che
resta basato solo sulle soglie generali OMS/WCRF.

## Nuova funzionalità richiesta per il form ricette
Il form di inserimento ricette dovrà includere un **calcolo automatico**:
l'utente inserisce "quantità per tutta la famiglia" oppure "quantità per
singola porzione adulto", e il programma converte in automatico dividendo
per la somma dei fattori porzione attivi in quel momento (oggi 3,0,
si aggiorna da sola se cambiano persone/fattori). Requisito confermato,
non rimandabile.

## Le 5 ricette raccolte (dati di test reali)

| # | Nome | Categoria pasto | Categoria alimentare | Adatto a |
|---|---|---|---|---|
| 1 | Pasta al pesto | Pranzo, Cena | Cereali | Tutti |
| 2 | Frittata semplice | Pranzo, Cena | Formaggi-Uova | Bambini |
| 3 | Frittata con zucchine | Pranzo, Cena | Formaggi-Uova | Adulti |
| 4 | Salmone alla piastra | Pranzo, Cena | Pesce | Tutti |
| 5 | Carote al forno | Pranzo, Cena | Verdura | Tutti |

### Ingredienti (quantità per 1 porzione adulto standard)
| Ricetta | Ingrediente | Quantità | Unità | Arrotonda a pezzo |
|---|---|---|---|---|
| Pasta al pesto | Pasta | 100 | g | No |
| | Pesto | 30 | g | No |
| | Parmigiano grattugiato | 12 | g | No |
| Frittata semplice | Uova | 2 | pezzi | Sì (min. 1) |
| | Note: filo d'olio, pizzico di sale (non quantificati) | | | |
| Frittata con zucchine | Uova | 2 | pezzi | Sì (min. 1) |
| | Zucchine | 150 | g | No |
| | Note: filo d'olio, pizzico di sale (non quantificati) | | | |
| Salmone alla piastra | Salmone | 140 | g | No |
| | Olio EVO | 10 | g | No |
| Carote al forno | Carote | 220 | g | No |
| | Olio EVO | 10 | g | No |

Nota: "Carote al forno" è pensata come **ricetta di contorno riutilizzabile**,
abbinabile a più secondi piatti diversi (non solo al salmone), grazie alla
nuova regola "più ricette per slot".

## Stile grafico
Discusso ma **volutamente rimandato**: si procederà con interfaccia grezza
(tabelle HTML, Bootstrap default) durante i test di logica. Direzione di
massima annotata per il futuro: stile pulito "da app" (cards, spazio bianco,
palette 1-2 colori tenui + accenti caldi per azioni), più "minimal-friendly"
che "minimal-finance", da confermare con palette vera scelta insieme quando
si arriverà alla fase grafica.

## Stato di avanzamento
- [x] Briefing iniziale completato (architettura, modello dati, stack, soglie nutrizionali)
- [x] Raccolta dati reali di test (4 persone + fattori porzione, 5 ricette complete con quantità e categoria alimentare)
- [ ] Creazione/riuso progetto Supabase con nuove tabelle dedicate
- [ ] Setup tabelle Supabase (persone, ricette, menu_settimanale, lista_spesa) con regole di sicurezza (RLS)
- [ ] Autenticazione 2 utenti (Gioele + moglie)
- [ ] Form gestione libretto ricette (con calcolo automatico famiglia→porzione adulto, categoria pasto multi-selezione, flag arrotondamento a pezzo)
- [ ] Form composizione menù settimanale (con supporto multi-ricetta per slot) + motore feedback nutrizionale
- [ ] Generazione automatica lista della spesa
- [ ] Vista/grafica menù settimanale (stile rimandato, da definire dopo i test di logica)
- [ ] Vista lista spesa con checkbox + voci extra manuali
- [ ] Test con dati reali e verifica calcoli

## Prossimi passi immediati
1. Decidere se creare un nuovo progetto Supabase dedicato o riusare quello di
   "Spese Familiari" con nuove tabelle
2. Setup tabelle e struttura dati su Supabase
3. Autenticazione 2 utenti
