import { supabase } from './supabase-config.js';

// --- Riferimenti agli elementi fissi della vista (esistono una sola
// volta nella pagina, non vengono mai ricreati) ---
const selettoreSettimanaSpesa = document.getElementById('selettore-settimana-spesa');
const bottoneGenera = document.getElementById('btn-genera-lista');
const contenitoreGenerata = document.getElementById('lista-spesa-generata');
const inputVoceManuale = document.getElementById('input-voce-manuale');
const bottoneAggiungiManuale = document.getElementById('btn-aggiungi-manuale');
const contenitoreManuale = document.getElementById('lista-spesa-manuale');

// Settimana attualmente visualizzata (stringa "YYYY-MM-DD" del lunedì)
let settimanaInizioCorrente = null;

// ==========================================================
// GESTIONE DATE: stessa identica logica già usata in js/menu.js
// (duplicata qui perché ogni vista/modulo ha il proprio piccolo stato
// indipendente: non condividiamo variabili tra viste diverse).
// ==========================================================

// Da stringa "YYYY-MM-DD" a oggetto Date "locale". Non usiamo
// `new Date(stringa)` perché verrebbe interpretata come mezzanotte UTC,
// che in alcuni fusi orari corrisponde ancora al giorno precedente se
// letta con i metodi locali (getDate/getDay): costruendo la data a mano
// con anno/mese/giorno restiamo sempre nel fuso orario del browser.
function parseDataISO(stringaData) {
    const [anno, mese, giorno] = stringaData.split('-').map(Number);
    return new Date(anno, mese - 1, giorno);
}

