// Questo file raccoglie i colori "di significato" usati in tutta l'app,
// così da avere un'unica fonte di verità invece di ripetere gli stessi
// codici colore in più file: se un domani cambiassero, basta modificarli
// qui una sola volta.
//
// - COLORI_CATEGORIA_ALIMENTARE: il colore di una categoria alimentare
//   (es. "pesce") è sempre lo stesso ovunque compaia nell'app (card
//   ricette, griglia menù, riepilogo nutrizionale): questo aiuta l'utente
//   a riconoscere "a colpo d'occhio" la stessa categoria in viste diverse.
//
// - COLORI_PERSONA: allo stesso modo, ogni persona della famiglia ha
//   sempre lo stesso colore (usato per i pallini nella griglia menù),
//   per riconoscerla subito senza dover leggere il nome per intero.

// Coppie sfondo pieno e vivace / testo a contrasto, pensate per badge
// "a pillola" ben visibili (il testo chiaro o scuro, a seconda del caso,
// garantisce un buon contrasto sullo sfondo pieno corrispondente).
export const COLORI_CATEGORIA_ALIMENTARE = {
    carne_rossa: { bg: '#E4572E', testo: '#FFFFFF' },
    carne_bianca: { bg: '#CC7A3D', testo: '#FFFFFF' },
    pesce: { bg: '#1E88C7', testo: '#FFFFFF' },
    legumi: { bg: '#7C8A28', testo: '#FFFFFF' },
    formaggi_uova: { bg: '#B1527A', testo: '#FFFFFF' },
    verdura: { bg: '#3F8C46', testo: '#FFFFFF' },
    cereali: { bg: '#F2B705', testo: '#4A3900' }
};

// Colori pieni e vivaci, usati per i pallini identificativi di persona
// (il nome è la chiave, sempre in minuscolo).
export const COLORI_PERSONA = {
    gioele: '#1E88E5',
    giovanna: '#EC407A',
    clarissa: '#FFB300',
    ludovica: '#66BB6A'
};

// Sette colori, uno per ciascun giorno della settimana (indice 0 =
// Lunedì, indice 6 = Domenica), usati come accento colorato in cima a
// ogni card-giorno nella vista Menù Settimanale. Sono esattamente gli
// stessi 7 colori già usati come sfondo delle categorie alimentari
// (nell'ordine: verdura, pesce, cereali, legumi, carne bianca,
// formaggi-uova, carne rossa), semplicemente riusati in rotazione fissa
// sui giorni: qui il colore NON ha nessun legame con il contenuto del
// menù di quel giorno, serve solo come punto di riferimento visivo per
// orientarsi rapidamente scorrendo la griglia dei 7 giorni.
export const COLORI_GIORNO = ['#3F8C46', '#1E88C7', '#F2B705', '#7C8A28', '#CC7A3D', '#B1527A', '#E4572E'];

// Colore unico usato in tutta l'app per gli elementi interattivi di
// azione: bottoni primari, link "+ Aggiungi", checkbox. È volutamente
// un colore a sé (verde acqua acceso), diverso sia da
// COLORI_CATEGORIA_ALIMENTARE.verdura (oliva/basilico più scuro, che
// codifica la categoria "verdura" nei badge) sia da qualsiasi colore in
// COLORI_PERSONA: quei due servono a identificare un dato specifico
// (una categoria, una persona), mentre questo serve solo a dire
// "qui puoi agire", senza nessun significato legato ai dati.
export const COLORE_AZIONE = '#00BFA6';

// Colore di riserva per un nome persona non presente nella mappa sopra
// (es. se in futuro si aggiunge una persona e non è ancora stata
// assegnata un colore dedicato): grigio neutro, non "invisibile".
const COLORE_PERSONA_FALLBACK = '#9E9E9E';

// Restituisce il colore di una persona dato il suo nome, cercandolo in
// modo case-insensitive (funziona sia con "Gioele" che "gioele").
// Se il nome non è tra quelli noti, restituisce il colore di fallback
// invece di lasciare il pallino senza colore.
export function getColorePersona(nome) {
    const chiave = nome.toLowerCase();
    return COLORI_PERSONA[chiave] || COLORE_PERSONA_FALLBACK;
}

// Mappa email -> nome di battesimo, usata solo per il saluto personale
// nella home ("Ciao Gioele" invece di "Ciao gioele.massaro@hotmail.it").
// Se l'email dell'utente loggato non è tra quelle mappate qui, va usata
// l'email stessa come fallback (vedi js/router.js).
export const NOME_DA_EMAIL = {
    'gioele.massaro@hotmail.it': 'Gioele',
    'giovannasantoro1992@gmail.com': 'Giovanna'
};
