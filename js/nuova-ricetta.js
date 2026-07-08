import { supabase } from './supabase-config.js';
import { mostraVista } from './router.js';
import { COLORI_CATEGORIA_ALIMENTARE } from './stile.js';
import { cercaSuggerimento } from './suggerimenti-ingredienti.js';

// --- Riferimenti agli elementi fissi della pagina ---
const form = document.getElementById('form-nuova-ricetta');
const contenitoreIngredienti = document.getElementById('contenitore-ingredienti');
const bottoneAggiungiIngrediente = document.getElementById('btn-aggiungi-ingrediente');
const avvisoIngredienti = document.getElementById('avviso-ingredienti');
const messaggioSalvataggio = document.getElementById('messaggio-salvataggio');
const titoloForm = document.getElementById('titolo-form-ricetta');
const bottoneSubmit = document.getElementById('btn-submit-ricetta');
const selectCategoriaAlimentare = document.getElementById('input-categoria-alimentare');
const pallinoCategoriaAlimentare = document.getElementById('pallino-categoria-alimentare');

// Contatore usato per assegnare un data-riga-id univoco a ogni riga
// ingrediente. Viene azzerato a 1 ogni volta che il form viene
// reinizializzato (vedi inizializzaFormNuovaRicetta più sotto).
let contatoreRighe = 1;

// null = il form è in modalità "crea nuova ricetta" (comportamento di
// sempre). Quando contiene un id, il form è in modalità "modifica
// ricetta esistente": viene impostato da caricaRicettaPerModifica() e
// riportato a null da inizializzaFormNuovaRicetta().
let idRicettaInModifica = null;

// Somma dei fattori porzione di tutte le persone in famiglia (es. 3.0).
// Viene ricalcolata leggendo la tabella "persone" ogni volta che si entra
// in questa vista, e serve per convertire "quantità per tutta la
// famiglia" in "quantità per 1 porzione adulto standard".
let sommaFattoriPorzione = 0;

// ==========================================================
// PALLINO ANTEPRIMA COLORE CATEGORIA ALIMENTARE
// ==========================================================
// Colora #pallino-categoria-alimentare con lo stesso colore di sfondo
// usato per quella categoria nei badge (card ricette, griglia menù,
// ecc.), leggendolo da COLORI_CATEGORIA_ALIMENTARE in js/stile.js: così
// l'utente vede subito, mentre sceglie dalla tendina, che colore avrà
// la ricetta nel resto dell'app.
function aggiornaPallinoCategoria() {
    const categoriaSelezionata = selectCategoriaAlimentare.value;
    const coloreCategoria = COLORI_CATEGORIA_ALIMENTARE[categoriaSelezionata];

    pallinoCategoriaAlimentare.style.backgroundColor = coloreCategoria
        ? coloreCategoria.bg
        : 'transparent';
}

// Aggiorniamo il pallino ogni volta che l'utente cambia la scelta nella
// tendina. Collegato una sola volta: il <select> non viene mai
// ricreato, solo il suo valore viene cambiato da reset/precompilazione.
selectCategoriaAlimentare.addEventListener('change', aggiornaPallinoCategoria);

// ==========================================================
// 1) CARICAMENTO SOMMA FATTORI PORZIONE
// ==========================================================
// Legge tutte le persone della famiglia e somma i loro fattori porzione.
async function caricaSommaFattoriPorzione() {
    const { data, error } = await supabase
        .from('persone')
        .select('fattore_porzione');

    if (error) {
        console.error('Errore nel caricamento dei fattori porzione:', error.message);
        return;
    }

    sommaFattoriPorzione = data.reduce((somma, persona) => somma + persona.fattore_porzione, 0);

    // Se l'utente ha già digitato qualcosa prima che arrivasse la
    // risposta di Supabase, ricalcoliamo subito il risultato mostrato.
    document.querySelectorAll('.riga-ingrediente').forEach(aggiornaCalcoloRiga);
}

