import { supabase } from './supabase-config.js';
import { COLORI_CATEGORIA_ALIMENTARE, getColorePersona } from './stile.js';

// Overlay bianco a schermo intero (vedi index.html), mostrato solo
// durante la generazione del PDF per coprire visivamente il contenuto
// temporaneo che il browser sta "fotografando" (vedi generaPdfMenu).
const overlayGenerazionePdf = document.getElementById('overlay-generazione-pdf');

// ==========================================================
// COSTANTI: stessa convenzione di giorni/pasti già usata in js/menu.js.
// La duplichiamo qui (invece di importarla) perché menu.js dovrà
// importare generaPdfMenu da QUESTO file: se anche questo file
// importasse qualcosa da menu.js si creerebbe un giro (import
// circolare) inutile, evitabile con questa piccola duplicazione.
// ==========================================================
const GIORNI = [
    { chiave: 'lunedi', etichetta: 'Lunedì', abbreviazione: 'Lun' },
    { chiave: 'martedi', etichetta: 'Martedì', abbreviazione: 'Mar' },
    { chiave: 'mercoledi', etichetta: 'Mercoledì', abbreviazione: 'Mer' },
    { chiave: 'giovedi', etichetta: 'Giovedì', abbreviazione: 'Gio' },
    { chiave: 'venerdi', etichetta: 'Venerdì', abbreviazione: 'Ven' },
    { chiave: 'sabato', etichetta: 'Sabato', abbreviazione: 'Sab' },
    { chiave: 'domenica', etichetta: 'Domenica', abbreviazione: 'Dom' }
];

const PASTI = [
    { chiave: 'colazione', etichetta: 'Colazione' },
    { chiave: 'spuntino', etichetta: 'Spuntino' },
    { chiave: 'pranzo', etichetta: 'Pranzo' },
    { chiave: 'merenda', etichetta: 'Merenda' },
    { chiave: 'cena', etichetta: 'Cena' }
];

// ==========================================================
// GESTIONE DATE (stessa logica di parseDataISO già vista in js/menu.js
// e js/lista-spesa.js, qui serve solo per calcolare la domenica e per
// formattare le date in modo leggibile nel titolo del PDF)
// ==========================================================
function parseDataISO(stringaData) {
    const [anno, mese, giorno] = stringaData.split('-').map(Number);
    return new Date(anno, mese - 1, giorno);
}

