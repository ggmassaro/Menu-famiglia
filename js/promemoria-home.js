import { supabase } from './supabase-config.js';
import { mostraVista } from './router.js';

// Contenitore dedicato nella Home (vedi index.html, dentro #vista-home
// subito dopo le 3 card colorate): resta vuoto in tutti i casi in cui
// non c'è nessun promemoria da mostrare.
const contenitorePromemoria = document.getElementById('promemoria-settimana');

// Date della settimana corrente/prossima, calcolate ogni volta che gira
// mostraPromemoriaSeNecessario() e riusate dal click sul bottone "Usa
// come base la settimana scorsa" (vedi più sotto): tenerle in variabili
// di modulo evita di doverle ricalcolare, e garantisce che il click usi
// esattamente le stesse date mostrate nel messaggio.
let lunediSettimanaCorrente = null;
let lunediSettimanaProssima = null;

// ==========================================================
// GESTIONE DATE: calcolo del lunedì di una data qualsiasi
// ==========================================================
// Stessa identica convenzione già usata altrove nel progetto (js/menu.js,
// js/lista-spesa.js): getDay() restituisce 0 per domenica, 1 per lunedì,
// ... 6 per sabato. Per tornare indietro fino al lunedì sottraiamo
// (getDay() - 1) giorni, tranne la domenica (0), il cui lunedì è 6
// giorni prima. Duplicata qui (invece che importata) perché ogni
// modulo di questo progetto tiene il proprio piccolo pezzo di logica
// data indipendente dagli altri.
function calcolaLunedi(data) {
    const giornoSettimana = data.getDay();
    const giorniDaSottrarre = giornoSettimana === 0 ? 6 : giornoSettimana - 1;

    const lunedi = new Date(data);
    lunedi.setDate(data.getDate() - giorniDaSottrarre);

    return formattaDataISO(lunedi);
}

