import { supabase } from './supabase-config.js';
import { mostraVista, mostraNavConUtente } from './router.js';

const form = document.getElementById('form-login');
const messaggioErrore = document.getElementById('messaggio-errore');

form.addEventListener('submit', async (event) => {
    event.preventDefault(); // impedisce alla pagina di ricaricarsi da sola

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    messaggioErrore.style.display = 'none';

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        // Login fallito: mostriamo il messaggio d'errore, restando sulla
        // vista di login
        messaggioErrore.textContent = 'Accesso non riuscito: email o password errati.';
        messaggioErrore.style.display = 'block';
    } else {
        // Login riuscito: essendo una Single Page Application non
        // cambiamo pagina. Mostriamo il nav con l'email dell'utente e
        // passiamo alla vista home tramite il router.
        mostraNavConUtente(data.user.email);
        mostraVista('home');
    }
});
