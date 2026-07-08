import { supabase } from './supabase-config.js';
import { caricaRicette } from './ricette.js';
import { inizializzaFormNuovaRicetta } from './nuova-ricetta.js';
import { inizializzaVistaMenu } from './menu.js';
import { inizializzaVistaListaSpesa } from './lista-spesa.js';
import { NOME_DA_EMAIL } from './stile.js';

// ============================================================
// RIFERIMENTI AGLI ELEMENTI FISSI DELLA PAGINA (nav e paragrafo
// di test connessione, entrambi fuori dalle singole "viste")
// ============================================================
const nav = document.getElementById('nav-principale');
const elementoUtente = document.getElementById('utente-loggato');
const bottoneLogout = document.getElementById('btn-logout');
const testConnessione = document.getElementById('test-connessione');
const salutoHome = document.getElementById('saluto-home');

// ============================================================
// 1) CAMBIO VISTA - il "router" della Single Page Application
// ============================================================
// In una SPA non si cambia mai pagina/URL: si nascondono tutti i
// contenitori ".vista" e si mostra solo quello richiesto, aggiungendo
// la classe "attiva" (vedi css/style.css). Questa funzione viene
// esportata perché serve anche ad altri file (auth.js dopo il login,
// nuova-ricetta.js dopo il salvataggio con successo).
export function mostraVista(nomeVista) {
    // Nascondiamo tutte le viste esistenti...
    document.querySelectorAll('.vista').forEach((vista) => {
        vista.classList.remove('attiva');
    });

    // ...e mostriamo solo quella richiesta (es. "ricette" -> #vista-ricette)
    const vistaDaMostrare = document.getElementById('vista-' + nomeVista);
    if (vistaDaMostrare) {
        vistaDaMostrare.classList.add('attiva');
    }

    // Alcune viste devono "ripartire da zero" ogni volta che vengono
    // aperte, perché mostrano dati che possono essere cambiati nel
    // frattempo (nuove ricette salvate) oppure perché il form deve
    // tornare vuoto per un nuovo inserimento.
    if (nomeVista === 'ricette') {
        caricaRicette();
    }

    if (nomeVista === 'nuova-ricetta') {
        inizializzaFormNuovaRicetta();
    }

    if (nomeVista === 'menu') {
        inizializzaVistaMenu();
    }

    if (nomeVista === 'lista-spesa') {
        inizializzaVistaListaSpesa();
    }
}

// ============================================================
// 2) CLICK GLOBALE SU QUALSIASI ELEMENTO data-vista="..."
// ============================================================
// Invece di collegare un event listener a ogni singolo bottone/link,
// ne basta uno solo su tutto il documento: quando l'elemento cliccato
// (o uno dei suoi genitori, grazie a closest) ha un attributo
// data-vista, cambiamo vista con quel valore.
document.addEventListener('click', (event) => {
    const elementoCliccato = event.target.closest('[data-vista]');
    if (elementoCliccato) {
        mostraVista(elementoCliccato.dataset.vista);
    }
});

// ============================================================
// 3) NAV E UTENTE LOGGATO
// ============================================================

// Mostra il nav in alto con l'email dell'utente e aggiorna il saluto
// personalizzato nella home. Esportata perché serve anche a js/auth.js
// subito dopo un login riuscito: aggiornando il saluto qui (invece che
// solo dentro avviaApp) copriamo automaticamente sia il caso "sessione
// già presente al caricamento della pagina" sia il caso "login appena
// fatto", visto che entrambi passano da questa stessa funzione.
export function mostraNavConUtente(email) {
    nav.style.display = 'block';
    elementoUtente.textContent = email;

    // Cerchiamo il nome di battesimo corrispondente a questa email nella
    // mappa NOME_DA_EMAIL (js/stile.js); se l'email non è tra quelle
    // conosciute, usiamo l'email stessa come fallback nel saluto.
    const nome = NOME_DA_EMAIL[email] || email;
    salutoHome.textContent = 'Ciao ' + nome;
}

// Nasconde il nav (nessun utente loggato / dopo il logout)
function nascondiNav() {
    nav.style.display = 'none';
    elementoUtente.textContent = '';
}

// Pulsante "Esci": chiude la sessione su Supabase, nasconde il nav e
// torna alla vista di login, il tutto senza mai ricaricare la pagina.
bottoneLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
    nascondiNav();
    mostraVista('login');
});

// ============================================================
// 4) AVVIO DELL'APP
// ============================================================
// Sostituisce la vecchia logica di js/auth-guard.js: non essendoci più
// pagine separate da proteggere con un redirect, qui decidiamo solo
// quale vista mostrare all'apertura dell'app, in base al fatto che
// esista già o meno una sessione Supabase attiva.
//
// La chiamata a supabase.auth.getSession() serve anche come "test di
// connessione" verso Supabase: se va a buon fine aggiorniamo il
// paragrafo #test-connessione nella vista home (prima questo era
// gestito da un file js/test-connessione.js a parte, ora inutile).
async function avviaApp() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            throw error;
        }

        testConnessione.textContent = 'Connessione a Supabase riuscita ✅';
        testConnessione.classList.add('text-success');

        if (session) {
            // Sessione già presente (utente loggato in precedenza)
            mostraNavConUtente(session.user.email);
            mostraVista('home');
        } else {
            // Nessuna sessione: mostriamo solo la vista di login
            nascondiNav();
            mostraVista('login');
        }
    } catch (err) {
        testConnessione.textContent = `Errore di connessione a Supabase: ${err.message}`;
        testConnessione.classList.add('text-danger');

        // Senza sapere se la sessione è valida, per sicurezza mostriamo
        // comunque la vista di login
        nascondiNav();
        mostraVista('login');
    }
}

avviaApp();
