import { supabase } from './supabase-config.js';
import { calcolaEMostraRiepilogoNutrizionale } from './nutrizione.js';
import { COLORI_CATEGORIA_ALIMENTARE, COLORI_GIORNO, getColorePersona } from './stile.js';
import { generaPdfMenu } from './stampa-menu.js';
import { mostraVista } from './router.js';
import { impostaSelezione, leggiSelezione, pulisciSelezione } from './stato-selezione.js';

// --- Riferimenti agli elementi fissi della vista (esistono una sola
// volta nella pagina, non vengono mai ricreati) ---
const selettoreSettimana = document.getElementById('selettore-settimana');
const grigliaMenu = document.getElementById('griglia-menu');
const legendaPersone = document.getElementById('legenda-persone');
const bottoneStampaMenu = document.getElementById('btn-stampa-menu');

// ==========================================================
// COSTANTI: giorni e pasti, con chiave (usata nel database, uguale ai
// valori delle colonne "giorno"/"tipo_pasto") ed etichetta leggibile
// (usata solo per la visualizzazione).
// ==========================================================
const GIORNI = [
    { chiave: 'lunedi', etichetta: 'Lunedì' },
    { chiave: 'martedi', etichetta: 'Martedì' },
    { chiave: 'mercoledi', etichetta: 'Mercoledì' },
    { chiave: 'giovedi', etichetta: 'Giovedì' },
    { chiave: 'venerdi', etichetta: 'Venerdì' },
    { chiave: 'sabato', etichetta: 'Sabato' },
    { chiave: 'domenica', etichetta: 'Domenica' }
];

const PASTI = [
    { chiave: 'colazione', etichetta: 'Colazione' },
    { chiave: 'spuntino', etichetta: 'Spuntino' },
    { chiave: 'pranzo', etichetta: 'Pranzo' },
    { chiave: 'merenda', etichetta: 'Merenda' },
    { chiave: 'cena', etichetta: 'Cena' }
];

// --- Stato della vista (aggiornato dal caricamento dati e dai cambi
// di settimana) ---
let elencoPersone = [];   // [{ id, nome }, ...]
let settimanaInizioCorrente = null; // stringa "YYYY-MM-DD" del lunedì mostrato

// ==========================================================
// GESTIONE DATE: calcolo del lunedì della settimana
// ==========================================================

// Trasforma una stringa "YYYY-MM-DD" (il formato di <input type="date">)
// in un oggetto Date "locale". Non usiamo semplicemente `new Date(stringa)`
// perché JavaScript interpreta quella forma di stringa come mezzanotte in
// UTC: in un fuso orario in anticipo o indietro rispetto a UTC, quel
// momento può ricadere nel giorno "sbagliato" quando lo si legge con i
// metodi locali (getDate/getDay). Costruendo la data a mano con
// anno/mese/giorno restiamo sempre nel fuso orario del browser.
function parseDataISO(stringaData) {
    const [anno, mese, giorno] = stringaData.split('-').map(Number);
    return new Date(anno, mese - 1, giorno);
}

