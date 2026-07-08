// ==========================================================
// DIZIONARIO DI RIFERIMENTO NUTRIZIONALE
// ==========================================================
// Fonte: Linee Guida CREA per una Sana Alimentazione, tabella delle
// grammature di riferimento per porzione. Per ogni ingrediente sono
// salvate due quantità (pranzo e cena, che secondo le linee guida non
// sono uguali per tutti gli alimenti) più l'unità di misura.
//
// Questo dizionario NON viene usato per calcoli automatici obbligatori:
// serve solo a SUGGERIRE una quantità plausibile all'utente mentre
// scrive il nome di un ingrediente nel form ricetta, che resta sempre
// libero di ignorarlo o modificarlo.
export const DIZIONARIO_GRAMMATURE = {
    "pane bianco": { pranzo: 120, cena: 100, unita: "g" },
    "pane integrale": { pranzo: 120, cena: 100, unita: "g" },
    "pane segale": { pranzo: 120, cena: 100, unita: "g" },
    "farro": { pranzo: 90, cena: 80, unita: "g" },
    "orzo": { pranzo: 90, cena: 80, unita: "g" },
    "fregola": { pranzo: 90, cena: 80, unita: "g" },
    "cous cous": { pranzo: 100, cena: 90, unita: "g" },
    "quinoa": { pranzo: 90, cena: 80, unita: "g" },
    "amaranto": { pranzo: 90, cena: 80, unita: "g" },
    "miglio": { pranzo: 100, cena: 90, unita: "g" },
    "grano saraceno": { pranzo: 100, cena: 90, unita: "g" },
    "bulgur": { pranzo: 90, cena: 80, unita: "g" },
    "pasta integrale": { pranzo: 90, cena: 80, unita: "g" },
    "pasta kamut": { pranzo: 100, cena: 90, unita: "g" },
    "riso basmati": { pranzo: 100, cena: 90, unita: "g" },
    "riso integrale": { pranzo: 90, cena: 80, unita: "g" },
    "pasta": { pranzo: 90, cena: 80, unita: "g" },
    "riso": { pranzo: 90, cena: 80, unita: "g" },
    "patate": { pranzo: 270, cena: 240, unita: "g" },
    "gnocchi": { pranzo: 180, cena: 160, unita: "g" },
    "pasta fresca": { pranzo: 180, cena: 160, unita: "g" },
    "tortellini": { pranzo: 180, cena: 160, unita: "g" },
    "ravioli": { pranzo: 180, cena: 160, unita: "g" },
    "pasta di riso": { pranzo: 120, cena: 60, unita: "g" },
    "manzo": { pranzo: 120, cena: 140, unita: "g" },
    "bovino": { pranzo: 120, cena: 140, unita: "g" },
    "vitello": { pranzo: 120, cena: 140, unita: "g" },
    "cavallo": { pranzo: 120, cena: 140, unita: "g" },
    "maiale": { pranzo: 100, cena: 120, unita: "g" },
    "salsiccia": { pranzo: 100, cena: 120, unita: "g" },
    "pollo": { pranzo: 140, cena: 160, unita: "g" },
    "tacchino": { pranzo: 120, cena: 140, unita: "g" },
    "coniglio": { pranzo: 140, cena: 160, unita: "g" },
    "nasello": { pranzo: 170, cena: 200, unita: "g" },
    "merluzzo": { pranzo: 170, cena: 200, unita: "g" },
    "sogliola": { pranzo: 170, cena: 200, unita: "g" },
    "platessa": { pranzo: 170, cena: 200, unita: "g" },
    "orata": { pranzo: 170, cena: 200, unita: "g" },
    "spigola": { pranzo: 170, cena: 200, unita: "g" },
    "trota": { pranzo: 170, cena: 200, unita: "g" },
    "salmone": { pranzo: 120, cena: 140, unita: "g" },
    "pesce spada": { pranzo: 120, cena: 140, unita: "g" },
    "tonno fresco": { pranzo: 120, cena: 140, unita: "g" },
    "gamberetti": { pranzo: 120, cena: 140, unita: "g" },
    "totani": { pranzo: 120, cena: 140, unita: "g" },
    "calamari": { pranzo: 120, cena: 140, unita: "g" },
    "seitan": { pranzo: 120, cena: 140, unita: "g" },
    "legumi": { pranzo: 250, cena: 280, unita: "g" },
    "ceci": { pranzo: 250, cena: 280, unita: "g" },
    "lenticchie": { pranzo: 250, cena: 280, unita: "g" },
    "fagioli": { pranzo: 250, cena: 280, unita: "g" },
    "piselli": { pranzo: 250, cena: 280, unita: "g" },
    "mozzarella": { pranzo: 100, cena: 120, unita: "g" },
    "primo sale": { pranzo: 100, cena: 120, unita: "g" },
    "ricotta": { pranzo: 100, cena: 120, unita: "g" },
    "philadelphia": { pranzo: 100, cena: 120, unita: "g" },
    "certosa": { pranzo: 100, cena: 120, unita: "g" },
    "brie": { pranzo: 50, cena: 60, unita: "g" },
    "parmigiano": { pranzo: 50, cena: 60, unita: "g" },
    "grana": { pranzo: 50, cena: 60, unita: "g" },
    "prosciutto": { pranzo: 60, cena: 70, unita: "g" },
    "mortadella": { pranzo: 60, cena: 70, unita: "g" },
    "bresaola": { pranzo: 60, cena: 70, unita: "g" },
    "fesa di tacchino": { pranzo: 60, cena: 70, unita: "g" },
    "olio evo": { pranzo: 10, cena: 10, unita: "g" },
    "olio extravergine": { pranzo: 10, cena: 10, unita: "g" }
};