// ==========================================================
// 2) CALCOLO AUTOMATICO "FAMIGLIA -> PORZIONE ADULTO"
// ==========================================================
// Aggiorna lo span di anteprima di UNA riga ingrediente, in base a cosa è
// selezionato nel select "per_famiglia / per_porzione" e al valore digitato.
function aggiornaCalcoloRiga(riga) {
    const selectTipo = riga.querySelector('.select-tipo-quantita');
    const inputQuantita = riga.querySelector('.input-quantita');
    const selectUnita = riga.querySelector('.select-unita');
    const spanCalcolo = riga.querySelector('.span-calcolo-porzione');

    const quantita = parseFloat(inputQuantita.value);

    // Se il valore è già "per porzione adulto", oppure non è stato ancora
    // inserito un numero valido, non c'è nessun calcolo da mostrare.
    if (selectTipo.value === 'per_porzione' || isNaN(quantita) || sommaFattoriPorzione === 0) {
        spanCalcolo.textContent = '';
        return;
    }

    // Il valore inserito è per tutta la famiglia: lo dividiamo per la somma
    // dei fattori porzione per ottenere la quantità di 1 porzione adulto.
    const quantitaPerPorzione = (quantita / sommaFattoriPorzione).toFixed(1);
    spanCalcolo.textContent = `= ${quantitaPerPorzione} ${selectUnita.value} per porzione adulto`;
}

// ==========================================================
// 3) GESTIONE RIGHE INGREDIENTI DINAMICHE (aggiungi / rimuovi)
// ==========================================================

// Collega gli event listener necessari a una riga ingrediente: sia alla
// riga iniziale, sia a ogni nuova riga aggiunta dopo.
function collegaEventiRiga(riga) {
    const selectTipo = riga.querySelector('.select-tipo-quantita');
    const inputQuantita = riga.querySelector('.input-quantita');
    const bottoneRimuovi = riga.querySelector('.btn-rimuovi-ingrediente');
    const inputNome = riga.querySelector('.input-nome-ingrediente');
    const spanSuggerimento = riga.querySelector('.suggerimento-quantita');

    selectTipo.addEventListener('change', () => aggiornaCalcoloRiga(riga));
    inputQuantita.addEventListener('input', () => aggiornaCalcoloRiga(riga));

    bottoneRimuovi.addEventListener('click', () => rimuoviRiga(riga));

    // Suggerimento automatico di quantità (vedi js/suggerimenti-ingredienti.js):
    // si aggiorna ad ogni carattere digitato nel nome ingrediente, e si
    // applica alla riga con un click sullo span del suggerimento stesso.
    inputNome.addEventListener('input', () => aggiornaSuggerimentoRiga(riga));
    spanSuggerimento.addEventListener('click', () => applicaSuggerimentoRiga(riga));
}

// ==========================================================
// SUGGERIMENTO AUTOMATICO DI QUANTITÀ
// ==========================================================

// Richiamata ad ogni carattere digitato nel nome ingrediente di UNA riga:
// cerca un suggerimento nel dizionario e lo mostra (o nasconde) nello
// span dedicato di quella stessa riga.
function aggiornaSuggerimentoRiga(riga) {
    const inputNome = riga.querySelector('.input-nome-ingrediente');
    const spanSuggerimento = riga.querySelector('.suggerimento-quantita');

    // Le categorie pasto (pranzo/cena/...) sono spuntate una sola volta
    // per l'intera ricetta, nel form generale, non riga per riga: le
    // leggiamo da lì per capire quale grammatura proporre.
    const categoriePasto = Array.from(
        document.querySelectorAll('input[name="categoria-pasto"]:checked')
    ).map((checkbox) => checkbox.value);

    const suggerimento = cercaSuggerimento(inputNome.value, categoriePasto);

    if (!suggerimento) {
        // Nessuna corrispondenza (o campo vuoto): nessun messaggio da
        // mostrare, e ripuliamo eventuali dati di un suggerimento
        // precedente rimasto attaccato allo span (altrimenti un click
        // "vecchio" applicherebbe valori ormai non più corretti).
        spanSuggerimento.textContent = '';
        delete spanSuggerimento.dataset.quantita;
        delete spanSuggerimento.dataset.unita;
        delete spanSuggerimento.dataset.arrotonda;
        return;
    }

    // Salviamo i valori suggeriti come data-attribute sullo span stesso:
    // ci serviranno al momento del click, in applicaSuggerimentoRiga.
    spanSuggerimento.textContent = `Suggerito dal tuo piano: ${suggerimento.quantita} ${suggerimento.unita} (clicca per usare)`;
    spanSuggerimento.dataset.quantita = suggerimento.quantita;
    spanSuggerimento.dataset.unita = suggerimento.unita;
    spanSuggerimento.dataset.arrotonda = suggerimento.arrotonda;
}

