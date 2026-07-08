import { supabase } from './supabase-config.js';
import { COLORI_CATEGORIA_ALIMENTARE } from './stile.js';

const contenitoreRiepilogo = document.getElementById('riepilogo-nutrizionale');

// ==========================================================
// ETICHETTE LEGGIBILI (stessa convenzione già usata in js/ricette.js)
// ==========================================================
const ETICHETTE_CATEGORIA_ALIMENTARE = {
    carne_rossa: 'Carne rossa',
    carne_bianca: 'Carne bianca',
    pesce: 'Pesce',
    legumi: 'Legumi',
    formaggi_uova: 'Formaggi e Uova',
    verdura: 'Verdura',
    cereali: 'Cereali'
};

// ==========================================================
// SOGLIE DI RIFERIMENTO (Linee Guida CREA + World Cancer Research Fund
// per la carne rossa)
// ==========================================================
// Ogni categoria alimentare ha un "tipo" di soglia diverso:
//
// - 'soglia_massima': esiste solo un tetto da non superare (la carne
//   rossa, secondo il World Cancer Research Fund, è collegata a un
//   rischio che aumenta con il consumo: qui ha senso un vero e proprio
//   AVVISO se si supera la soglia, non solo un'informazione neutra).
//
// - 'intervallo_consigliato': esiste un range consigliato (min-max) a
//   settimana. Restare fuori da questo range (sopra o sotto) NON è
//   pericoloso come per la carne rossa, quindi lo segnaliamo solo come
//   informazione da tenere d'occhio, non come avviso allarmante.
//
// - 'solo_conteggio': per queste categorie non applichiamo NESSUN
//   giudizio, solo il numero di volte pianificate. Motivo (spiegato
//   anche all'utente nel paragrafo sopra il riepilogo):
//     - formaggi_uova accorpa nel nostro database due alimenti (formaggi
//       ed uova) che avrebbero soglie diverse tra loro: non essendo
//       distinguibili nei dati che abbiamo, non possiamo applicare una
//       soglia corretta per l'una o per l'altra.
//     - cereali e verdura andrebbero valutati in base alle porzioni
//       giornaliere in grammi (come raccomandato dalle linee guida), non
//       contando semplicemente "quante ricette a settimana": un conteggio
//       di ricette non basta per dare un giudizio nutrizionalmente
//       corretto su questi due gruppi.
const SOGLIE_NUTRIZIONALI = {
    carne_rossa: { tipo: 'soglia_massima', valore: 3 },
    carne_bianca: { tipo: 'intervallo_consigliato', min: 2, max: 3 },
    pesce: { tipo: 'intervallo_consigliato', min: 2, max: 3 },
    legumi: { tipo: 'intervallo_consigliato', min: 3, max: 4 },
    formaggi_uova: { tipo: 'solo_conteggio' },
    cereali: { tipo: 'solo_conteggio' },
    verdura: { tipo: 'solo_conteggio' }
};