// Trasforma una Date in una stringa leggibile in italiano, es. "7 luglio 2026"
function formattaDataLeggibile(data) {
    return data.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ==========================================================
// GENERAZIONE DEL MARKUP HTML (badge ricetta, cella, tabella)
// ==========================================================

// Badge di una singola ricetta assegnata, con lo stesso colore di
// categoria alimentare usato nel resto dell'app, più un pallino per
// ciascuna persona assegnata. Scritto con stili INLINE (style="...")
// invece che con classi CSS: html2pdf "fotografa" l'HTML così com'è
// renderizzato dal browser, e gli stili inline sono il modo più
// affidabile per essere sicuri che vengano applicati anche nel PDF.
function creaHtmlBadgeRicetta(ricetta, persone) {
    const coloreCategoria = COLORI_CATEGORIA_ALIMENTARE[ricetta.categoriaAlimentare];
    const bg = coloreCategoria ? coloreCategoria.bg : '#E0DED8';
    const testo = coloreCategoria ? coloreCategoria.testo : '#2B2420';

    const pallini = ricetta.personeAssegnate
        .map((idPersona) => {
            const persona = persone.find((p) => p.id === idPersona);
            if (!persona) {
                return '';
            }
            const colore = getColorePersona(persona.nome);
            return `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${colore}; margin-left:3px; border:1px solid #fff;"></span>`;
        })
        .join('');

    return `
        <div style="background-color:${bg}; color:${testo}; border-radius:12px; padding:3px 8px; font-size:10px; margin-bottom:4px; display:inline-block;">
            ${ricetta.nome}${pallini}
        </div>
    `;
}

// Cella di UN giorno/pasto: un badge per ogni ricetta assegnata (una
// sotto l'altra), oppure un trattino grigio se non c'è nessuna ricetta.
function creaHtmlCellaGiorno(listaRicette, persone) {
    if (listaRicette.length === 0) {
        return '<td style="text-align:center; color:#C9C7C0; padding:8px; border:1px solid #E0DED8;">—</td>';
    }

    const badge = listaRicette.map((ricetta) => creaHtmlBadgeRicetta(ricetta, persone)).join('<br>');
    return `<td style="padding:8px; border:1px solid #E0DED8; vertical-align:top;">${badge}</td>`;
}

// ==========================================================
// FUNZIONE ESPORTATA: genera e scarica il PDF del menù settimanale
// ==========================================================
export async function generaPdfMenu(settimanaInizio) {
    // --- 1) Carichiamo le persone: servono per i pallini colorati ---
    const { data: persone, error: errorePersone } = await supabase
        .from('persone')
        .select('id, nome');

    if (errorePersone) {
        alert('Errore nel caricamento delle persone: ' + errorePersone.message);
        return;
    }

    // --- 2) Carichiamo tutte le voci di menu di questa settimana, con
    // nome e categoria_alimentare della ricetta collegata (un solo
    // join, come già fatto altrove nel progetto).
    const { data: righeMenu, error: erroreMenu } = await supabase
        .from('menu_settimanale')
        .select('*, ricette(nome, categoria_alimentare)')
        .eq('settimana_inizio', settimanaInizio);

    if (erroreMenu) {
        alert('Errore nel caricamento del menù: ' + erroreMenu.message);
        return;
    }

    // --- 3) Organizziamo le righe in una mappa[giorno][pasto] = [...],
    // inizializzata vuota per tutte le 35 combinazioni possibili, così
    // possiamo controllare facilmente quali sono davvero vuote.
    const mappa = {};
    GIORNI.forEach((giorno) => {
        mappa[giorno.chiave] = {};
        PASTI.forEach((pasto) => {
            mappa[giorno.chiave][pasto.chiave] = [];
        });
    });

    righeMenu.forEach((riga) => {
        if (!mappa[riga.giorno] || !mappa[riga.giorno][riga.tipo_pasto]) {
            return; // dato imprevisto (giorno/pasto non tra quelli noti): saltiamo
        }

        mappa[riga.giorno][riga.tipo_pasto].push({
            nome: riga.ricette ? riga.ricette.nome : '(ricetta non trovata)',
            categoriaAlimentare: riga.ricette ? riga.ricette.categoria_alimentare : null,
            personeAssegnate: riga.persone_assegnate || []
        });
    });

    // --- 4) Filtro "pasti da nascondere se vuoti su tutta la settimana":
    // un tipo di pasto (es. "colazione") entra nell'elenco pastiDaMostrare
    // solo se ALMENO UNO dei 7 giorni ha ALMENO UNA ricetta assegnata a
    // quel pasto. GIORNI.some(...) restituisce true alla prima corrispondenza
    // trovata: se per "colazione" tutti e 7 i giorni hanno un array vuoto,
    // some() resta false e quella riga non compare affatto nella tabella,
    // invece di occupare spazio con una riga completamente vuota.
    const pastiDaMostrare = PASTI.filter((pasto) =>
        GIORNI.some((giorno) => mappa[giorno.chiave][pasto.chiave].length > 0)
    );

    // --- 5) Costruiamo la tabella HTML ---
    const rigaIntestazione = `
        <tr>
            <th style="border-bottom:2px solid #2B2420; padding:8px; text-align:left;"></th>
            ${GIORNI.map((giorno) => `<th style="border-bottom:2px solid #2B2420; padding:8px; text-align:left;">${giorno.abbreviazione}</th>`).join('')}
        </tr>
    `;

    const righeCorpo = pastiDaMostrare
        .map((pasto) => {
            const celle = GIORNI
                .map((giorno) => creaHtmlCellaGiorno(mappa[giorno.chiave][pasto.chiave], persone))
                .join('');

            return `
                <tr>
                    <td style="font-weight:bold; padding:8px; border:1px solid #E0DED8; white-space:nowrap;">${pasto.etichetta}</td>
                    ${celle}
                </tr>
            `;
        })
        .join('');

    const tabellaHtml = `
        <table style="border-collapse:collapse; width:100%; font-family:'Plus Jakarta Sans', sans-serif; font-size:12px;">
            ${rigaIntestazione}
            ${righeCorpo}
        </table>
    `;

    // --- 6) Titolo e intervallo di date della settimana (lunedì -> domenica) ---
    const lunedi = parseDataISO(settimanaInizio);
    const domenica = new Date(lunedi);
    domenica.setDate(lunedi.getDate() + 6); // la domenica è 6 giorni dopo il lunedì

    const intestazioneHtml = `
        <h1 style="font-family:'Fraunces', serif; font-style:italic; margin-bottom:4px;">Menù Settimanale</h1>
        <p style="margin-top:0; margin-bottom:16px; color:#8A8A84;">
            Settimana dal ${formattaDataLeggibile(lunedi)} al ${formattaDataLeggibile(domenica)}
        </p>
    `;

    // --- 7) Legenda persone in fondo alla pagina ---
    const legendaHtml = `
        <div style="margin-top:16px; display:flex; gap:16px; font-size:11px;">
            ${persone
                .map((persona) => {
                    const colore = getColorePersona(persona.nome);
                    return `<span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${colore}; margin-right:4px;"></span>${persona.nome}</span>`;
                })
                .join('')}
        </div>
    `;

    // --- 8) Costruiamo il contenuto completo (titolo + tabella + legenda) ---
    const contenutoCompletoHtml = `
        <div style="padding:20px; color:#2B2420;">
            ${intestazioneHtml}
            ${tabellaHtml}
            ${legendaHtml}
        </div>
    `;

    // --- 9) Creiamo un elemento temporaneo per "fotografare" il contenuto ---
    // La versione precedente scriveva questo HTML dentro un <div> fisso,
    // tenuto sempre fuori dallo schermo con "left: -9999px". Il problema:
    // html2canvas (la libreria che html2pdf usa internamente per catturare
    // il DOM) in alcuni browser calcola male le dimensioni e il rendering
    // di un elemento posizionato così lontano dall'area visibile, e il
    // risultato è una "fotografia" vuota, quindi un PDF vuoto.
    //
    // La correzione: creiamo un nuovo elemento ogni volta e NON lo
    // posizioniamo più con "position: fixed" a coordinate 0,0 (che in
    // alcuni browser può ancora confondere il calcolo delle dimensioni
    // durante la cattura): lo lasciamo semplicemente scorrere in fondo
    // alla pagina, come farebbe qualsiasi altro elemento normale. Non
    // c'è bisogno di nasconderlo con trucchi di posizionamento, perché
    // ci pensa comunque l'overlay bianco a schermo intero (z-index più
    // alto) a coprirlo visivamente durante tutto il processo.
    const contenitoreTemporaneo = document.createElement('div');
    contenitoreTemporaneo.innerHTML = contenutoCompletoHtml;
    contenitoreTemporaneo.style.cssText = 'width: 1100px; background: #FFFFFF; padding: 20px;';

    // Mostriamo l'overlay bianco e aggiungiamo il contenitore temporaneo
    // al body: da questo momento l'utente vede solo la scritta
    // "Generazione PDF in corso...", non il contenuto sotto di essa.
    overlayGenerazionePdf.style.display = 'flex';
    document.body.appendChild(contenitoreTemporaneo);

    // --- 10) Piccola pausa forzata prima di catturare il contenuto ---
    // Appena aggiunto al DOM, il browser non ha ancora necessariamente
    // "disegnato" il nuovo contenuto sullo schermo: se chiamassimo
    // html2pdf() nello stesso istante, rischieremmo di catturare un
    // fotogramma ancora vuoto (da cui il PDF completamente bianco).
    // Il "doppio requestAnimationFrame" è una tecnica nota per questo
    // problema: il primo requestAnimationFrame viene eseguito subito
    // PRIMA del prossimo ridisegno dello schermo, mentre il secondo
    // (richiesto da dentro il primo) viene eseguito subito DOPO che
    // quel ridisegno è stato completato. Aspettare fino al secondo
    // callback garantisce quindi che il browser abbia finito almeno un
    // ciclo di disegno completo, con il nostro contenuto già visibile
    // "fisicamente" sullo schermo (anche se coperto dall'overlay),
    // prima di procedere con la cattura.
    await new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });

    // Log temporaneo di controllo: se in Console vediamo qui l'HTML
    // della tabella con i dati del menù, il problema NON è nei dati né
    // nella loro costruzione, ma solo nella tempistica della cattura
    // (o viceversa, se qui compare già vuoto, il problema è a monte).
    console.log('Contenuto da stampare:', contenitoreTemporaneo.innerHTML.substring(0, 200));

    // --- 11) Generiamo e scarichiamo il PDF a partire dal contenitore
    // temporaneo appena creato e aggiunto al DOM ---
    html2pdf()
        .from(contenitoreTemporaneo)
        .set({
            margin: 10,
            filename: `menu-settimana-${settimanaInizio}.pdf`,
            jsPDF: { orientation: 'landscape', format: 'a4' }
        })
        .save()
        .then(() => {
            // Tutto andato a buon fine: rimuoviamo il contenitore
            // temporaneo (non serve più) e nascondiamo di nuovo l'overlay.
            contenitoreTemporaneo.remove();
            overlayGenerazionePdf.style.display = 'none';
        })
        .catch((errore) => {
            // Qualcosa è andato storto: puliamo comunque il DOM, altrimenti
            // l'overlay bianco resterebbe visibile per sempre bloccando
            // l'app, e avvisiamo l'utente con il messaggio di errore.
            contenitoreTemporaneo.remove();
            overlayGenerazionePdf.style.display = 'none';
            window.alert('Errore nella generazione del PDF: ' + errore.message);
        });
}