// Richiamata al click sullo span del suggerimento: copia i valori
// suggeriti nei campi veri della riga (quantità, unità, ed eventualmente
// il checkbox arrotonda per le uova), poi svuota il suggerimento perché
// è stato "usato". Il suggerimento resta comunque facoltativo: l'utente
// può sempre modificare a mano il valore anche dopo averlo applicato.
function applicaSuggerimentoRiga(riga) {
    const spanSuggerimento = riga.querySelector('.suggerimento-quantita');

    if (!spanSuggerimento.dataset.quantita) {
        return; // niente suggerimento attivo su questa riga: non facciamo nulla
    }

    riga.querySelector('.input-quantita').value = spanSuggerimento.dataset.quantita;
    riga.querySelector('.select-unita').value = spanSuggerimento.dataset.unita;

    if (spanSuggerimento.dataset.arrotonda === 'true') {
        riga.querySelector('.checkbox-arrotonda').checked = true;
    }

    // Il valore di input-quantita è cambiato via JavaScript (non con una
    // digitazione dell'utente), quindi il listener "input" collegato in
    // collegaEventiRiga non scatta da solo: richiamiamo qui il calcolo,
    // così l'anteprima "famiglia -> porzione adulto" resta coerente.
    aggiornaCalcoloRiga(riga);

    // Il suggerimento è stato usato: svuotiamo testo e dati salvati.
    spanSuggerimento.textContent = '';
    delete spanSuggerimento.dataset.quantita;
    delete spanSuggerimento.dataset.unita;
    delete spanSuggerimento.dataset.arrotonda;
}

// Genera il markup HTML di una riga ingrediente vuota, con un data-riga-id
// univoco (serve anche per generare un id univoco al checkbox "arrotonda").
// La classe "riga-ingrediente" resta invariata (serve al JS per
// selezionare le righe); "riga-ingrediente-stile" aggiunge solo lo
// sfondo/angoli arrotondati definiti in css/style.css.
function creaHtmlRiga(id) {
    return `
        <div class="row g-2 align-items-center riga-ingrediente riga-ingrediente-stile" data-riga-id="${id}">
            <div class="col-md-3">
                <input type="text" class="form-control form-control-sm input-nome-ingrediente" placeholder="Nome ingrediente">
                <span class="small text-muted suggerimento-quantita" style="display:block; cursor:pointer;"></span>
            </div>
            <div class="col-md-2">
                <select class="form-select form-select-sm select-tipo-quantita">
                    <option value="per_porzione" selected>Già per porzione adulto</option>
                    <option value="per_famiglia">Per tutta la famiglia</option>
                </select>
            </div>
            <div class="col-md-2">
                <input type="number" step="0.1" class="form-control form-control-sm input-quantita" placeholder="Quantità">
            </div>
            <div class="col-md-2">
                <select class="form-select form-select-sm select-unita">
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="pezzi">pezzi</option>
                </select>
            </div>
            <div class="col-md-2">
                <div class="form-check">
                    <input class="form-check-input checkbox-arrotonda" type="checkbox" id="arrotonda-${id}">
                    <label class="form-check-label small" for="arrotonda-${id}">Arrotonda a pezzo intero</label>
                </div>
            </div>
            <div class="col-md-1 text-end">
                <!-- La classe "btn-rimuovi-ingrediente" resta per il click
                     listener già esistente in collegaEventiRiga(); "link-rimuovi-ingrediente"
                     dà solo lo stile a link colorato invece del bottone bordato. -->
                <span class="btn-rimuovi-ingrediente link-rimuovi-ingrediente">Rimuovi</span>
            </div>
            <div class="col-12">
                <span class="small text-muted span-calcolo-porzione"></span>
            </div>
        </div>
    `;
}

// Aggiunge una nuova riga ingrediente vuota in fondo al contenitore e le
// collega gli stessi event listener delle altre righe.
function aggiungiRiga() {
    contatoreRighe++;
    contenitoreIngredienti.insertAdjacentHTML('beforeend', creaHtmlRiga(contatoreRighe));

    const nuovaRiga = contenitoreIngredienti.lastElementChild;
    collegaEventiRiga(nuovaRiga);
}

// Rimuove una riga ingrediente dalla pagina, a meno che non sia rimasta
// l'unica riga: in quel caso mostra un breve avviso invece di eliminarla.
function rimuoviRiga(riga) {
    const numeroRighe = contenitoreIngredienti.querySelectorAll('.riga-ingrediente').length;

    if (numeroRighe <= 1) {
        avvisoIngredienti.style.display = 'block';
        setTimeout(() => {
            avvisoIngredienti.style.display = 'none';
        }, 2500);
        return;
    }

    riga.remove();
}