// ==========================================================
// GENERAZIONE DI UN SINGOLO BADGE (una riga colorata per categoria)
// ==========================================================
// Costruisce il messaggio e il colore giusto in base al tipo di soglia
// definito sopra e al conteggio effettivo di questa settimana.
function creaHtmlBadgeCategoria(categoria, conteggio) {
    const etichetta = ETICHETTE_CATEGORIA_ALIMENTARE[categoria];
    const soglia = SOGLIE_NUTRIZIONALI[categoria];
    const volteTesto = conteggio === 1 ? '1 volta' : `${conteggio} volte`;

    let classeAlert;
    let messaggio;

    if (soglia.tipo === 'soglia_massima') {
        // Solo un tetto massimo: sopra è un avviso (rosso), entro il
        // limite va bene (verde).
        if (conteggio > soglia.valore) {
            classeAlert = 'alert-danger';
            messaggio = `${etichetta}: ${volteTesto} questa settimana (soglia consigliata: max ${soglia.valore})`;
        } else {
            classeAlert = 'alert-success';
            messaggio = `${etichetta}: ${volteTesto} questa settimana (entro la soglia consigliata di max ${soglia.valore})`;
        }
    } else if (soglia.tipo === 'intervallo_consigliato') {
        // Range consigliato: dentro il range va bene (verde), fuori dal
        // range (sopra O sotto) è solo un'informazione da notare
        // (giallo/neutro), non un allarme.
        const dentroIntervallo = conteggio >= soglia.min && conteggio <= soglia.max;

        if (dentroIntervallo) {
            classeAlert = 'alert-success';
            messaggio = `${etichetta}: ${volteTesto} questa settimana (in linea con l'intervallo consigliato di ${soglia.min}-${soglia.max})`;
        } else {
            classeAlert = 'alert-warning';
            messaggio = `${etichetta}: ${volteTesto} questa settimana (l'intervallo consigliato è ${soglia.min}-${soglia.max})`;
        }
    } else {
        // 'solo_conteggio': nessun giudizio, solo il numero, con colore
        // grigio neutro.
        classeAlert = 'alert-secondary';
        messaggio = `${etichetta}: ${volteTesto} questa settimana (nessuna soglia applicabile con i dati disponibili)`;
    }

    // Piccolo pallino colorato prima del testo: usa lo stesso colore
    // "testo" (più scuro e visibile del "bg" chiaro) assegnato a questa
    // categoria in js/stile.js, per coerenza visiva con le altre viste
    // dell'app. Le classi Bootstrap alert-* restano invariate: sono loro
    // a comunicare il significato della soglia (verde/giallo/rosso/
    // grigio), il pallino aggiunge solo il riconoscimento della categoria.
    const colorePallino = COLORI_CATEGORIA_ALIMENTARE[categoria]
        ? COLORI_CATEGORIA_ALIMENTARE[categoria].testo
        : '#9E9E9E';
    const pallino = `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${colorePallino}; margin-right: 6px;"></span>`;

    return `<div class="alert ${classeAlert} py-2 mb-0" role="alert">${pallino}${messaggio}</div>`;
}

// ==========================================================
// FUNZIONE ESPORTATA: calcolo e visualizzazione del riepilogo
// ==========================================================
// Richiamata da js/menu.js ogni volta che viene rigenerata la griglia
// del menù (all'apertura della vista, al cambio settimana, dopo
// un'aggiunta o rimozione di ricetta), passandole la settimana_inizio
// attualmente mostrata.
export async function calcolaEMostraRiepilogoNutrizionale(settimanaInizio) {
    // select('*, ricette(categoria_alimentare)') fa un join: da ogni riga
    // di menu_settimanale arriviamo alla ricetta collegata e prendiamo
    // solo la sua categoria_alimentare (es. "pesce"), che è l'unico dato
    // che ci serve qui.
    const { data: righeMenu, error } = await supabase
        .from('menu_settimanale')
        .select('*, ricette(categoria_alimentare)')
        .eq('settimana_inizio', settimanaInizio);

    if (error) {
        contenitoreRiepilogo.innerHTML = `<p class="text-danger">Errore nel calcolo del riepilogo nutrizionale: ${error.message}</p>`;
        return;
    }

    // Inizializziamo il conteggio a 0 per tutte e 7 le categorie
    // possibili: così anche una categoria mai pianificata questa
    // settimana (0 volte) compare comunque nel riepilogo, invece di
    // sparire semplicemente perché non ci sono righe da contare.
    const conteggioPerCategoria = {};
    Object.keys(ETICHETTE_CATEGORIA_ALIMENTARE).forEach((categoria) => {
        conteggioPerCategoria[categoria] = 0;
    });

    // Ogni riga di menu_settimanale = una ricetta pianificata in un
    // pasto: contiamo quante volte compare ciascuna categoria
    // alimentare, sommando 1 ogni volta che la troviamo.
    righeMenu.forEach((riga) => {
        const categoria = riga.ricette ? riga.ricette.categoria_alimentare : null;
        if (categoria && conteggioPerCategoria[categoria] !== undefined) {
            conteggioPerCategoria[categoria]++;
        }
    });

    // Generiamo un badge per ciascuna delle 7 categorie, nello stesso
    // ordine in cui sono definite le etichette, e li mostriamo tutti
    // impilati dentro #riepilogo-nutrizionale.
    const badgeHtml = Object.keys(ETICHETTE_CATEGORIA_ALIMENTARE)
        .map((categoria) => creaHtmlBadgeCategoria(categoria, conteggioPerCategoria[categoria]))
        .join('');

    contenitoreRiepilogo.innerHTML = `<div class="d-flex flex-column gap-2">${badgeHtml}</div>`;
}