// Operazione inversa: da un oggetto Date locale a una stringa "YYYY-MM-DD",
// pronta per essere salvata nella colonna "settimana_inizio" (di tipo date).
function formattaDataISO(data) {
    const anno = data.getFullYear();
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const giorno = String(data.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
}

// Dato un giorno qualsiasi, calcola la data del lunedì della settimana a
// cui appartiene. In JavaScript, Date.prototype.getDay() restituisce un
// numero da 0 a 6, dove 0 = domenica, 1 = lunedì, ... 6 = sabato.
// Per tornare indietro fino al lunedì dobbiamo sottrarre (getDay() - 1)
// giorni in tutti i casi TRANNE la domenica: se oggi è domenica (0), il
// lunedì della stessa settimana è 6 giorni prima, non -1 giorni dopo.
function calcolaLunedi(data) {
    const giornoSettimana = data.getDay();
    const giorniDaSottrarre = giornoSettimana === 0 ? 6 : giornoSettimana - 1;

    const lunedi = new Date(data); // copia, per non modificare "data" originale
    lunedi.setDate(data.getDate() - giorniDaSottrarre);

    return formattaDataISO(lunedi);
}

// ==========================================================
// CARICAMENTO DATI: persone e ricette
// ==========================================================

// Carica id e nome di tutte le persone della famiglia: servono per
// mostrare i checkbox "persone assegnate" e per tradurre gli id salvati
// in persone_assegnate nei nomi da mostrare a video.
async function caricaPersone() {
    const { data, error } = await supabase
        .from('persone')
        .select('id, nome');

    if (error) {
        console.error('Errore nel caricamento delle persone:', error.message);
        elencoPersone = [];
        return;
    }

    elencoPersone = data;
}

// ==========================================================
// LEGENDA PERSONE
// ==========================================================
// Un pallino colorato (sempre lo stesso colore di getColorePersona, vedi
// js/stile.js) seguito dal nome, per ciascuna persona della famiglia.
// Le persone non cambiano ogni volta che si cambia settimana, quindi
// generiamo questa legenda una sola volta all'apertura della vista
// (richiamata da inizializzaVistaMenu), non ad ogni rigenerazione della
// griglia: non ha senso rifare questo lavoro ad ogni cambio di settimana.
function generaLegendaPersone() {
    const vociPersone = elencoPersone
        .map((persona) => {
            const colore = getColorePersona(persona.nome);
            return `
                <span class="d-flex align-items-center gap-2">
                    <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background-color: ${colore};"></span>
                    ${persona.nome}
                </span>
            `;
        })
        .join('');

    legendaPersone.innerHTML = `<div class="legenda-persone">${vociPersone}</div>`;
}

// ==========================================================
// GENERAZIONE DELLA GRIGLIA (7 giorni x 5 pasti)
// ==========================================================

// Ricostruisce da zero tutto il contenuto di #griglia-menu per la
// settimana attualmente selezionata (settimanaInizioCorrente).
async function generaGriglia() {
    // Invece di interrogare menu_settimanale separatamente per ognuna
    // delle 35 celle giorno/pasto, facciamo UNA sola query che prende
    // tutte le voci di questa settimana (con nome E categoria_alimentare
    // della ricetta collegata, grazie a select('*, ricette(nome,
    // categoria_alimentare)') — la categoria serve per colorare il badge
    // con lo stesso colore usato ovunque nell'app, vedi js/stile.js), e
    // poi le smistiamo noi in JavaScript: molto più efficiente, stesso
    // risultato finale.
    const { data: righeMenu, error } = await supabase
        .from('menu_settimanale')
        .select('*, ricette(nome, categoria_alimentare)')
        .eq('settimana_inizio', settimanaInizioCorrente);

    if (error) {
        grigliaMenu.innerHTML = `<p class="text-danger">Errore nel caricamento del menù: ${error.message}</p>`;
        return;
    }

    // Raggruppiamo le righe trovate per "giorno_pasto", così da poterle
    // ritrovare velocemente mentre costruiamo ogni singola cella.
    const righePerCella = {};
    righeMenu.forEach((riga) => {
        const chiaveCella = `${riga.giorno}_${riga.tipo_pasto}`;
        if (!righePerCella[chiaveCella]) {
            righePerCella[chiaveCella] = [];
        }
        righePerCella[chiaveCella].push(riga);
    });

    grigliaMenu.innerHTML = '';

    // Per capire quale giorno è "oggi" dentro la settimana mostrata,
    // confrontiamo la data odierna con la data di ciascuno dei 7 giorni
    // (lunedì della settimana + indice giorni), entrambe come stringhe
    // "YYYY-MM-DD": se coincidono, quel giorno è quello corrente e
    // l'accordion deve partire già aperto solo per lui.
    const oggiISO = formattaDataISO(new Date());
    const lunediSettimana = parseDataISO(settimanaInizioCorrente);

    GIORNI.forEach((giorno, indice) => {
        const dataDiQuestoGiorno = new Date(lunediSettimana);
        dataDiQuestoGiorno.setDate(lunediSettimana.getDate() + indice);
        const eGiornoCorrente = formattaDataISO(dataDiQuestoGiorno) === oggiISO;

        // "corpo-giorno" è il contenitore che l'accordion mostra/nasconde
        // (vedi css/style.css: display:none, diventa "block" con la
        // classe "aperto"); data-giorno lo collega alla fascia
        // corrispondente quando l'utente clicca per aprirlo/chiuderlo.
        // Riusiamo lo stesso div che già faceva da "card-body" invece di
        // aggiungere un ulteriore livello di nidificazione HTML.
        const corpoCard = document.createElement('div');
        corpoCard.className = 'card-body corpo-giorno' + (eGiornoCorrente ? ' aperto' : '');
        corpoCard.dataset.giorno = giorno.chiave;

        PASTI.forEach((pasto) => {
            const chiaveCella = `${giorno.chiave}_${pasto.chiave}`;
            const righeCella = righePerCella[chiaveCella] || [];
            corpoCard.insertAdjacentHTML('beforeend', creaHtmlBloccoPasto(giorno, pasto, righeCella));
        });

        // Fascia colorata in cima alla card (sostituisce la vecchia
        // barra sottile .accento-giorno): un colore diverso per ciascuno
        // dei 7 giorni (COLORI_GIORNO, indice 0 = Lunedì), puro accento
        // visivo per orientarsi scorrendo la griglia, senza nessun
        // legame con il contenuto del menù di quel giorno. Il nome del
        // giorno ora sta dentro questa fascia (invece che nel corpo
        // della card), come <p class="nome-giorno">. È anche
        // l'intestazione cliccabile dell'accordion: data-giorno-target
        // dice al click listener delegato quale corpo-giorno aprire, e
        // la classe "espansa" (già presente se è il giorno corrente)
        // ruota la freccina verso l'alto.
        const fascia = document.createElement('div');
        fascia.className = 'fascia-giorno' + (eGiornoCorrente ? ' espansa' : '');
        fascia.dataset.giornoTarget = giorno.chiave;
        fascia.style.backgroundColor = COLORI_GIORNO[indice];
        fascia.innerHTML = `
            <p class="nome-giorno">${giorno.etichetta}</p>
            <span class="icona-freccia-giorno">▾</span>
        `;

        const cardGiorno = document.createElement('div');
        cardGiorno.className = 'card card-giorno mb-3';
        cardGiorno.appendChild(fascia);
        cardGiorno.appendChild(corpoCard);

        grigliaMenu.appendChild(cardGiorno);
    });

    // Il riepilogo nutrizionale dipende dagli stessi dati della griglia
    // (le ricette pianificate in questa settimana), quindi lo
    // aggiorniamo ogni volta che rigeneriamo la griglia: questo unico
    // punto copre già sia l'apertura della vista (inizializzaVistaMenu
    // chiama generaGriglia), sia il cambio di settimana, sia l'aggiunta
    // o rimozione di una ricetta dal menù (confermaPersoneRapido e
    // rimuoviVoceMenu richiamano entrambe generaGriglia).
    await calcolaEMostraRiepilogoNutrizionale(settimanaInizioCorrente);
}

// Genera il markup HTML di una singola voce di menù già salvata
// (una ricetta assegnata a un giorno/pasto, con le sue persone).
function creaHtmlVoceMenu(riga) {
    const nomeRicetta = riga.ricette ? riga.ricette.nome : '(ricetta non trovata)';

    // Badge colorato "a pillola" per il nome ricetta: stesso colore di
    // sfondo/testo usato per questa categoria alimentare in tutta l'app
    // (card ricette, riepilogo nutrizionale), preso da js/stile.js.
    const categoriaAlimentare = riga.ricette ? riga.ricette.categoria_alimentare : null;
    const coloreCategoria = COLORI_CATEGORIA_ALIMENTARE[categoriaAlimentare];
    const badgeRicetta = coloreCategoria
        ? `<span style="background-color: ${coloreCategoria.bg}; color: ${coloreCategoria.testo}; border-radius: 20px; padding: 4px 10px; font-size: 0.85rem;">${nomeRicetta}</span>`
        : `<strong>${nomeRicetta}</strong>`;

    // riga.persone_assegnate è un array di id (uuid): per ciascuno
    // creiamo un pallino colorato (invece del semplice nome testuale),
    // usando sempre lo stesso colore per la stessa persona in tutta
    // l'app (getColorePersona, da js/stile.js). La classe CSS
    // .pallino-persona-in-chip (vedi css/style.css) gestisce dimensione,
    // bordo bianco e la leggera sovrapposizione tra un pallino e
    // l'altro, per un effetto "avatar impilati". Il "title" mostra il
    // nome per intero passandoci sopra con il mouse.
    const pallinePersone = (riga.persone_assegnate || [])
        .map((idPersona) => {
            const persona = elencoPersone.find((p) => p.id === idPersona);
            if (!persona) {
                return '';
            }
            const colore = getColorePersona(persona.nome);
            return `<span class="pallino-persona-in-chip" title="${persona.nome}" style="background-color: ${colore};"></span>`;
        })
        .join('');

    return `
        <div class="d-flex justify-content-between align-items-center border rounded px-2 py-1 mb-1">
            <span class="d-flex align-items-center">
                ${badgeRicetta}
                ${pallinePersone}
            </span>
            <span class="link-rimuovi-pasto btn-rimuovi-voce-menu" data-id="${riga.id}">Rimuovi</span>
        </div>
    `;
}

// Genera il markup HTML di un intero blocco pasto (es. "Lunedì - Cena"):
// l'elenco delle ricette già assegnate, più il link per aggiungerne una
// nuova. Il blocco porta gli attributi data-giorno e data-pasto: servono
// per sapere a quale giorno/pasto appartiene, sia al click su "+
// Aggiungi" (per salvare la selezione, vedi più sotto) sia quando
// apriFormPersoneRapido() deve ritrovare questo stesso blocco al
// ritorno dal Libretto Ricette.
//
// NOTA: qui non c'è più, come in passato, una tendina <select> con
// tutte le ricette disponibili: la scelta della ricetta avviene ora nel
// Libretto Ricette (vedi il click su "+ Aggiungi" nel listener delegato
// più sotto, e js/ricette.js), non più in un form inline in questa vista.
function creaHtmlBloccoPasto(giorno, pasto, righeCella) {
    const righeHtml = righeCella.map(creaHtmlVoceMenu).join('');

    return `
        <div class="mb-3 blocco-pasto" data-giorno="${giorno.chiave}" data-pasto="${pasto.chiave}">
            <h6 class="etichetta-pasto">${pasto.etichetta}</h6>
            <div class="mb-1">
                ${righeHtml}
            </div>
            <span class="link-aggiungi-pasto btn-mostra-form-aggiungi">+ Aggiungi</span>
        </div>
    `;
}

// ==========================================================
// FLUSSO A DUE PASSI: apre il form "scegli le persone" per una ricetta
// già scelta nel Libretto Ricette
// ==========================================================
// Esportata: richiamata da inizializzaVistaMenu() quando l'utente torna
// dal Libretto Ricette con una ricetta già scelta (vedi
// js/stato-selezione.js). Inserisce, dentro il blocco-pasto giusto della
// griglia (già ricostruita), un piccolo form con il nome della ricetta
// fisso e solo le checkbox delle persone: niente tendina, perché la
// ricetta è già stata decisa nel passo precedente.
export function apriFormPersoneRapido(giorno, tipoPasto, ricettaId, nomeRicetta) {
    const bloccoPasto = grigliaMenu.querySelector(
        `.blocco-pasto[data-giorno="${giorno}"][data-pasto="${tipoPasto}"]`
    );

    if (!bloccoPasto) {
        // Non dovrebbe succedere (giorno/pasto sempre tra quelli noti),
        // ma senza il blocco giusto non c'è dove inserire il form.
        return;
    }

    // Se il giorno era chiuso nell'accordion, lo apriamo: altrimenti
    // l'utente non vedrebbe il form appena inserito (vedi css/style.css,
    // .corpo-giorno è display:none finché non ha la classe "aperto").
    const corpoGiorno = bloccoPasto.closest('.corpo-giorno');
    if (corpoGiorno && !corpoGiorno.classList.contains('aperto')) {
        corpoGiorno.classList.add('aperto');
        const fasciaCorrispondente = grigliaMenu.querySelector(
            `.fascia-giorno[data-giorno-target="${giorno}"]`
        );
        if (fasciaCorrispondente) {
            fasciaCorrispondente.classList.add('espansa');
        }
    }

    const checkboxPersone = elencoPersone
        .map((persona) => {
            const idCheckbox = `persona-rapida-${giorno}-${tipoPasto}-${persona.id}`;
            return `
                <div class="form-check form-check-inline">
                    <input class="form-check-input checkbox-persona-rapido" type="checkbox" value="${persona.id}" id="${idCheckbox}">
                    <label class="form-check-label small" for="${idCheckbox}">${persona.nome}</label>
                </div>
            `;
        })
        .join('');

    const formHtml = `
        <div class="form-persone-rapido mt-2" data-ricetta-id="${ricettaId}">
            <p class="small mb-2">Ricetta scelta: <strong>${nomeRicetta}</strong></p>
            <div class="mb-2">${checkboxPersone}</div>
            <button type="button" class="btn btn-success btn-sm btn-conferma-persone-rapido">Conferma</button>
            <button type="button" class="btn btn-secondary btn-sm btn-annulla-persone-rapido">Annulla</button>
        </div>
    `;

    bloccoPasto.insertAdjacentHTML('beforeend', formHtml);
}

// ==========================================================
// AZIONI: aggiungi voce di menu / rimuovi voce di menu
// ==========================================================

// Legge i dati compilati nel form "persone rapido" (vedi
// apriFormPersoneRapido) e inserisce la nuova voce in menu_settimanale.
// La ricetta è già nota (salvata in data-ricetta-id sul form stesso, dal
// momento in cui è stata scelta nel Libretto Ricette): qui raccogliamo
// solo le persone spuntate.
async function confermaPersoneRapido(bottoneConferma) {
    const formRapido = bottoneConferma.closest('.form-persone-rapido');
    const bloccoPasto = bottoneConferma.closest('.blocco-pasto');
    const giorno = bloccoPasto.dataset.giorno;
    const pasto = bloccoPasto.dataset.pasto;
    const ricettaId = formRapido.dataset.ricettaId;

    const personeSelezionate = Array.from(
        formRapido.querySelectorAll('.checkbox-persona-rapido:checked')
    ).map((checkbox) => checkbox.value);

    const { error } = await supabase
        .from('menu_settimanale')
        .insert({
            settimana_inizio: settimanaInizioCorrente,
            giorno: giorno,
            tipo_pasto: pasto,
            ricetta_id: ricettaId,
            persone_assegnate: personeSelezionate
        });

    if (error) {
        alert('Errore nel salvataggio della voce di menù: ' + error.message);
        return;
    }

    // Ricostruiamo tutta la griglia: così la nuova voce compare subito
    // (il form "persone rapido" sparisce da solo, dato che generaGriglia
    // ricrea tutto da zero a partire dai dati appena salvati).
    await generaGriglia();
}

// Chiude il form "persone rapido" senza salvare nulla.
function annullaPersoneRapido(bottoneAnnulla) {
    bottoneAnnulla.closest('.form-persone-rapido').remove();
}

// Cancella una voce di menu_settimanale (identificata dal suo id) e
// ricarica la griglia per riflettere la rimozione.
async function rimuoviVoceMenu(id) {
    const { error } = await supabase
        .from('menu_settimanale')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Errore durante la rimozione della voce di menù: ' + error.message);
        return;
    }

    await generaGriglia();
}

