import { supabase } from './supabase-config.js';
import { mostraVista } from './router.js';
import { caricaRicettaPerModifica } from './nuova-ricetta.js';
import { COLORI_CATEGORIA_ALIMENTARE } from './stile.js';

const contenitore = document.getElementById('contenitore-ricette');
const messaggioCaricamento = document.getElementById('messaggio-caricamento');
const filtriContainer = document.getElementById('filtri-categoria');

// Ricette attualmente caricate da Supabase, tenute in memoria qui: il
// filtro per categoria (vedi più sotto) le rilegge direttamente da questa
// variabile invece di rifare una query ogni volta che si clicca una chip,
// dato che i dati non cambiano, cambia solo quali ricette mostrare.
let ricetteCaricate = [];

// Piccoli "dizionari" per trasformare i codici salvati nel database
// (es. "formaggi_uova") in testo leggibile per l'utente (es. "Formaggi e Uova").
// Non è obbligatorio, ma rende la pagina più chiara da leggere.
const ETICHETTE_CATEGORIA_ALIMENTARE = {
    carne_rossa: 'Carne rossa',
    carne_bianca: 'Carne bianca',
    pesce: 'Pesce',
    legumi: 'Legumi',
    formaggi_uova: 'Formaggi e Uova',
    verdura: 'Verdura',
    cereali: 'Cereali'
};

const ETICHETTE_ADATTO_A = {
    adulti: 'Adulti',
    bambini: 'Bambini',
    tutti: 'Tutti'
};

// Esportata perché ora viene richiamata dal router (js/router.js) ogni
// volta che l'utente entra nella vista "ricette", invece di partire da
// sola una sola volta al caricamento dello script.
export async function caricaRicette() {
    // La select 'ingredienti(*)' dice a Supabase: per ogni ricetta,
    // includi anche tutte le righe collegate della tabella ingredienti
    // (quelle che hanno ricetta_id uguale all'id di questa ricetta).
    const { data: ricette, error } = await supabase
        .from('ricette')
        .select('*, ingredienti(*)')
        .order('nome', { ascending: true });

    if (error) {
        messaggioCaricamento.textContent = 'Errore nel caricamento delle ricette: ' + error.message;
        messaggioCaricamento.classList.add('text-danger');
        return;
    }

    messaggioCaricamento.style.display = 'none';

    ricetteCaricate = ricette;

    generaFiltriCategoria(ricette);
    mostraRicette(ricette);
}

// ==========================================================
// FILTRO PER CATEGORIA ALIMENTARE
// ==========================================================

// Genera le "chip" cliccabili sopra l'elenco ricette: una chip "Tutte"
// (sempre presente e attiva di default) più una chip per ciascuna
// categoria alimentare effettivamente usata da almeno una ricetta
// caricata (niente chip per categorie senza nessuna ricetta).
function generaFiltriCategoria(ricette) {
    // new Set(...) elimina i duplicati: se 5 ricette sono "pesce",
    // vogliamo comunque una sola chip "Pesce".
    const categoriePresenti = [...new Set(ricette.map((r) => r.categoria_alimentare))];

    const chipTutte = '<span class="badge chip-filtro bg-light text-dark border attivo" data-categoria="tutte">Tutte</span>';

    const chipCategorie = categoriePresenti
        .map((categoria) => {
            const etichetta = ETICHETTE_CATEGORIA_ALIMENTARE[categoria] || categoria;
            return `<span class="badge chip-filtro bg-light text-dark border" data-categoria="${categoria}">${etichetta}</span>`;
        })
        .join('');

    filtriContainer.innerHTML = chipTutte + chipCategorie;
}

// Un solo listener delegato sul contenitore delle chip (le chip vengono
// rigenerate ogni volta che si ricaricano le ricette, quindi ricollegare
// un listener per ciascuna andrebbe perso a ogni ricarica).
filtriContainer.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip-filtro');
    if (!chip) {
        return;
    }

    // Spostiamo la classe "attivo" solo sulla chip appena cliccata
    filtriContainer.querySelectorAll('.chip-filtro').forEach((c) => c.classList.remove('attivo'));
    chip.classList.add('attivo');

    const categoriaScelta = chip.dataset.categoria;

    // Filtriamo le ricette già in memoria (ricetteCaricate) invece di
    // interrogare di nuovo Supabase: i dati sono già quelli giusti, cambia
    // solo il sottoinsieme da mostrare, quindi il filtro è istantaneo e
    // non genera traffico di rete ad ogni click.
    const ricetteFiltrate = categoriaScelta === 'tutte'
        ? ricetteCaricate
        : ricetteCaricate.filter((ricetta) => ricetta.categoria_alimentare === categoriaScelta);

    mostraRicette(ricetteFiltrate);
});

