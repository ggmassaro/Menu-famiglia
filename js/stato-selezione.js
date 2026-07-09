// ==========================================================
// STATO CONDIVISO PER IL FLUSSO "AGGIUNGI RICETTA AL MENÙ" A DUE PASSI
// ==========================================================
// Flusso: dal Menù Settimanale l'utente clicca "+ Aggiungi" su un
// giorno/pasto -> viene mandato al Libretto Ricette per scegliere la
// ricetta (con i filtri già pronti) -> sceglie una ricetta -> torna al
// Menù, dove appare un piccolo form per scegliere solo le persone.
//
// js/menu.js e js/ricette.js hanno bisogno di scambiarsi alcune
// informazioni durante questo flusso (quale giorno/pasto, quale
// ricetta). Se lo facessero importandosi direttamente a vicenda si
// creerebbe una dipendenza circolare complicata da seguire; tenendo
// invece questi pochi dati qui, in un modulo neutro che sta "in mezzo",
// entrambi i file possono leggerli/scriverli senza sapere nulla della
// struttura interna dell'altro file.
//
// Nota: quando l'utente clicca "+ Aggiungi" nel Menù conosciamo solo
// giorno/tipoPasto (la ricetta non è ancora stata scelta); ricettaId e
// nomeRicetta vengono aggiunti in un secondo momento, quando l'utente
// sceglie la ricetta nel Libretto (vedi impostaRicettaScelta più sotto).
let statoSelezione = {
    attivo: false,
    giorno: null,
    tipoPasto: null,
    ricettaId: null,
    nomeRicetta: null
};

// Avvia la modalità selezione per un giorno/pasto specifico. Richiamata
// da js/menu.js quando l'utente clicca "+ Aggiungi" su una cella della
// griglia, prima di mandarlo alla vista Ricette.
export function impostaSelezione(giorno, tipoPasto) {
    statoSelezione = {
        attivo: true,
        giorno: giorno,
        tipoPasto: tipoPasto,
        ricettaId: null,
        nomeRicetta: null
    };
}

// Completa la selezione con la ricetta scelta dall'utente nel Libretto
// Ricette, mantenendo giorno/tipoPasto già salvati. Richiamata da
// js/ricette.js quando l'utente clicca "Aggiungi qui" su una card.
export function impostaRicettaScelta(ricettaId, nomeRicetta) {
    statoSelezione = {
        ...statoSelezione,
        ricettaId: ricettaId,
        nomeRicetta: nomeRicetta
    };
}

// Disattiva la modalità selezione e azzera tutti i valori salvati.
// Richiamata sia quando l'utente annulla esplicitamente (bottone
// "Annulla selezione" nel Libretto Ricette), sia da js/menu.js subito
// dopo aver usato i dati per aprire il form di scelta persone.
export function pulisciSelezione() {
    statoSelezione = {
        attivo: false,
        giorno: null,
        tipoPasto: null,
        ricettaId: null,
        nomeRicetta: null
    };
}

// Restituisce una COPIA dello stato attuale (con lo spread {...}),
// non l'oggetto originale: così chi la legge non può modificare per
// sbaglio lo stato interno di questo modulo scrivendoci sopra
// direttamente, ma deve sempre passare dalle funzioni sopra.
export function leggiSelezione() {
    return { ...statoSelezione };
}