// Da oggetto Date locale a stringa "YYYY-MM-DD", pronta per la colonna
// "settimana_inizio" (di tipo date).
function formattaDataISO(data) {
    const anno = data.getFullYear();
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const giorno = String(data.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
}

// Calcola il lunedì della settimana a cui appartiene una data qualsiasi.
// getDay() restituisce 0 per domenica, 1 per lunedì, ... 6 per sabato:
// per tornare al lunedì sottraiamo (getDay() - 1) giorni, tranne la
// domenica (0), il cui lunedì è 6 giorni prima.
function calcolaLunedi(data) {
    const giornoSettimana = data.getDay();
    const giorniDaSottrarre = giornoSettimana === 0 ? 6 : giornoSettimana - 1;

    const lunedi = new Date(data);
    lunedi.setDate(data.getDate() - giorniDaSottrarre);

    return formattaDataISO(lunedi);
}

// ==========================================================
// GENERAZIONE DELLA LISTA A PARTIRE DAL MENÙ
// ==========================================================
// Richiamata al click di #btn-genera-lista. Ricalcola da zero tutti gli
// ingredienti necessari per la settimana corrente, in base a cosa è
// stato pianificato nel menù settimanale, e li salva in "lista_spesa".
async function generaListaDalMenu() {
    // --- 1) Carichiamo le persone con il loro fattore_porzione: serve
    // per convertire la quantità "per 1 porzione adulto" di ogni
    // ingrediente nella quantità reale da comprare per quella persona.
    const { data: persone, error: errorePersone } = await supabase
        .from('persone')
        .select('id, nome, fattore_porzione');

    if (errorePersone) {
        alert('Errore nel caricamento delle persone: ' + errorePersone.message);
        return;
    }

    // --- 2) Carichiamo tutte le voci di menu di questa settimana. La
    // sintassi select('*, ricette(nome, ingredienti(*))') fa due "join"
    // in un colpo solo: da ogni riga di menu_settimanale arriviamo alla
    // ricetta collegata, e da quella a tutti i suoi ingredienti.
    const { data: righeMenu, error: erroreMenu } = await supabase
        .from('menu_settimanale')
        .select('*, ricette(nome, ingredienti(*))')
        .eq('settimana_inizio', settimanaInizioCorrente);

    if (erroreMenu) {
        alert('Errore nel caricamento del menù: ' + erroreMenu.message);
        return;
    }

    // --- 3) Calcoliamo, per ogni ingrediente, la quantità totale da
    // comprare per tutta la famiglia in questa settimana.
    //
    // Usiamo un oggetto JavaScript come "mappa di accumulo": la chiave è
    // il nome dell'ingrediente (es. "Uova"), il valore è un oggetto
    // { totale, unita, arrotondaAPezzo }. Ogni volta che lo stesso
    // ingrediente compare in un'altra ricetta, in un altro pasto o per
    // un'altra persona, invece di creare una riga separata SOMMIAMO la
    // nuova quantità al totale già accumulato per quella stessa chiave:
    // così "Uova" a pranzo di lunedì e "Uova" a cena di martedì finiscono
    // in un'unica riga finale con il totale complessivo.
    const mappaIngredienti = {};

    righeMenu.forEach((rigaMenu) => {
        const ricetta = rigaMenu.ricette;
        if (!ricetta || !ricetta.ingredienti) {
            return; // riga di menu senza ricetta collegata: la saltiamo
        }

        const personeAssegnate = rigaMenu.persone_assegnate || [];

        personeAssegnate.forEach((idPersona) => {
            const persona = persone.find((p) => p.id === idPersona);
            if (!persona) {
                return; // persona non trovata (es. cancellata nel frattempo)
            }

            ricetta.ingredienti.forEach((ingrediente) => {
                // Quantità "per 1 porzione adulto standard" moltiplicata
                // per il fattore porzione della persona (es. 0.6 per una
                // bambina di 5 anni): ottieni la quantità reale per lei.
                let quantitaPersona = ingrediente.quantita * persona.fattore_porzione;

                // Regola dell'arrotondamento "a pezzo indivisibile" (usata
                // per ingredienti come uova, fette, wurstel...): non si
                // può comprare "1.2 uova", quindi arrotondiamo all'intero
                // più vicino, con un minimo di 1 (anche una porzione
                // piccola richiede comunque almeno 1 pezzo intero).
                if (ingrediente.arrotonda_a_pezzo) {
                    quantitaPersona = Math.max(1, Math.round(quantitaPersona));
                }

                const chiave = ingrediente.nome;

                if (!mappaIngredienti[chiave]) {
                    mappaIngredienti[chiave] = {
                        totale: 0,
                        unita: ingrediente.unita,
                        arrotondaAPezzo: false
                    };
                }

                // Accumuliamo: sommiamo questo contributo al totale già
                // calcolato in precedenza per lo stesso ingrediente.
                mappaIngredienti[chiave].totale += quantitaPersona;

                // Se anche un solo contributo per questo ingrediente è
                // "a pezzo", trattiamo l'intero totale accumulato come
                // "a pezzo" nel risultato finale (vedi punto 5 sotto).
                if (ingrediente.arrotonda_a_pezzo) {
                    mappaIngredienti[chiave].arrotondaAPezzo = true;
                }
            });
        });
    });

    // --- 4) Ripuliamo la lista della spesa "generata" della settimana
    // precedente (is_manuale = false), SENZA toccare le voci aggiunte a
    // mano dall'utente (is_manuale = true): altrimenti ogni rigenerazione
    // cancellerebbe anche quelle, perdendo lavoro dell'utente.
    const { error: erroreCancellazione } = await supabase
        .from('lista_spesa')
        .delete()
        .eq('settimana_inizio', settimanaInizioCorrente)
        .eq('is_manuale', false);

    if (erroreCancellazione) {
        alert('Errore nella pulizia della lista precedente: ' + erroreCancellazione.message);
        return;
    }

    // --- 5) Trasformiamo la mappa accumulata in righe pronte per l'insert ---
    const righeDaInserire = Object.entries(mappaIngredienti).map(([nomeIngrediente, dati]) => {
        // Per gli ingredienti "a pezzo" il totale è già un numero intero
        // (somma di numeri già arrotondati al punto 3); per gli altri
        // arrotondiamo a 1 decimale solo per evitare di salvare numeri
        // con troppe cifre decimali (es. 233.33333333).
        const quantitaFinale = dati.arrotondaAPezzo
            ? Math.round(dati.totale)
            : parseFloat(dati.totale.toFixed(1));

        return {
            settimana_inizio: settimanaInizioCorrente,
            ingrediente: nomeIngrediente,
            quantita_totale: quantitaFinale,
            unita: dati.unita,
            is_manuale: false,
            stato: 'da_comprare'
        };
    });

    if (righeDaInserire.length > 0) {
        const { error: erroreInserimento } = await supabase
            .from('lista_spesa')
            .insert(righeDaInserire);

        if (erroreInserimento) {
            alert('Errore nel salvataggio della lista della spesa: ' + erroreInserimento.message);
            return;
        }
    }

    // --- 6) Aggiorniamo la pagina con i nuovi dati calcolati ---
    await visualizzaListaSpesa();
}

// ==========================================================
// VISUALIZZAZIONE DELLA LISTA
// ==========================================================

// Genera il markup HTML di UNA voce della lista della spesa (sia
// generata dal menù, sia manuale). Il bottone "Elimina" compare solo
// per le voci manuali (per quelle generate basta rigenerare la lista).
function creaHtmlVoce(voce, manuale) {
    const quantitaTesto = (voce.quantita_totale !== null && voce.unita)
        ? `${voce.quantita_totale} ${voce.unita}`
        : '';

    const comprato = voce.stato === 'comprato';

    const bottoneElimina = manuale
        ? `<button type="button" class="btn btn-outline-danger btn-sm ms-2 btn-elimina-voce" data-id="${voce.id}">Elimina</button>`
        : '';

    // La classe "riga-lista-spesa" (vedi css/style.css, dentro
    // .card-lista-spesa) gestisce il padding comodo e il sottile
    // separatore tra una riga e l'altra, al posto delle vecchie classi
    // Bootstrap border/rounded/px-2/py-1/mb-1.
    // Usiamo la classe "testo-comprato" (invece delle vecchie classi
    // Bootstrap text-decoration-line-through/text-muted) per lo stesso
    // stile applicato anche subito dopo il click sulla checkbox (vedi
    // aggiornaStatoVoce più sotto): così l'aspetto è identico sia al
    // primo caricamento sia durante l'uso.
    return `
        <div class="riga-lista-spesa d-flex justify-content-between align-items-center">
            <div class="form-check mb-0">
                <input class="form-check-input checkbox-stato-voce" type="checkbox" data-id="${voce.id}" id="voce-${voce.id}" ${comprato ? 'checked' : ''}>
                <label class="form-check-label ${comprato ? 'testo-comprato' : ''}" for="voce-${voce.id}">
                    ${voce.ingrediente}${quantitaTesto ? ` — ${quantitaTesto}` : ''}
                </label>
            </div>
            ${bottoneElimina}
        </div>
    `;
}

// Carica da "lista_spesa" tutte le righe della settimana corrente e le
// mostra divise in due gruppi: generate dal menù (is_manuale = false) e
// aggiunte a mano (is_manuale = true). Richiamata sia dopo la
// generazione, sia all'apertura della vista, sia dopo ogni modifica
// (checkbox spuntata, voce eliminata, voce manuale aggiunta).
async function visualizzaListaSpesa() {
    const { data, error } = await supabase
        .from('lista_spesa')
        .select('*')
        .eq('settimana_inizio', settimanaInizioCorrente)
        .order('ingrediente', { ascending: true });

    if (error) {
        contenitoreGenerata.innerHTML = `<p class="text-danger">Errore nel caricamento della lista: ${error.message}</p>`;
        contenitoreManuale.innerHTML = '';
        return;
    }

    const vociGenerate = data.filter((voce) => !voce.is_manuale);
    const vociManuali = data.filter((voce) => voce.is_manuale);

    // Anche i messaggi di "lista vuota" usano la classe "riga-lista-spesa"
    // solo per il padding (niente bordo sotto, essendo l'unico elemento
    // dentro la card, grazie alla regola :last-child in css/style.css).
    contenitoreGenerata.innerHTML = vociGenerate.length > 0
        ? vociGenerate.map((voce) => creaHtmlVoce(voce, false)).join('')
        : '<p class="riga-lista-spesa text-muted mb-0">Nessun ingrediente calcolato per questa settimana. Premi "Genera/Aggiorna lista dal menù".</p>';

    contenitoreManuale.innerHTML = vociManuali.length > 0
        ? vociManuali.map((voce) => creaHtmlVoce(voce, true)).join('')
        : '<p class="riga-lista-spesa text-muted mb-0">Nessuna voce manuale.</p>';
}

// ==========================================================
// AZIONI: cambio stato (checkbox) ed eliminazione voce manuale
// ==========================================================

// Aggiorna lo stato di una voce quando l'utente spunta/de-spunta la sua
// checkbox. Riceve direttamente l'elemento checkbox (non solo id e
// valore) perché ci serve per trovare l'etichetta di testo accanto e
// aggiornarne subito lo stile.
async function aggiornaStatoVoce(checkbox) {
    const comprato = checkbox.checked;
    const etichetta = checkbox.closest('.form-check').querySelector('.form-check-label');

    // Aggiornamento "ottimistico": applichiamo subito lo stile barrato
    // (o lo togliamo) PRIMA di aspettare la risposta di Supabase, così
    // l'interfaccia sembra reattiva anche se la rete è lenta. Se poi il
    // salvataggio fallisce, annulliamo questo cambiamento più sotto.
    if (comprato) {
        etichetta.classList.add('testo-comprato');
    } else {
        etichetta.classList.remove('testo-comprato');
    }

    const { error } = await supabase
        .from('lista_spesa')
        .update({ stato: comprato ? 'comprato' : 'da_comprare' })
        .eq('id', checkbox.dataset.id);

    if (error) {
        // Il salvataggio non è andato a buon fine: ripristiniamo sia la
        // checkbox sia lo stile del testo allo stato precedente il
        // click, e avvisiamo l'utente con il messaggio di errore.
        checkbox.checked = !comprato;
        if (comprato) {
            etichetta.classList.remove('testo-comprato');
        } else {
            etichetta.classList.add('testo-comprato');
        }
        window.alert('Errore nell\'aggiornamento dello stato: ' + error.message);
    }
}

// Elimina una voce manuale specifica e ricarica la visualizzazione.
async function eliminaVoceManuale(id) {
    const { error } = await supabase
        .from('lista_spesa')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Errore durante l\'eliminazione della voce: ' + error.message);
        return;
    }

    await visualizzaListaSpesa();
}