// Questo listener va collegato una sola volta: il bottone "+ Aggiungi
// ingrediente" esiste una sola volta nella pagina (non viene ricreato
// ogni volta che si entra nella vista).
bottoneAggiungiIngrediente.addEventListener('click', aggiungiRiga);

// ==========================================================
// 4) INIZIALIZZAZIONE / RESET DEL FORM
// ==========================================================
// Esportata: viene richiamata dal router (js/router.js) ogni volta che
// l'utente entra nella vista "nuova-ricetta", così il form riparte
// sempre pulito e non mostra i dati di un inserimento precedente.
export function inizializzaFormNuovaRicetta() {
    // Ripartiamo sempre in modalità "crea nuova ricetta": se l'utente
    // arrivava da una modifica lasciata a metà, la annulliamo qui.
    idRicettaInModifica = null;
    titoloForm.textContent = 'Nuova Ricetta';
    bottoneSubmit.textContent = 'Salva ricetta';

    // form.reset() riporta ai valori originali dell'HTML tutti i campi
    // dentro <form>: nome vuoto, checkbox categoria pasto deselezionati,
    // select categoria alimentare sulla prima opzione, radio "adatto a"
    // su "adulti" (perché ha l'attributo checked nell'HTML), note vuote.
    form.reset();

    // Rimuoviamo tutte le righe ingrediente eventualmente presenti
    // (comprese quelle aggiunte in una sessione di inserimento precedente)
    // e ricreiamo da zero un'unica riga vuota.
    contenitoreIngredienti.innerHTML = '';
    contatoreRighe = 1;
    contenitoreIngredienti.insertAdjacentHTML('beforeend', creaHtmlRiga(1));
    collegaEventiRiga(contenitoreIngredienti.querySelector('.riga-ingrediente'));

    // Nascondiamo eventuali messaggi rimasti da un salvataggio precedente
    nascondiMessaggio();
    avvisoIngredienti.style.display = 'none';

    // Ricarichiamo la somma dei fattori porzione: potrebbe essere
    // cambiata (es. sono cambiate le persone in famiglia) da quando
    // questa vista è stata aperta l'ultima volta.
    caricaSommaFattoriPorzione();

    // form.reset() ha appena riportato il select alla prima opzione
    // ("Carne rossa"): aggiorniamo subito il pallino di anteprima con
    // il suo colore, invece di lasciarlo vuoto finché l'utente non
    // tocca la tendina.
    aggiornaPallinoCategoria();
}