// ==========================================================
// EVENTI (collegati una sola volta: #griglia-menu e #selettore-settimana
// esistono sempre nella pagina, anche quando la vista è nascosta, quindi
// non serve ricollegarli ogni volta che si entra nella vista)
// ==========================================================

// Delega di un solo listener di click su tutta la griglia: dato che le
// celle vengono ricreate ogni volta (generaGriglia sostituisce
// l'innerHTML), sarebbe scomodo ricollegare listener singoli a ogni
// bottone. Con la delega, event.target.closest(...) ci dice su quale
// bottone specifico (dentro quale cella) l'utente ha cliccato.
//
// Il click sulla fascia colorata (apri/chiudi accordion) è gestito qui
// dentro, invece che con un secondo addEventListener a parte: questo
// listener sulla griglia viene registrato UNA SOLA VOLTA, a questo
// punto del file, quando lo script viene caricato — non dentro
// generaGriglia(), che invece gira ogni volta che si cambia settimana o
// si aggiunge/rimuove una ricetta. Se registrassimo un listener per la
// fascia dentro generaGriglia(), ad ogni rigenerazione della griglia se
// ne accumulerebbe uno nuovo sopra ai precedenti (mai rimossi), e un
// singolo click finirebbe per scattare più volte.
grigliaMenu.addEventListener('click', async (event) => {
    const fasciaCliccata = event.target.closest('.fascia-giorno');
    if (fasciaCliccata) {
        // Troviamo il corpo-giorno con lo stesso "nome giorno" salvato
        // nella fascia (data-giorno-target) e ne alterniamo (toggle) la
        // visibilità, insieme alla rotazione della freccina sulla fascia.
        const corpoGiorno = grigliaMenu.querySelector(
            `.corpo-giorno[data-giorno="${fasciaCliccata.dataset.giornoTarget}"]`
        );
        if (corpoGiorno) {
            corpoGiorno.classList.toggle('aperto');
            fasciaCliccata.classList.toggle('espansa');
        }
        return;
    }

    const bottoneMostraForm = event.target.closest('.btn-mostra-form-aggiungi');
    if (bottoneMostraForm) {
        // Nuovo flusso a due passi: invece di aprire qui un form con una
        // tendina di scelta ricetta, salviamo QUALE giorno/pasto l'utente
        // vuole riempire (js/stato-selezione.js, condiviso con
        // js/ricette.js senza che i due file si importino a vicenda) e lo
        // mandiamo a scegliere la ricetta nel Libretto Ricette. Al ritorno
        // sarà inizializzaVistaMenu() a riaprire qui, nel punto giusto, il
        // form per scegliere solo le persone (vedi apriFormPersoneRapido).
        const bloccoPasto = bottoneMostraForm.closest('.blocco-pasto');
        impostaSelezione(bloccoPasto.dataset.giorno, bloccoPasto.dataset.pasto);
        mostraVista('ricette');
        return;
    }

    const bottoneConfermaRapido = event.target.closest('.btn-conferma-persone-rapido');
    if (bottoneConfermaRapido) {
        await confermaPersoneRapido(bottoneConfermaRapido);
        return;
    }

    const bottoneAnnullaRapido = event.target.closest('.btn-annulla-persone-rapido');
    if (bottoneAnnullaRapido) {
        annullaPersoneRapido(bottoneAnnullaRapido);
        return;
    }

    const bottoneRimuovi = event.target.closest('.btn-rimuovi-voce-menu');
    if (bottoneRimuovi) {
        await rimuoviVoceMenu(bottoneRimuovi.dataset.id);
        return;
    }
});