// Deleghiamo un solo listener "change" per ciascuno dei due contenitori:
// dato che le voci vengono ricreate ogni volta (visualizzaListaSpesa
// sostituisce l'innerHTML), è più comodo intercettare i click/change
// sull'intero contenitore piuttosto che su ogni singola checkbox.
contenitoreGenerata.addEventListener('change', (event) => {
    const checkbox = event.target.closest('.checkbox-stato-voce');
    if (checkbox) {
        aggiornaStatoVoce(checkbox);
    }
});

contenitoreManuale.addEventListener('change', (event) => {
    const checkbox = event.target.closest('.checkbox-stato-voce');
    if (checkbox) {
        aggiornaStatoVoce(checkbox);
    }
});

contenitoreManuale.addEventListener('click', (event) => {
    const bottoneElimina = event.target.closest('.btn-elimina-voce');
    if (bottoneElimina) {
        eliminaVoceManuale(bottoneElimina.dataset.id);
    }
});

// ==========================================================
// AGGIUNTA VOCE MANUALE
// ==========================================================
async function aggiungiVoceManuale() {
    const testo = inputVoceManuale.value.trim();
    if (testo === '') {
        return; // niente da salvare
    }

    const { error } = await supabase
        .from('lista_spesa')
        .insert({
            settimana_inizio: settimanaInizioCorrente,
            ingrediente: testo,
            quantita_totale: null,
            unita: null,
            is_manuale: true,
            stato: 'da_comprare'
        });

    if (error) {
        alert('Errore nel salvataggio della voce manuale: ' + error.message);
        return;
    }

    inputVoceManuale.value = '';
    await visualizzaListaSpesa();
}