// ==========================================================
// 5) CARICAMENTO DI UNA RICETTA ESISTENTE PER LA MODIFICA
// ==========================================================
// Esportata: richiamata da js/ricette.js quando l'utente clicca
// "Modifica" su una card (subito dopo che il router ha già mostrato e
// resettato questa vista). Precompila tutti i campi del form con i dati
// della ricetta scelta e fa passare il form dalla modalità "crea" alla
// modalità "modifica" impostando idRicettaInModifica.
export async function caricaRicettaPerModifica(idRicetta) {
    idRicettaInModifica = idRicetta;

    const { data: ricetta, error } = await supabase
        .from('ricette')
        .select('*, ingredienti(*)')
        .eq('id', idRicetta)
        .single();

    if (error) {
        mostraMessaggio('Errore nel caricamento della ricetta da modificare: ' + error.message, false);
        return;
    }

    // Cambiamo titolo e testo del bottone per far capire subito
    // all'utente che ora sta modificando una ricetta esistente, e non
    // creandone una nuova.
    titoloForm.textContent = 'Modifica Ricetta';
    bottoneSubmit.textContent = 'Salva modifiche';

    // --- Precompiliamo i campi semplici del form ---
    document.getElementById('input-nome').value = ricetta.nome;
    document.getElementById('input-note').value = ricetta.note || '';

    // Checkbox "categoria pasto": spuntiamo solo quelli il cui value è
    // presente nell'array categoria_pasto salvato per questa ricetta.
    document.querySelectorAll('input[name="categoria-pasto"]').forEach((checkbox) => {
        checkbox.checked = ricetta.categoria_pasto.includes(checkbox.value);
    });

    selectCategoriaAlimentare.value = ricetta.categoria_alimentare;

    // Aggiorniamo subito il pallino di anteprima con il colore della
    // categoria della ricetta appena caricata, così è corretto fin da
    // subito e non solo dopo un eventuale cambio manuale nella tendina.
    aggiornaPallinoCategoria();

    // Radio "adatto a": selezioniamo quello con lo stesso value salvato
    const radioAdattoA = document.querySelector(`input[name="adatto-a"][value="${ricetta.adatto_a}"]`);
    if (radioAdattoA) {
        radioAdattoA.checked = true;
    }

    // --- Ricreiamo una riga ingrediente per ciascun ingrediente salvato ---
    contenitoreIngredienti.innerHTML = '';

    if (ricetta.ingredienti.length === 0) {
        // Ricetta senza ingredienti salvati: partiamo comunque da una
        // riga vuota, come nel form di creazione.
        contatoreRighe = 1;
        contenitoreIngredienti.insertAdjacentHTML('beforeend', creaHtmlRiga(1));
        collegaEventiRiga(contenitoreIngredienti.querySelector('.riga-ingrediente'));
    } else {
        contatoreRighe = 0;
        ricetta.ingredienti.forEach((ingrediente) => {
            contatoreRighe++;
            contenitoreIngredienti.insertAdjacentHTML('beforeend', creaHtmlRiga(contatoreRighe));

            const riga = contenitoreIngredienti.lastElementChild;
            collegaEventiRiga(riga);

            // Le quantità salvate nel database sono già "per 1 porzione
            // adulto standard" (è così che questo stesso form le salva),
            // quindi il select tipo quantità resta sempre su
            // "per_porzione": non c'è nessun ricalcolo da mostrare.
            riga.querySelector('.input-nome-ingrediente').value = ingrediente.nome;
            riga.querySelector('.select-tipo-quantita').value = 'per_porzione';
            riga.querySelector('.input-quantita').value = ingrediente.quantita;
            riga.querySelector('.select-unita').value = ingrediente.unita;
            riga.querySelector('.checkbox-arrotonda').checked = ingrediente.arrotonda_a_pezzo;
        });
    }

    nascondiMessaggio();
    avvisoIngredienti.style.display = 'none';
}