// Caso speciale: le uova non si pesano in grammi, si contano "a pezzi"
// (e quel numero va arrotondato all'intero più vicino, come già fa la
// regola generale "arrotonda a pezzo indivisibile" del form ricetta).
export const SUGGERIMENTO_UOVA = { quantita: 2, unita: "pezzi", arrotonda: true };

// ==========================================================
// RICERCA DEL SUGGERIMENTO
// ==========================================================
// Cerca una corrispondenza per il nome ingrediente scritto dall'utente
// e restituisce un oggetto { quantita, unita, arrotonda } da proporre,
// oppure null se non troviamo nulla di simile nel dizionario.
export function cercaSuggerimento(nomeIngrediente, categoriePastoSelezionate) {
    // Normalizziamo il testo scritto dall'utente: minuscolo e senza spazi
    // ai bordi, così "Pasta ", "PASTA" e "pasta" vengono trattati allo
    // stesso modo. Se il campo è vuoto non c'è nulla da cercare (senza
    // questo controllo, un nome vuoto "corrisponderebbe" a qualsiasi
    // chiave, perché ogni stringa "contiene" la stringa vuota).
    const nomeNormalizzato = nomeIngrediente.trim().toLowerCase();
    if (nomeNormalizzato === '') {
        return null;
    }

    // Caso speciale uova: "uovo", "uova", "le uova", ecc. contengono
    // tutte la sotto-stringa "uov". Le uova si suggeriscono sempre a
    // pezzi, senza bisogno di guardare pranzo/cena.
    if (nomeNormalizzato.includes('uov')) {
        return SUGGERIMENTO_UOVA;
    }

    // Ordiniamo le chiavi del dizionario dalla più lunga alla più corta.
    // Perché: molte chiavi sono una "variante" di un'altra più generica
    // (es. "pasta integrale" contiene "pasta"). Se scorressimo le chiavi
    // in ordine qualsiasi, scrivendo "pasta integrale" potremmo trovare
    // prima "pasta" (match più generico e meno preciso) invece della
    // corrispondenza esatta "pasta integrale". Controllando prima le
    // chiavi più lunghe (più specifiche), la corrispondenza più precisa
    // vince sempre quando è disponibile.
    const chiaviOrdinate = Object.keys(DIZIONARIO_GRAMMATURE).sort(
        (a, b) => b.length - a.length
    );

    // Match "parziale" in entrambe le direzioni: nomeNormalizzato.includes(chiave)
    // copre il caso in cui l'utente scrive qualcosa di più lungo/specifico
    // della chiave (es. utente scrive "petto di pollo", chiave "pollo");
    // chiave.includes(nomeNormalizzato) copre il caso opposto, in cui
    // l'utente sta ancora scrivendo e ha digitato solo l'inizio di una
    // chiave più lunga (es. utente scrive "pasta integr", chiave "pasta
    // integrale").
    const chiaveTrovata = chiaviOrdinate.find(
        (chiave) => nomeNormalizzato.includes(chiave) || chiave.includes(nomeNormalizzato)
    );

    if (!chiaveTrovata) {
        return null;
    }

    const voce = DIZIONARIO_GRAMMATURE[chiaveTrovata];

    // Scegliamo la grammatura giusta in base a cosa è già stato spuntato
    // tra le categorie pasto della ricetta: le linee guida CREA danno
    // porzioni diverse per pranzo e cena. Se è spuntato "pranzo" (anche
    // insieme ad altre categorie) usiamo il valore pranzo; se invece è
    // spuntata solo "cena" (senza pranzo) usiamo il valore cena; se non
    // è ancora spuntato nulla, usiamo pranzo come valore di default
    // ragionevole (è la scelta più comune per la maggior parte dei piatti).
    let pastoDiRiferimento;
    if (categoriePastoSelezionate.includes('pranzo')) {
        pastoDiRiferimento = 'pranzo';
    } else if (categoriePastoSelezionate.includes('cena')) {
        pastoDiRiferimento = 'cena';
    } else {
        pastoDiRiferimento = 'pranzo';
    }

    return {
        quantita: voce[pastoDiRiferimento],
        unita: voce.unita,
        arrotonda: false
    };
}