// ==========================================================
// EVENTI (collegati una sola volta: gli elementi coinvolti esistono
// sempre nella pagina, anche a vista nascosta, quindi non serve
// ricollegarli ogni volta che si entra nella vista)
// ==========================================================

bottoneGenera.addEventListener('click', generaListaDalMenu);

bottoneAggiungiManuale.addEventListener('click', aggiungiVoceManuale);

// Quando l'utente cambia settimana, ricalcoliamo il lunedì e ricarichiamo
// SOLO la visualizzazione (mai la rigenerazione automatica dal menù):
// la rigenerazione avviene solo con un click esplicito su
// #btn-genera-lista, per non rischiare di sovrascrivere per sbaglio
// checkbox già spuntate o voci manuali già presenti.
selettoreSettimanaSpesa.addEventListener('change', () => {
    if (!selettoreSettimanaSpesa.value) {
        return;
    }

    const dataScelta = parseDataISO(selettoreSettimanaSpesa.value);
    settimanaInizioCorrente = calcolaLunedi(dataScelta);
    visualizzaListaSpesa();
});

// ==========================================================
// FUNZIONE ESPORTATA: inizializzazione della vista
// ==========================================================
// Richiamata dal router (js/router.js) ogni volta che l'utente entra
// nella vista "lista-spesa": imposta la data odierna se non è già stata
// scelta una data, calcola la settimana corrispondente e mostra la lista
// già salvata, SENZA rigenerarla automaticamente dal menù.
export async function inizializzaVistaListaSpesa() {
    if (!selettoreSettimanaSpesa.value) {
        selettoreSettimanaSpesa.value = formattaDataISO(new Date());
    }

    const dataScelta = parseDataISO(selettoreSettimanaSpesa.value);
    settimanaInizioCorrente = calcolaLunedi(dataScelta);

    await visualizzaListaSpesa();
}