// Da oggetto Date locale a stringa "YYYY-MM-DD", pronta per la colonna
// "settimana_inizio" (di tipo date).
function formattaDataISO(data) {
    const anno = data.getFullYear();
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const giorno = String(data.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
}

// Da stringa "YYYY-MM-DD" a oggetto Date locale (serve per sommare 7
// giorni al lunedì corrente e ottenere il lunedì della settimana dopo).
function parseDataISO(stringaData) {
    const [anno, mese, giorno] = stringaData.split('-').map(Number);
    return new Date(anno, mese - 1, giorno);
}

// ==========================================================
// FUNZIONE ESPORTATA: mostra il promemoria solo se serve davvero
// ==========================================================
// Richiamata da js/router.js ogni volta che si mostra (o si rientra
// nella) vista Home. Il promemoria ha senso mostrarlo SOLO se:
// 1) oggi è venerdì (il momento naturale per pianificare la settimana
//    dopo, prima del weekend), E
// 2) la settimana successiva non ha ancora nessuna ricetta pianificata
//    (altrimenti l'utente ha già fatto il lavoro, il promemoria
//    sarebbe solo un fastidio).
// In tutti gli altri casi il contenitore resta vuoto.
export async function mostraPromemoriaSeNecessario() {
    contenitorePromemoria.innerHTML = '';

    const oggi = new Date();

    // getDay() === 5 vuol dire venerdì (0 = domenica, 1 = lunedì, ...).
    if (oggi.getDay() !== 5) {
        return;
    }

    lunediSettimanaCorrente = calcolaLunedi(oggi);
    lunediSettimanaProssima = formattaDataISO(
        (() => {
            const data = parseDataISO(lunediSettimanaCorrente);
            data.setDate(data.getDate() + 7); // il lunedì dopo è 7 giorni dopo questo
            return data;
        })()
    );

    // Contiamo (senza scaricare tutte le colonne, ci basta sapere se
    // esiste almeno una riga) quante voci di menù esistono già per la
    // settimana prossima.
    const { data: righeProssimaSettimana, error } = await supabase
        .from('menu_settimanale')
        .select('id')
        .eq('settimana_inizio', lunediSettimanaProssima);

    if (error) {
        console.error('Errore nel controllo del menù della prossima settimana:', error.message);
        return; // in caso di errore, meglio non mostrare nulla che mostrare un promemoria sbagliato
    }

    if (righeProssimaSettimana.length > 0) {
        // La prossima settimana ha già qualcosa: l'utente ha già fatto
        // il lavoro, nessun promemoria da mostrare.
        return;
    }

    mostraBannerPromemoria();
}

// ==========================================================
// GENERAZIONE E GESTIONE DEL BANNER
// ==========================================================

// Mostra il banner iniziale, con l'invito a pianificare e il bottone
// per copiare la settimana scorsa come base di partenza.
function mostraBannerPromemoria() {
    contenitorePromemoria.innerHTML = `
        <div class="alert alert-light border shadow-sm d-flex justify-content-between align-items-center flex-wrap gap-2 mb-0">
            <span>Programma il menù della prossima settimana, così hai la lista della spesa pronta per il weekend</span>
            <button type="button" class="btn btn-azione btn-sm btn-copia-menu-precedente">Usa come base la settimana scorsa</button>
        </div>
    `;
}

// Un solo listener delegato sul contenitore (collegato una sola volta,
// al caricamento dello script): il contenuto del banner cambia più
// volte durante il flusso (invito iniziale -> messaggio di esito), ma
// non serve mai ricollegare nulla perché la delega funziona comunque su
// qualsiasi bottone venga generato dentro questo contenitore.
contenitorePromemoria.addEventListener('click', async (event) => {
    const bottoneCopia = event.target.closest('.btn-copia-menu-precedente');
    if (bottoneCopia) {
        await copiaMenuSettimanaScorsa();
        return;
    }

    const bottoneVaiAlMenu = event.target.closest('.btn-vai-al-menu');
    if (bottoneVaiAlMenu) {
        mostraVista('menu');
    }
});

// Copia tutte le voci di menu_settimanale della settimana corrente
// (quella appena trascorsa/in corso) nella settimana prossima, cambiando
// solo la data settimana_inizio: stesso giorno, stesso tipo_pasto,
// stessa ricetta, stesse persone assegnate. È una copia "grezza" e
// volutamente semplice: l'utente potrà poi aggiustare a mano dal Menù
// Settimanale (aggiungere/rimuovere singole ricette) quello che non va
// bene copiato pari pari.
async function copiaMenuSettimanaScorsa() {
    const { data: righeDaCopiare, error: erroreLettura } = await supabase
        .from('menu_settimanale')
        .select('giorno, tipo_pasto, ricetta_id, persone_assegnate')
        .eq('settimana_inizio', lunediSettimanaCorrente);

    if (erroreLettura) {
        mostraMessaggioEsito(
            'Errore nel recupero del menù della settimana scorsa: ' + erroreLettura.message,
            'danger'
        );
        return;
    }

    if (righeDaCopiare.length === 0) {
        mostraMessaggioEsito('Nessun menù trovato nella settimana scorsa da copiare', 'warning');
        return;
    }

    // Trasformiamo ogni riga letta in una nuova riga da inserire: stessi
    // dati, ma con settimana_inizio spostata alla settimana prossima.
    const righeDaInserire = righeDaCopiare.map((riga) => ({
        settimana_inizio: lunediSettimanaProssima,
        giorno: riga.giorno,
        tipo_pasto: riga.tipo_pasto,
        ricetta_id: riga.ricetta_id,
        persone_assegnate: riga.persone_assegnate
    }));

    const { error: erroreInserimento } = await supabase
        .from('menu_settimanale')
        .insert(righeDaInserire);

    if (erroreInserimento) {
        mostraMessaggioEsito(
            'Errore nel salvataggio del menù copiato: ' + erroreInserimento.message,
            'danger'
        );
        return;
    }

    contenitorePromemoria.innerHTML = `
        <div class="alert alert-success d-flex justify-content-between align-items-center flex-wrap gap-2 mb-0">
            <span>Menù copiato! Vai al Menù Settimanale per rivederlo e modificarlo</span>
            <button type="button" class="btn btn-azione btn-sm btn-vai-al-menu">Vai al Menù</button>
        </div>
    `;
}

// Mostra un messaggio di esito (avviso o errore) al posto del banner
// iniziale, con lo stile Bootstrap "alert" corrispondente.
function mostraMessaggioEsito(testo, tipo) {
    contenitorePromemoria.innerHTML = `
        <div class="alert alert-${tipo} mb-0">${testo}</div>
    `;
}