// ==========================================================
// 6) SALVATAGGIO RICETTA (submit del form)
// ==========================================================
// Questo listener va collegato una sola volta, al caricamento dello
// script: il form <form id="form-nuova-ricetta"> non viene ricreato
// ogni volta che si entra nella vista, solo il suo contenuto viene
// svuotato da inizializzaFormNuovaRicetta().
form.addEventListener('submit', async (event) => {
    event.preventDefault(); // evitiamo il ricaricamento della pagina

    nascondiMessaggio();

    // --- Raccolta dei dati generali della ricetta ---
    const nome = document.getElementById('input-nome').value.trim();

    // Raccogliamo tutti i checkbox "categoria-pasto" selezionati in un array
    // di stringhe (es. ["pranzo", "cena"]), da salvare in una colonna array.
    const categoriaPasto = Array.from(
        document.querySelectorAll('input[name="categoria-pasto"]:checked')
    ).map((checkbox) => checkbox.value);

    const categoriaAlimentare = document.getElementById('input-categoria-alimentare').value;

    const adattoA = document.querySelector('input[name="adatto-a"]:checked').value;

    const noteInserite = document.getElementById('input-note').value.trim();
    const note = noteInserite === '' ? null : noteInserite; // stringa vuota -> null

    const datiRicetta = {
        nome: nome,
        categoria_pasto: categoriaPasto,
        categoria_alimentare: categoriaAlimentare,
        adatto_a: adattoA,
        note: note
    };

    let ricettaId;

    if (idRicettaInModifica === null) {
        // --- MODALITÀ CREAZIONE (comportamento invariato) ---
        // Usiamo .select() dopo l'insert per farci restituire subito la
        // riga appena creata (in particolare il suo "id"), che serve per
        // collegare gli ingredienti alla ricetta giusta.
        const { data: ricetteInserite, error: erroreRicetta } = await supabase
            .from('ricette')
            .insert(datiRicetta)
            .select();

        if (erroreRicetta) {
            // Senza la ricetta salvata non ha senso proseguire con gli
            // ingredienti: mostriamo l'errore e ci fermiamo qui.
            mostraMessaggio('Errore nel salvataggio della ricetta: ' + erroreRicetta.message, false);
            return;
        }

        ricettaId = ricetteInserite[0].id;
    } else {
        // --- MODALITÀ MODIFICA: aggiorniamo la riga esistente ---
        const { error: erroreRicetta } = await supabase
            .from('ricette')
            .update(datiRicetta)
            .eq('id', idRicettaInModifica);

        if (erroreRicetta) {
            mostraMessaggio('Errore nell\'aggiornamento della ricetta: ' + erroreRicetta.message, false);
            return;
        }

        ricettaId = idRicettaInModifica;

        // Per gli ingredienti, il modo più semplice e sicuro di gestire
        // una modifica è: cancellare TUTTI gli ingredienti già collegati
        // a questa ricetta e ricrearli da capo con i valori attuali del
        // form, invece di calcolare riga per riga cosa è stato aggiunto,
        // modificato o rimosso rispetto a prima. Questo approccio
        // "cancella e ricrea" è accettabile qui perché gli ingredienti
        // non hanno nessun'altra tabella che li referenzia (a differenza
        // delle ricette, a cui invece punta menu_settimanale.ricetta_id).
        const { error: erroreCancellazione } = await supabase
            .from('ingredienti')
            .delete()
            .eq('ricetta_id', ricettaId);

        if (erroreCancellazione) {
            mostraMessaggio('Errore nell\'aggiornamento degli ingredienti: ' + erroreCancellazione.message, false);
            return;
        }
    }

    // --- Preparazione degli ingredienti da salvare (identica per creazione e modifica) ---
    const righeIngredienti = document.querySelectorAll('.riga-ingrediente');
    const ingredientiDaSalvare = [];

    righeIngredienti.forEach((riga) => {
        const nomeIngrediente = riga.querySelector('.input-nome-ingrediente').value.trim();

        // Le righe lasciate vuote dall'utente vengono semplicemente ignorate
        if (nomeIngrediente === '') {
            return;
        }

        const tipoQuantita = riga.querySelector('.select-tipo-quantita').value;
        const quantitaInserita = parseFloat(riga.querySelector('.input-quantita').value);
        const unita = riga.querySelector('.select-unita').value;
        const arrotondaAPezzo = riga.querySelector('.checkbox-arrotonda').checked;

        // Calcoliamo la quantità finale "per 1 porzione adulto standard"
        // da salvare nel database.
        let quantitaFinale;
        if (tipoQuantita === 'per_famiglia') {
            quantitaFinale = parseFloat((quantitaInserita / sommaFattoriPorzione).toFixed(1));
        } else {
            quantitaFinale = quantitaInserita;
        }

        ingredientiDaSalvare.push({
            ricetta_id: ricettaId,
            nome: nomeIngrediente,
            quantita: quantitaFinale,
            unita: unita,
            arrotonda_a_pezzo: arrotondaAPezzo
        });
    });

    // --- Inserimento dei nuovi ingredienti (se ce n'è almeno uno compilato) ---
    if (ingredientiDaSalvare.length > 0) {
        const { error: erroreIngredienti } = await supabase
            .from('ingredienti')
            .insert(ingredientiDaSalvare);

        if (erroreIngredienti) {
            // La ricetta è già stata salvata, ma gli ingredienti no: lo
            // segnaliamo chiaramente e NON cambiamo vista, così l'utente
            // può leggere l'errore.
            mostraMessaggio(
                'Ricetta salvata, ma errore nel salvataggio degli ingredienti: ' + erroreIngredienti.message,
                false
            );
            return;
        }
    }

    // --- Tutto andato a buon fine: avviso e ritorno alla vista ricette ---
    // Essendo una Single Page Application, non cambiamo più pagina con
    // window.location.href: chiamiamo il router, che si occupa anche di
    // ricaricare l'elenco ricette (così compaiono subito i cambiamenti).
    const testoEsito = idRicettaInModifica === null
        ? 'Ricetta salvata con successo'
        : 'Modifiche salvate con successo';

    mostraMessaggio(testoEsito, true);
    setTimeout(() => {
        mostraVista('ricette');
    }, 1500);
});

// Mostra un messaggio di esito (verde se successo, rosso se errore)
function mostraMessaggio(testo, successo) {
    messaggioSalvataggio.textContent = testo;
    messaggioSalvataggio.classList.remove('text-success', 'text-danger');
    messaggioSalvataggio.classList.add(successo ? 'text-success' : 'text-danger');
    messaggioSalvataggio.style.display = 'block';
}

function nascondiMessaggio() {
    messaggioSalvataggio.style.display = 'none';
    messaggioSalvataggio.classList.remove('text-success', 'text-danger');
}