function mostraRicette(ricette) {
    contenitore.innerHTML = ''; // svuota il contenitore prima di riempirlo

    ricette.forEach((ricetta) => {
        const categoriePasto = ricetta.categoria_pasto.join(', ');
        const categoriaAlimentare = ETICHETTE_CATEGORIA_ALIMENTARE[ricetta.categoria_alimentare] || ricetta.categoria_alimentare;
        const adattoA = ETICHETTE_ADATTO_A[ricetta.adatto_a] || ricetta.adatto_a;

        // Badge colorato "a pillola" per la categoria alimentare: stesso
        // colore ovunque questa categoria compaia nell'app (vedi
        // js/stile.js). Il colore di sfondo/testo viene applicato con
        // stile inline perché sono valori dinamici (dipendono dalla
        // categoria di QUESTA ricetta), non classi Bootstrap fisse.
        const coloreCategoria = COLORI_CATEGORIA_ALIMENTARE[ricetta.categoria_alimentare];
        const badgeCategoria = coloreCategoria
            ? `<span style="background-color: ${coloreCategoria.bg}; color: ${coloreCategoria.testo}; border-radius: 20px; padding: 4px 10px; font-size: 0.85rem;">${categoriaAlimentare}</span>`
            : categoriaAlimentare;

        const righeIngredienti = ricetta.ingredienti
            .map((ing) => {
                const notaArrotondamento = ing.arrotonda_a_pezzo ? ' (arrotondato a pezzo intero)' : '';
                return `<li>${ing.nome}: ${ing.quantita} ${ing.unita}${notaArrotondamento}</li>`;
            })
            .join('');

        const notaHtml = ricetta.note
            ? `<p class="text-muted small fst-italic mb-2">${ricetta.note}</p>`
            : '';

        const cardHtml = `
            <div class="col-md-6 col-lg-4">
                <div class="card card-ricetta h-100">
                    <div class="card-ricetta-barra" style="background-color: ${coloreCategoria ? coloreCategoria.bg : '#CCCCCC'};"></div>
                    <div class="card-body">
                        <h5 class="card-title">${ricetta.nome}</h5>
                        <p class="card-subtitle mb-2">
                            ${badgeCategoria}
                            <span class="text-muted small">&middot; ${adattoA}</span>
                        </p>
                        <p class="small text-muted mb-2">Pasti: ${categoriePasto}</p>
                        ${notaHtml}
                        <p class="mb-1 fw-semibold small">Ingredienti (per 1 porzione adulto):</p>
                        <ul class="small mb-0">
                            ${righeIngredienti}
                        </ul>
                        <div class="d-flex gap-2 mt-2">
                            <button type="button" class="btn btn-outline-secondary btn-sm btn-modifica-ricetta" data-id="${ricetta.id}">Modifica</button>
                            <button type="button" class="btn btn-outline-danger btn-sm btn-elimina-ricetta" data-id="${ricetta.id}">Elimina</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        contenitore.insertAdjacentHTML('beforeend', cardHtml);
    });
}

// ==========================================================
// AZIONI SULLE CARD: modifica ed elimina ricetta
// ==========================================================
// Un solo listener delegato sul contenitore (collegato una sola volta,
// al caricamento dello script), invece di uno per ciascun bottone: le
// card vengono ricreate ogni volta che caricaRicette() gira di nuovo, e
// bottoni "attaccati" singolarmente andrebbero persi a ogni ricarica.
contenitore.addEventListener('click', async (event) => {
    const bottoneModifica = event.target.closest('.btn-modifica-ricetta');
    if (bottoneModifica) {
        const idRicetta = bottoneModifica.dataset.id;

        // Passiamo prima alla vista di creazione/modifica ricetta: il
        // router la resetta sempre "vuota" (modalità crea) quando viene
        // aperta così...
        mostraVista('nuova-ricetta');
        // ...e SUBITO DOPO la precompiliamo con i dati della ricetta
        // scelta, facendola passare in modalità "modifica".
        await caricaRicettaPerModifica(idRicetta);
        return;
    }

    const bottoneElimina = event.target.closest('.btn-elimina-ricetta');
    if (bottoneElimina) {
        await eliminaRicetta(bottoneElimina.dataset.id);
        return;
    }
});

// Chiede conferma ed elimina una ricetta da Supabase.
//
// Se quella ricetta è ancora usata in una o più voci del menù
// settimanale, il database la rifiuta: la colonna
// menu_settimanale.ricetta_id ha una foreign key verso ricette.id, e
// Postgres non permette di cancellare una riga ancora referenziata
// altrove. In quel caso l'errore restituito ha codice '23503'
// (violazione di foreign key): lo intercettiamo per mostrare un
// messaggio comprensibile invece del codice tecnico Postgres.
async function eliminaRicetta(idRicetta) {
    const confermato = window.confirm('Vuoi eliminare questa ricetta? L\'operazione non è reversibile.');
    if (!confermato) {
        return;
    }

    const { error } = await supabase
        .from('ricette')
        .delete()
        .eq('id', idRicetta);

    if (error) {
        if (error.code === '23503') {
            window.alert('Impossibile eliminare: questa ricetta è ancora usata nel menù settimanale. Rimuovila prima dal menù, poi riprova.');
        } else {
            window.alert(error.message);
        }
        return;
    }

    // Ricarichiamo l'elenco per far sparire subito la card eliminata
    caricaRicette();
}