// Quando l'utente sceglie un'altra data, ricalcoliamo il lunedì
// corrispondente e rigeneriamo tutta la griglia per quella settimana.
selettoreSettimana.addEventListener('change', () => {
    if (!selettoreSettimana.value) {
        return;
    }

    const dataScelta = parseDataISO(selettoreSettimana.value);
    settimanaInizioCorrente = calcolaLunedi(dataScelta);
    generaGriglia();
});

// Click su "Scarica PDF del menù": riusiamo la stessa variabile
// settimanaInizioCorrente già tenuta aggiornata da questo file (dal
// caricamento iniziale e da ogni cambio di settimana), così il PDF
// generato corrisponde sempre a quello che l'utente sta vedendo a schermo.
bottoneStampaMenu.addEventListener('click', () => {
    generaPdfMenu(settimanaInizioCorrente);
});

// ==========================================================
// FUNZIONE ESPORTATA: inizializzazione della vista
// ==========================================================
// Richiamata dal router (js/router.js) ogni volta che l'utente entra
// nella vista "menu": ricarica persone e ricette (potrebbero essere
// cambiate), imposta la data odierna se non è già stata scelta una data,
// e genera la griglia per la settimana corrispondente.
export async function inizializzaVistaMenu() {
    await caricaPersone();

    // Le persone non cambiano ad ogni cambio di settimana: generiamo la
    // legenda una sola volta qui, non dentro generaGriglia() (che invece
    // gira ad ogni cambio settimana/aggiunta/rimozione).
    generaLegendaPersone();

    if (!selettoreSettimana.value) {
        selettoreSettimana.value = formattaDataISO(new Date());
    }

    const dataScelta = parseDataISO(selettoreSettimana.value);
    settimanaInizioCorrente = calcolaLunedi(dataScelta);

    await generaGriglia();

    // Flusso a due passi "scegli la ricetta nel Libretto, torna qui per
    // le persone": se l'utente sta rientrando dal Libretto Ricette con
    // una ricetta già scelta (vedi js/stato-selezione.js), apriamo
    // subito il form per scegliere le persone, nel punto giusto della
    // griglia appena ricostruita. Lo facciamo DOPO generaGriglia() e non
    // prima, perché generaGriglia() svuota e ricrea da zero tutto il
    // contenuto di #griglia-menu: se aprissimo il form prima, verrebbe
    // cancellato subito insieme al resto.
    const selezione = leggiSelezione();
    if (selezione.attivo && selezione.ricettaId) {
        apriFormPersoneRapido(selezione.giorno, selezione.tipoPasto, selezione.ricettaId, selezione.nomeRicetta);
        pulisciSelezione();
    }
}
