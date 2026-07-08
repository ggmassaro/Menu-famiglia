// Logica applicativa - Spese Famiglia

const loginScreen = document.getElementById("login-screen");
const appContainer = document.getElementById("app-container");
const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const loginButton = document.getElementById("login-button");
const loginError = document.getElementById("login-error");
const logoutButton = document.getElementById("logout-button");
const userEmailLabel = document.getElementById("user-email");

function showApp(email) {
  loginScreen.classList.add("d-none");
  appContainer.classList.remove("d-none");
  userEmailLabel.textContent = email || "";
  caricaDatiInserimentoSpesa();
}

function showLogin() {
  appContainer.classList.add("d-none");
  loginScreen.classList.remove("d-none");
  loginError.classList.add("d-none");
  loginError.textContent = "";
  loginPasswordInput.value = "";
}

async function checkSession() {
  const { data } = await db.auth.getSession();
  if (data.session) {
    showApp(data.session.user.email);
  } else {
    showLogin();
  }
}

async function handleLogin() {
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;

  const { data, error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    loginError.textContent = "Email o password non corretti";
    loginError.classList.remove("d-none");
    return;
  }

  showApp(data.user.email);
}

async function handleLogout() {
  await db.auth.signOut();
  showLogin();
}

loginButton.addEventListener("click", handleLogin);
logoutButton.addEventListener("click", handleLogout);

checkSession();

// ---------------------------------------------------------------------------
// Banner promemoria fine mese
// ---------------------------------------------------------------------------

const promemoriaFineMeseBanner = document.getElementById("promemoria-fine-mese-banner");

function mostraPromemoriaFineMeseSeNecessario() {
  const oggi = new Date();
  const giorniNelMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0).getDate();

  if (oggi.getDate() >= giorniNelMese - 1) {
    promemoriaFineMeseBanner.classList.remove("d-none");
  }
}

mostraPromemoriaFineMeseSeNecessario();

// ---------------------------------------------------------------------------
// Sezione "Inserisci Spesa"
// ---------------------------------------------------------------------------

const NUOVA_VOCE_VALORE = "__nuova_voce__";
const NUOVA_VOCE_TESTO = "+ Aggiungi nuova voce...";
const NUOVO_GRUPPO_VALORE = "__nuovo_gruppo__";
const NUOVO_GRUPPO_TESTO = "+ Aggiungi nuovo gruppo...";

const spesaNuovaButton = document.getElementById("spesa-nuova-button");
const spesaFormContainer = document.getElementById("spesa-form-container");
const spesaForm = document.getElementById("spesa-form");
const spesaDataInput = document.getElementById("spesa-data");
const spesaImportoInput = document.getElementById("spesa-importo");
const spesaVoceSelect = document.getElementById("spesa-voce");
const spesaGruppoSelect = document.getElementById("spesa-gruppo");
const spesaMetodoSelect = document.getElementById("spesa-metodo");
const spesaContoSelect = document.getElementById("spesa-conto");
const spesaNotaInput = document.getElementById("spesa-nota");
const spesaFeedback = document.getElementById("spesa-feedback");
const spesaSubmitButton = document.getElementById("spesa-submit-button");
const annullaModificaButton = document.getElementById("annulla-modifica-button");
const speseTableBody = document.getElementById("spese-table-body");
const speseCardsMobile = document.getElementById("spese-cards-mobile");
const filtroSpeseMese = document.getElementById("filtro-spese-mese");
const filtroSpeseVoce = document.getElementById("filtro-spese-voce");
const filtroSpeseGruppo = document.getElementById("filtro-spese-gruppo");
const filtroSpeseMetodo = document.getElementById("filtro-spese-metodo");
const filtroSpeseConto = document.getElementById("filtro-spese-conto");
const filtroSpeseResetButton = document.getElementById("filtro-spese-reset-button");
const filtroSpeseToggleButton = document.getElementById("filtro-spese-toggle-button");
const filtroSpeseContainer = document.getElementById("filtro-spese-container");

const CHIAVE_FILTRI_SPESE_LOCALSTORAGE = "filtriSpese";

let vociSpesaCache = [];
let gruppiSpesaCache = [];
let speseCache = [];
let ultimoValoreVoce = "";
let ultimoValoreGruppo = "";
let editingSpesaId = null;

function dataOdiernaISO() {
  const oggi = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${oggi.getFullYear()}-${pad(oggi.getMonth() + 1)}-${pad(oggi.getDate())}`;
}

function formatDataIt(dataISO) {
  const [anno, mese, giorno] = dataISO.split("-");
  return `${giorno}/${mese}/${anno}`;
}

function formatEuro(valore) {
  return Number(valore).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function escapeHtml(testo) {
  const div = document.createElement("div");
  div.textContent = testo ?? "";
  return div.innerHTML;
}

function escapeHtmlAttr(testo) {
  return escapeHtml(testo).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const PALETTE_VOCI = [
  "#2c7ef8", "#f2b544", "#8f6cff", "#38c6f4", "#ff6b9d",
  "#4fd6c8", "#7aa6ff", "#ffb347", "#6f7bf7", "#45b8e8",
];

function getColoreVoce(nomeVoce) {
  const indice = vociSpesaCache.findIndex((v) => v.nome === nomeVoce);
  return PALETTE_VOCI[(indice === -1 ? 0 : indice) % PALETTE_VOCI.length];
}

function coloriPerEtichette(etichette) {
  return etichette.map((_, indice) => PALETTE_VOCI[indice % PALETTE_VOCI.length]);
}

function mostraFeedbackSpesa(messaggio, tipo) {
  spesaFeedback.textContent = messaggio;
  spesaFeedback.className = `alert alert-${tipo} mt-3`;
}

function nascondiFeedbackSpesa() {
  spesaFeedback.classList.add("d-none");
}

function renderVoceOptions(selezionata) {
  spesaVoceSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.textContent = "Seleziona...";
  spesaVoceSelect.appendChild(placeholder);

  vociSpesaCache.forEach((voce) => {
    const opt = document.createElement("option");
    opt.value = voce.nome;
    opt.textContent = voce.nome;
    spesaVoceSelect.appendChild(opt);
  });

  const nuova = document.createElement("option");
  nuova.value = NUOVA_VOCE_VALORE;
  nuova.textContent = NUOVA_VOCE_TESTO;
  spesaVoceSelect.appendChild(nuova);

  spesaVoceSelect.value = selezionata || "";
  ultimoValoreVoce = spesaVoceSelect.value;
}

function renderGruppoOptions(selezionata) {
  spesaGruppoSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.textContent = "Seleziona...";
  spesaGruppoSelect.appendChild(placeholder);

  gruppiSpesaCache.forEach((gruppo) => {
    const opt = document.createElement("option");
    opt.value = gruppo.nome;
    opt.textContent = gruppo.nome;
    spesaGruppoSelect.appendChild(opt);
  });

  const nuovo = document.createElement("option");
  nuovo.value = NUOVO_GRUPPO_VALORE;
  nuovo.textContent = NUOVO_GRUPPO_TESTO;
  spesaGruppoSelect.appendChild(nuovo);

  spesaGruppoSelect.value = selezionata || "";
  ultimoValoreGruppo = spesaGruppoSelect.value;
}

function renderFiltroVoceOptions() {
  const valoreAttuale = filtroSpeseVoce.value;
  filtroSpeseVoce.innerHTML =
    '<option value="">Tutte</option>' +
    vociSpesaCache.map((v) => `<option value="${escapeHtmlAttr(v.nome)}">${escapeHtml(v.nome)}</option>`).join("");
  filtroSpeseVoce.value = valoreAttuale;
}

function renderFiltroGruppoOptions() {
  const valoreAttuale = filtroSpeseGruppo.value;
  filtroSpeseGruppo.innerHTML =
    '<option value="">Tutti</option>' +
    gruppiSpesaCache.map((g) => `<option value="${escapeHtmlAttr(g.nome)}">${escapeHtml(g.nome)}</option>`).join("");
  filtroSpeseGruppo.value = valoreAttuale;
}

async function caricaVociSpesa(selezionata) {
  const { data, error } = await db.from("voci_spesa").select("*").order("nome");
  if (!error) {
    vociSpesaCache = data || [];
  }
  renderVoceOptions(selezionata);
  renderFiltroVoceOptions();
}

async function caricaGruppiSpesa(selezionata) {
  const { data, error } = await db.from("gruppi_spesa").select("*").order("nome");
  if (!error) {
    gruppiSpesaCache = data || [];
  }
  renderGruppoOptions(selezionata);
  renderFiltroGruppoOptions();
}

async function gestisciNuovaVoce() {
  const nome = window.prompt("Nome nuova voce di spesa:");
  if (!nome || !nome.trim()) {
    spesaVoceSelect.value = ultimoValoreVoce;
    return;
  }

  const { error } = await db.from("voci_spesa").insert({ nome: nome.trim() });
  if (error) {
    mostraFeedbackSpesa("Errore nella creazione della voce: " + error.message, "danger");
    spesaVoceSelect.value = ultimoValoreVoce;
    return;
  }

  await caricaVociSpesa(nome.trim());
}

async function gestisciNuovoGruppo() {
  const nome = window.prompt("Nome nuovo gruppo di spesa:");
  if (!nome || !nome.trim()) {
    spesaGruppoSelect.value = ultimoValoreGruppo;
    return;
  }

  const nomeTrim = nome.trim();
  const { error } = await db.from("gruppi_spesa").insert({ nome: nomeTrim });
  if (error) {
    mostraFeedbackSpesa("Errore nella creazione del gruppo: " + error.message, "danger");
    spesaGruppoSelect.value = ultimoValoreGruppo;
    return;
  }

  await caricaGruppiSpesa(nomeTrim);
  await creaBudgetAutomaticoPerNuovoGruppo(nomeTrim);
}

spesaVoceSelect.addEventListener("change", () => {
  if (spesaVoceSelect.value === NUOVA_VOCE_VALORE) {
    gestisciNuovaVoce();
  } else {
    ultimoValoreVoce = spesaVoceSelect.value;
  }
});

spesaGruppoSelect.addEventListener("change", () => {
  if (spesaGruppoSelect.value === NUOVO_GRUPPO_VALORE) {
    gestisciNuovoGruppo();
  } else {
    ultimoValoreGruppo = spesaGruppoSelect.value;
  }
});

function renderSpeseTable() {
  speseTableBody.innerHTML = speseCache
    .map(
      (spesa) => `
        <tr>
          <td>${formatDataIt(spesa.data)}</td>
          <td>${formatEuro(spesa.importo)}</td>
          <td><span class="voce-dot" style="background:${getColoreVoce(spesa.voce_spesa)}"></span>${escapeHtml(spesa.voce_spesa)}</td>
          <td>${escapeHtml(spesa.gruppo_spesa)}</td>
          <td>${escapeHtml(spesa.metodo_pagamento)}</td>
          <td>${escapeHtml(spesa.conto)}</td>
          <td>${escapeHtml(spesa.nota)}</td>
          <td class="text-nowrap">
            <button type="button" class="btn btn-sm btn-outline-primary btn-modifica-spesa" data-id="${spesa.id}">Modifica</button>
            <button type="button" class="btn btn-sm btn-outline-danger btn-elimina-spesa" data-id="${spesa.id}">Elimina</button>
          </td>
        </tr>
      `
    )
    .join("");

  speseCardsMobile.innerHTML = speseCache
    .map(
      (spesa) => `
        <div class="spesa-card-mobile">
          <div class="spesa-card-riga-alto">
            <span>${formatDataIt(spesa.data)}</span>
            <span class="spesa-card-importo">${formatEuro(spesa.importo)}</span>
          </div>
          <div class="spesa-card-riga">
            <span class="voce-dot" style="background:${getColoreVoce(spesa.voce_spesa)}"></span>${escapeHtml(spesa.voce_spesa)} - ${escapeHtml(spesa.gruppo_spesa)}
          </div>
          <div class="spesa-card-riga">
            ${escapeHtml(spesa.metodo_pagamento)} &middot; ${escapeHtml(spesa.conto)}${spesa.nota ? ` - ${escapeHtml(spesa.nota)}` : ""}
          </div>
          <div class="spesa-card-azioni">
            <button type="button" class="btn btn-sm btn-outline-primary btn-modifica-spesa" data-id="${spesa.id}">Modifica</button>
            <button type="button" class="btn btn-sm btn-outline-danger btn-elimina-spesa" data-id="${spesa.id}">Elimina</button>
          </div>
        </div>
      `
    )
    .join("");
}

function filtriSpeseAttivi() {
  return {
    mese: filtroSpeseMese.value,
    voce: filtroSpeseVoce.value,
    gruppo: filtroSpeseGruppo.value,
    metodo: filtroSpeseMetodo.value,
    conto: filtroSpeseConto.value,
  };
}

async function caricaSpeseRecenti() {
  const filtri = filtriSpeseAttivi();
  const almenoUnFiltroAttivo = Object.values(filtri).some((valore) => valore !== "");

  let query = db.from("spese").select("*");

  if (filtri.mese) {
    const { anno, mese } = parseMeseInput(filtri.mese);
    const { primoGiorno, ultimoGiorno } = rangeDateMese(anno, mese);
    query = query.gte("data", primoGiorno).lte("data", ultimoGiorno);
  }
  if (filtri.voce) {
    query = query.eq("voce_spesa", filtri.voce);
  }
  if (filtri.gruppo) {
    query = query.eq("gruppo_spesa", filtri.gruppo);
  }
  if (filtri.metodo) {
    query = query.eq("metodo_pagamento", filtri.metodo);
  }
  if (filtri.conto) {
    query = filtri.conto === "Non specificato" ? query.is("conto", null) : query.eq("conto", filtri.conto);
  }

  query = query.order("data", { ascending: false }).order("created_at", { ascending: false });

  if (!almenoUnFiltroAttivo) {
    query = query.limit(20);
  }

  const { data, error } = await query;

  if (!error) {
    speseCache = data || [];
    renderSpeseTable();
  }
}

function apriFormSpesa() {
  spesaFormContainer.classList.remove("d-none");
  spesaNuovaButton.classList.add("d-none");
}

function chiudiFormSpesa() {
  spesaFormContainer.classList.add("d-none");
  spesaNuovaButton.classList.remove("d-none");
}

function resetSpesaForm() {
  const metodoAttuale = spesaMetodoSelect.value;

  spesaDataInput.value = dataOdiernaISO();
  spesaImportoInput.value = "";
  renderVoceOptions("");
  renderGruppoOptions("");
  spesaMetodoSelect.value = metodoAttuale;
  spesaContoSelect.value = "Condiviso";
  spesaNotaInput.value = "";

  editingSpesaId = null;
  spesaSubmitButton.textContent = "Salva spesa";
}

function iniziaModificaSpesa(id) {
  const spesa = speseCache.find((s) => String(s.id) === String(id));
  if (!spesa) return;

  editingSpesaId = spesa.id;
  spesaDataInput.value = spesa.data;
  spesaImportoInput.value = spesa.importo;
  renderVoceOptions(spesa.voce_spesa);
  renderGruppoOptions(spesa.gruppo_spesa);
  spesaMetodoSelect.value = spesa.metodo_pagamento;
  spesaContoSelect.value = spesa.conto || "Condiviso";
  spesaNotaInput.value = spesa.nota || "";

  spesaSubmitButton.textContent = "Aggiorna spesa";
  nascondiFeedbackSpesa();
  apriFormSpesa();
}

async function eliminaSpesa(id) {
  const confermato = window.confirm("Eliminare questa spesa?");
  if (!confermato) return;

  const { error } = await db.from("spese").delete().eq("id", id);
  if (error) {
    mostraFeedbackSpesa("Errore durante l'eliminazione: " + error.message, "danger");
    return;
  }

  if (String(editingSpesaId) === String(id)) {
    resetSpesaForm();
  }

  await caricaSpeseRecenti();
}

function gestisciClickAzioniSpesa(event) {
  const bottoneModifica = event.target.closest(".btn-modifica-spesa");
  if (bottoneModifica) {
    iniziaModificaSpesa(bottoneModifica.dataset.id);
    return;
  }

  const bottoneElimina = event.target.closest(".btn-elimina-spesa");
  if (bottoneElimina) {
    eliminaSpesa(bottoneElimina.dataset.id);
  }
}

speseTableBody.addEventListener("click", gestisciClickAzioniSpesa);
speseCardsMobile.addEventListener("click", gestisciClickAzioniSpesa);

spesaNuovaButton.addEventListener("click", () => {
  resetSpesaForm();
  nascondiFeedbackSpesa();
  apriFormSpesa();
});

annullaModificaButton.addEventListener("click", () => {
  resetSpesaForm();
  nascondiFeedbackSpesa();
  chiudiFormSpesa();
});

spesaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  nascondiFeedbackSpesa();

  if (!spesaForm.checkValidity()) {
    spesaForm.reportValidity();
    return;
  }

  const payload = {
    data: spesaDataInput.value,
    importo: parseFloat(spesaImportoInput.value),
    voce_spesa: spesaVoceSelect.value,
    gruppo_spesa: spesaGruppoSelect.value,
    metodo_pagamento: spesaMetodoSelect.value,
    conto: spesaContoSelect.value,
    nota: spesaNotaInput.value.trim() || null,
  };

  const { error } = editingSpesaId
    ? await db.from("spese").update(payload).eq("id", editingSpesaId)
    : await db.from("spese").insert(payload);

  if (error) {
    mostraFeedbackSpesa("Errore durante il salvataggio: " + error.message, "danger");
    return;
  }

  mostraFeedbackSpesa("Spesa salvata correttamente", "success");
  resetSpesaForm();
  await caricaSpeseRecenti();
});

function apriFiltriSpese() {
  filtroSpeseContainer.classList.remove("d-none");
}

function chiudiFiltriSpese() {
  filtroSpeseContainer.classList.add("d-none");
}

function salvaFiltriSpese() {
  localStorage.setItem(CHIAVE_FILTRI_SPESE_LOCALSTORAGE, JSON.stringify(filtriSpeseAttivi()));
}

function ripristinaFiltriSpese() {
  let filtriSalvati = {};
  try {
    filtriSalvati = JSON.parse(localStorage.getItem(CHIAVE_FILTRI_SPESE_LOCALSTORAGE) || "{}");
  } catch {
    filtriSalvati = {};
  }

  filtroSpeseMese.value = filtriSalvati.mese || "";
  filtroSpeseVoce.value = filtriSalvati.voce || "";
  filtroSpeseGruppo.value = filtriSalvati.gruppo || "";
  filtroSpeseMetodo.value = filtriSalvati.metodo || "";
  filtroSpeseConto.value = filtriSalvati.conto || "";

  const almenoUnFiltroAttivo = Object.values(filtriSpeseAttivi()).some((valore) => valore !== "");
  if (almenoUnFiltroAttivo) {
    apriFiltriSpese();
  }
}

function gestisciCambioFiltroSpese() {
  salvaFiltriSpese();
  caricaSpeseRecenti();
}

filtroSpeseMese.addEventListener("change", gestisciCambioFiltroSpese);
filtroSpeseVoce.addEventListener("change", gestisciCambioFiltroSpese);
filtroSpeseGruppo.addEventListener("change", gestisciCambioFiltroSpese);
filtroSpeseMetodo.addEventListener("change", gestisciCambioFiltroSpese);
filtroSpeseConto.addEventListener("change", gestisciCambioFiltroSpese);

filtroSpeseResetButton.addEventListener("click", () => {
  filtroSpeseMese.value = "";
  filtroSpeseVoce.value = "";
  filtroSpeseGruppo.value = "";
  filtroSpeseMetodo.value = "";
  filtroSpeseConto.value = "";
  salvaFiltriSpese();
  caricaSpeseRecenti();
});

filtroSpeseToggleButton.addEventListener("click", () => {
  if (filtroSpeseContainer.classList.contains("d-none")) {
    apriFiltriSpese();
  } else {
    chiudiFiltriSpese();
  }
});

async function caricaDatiInserimentoSpesa() {
  spesaDataInput.value = spesaDataInput.value || dataOdiernaISO();
  await Promise.all([caricaVociSpesa(), caricaGruppiSpesa()]);
  ripristinaFiltriSpese();
  await caricaSpeseRecenti();
}

// ---------------------------------------------------------------------------
// Gestione Voci/Gruppi spesa (modale)
// ---------------------------------------------------------------------------

const gestisciVociGruppiButton = document.getElementById("gestisci-voci-gruppi-button");
const gestisciVociGruppiModal = new bootstrap.Modal(document.getElementById("gestisci-voci-gruppi-modal"));
const gestioneVociLista = document.getElementById("gestione-voci-lista");
const gestioneGruppiLista = document.getElementById("gestione-gruppi-lista");
const gestioneVoceNuovaInput = document.getElementById("gestione-voce-nuova-input");
const gestioneVoceAggiungiButton = document.getElementById("gestione-voce-aggiungi-button");
const gestioneGruppoNuovoInput = document.getElementById("gestione-gruppo-nuovo-input");
const gestioneGruppoAggiungiButton = document.getElementById("gestione-gruppo-aggiungi-button");

function renderGestioneListe() {
  gestioneVociLista.innerHTML = vociSpesaCache
    .map(
      (voce) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          ${escapeHtml(voce.nome)}
          <button type="button" class="btn btn-sm btn-outline-danger gestione-elimina-voce" data-id="${voce.id}" data-nome="${escapeHtmlAttr(voce.nome)}">&times;</button>
        </li>
      `
    )
    .join("");

  gestioneGruppiLista.innerHTML = gruppiSpesaCache
    .map(
      (gruppo) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          ${escapeHtml(gruppo.nome)}
          <button type="button" class="btn btn-sm btn-outline-danger gestione-elimina-gruppo" data-id="${gruppo.id}" data-nome="${escapeHtmlAttr(gruppo.nome)}">&times;</button>
        </li>
      `
    )
    .join("");
}

async function eliminaVoceGestione(id, nome) {
  if (!window.confirm(`Eliminare la voce "${nome}"?`)) return;

  const { error } = await db.from("voci_spesa").delete().eq("id", id);
  if (error) {
    window.alert("Errore durante l'eliminazione: " + error.message);
    return;
  }

  await caricaVociSpesa(spesaVoceSelect.value);
  renderGestioneListe();
}

async function eliminaGruppoGestione(id, nome) {
  if (!window.confirm(`Eliminare il gruppo "${nome}"?`)) return;

  const { error } = await db.from("gruppi_spesa").delete().eq("id", id);
  if (error) {
    window.alert("Errore durante l'eliminazione: " + error.message);
    return;
  }

  await caricaGruppiSpesa(spesaGruppoSelect.value);
  renderGestioneListe();
}

async function aggiungiVoceGestione() {
  const nome = gestioneVoceNuovaInput.value.trim();
  if (!nome) return;

  const { error } = await db.from("voci_spesa").insert({ nome });
  if (error) {
    window.alert("Errore nella creazione della voce: " + error.message);
    return;
  }

  gestioneVoceNuovaInput.value = "";
  await caricaVociSpesa(spesaVoceSelect.value);
  renderGestioneListe();
}

async function aggiungiGruppoGestione() {
  const nome = gestioneGruppoNuovoInput.value.trim();
  if (!nome) return;

  const { error } = await db.from("gruppi_spesa").insert({ nome });
  if (error) {
    window.alert("Errore nella creazione del gruppo: " + error.message);
    return;
  }

  gestioneGruppoNuovoInput.value = "";
  await caricaGruppiSpesa(spesaGruppoSelect.value);
  renderGestioneListe();
  await creaBudgetAutomaticoPerNuovoGruppo(nome);
}

gestisciVociGruppiButton.addEventListener("click", () => {
  renderGestioneListe();
  gestisciVociGruppiModal.show();
});

gestioneVociLista.addEventListener("click", (event) => {
  const bottone = event.target.closest(".gestione-elimina-voce");
  if (bottone) {
    eliminaVoceGestione(bottone.dataset.id, bottone.dataset.nome);
  }
});

gestioneGruppiLista.addEventListener("click", (event) => {
  const bottone = event.target.closest(".gestione-elimina-gruppo");
  if (bottone) {
    eliminaGruppoGestione(bottone.dataset.id, bottone.dataset.nome);
  }
});

gestioneVoceAggiungiButton.addEventListener("click", aggiungiVoceGestione);
gestioneGruppoAggiungiButton.addEventListener("click", aggiungiGruppoGestione);

gestioneVoceNuovaInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    aggiungiVoceGestione();
  }
});

gestioneGruppoNuovoInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    aggiungiGruppoGestione();
  }
});

// ---------------------------------------------------------------------------
// Sezione "Dashboard"
// ---------------------------------------------------------------------------

const dashboardTabButton = document.getElementById("dashboard-tab");
const dashboardMeseFiltro = document.getElementById("dashboard-mese-filtro");
const dashboardTotaleMeseEl = document.getElementById("dashboard-totale-mese");
const dashboardExportCsvButton = document.getElementById("dashboard-export-csv-button");

let tutteLeSpeseCache = [];
const chartInstances = {};

Chart.defaults.color = "#cfced9";

const NOMI_MESI_IT = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

function meseCorrenteISO() {
  const oggi = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${oggi.getFullYear()}-${pad(oggi.getMonth() + 1)}`;
}

function formatMeseLabel(meseISO) {
  const [anno, mese] = meseISO.split("-");
  return `${NOMI_MESI_IT[parseInt(mese, 10) - 1]} ${anno}`;
}

function aggregaImportiPerChiave(spese, chiave, etichettaDefault) {
  return spese.reduce((aggregato, spesa) => {
    const chiaveValore = spesa[chiave] || etichettaDefault || spesa[chiave];
    aggregato[chiaveValore] = (aggregato[chiaveValore] || 0) + Number(spesa.importo);
    return aggregato;
  }, {});
}

function disegnaGrafico(canvasId, config) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  const canvas = document.getElementById(canvasId);
  chartInstances[canvasId] = new Chart(canvas, config);
}

function filtraSpesePerMese(mese) {
  return tutteLeSpeseCache.filter((spesa) => spesa.data.slice(0, 7) === mese);
}

function aggiornaDashboardMese() {
  const mese = dashboardMeseFiltro.value;
  if (!mese) return;

  const speseMese = filtraSpesePerMese(mese);
  const totale = speseMese.reduce((somma, spesa) => somma + Number(spesa.importo), 0);
  dashboardTotaleMeseEl.textContent = formatEuro(totale);

  const aggregatoVoce = aggregaImportiPerChiave(speseMese, "voce_spesa");
  const aggregatoGruppo = aggregaImportiPerChiave(speseMese, "gruppo_spesa");
  const aggregatoConto = aggregaImportiPerChiave(speseMese, "conto", "Non specificato");

  const etichetteVoce = Object.keys(aggregatoVoce);
  const etichetteGruppo = Object.keys(aggregatoGruppo);
  const etichetteConto = Object.keys(aggregatoConto);

  disegnaGrafico("dashboard-chart-voce", {
    type: "pie",
    data: {
      labels: etichetteVoce,
      datasets: [{ data: Object.values(aggregatoVoce), backgroundColor: etichetteVoce.map(getColoreVoce) }],
    },
    options: { plugins: { legend: { position: "bottom" } } },
  });

  disegnaGrafico("dashboard-chart-gruppo", {
    type: "pie",
    data: {
      labels: etichetteGruppo,
      datasets: [{ data: Object.values(aggregatoGruppo), backgroundColor: coloriPerEtichette(etichetteGruppo) }],
    },
    options: { plugins: { legend: { position: "bottom" } } },
  });

  disegnaGrafico("dashboard-chart-conto", {
    type: "pie",
    data: {
      labels: etichetteConto,
      datasets: [{ data: Object.values(aggregatoConto), backgroundColor: coloriPerEtichette(etichetteConto) }],
    },
    options: { plugins: { legend: { position: "bottom" } } },
  });
}

function aggiornaGraficoTrend() {
  const aggregatoMensile = {};
  tutteLeSpeseCache.forEach((spesa) => {
    const chiaveMese = spesa.data.slice(0, 7);
    aggregatoMensile[chiaveMese] = (aggregatoMensile[chiaveMese] || 0) + Number(spesa.importo);
  });

  const mesiOrdinati = Object.keys(aggregatoMensile).sort();

  disegnaGrafico("dashboard-chart-trend", {
    type: "bar",
    data: {
      labels: mesiOrdinati.map(formatMeseLabel),
      datasets: [{ label: "Totale speso", data: mesiOrdinati.map((m) => aggregatoMensile[m]) }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

async function caricaDashboard() {
  const { data, error } = await db.from("spese").select("*");
  if (!error) {
    tutteLeSpeseCache = data || [];
  }
  aggiornaDashboardMese();
  aggiornaGraficoTrend();
}

function escapeCsvCampo(valore) {
  const testo = String(valore ?? "");
  if (/[",;\n]/.test(testo)) {
    return '"' + testo.replace(/"/g, '""') + '"';
  }
  return testo;
}

function creaRigaCsv(campi) {
  return campi.map(escapeCsvCampo).join(";");
}

function formatImportoCsv(valore) {
  return Number(valore).toFixed(2).replace(".", ",");
}

function esportaCsvMeseSelezionato() {
  const mese = dashboardMeseFiltro.value;
  const speseMese = filtraSpesePerMese(mese).sort((a, b) => a.data.localeCompare(b.data));

  const intestazione = ["Data", "Importo", "Voce spesa", "Gruppo spesa", "Metodo pagamento", "Conto", "Nota"];
  const righe = speseMese.map((spesa) =>
    creaRigaCsv([
      formatDataIt(spesa.data),
      formatImportoCsv(spesa.importo),
      spesa.voce_spesa,
      spesa.gruppo_spesa,
      spesa.metodo_pagamento,
      spesa.conto || "",
      spesa.nota || "",
    ])
  );

  const contenutoCsv = [creaRigaCsv(intestazione), ...righe].join("\n");
  const blob = new Blob(["﻿" + contenutoCsv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `spese_${mese}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

dashboardMeseFiltro.value = meseCorrenteISO();
dashboardMeseFiltro.addEventListener("change", aggiornaDashboardMese);
dashboardExportCsvButton.addEventListener("click", esportaCsvMeseSelezionato);
dashboardTabButton.addEventListener("shown.bs.tab", caricaDashboard);

// ---------------------------------------------------------------------------
// Sezione "Budget"
// ---------------------------------------------------------------------------

const budgetTabButton = document.getElementById("budget-tab");
const budgetMeseInput = document.getElementById("budget-mese-selezionato");
const budgetImportBanner = document.getElementById("budget-import-banner");
const budgetCopiaMeseScorsoButton = document.getElementById("budget-copia-mese-scorso-button");
const budgetNuovoButton = document.getElementById("budget-nuovo-button");
const budgetFormContainer = document.getElementById("budget-form-container");
const budgetForm = document.getElementById("budget-form");
const budgetNomeInput = document.getElementById("budget-nome");
const budgetVociChecklist = document.getElementById("budget-voci-checklist");
const budgetGruppiChecklist = document.getElementById("budget-gruppi-checklist");
const budgetImportoInput = document.getElementById("budget-importo");
const budgetFeedback = document.getElementById("budget-feedback");
const budgetSubmitButton = document.getElementById("budget-submit-button");
const budgetAnnullaModificaButton = document.getElementById("budget-annulla-modifica-button");
const budgetBozzeContainer = document.getElementById("budget-bozze-container");
const budgetBozzeList = document.getElementById("budget-bozze-list");
const budgetSalvaTutteBozzeButton = document.getElementById("budget-salva-tutte-bozze-button");
const budgetLista = document.getElementById("budget-lista");
const dettaglioBudgetModal = new bootstrap.Modal(document.getElementById("dettaglio-budget-modal"));
const dettaglioBudgetTitolo = document.getElementById("dettaglio-budget-titolo");
const dettaglioBudgetTbody = document.getElementById("dettaglio-budget-tbody");
const budgetNonCoperteBanner = document.getElementById("budget-non-coperte-banner");
const budgetNonCoperteTesto = document.getElementById("budget-non-coperte-testo");
const budgetNonCoperteVediButton = document.getElementById("budget-non-coperte-vedi-button");
const budgetTotaleRiepilogo = document.getElementById("budget-totale-riepilogo");
const budgetTotaleStatus = document.getElementById("budget-totale-status");
const budgetTotaleProgressBar = document.getElementById("budget-totale-progress-bar");
const budgetTotaleTesto = document.getElementById("budget-totale-testo");

let budgetDelMeseCache = [];
let speseDelMeseBudgetCache = [];
let budgetMesePrecedenteCache = [];
let budgetBozze = [];
let editingBudgetId = null;

function parseMeseInput(valore) {
  const [annoStr, meseStr] = valore.split("-");
  return { anno: parseInt(annoStr, 10), mese: parseInt(meseStr, 10) };
}

function mesePrecedente(anno, mese) {
  return mese === 1 ? { anno: anno - 1, mese: 12 } : { anno, mese: mese - 1 };
}

function rangeDateMese(anno, mese) {
  const pad = (n) => String(n).padStart(2, "0");
  const primoGiorno = `${anno}-${pad(mese)}-01`;
  const ultimoGiornoNumero = new Date(anno, mese, 0).getDate();
  const ultimoGiorno = `${anno}-${pad(mese)}-${pad(ultimoGiornoNumero)}`;
  return { primoGiorno, ultimoGiorno };
}

async function caricaSpeseDelMeseBudget(anno, mese) {
  const { primoGiorno, ultimoGiorno } = rangeDateMese(anno, mese);
  const { data, error } = await db
    .from("spese")
    .select("*")
    .gte("data", primoGiorno)
    .lte("data", ultimoGiorno);
  return error ? [] : data || [];
}

async function caricaBudgetDelMese(anno, mese) {
  const { data, error } = await db
    .from("budget")
    .select("*")
    .eq("anno", anno)
    .eq("mese", mese)
    .order("nome");
  return error ? [] : data || [];
}

function renderChecklist(container, elementi, prefissoId) {
  const selezionatiPrecedenti = new Set(
    Array.from(container.querySelectorAll("input:checked")).map((cb) => cb.value)
  );

  container.innerHTML = elementi
    .map((elemento, indice) => {
      const id = `${prefissoId}-${indice}`;
      const selezionato = selezionatiPrecedenti.has(elemento.nome) ? "checked" : "";
      return `
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="${escapeHtmlAttr(elemento.nome)}" id="${id}" ${selezionato}>
          <label class="form-check-label" for="${id}">${escapeHtml(elemento.nome)}</label>
        </div>
      `;
    })
    .join("");
}

async function caricaVociGruppiBudgetSelect() {
  const [{ data: voci }, { data: gruppi }] = await Promise.all([
    db.from("voci_spesa").select("*").order("nome"),
    db.from("gruppi_spesa").select("*").order("nome"),
  ]);

  renderChecklist(budgetVociChecklist, voci || [], "budget-voce-check");
  renderChecklist(budgetGruppiChecklist, gruppi || [], "budget-gruppo-check");
}

async function creaBudgetAutomaticoPerNuovoGruppo(nomeGruppo) {
  const rispostaImporto = window.prompt(`Imposta il budget mensile per "${nomeGruppo}" (€):`);
  const importoParsed = parseFloat(rispostaImporto);
  const importoMensile = rispostaImporto !== null && !isNaN(importoParsed) && importoParsed >= 0 ? importoParsed : 0;

  const { anno, mese } = parseMeseInput(budgetMeseInput.value || meseCorrenteISO());

  const { error } = await db.from("budget").insert({
    nome: nomeGruppo,
    voci_spesa: [],
    gruppi_spesa: [nomeGruppo],
    importo_mensile: importoMensile,
    mese,
    anno,
  });

  if (error) {
    window.alert("Errore nella creazione automatica del budget: " + error.message);
    return;
  }

  await ricaricaBudgetETotali();
}

function mostraFeedbackBudget(messaggio, tipo) {
  budgetFeedback.textContent = messaggio;
  budgetFeedback.className = `alert alert-${tipo} mt-3`;
}

function nascondiFeedbackBudget() {
  budgetFeedback.classList.add("d-none");
}

function mostraBannerImportBudget(budgetPrecedente) {
  budgetMesePrecedenteCache = budgetPrecedente;
  budgetImportBanner.classList.remove("d-none");
}

function nascondiBannerImportBudget() {
  budgetImportBanner.classList.add("d-none");
  budgetMesePrecedenteCache = [];
}

function apriFormBudget() {
  budgetFormContainer.classList.remove("d-none");
  budgetNuovoButton.classList.add("d-none");
}

function chiudiFormBudget() {
  budgetFormContainer.classList.add("d-none");
  budgetNuovoButton.classList.remove("d-none");
}

function resetBudgetForm() {
  budgetNomeInput.value = "";
  budgetVociChecklist.querySelectorAll("input").forEach((cb) => (cb.checked = false));
  budgetGruppiChecklist.querySelectorAll("input").forEach((cb) => (cb.checked = false));
  budgetImportoInput.value = "";

  editingBudgetId = null;
  budgetSubmitButton.textContent = "Salva budget";
}

function iniziaModificaBudget(id) {
  const budget = budgetDelMeseCache.find((b) => String(b.id) === String(id));
  if (!budget) return;

  editingBudgetId = budget.id;
  budgetNomeInput.value = budget.nome;
  budgetVociChecklist.querySelectorAll("input").forEach((cb) => {
    cb.checked = (budget.voci_spesa || []).includes(cb.value);
  });
  budgetGruppiChecklist.querySelectorAll("input").forEach((cb) => {
    cb.checked = (budget.gruppi_spesa || []).includes(cb.value);
  });
  budgetImportoInput.value = budget.importo_mensile;

  budgetSubmitButton.textContent = "Aggiorna budget";
  nascondiFeedbackBudget();
  apriFormBudget();
}

async function eliminaBudget(id) {
  const confermato = window.confirm("Eliminare questo budget?");
  if (!confermato) return;

  const { error } = await db.from("budget").delete().eq("id", id);
  if (error) {
    mostraFeedbackBudget("Errore durante l'eliminazione: " + error.message, "danger");
    return;
  }

  if (String(editingBudgetId) === String(id)) {
    resetBudgetForm();
  }

  await ricaricaBudgetETotali();
}

function filtraSpesePerBudget(budget) {
  const vociIncluse = new Set(budget.voci_spesa || []);
  const gruppiInclusi = new Set(budget.gruppi_spesa || []);

  return speseDelMeseBudgetCache.filter(
    (spesa) => vociIncluse.has(spesa.voce_spesa) || gruppiInclusi.has(spesa.gruppo_spesa)
  );
}

function calcolaActualBudget(budget) {
  return filtraSpesePerBudget(budget).reduce((somma, spesa) => somma + Number(spesa.importo), 0);
}

function renderRigheSpeseDettaglio(spese, messaggioVuoto) {
  if (spese.length === 0) {
    return `<tr><td colspan="5" class="text-muted">${messaggioVuoto}</td></tr>`;
  }

  return spese
    .map(
      (spesa) => `
        <tr>
          <td>${formatDataIt(spesa.data)}</td>
          <td>${formatEuro(spesa.importo)}</td>
          <td>${escapeHtml(spesa.voce_spesa)}</td>
          <td>${escapeHtml(spesa.gruppo_spesa)}</td>
          <td>${escapeHtml(spesa.conto)}</td>
        </tr>
      `
    )
    .join("");
}

function apriDettaglioSpeseModale(titolo, spese, messaggioVuoto) {
  dettaglioBudgetTitolo.textContent = titolo;
  dettaglioBudgetTbody.innerHTML = renderRigheSpeseDettaglio(spese, messaggioVuoto);
  dettaglioBudgetModal.show();
}

function apriDettaglioBudget(id) {
  const budget = budgetDelMeseCache.find((b) => String(b.id) === String(id));
  if (!budget) return;

  const speseBudget = filtraSpesePerBudget(budget).sort((a, b) => b.data.localeCompare(a.data));
  apriDettaglioSpeseModale(budget.nome, speseBudget, "Nessuna spesa per questo budget nel mese selezionato.");
}

function budgetCoprelaSpesa(budget, spesa) {
  return (budget.voci_spesa || []).includes(spesa.voce_spesa) || (budget.gruppi_spesa || []).includes(spesa.gruppo_spesa);
}

function speseNonCoperteDaAlcunBudget() {
  return speseDelMeseBudgetCache.filter(
    (spesa) => !budgetDelMeseCache.some((budget) => budgetCoprelaSpesa(budget, spesa))
  );
}

function aggiornaBannerSpeseNonCoperte() {
  const nonCoperte = speseNonCoperteDaAlcunBudget();

  if (nonCoperte.length === 0) {
    budgetNonCoperteBanner.classList.add("d-none");
    return;
  }

  budgetNonCoperteTesto.textContent = `Attenzione: ${nonCoperte.length} spese di questo mese non rientrano in nessun budget`;
  budgetNonCoperteBanner.classList.remove("d-none");
}

budgetNonCoperteVediButton.addEventListener("click", () => {
  const nonCoperte = speseNonCoperteDaAlcunBudget().sort((a, b) => b.data.localeCompare(a.data));
  apriDettaglioSpeseModale("Spese non coperte da nessun budget", nonCoperte, "Nessuna spesa non coperta.");
});

function aggiornaRiepilogoTotaleBudget() {
  if (budgetDelMeseCache.length === 0) {
    budgetTotaleRiepilogo.classList.add("d-none");
    return;
  }

  const totaleBudget = budgetDelMeseCache.reduce((somma, b) => somma + Number(b.importo_mensile), 0);
  const totaleSpeso = budgetDelMeseCache.reduce((somma, b) => somma + calcolaActualBudget(b), 0);
  const percentuale = totaleBudget > 0 ? (totaleSpeso / totaleBudget) * 100 : 0;
  const percentualeBarra = Math.min(Math.max(percentuale, 0), 100);

  let coloreBarra = "bg-success";
  let statoClasse = "status-ok";
  if (percentuale > 100) {
    coloreBarra = "bg-danger";
    statoClasse = "status-over";
  } else if (percentuale >= 90) {
    coloreBarra = "bg-warning";
    statoClasse = "status-warn";
  }

  const rimanenti = totaleBudget - totaleSpeso;
  const statoTesto = percentuale > 100
    ? `Sforato di ${formatEuro(Math.abs(rimanenti))}`
    : `Rimangono ${formatEuro(rimanenti)}`;

  budgetTotaleRiepilogo.classList.remove("d-none");
  budgetTotaleProgressBar.className = `progress-bar ${coloreBarra}`;
  budgetTotaleProgressBar.style.width = `${percentualeBarra}%`;
  budgetTotaleStatus.className = `status-pill ${statoClasse}`;
  budgetTotaleStatus.textContent = statoTesto;
  budgetTotaleTesto.textContent = `Speso ${formatEuro(totaleSpeso)} di ${formatEuro(totaleBudget)}`;
}

function renderBudgetLista() {
  if (budgetDelMeseCache.length === 0) {
    budgetLista.innerHTML = '<p class="text-muted">Nessun budget impostato per questo mese.</p>';
    return;
  }

  budgetLista.innerHTML = budgetDelMeseCache
    .map((budget) => {
      const actual = calcolaActualBudget(budget);
      const importo = Number(budget.importo_mensile);
      const percentuale = importo > 0 ? (actual / importo) * 100 : 0;
      const percentualeBarra = Math.min(Math.max(percentuale, 0), 100);

      let coloreBarra = "bg-success";
      let statoClasse = "status-ok";
      if (percentuale > 100) {
        coloreBarra = "bg-danger";
        statoClasse = "status-over";
      } else if (percentuale >= 80) {
        coloreBarra = "bg-warning";
        statoClasse = "status-warn";
      }

      const rimanenti = importo - actual;
      const statoTesto = percentuale > 100
        ? `Sforato di ${formatEuro(Math.abs(rimanenti))}`
        : `Rimangono ${formatEuro(rimanenti)}`;

      const badgeVoci = (budget.voci_spesa || [])
        .map((v) => `<span class="badge text-bg-secondary me-1">${escapeHtml(v)}</span>`)
        .join("");
      const badgeGruppi = (budget.gruppi_spesa || [])
        .map((g) => `<span class="badge text-bg-info me-1">${escapeHtml(g)}</span>`)
        .join("");

      return `
        <div class="col-12 col-md-6 col-lg-4">
          <div class="card h-100 budget-card-cliccabile" data-id="${budget.id}">
            <div class="card-body">
              <h6 class="card-title">${escapeHtml(budget.nome)}</h6>
              <div class="mb-2">${badgeVoci}${badgeGruppi}</div>
              <div class="progress mb-2" role="progressbar" aria-valuenow="${percentualeBarra}" aria-valuemin="0" aria-valuemax="100">
                <div class="progress-bar ${coloreBarra}" style="width: ${percentualeBarra}%"></div>
              </div>
              <div class="small mb-2">Speso ${formatEuro(actual)} di ${formatEuro(importo)}</div>
              <div class="mb-3"><span class="status-pill ${statoClasse}">${statoTesto}</span></div>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-primary btn-modifica-budget" data-id="${budget.id}">Modifica</button>
                <button type="button" class="btn btn-sm btn-outline-danger btn-elimina-budget" data-id="${budget.id}">Elimina</button>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderBozze() {
  if (budgetBozze.length === 0) {
    budgetBozzeContainer.classList.add("d-none");
    budgetBozzeList.innerHTML = "";
    return;
  }

  budgetBozzeContainer.classList.remove("d-none");
  budgetBozzeList.innerHTML = budgetBozze
    .map((bozza, indice) => {
      const badgeVoci = bozza.voci_spesa
        .map(
          (v, vi) => `
            <span class="badge text-bg-secondary me-1 mb-1">
              ${escapeHtml(v)}
              <span class="bozza-rimuovi-voce" data-indice="${indice}" data-sotto-indice="${vi}" role="button">&times;</span>
            </span>
          `
        )
        .join("");
      const badgeGruppi = bozza.gruppi_spesa
        .map(
          (g, gi) => `
            <span class="badge text-bg-info me-1 mb-1">
              ${escapeHtml(g)}
              <span class="bozza-rimuovi-gruppo" data-indice="${indice}" data-sotto-indice="${gi}" role="button">&times;</span>
            </span>
          `
        )
        .join("");

      return `
        <div class="col-12 col-md-6 col-lg-4">
          <div class="card h-100 border-primary">
            <div class="card-body">
              <input type="text" class="form-control form-control-sm mb-2 bozza-nome-input" data-indice="${indice}" value="${escapeHtmlAttr(bozza.nome)}">
              <div class="mb-2">${badgeVoci}${badgeGruppi}</div>
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">&euro;</span>
                <input type="number" step="0.01" min="0" class="form-control bozza-importo-input" data-indice="${indice}" value="${bozza.importo_mensile}">
              </div>
              <button type="button" class="btn btn-sm btn-outline-danger bozza-rimuovi-button" data-indice="${indice}">Rimuovi bozza</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

async function ricaricaBudgetETotali() {
  const { anno, mese } = parseMeseInput(budgetMeseInput.value);
  const [budgets, spese] = await Promise.all([
    caricaBudgetDelMese(anno, mese),
    caricaSpeseDelMeseBudget(anno, mese),
  ]);
  budgetDelMeseCache = budgets;
  speseDelMeseBudgetCache = spese;
  renderBudgetLista();
  aggiornaRiepilogoTotaleBudget();
  aggiornaBannerSpeseNonCoperte();
  nascondiBannerImportBudget();
}

async function inizializzaBudgetTab() {
  nascondiFeedbackBudget();
  resetBudgetForm();
  chiudiFormBudget();
  budgetBozze = [];
  renderBozze();

  const { anno, mese } = parseMeseInput(budgetMeseInput.value);
  const [budgets, spese] = await Promise.all([
    caricaBudgetDelMese(anno, mese),
    caricaSpeseDelMeseBudget(anno, mese),
  ]);
  budgetDelMeseCache = budgets;
  speseDelMeseBudgetCache = spese;
  renderBudgetLista();
  aggiornaRiepilogoTotaleBudget();
  aggiornaBannerSpeseNonCoperte();

  if (budgetDelMeseCache.length === 0) {
    const precedente = mesePrecedente(anno, mese);
    const budgetMesePrecedente = await caricaBudgetDelMese(precedente.anno, precedente.mese);
    if (budgetMesePrecedente.length > 0) {
      mostraBannerImportBudget(budgetMesePrecedente);
    } else {
      nascondiBannerImportBudget();
    }
  } else {
    nascondiBannerImportBudget();
  }
}

async function apriTabBudget() {
  await caricaVociGruppiBudgetSelect();
  await inizializzaBudgetTab();
}

budgetCopiaMeseScorsoButton.addEventListener("click", () => {
  budgetBozze = budgetMesePrecedenteCache.map((b) => ({
    nome: b.nome,
    voci_spesa: [...(b.voci_spesa || [])],
    gruppi_spesa: [...(b.gruppi_spesa || [])],
    importo_mensile: Number(b.importo_mensile),
  }));
  nascondiBannerImportBudget();
  renderBozze();
});

budgetBozzeList.addEventListener("input", (event) => {
  const inputNome = event.target.closest(".bozza-nome-input");
  if (inputNome) {
    budgetBozze[inputNome.dataset.indice].nome = inputNome.value;
    return;
  }

  const inputImporto = event.target.closest(".bozza-importo-input");
  if (inputImporto) {
    budgetBozze[inputImporto.dataset.indice].importo_mensile = parseFloat(inputImporto.value) || 0;
  }
});

budgetBozzeList.addEventListener("click", (event) => {
  const rimuoviVoce = event.target.closest(".bozza-rimuovi-voce");
  if (rimuoviVoce) {
    budgetBozze[rimuoviVoce.dataset.indice].voci_spesa.splice(rimuoviVoce.dataset.sottoIndice, 1);
    renderBozze();
    return;
  }

  const rimuoviGruppo = event.target.closest(".bozza-rimuovi-gruppo");
  if (rimuoviGruppo) {
    budgetBozze[rimuoviGruppo.dataset.indice].gruppi_spesa.splice(rimuoviGruppo.dataset.sottoIndice, 1);
    renderBozze();
    return;
  }

  const rimuoviBozza = event.target.closest(".bozza-rimuovi-button");
  if (rimuoviBozza) {
    budgetBozze.splice(rimuoviBozza.dataset.indice, 1);
    renderBozze();
  }
});

budgetSalvaTutteBozzeButton.addEventListener("click", async () => {
  const { anno, mese } = parseMeseInput(budgetMeseInput.value);
  const righe = budgetBozze.map((b) => ({
    nome: b.nome,
    voci_spesa: b.voci_spesa,
    gruppi_spesa: b.gruppi_spesa,
    importo_mensile: b.importo_mensile,
    mese,
    anno,
  }));

  const { error } = await db.from("budget").insert(righe);
  if (error) {
    mostraFeedbackBudget("Errore durante il salvataggio delle bozze: " + error.message, "danger");
    return;
  }

  budgetBozze = [];
  renderBozze();
  mostraFeedbackBudget("Budget copiati e salvati correttamente", "success");
  await ricaricaBudgetETotali();
});

budgetLista.addEventListener("click", (event) => {
  const bottoneModifica = event.target.closest(".btn-modifica-budget");
  if (bottoneModifica) {
    iniziaModificaBudget(bottoneModifica.dataset.id);
    return;
  }

  const bottoneElimina = event.target.closest(".btn-elimina-budget");
  if (bottoneElimina) {
    eliminaBudget(bottoneElimina.dataset.id);
    return;
  }

  const card = event.target.closest(".budget-card-cliccabile");
  if (card) {
    apriDettaglioBudget(card.dataset.id);
  }
});

budgetNuovoButton.addEventListener("click", () => {
  resetBudgetForm();
  nascondiFeedbackBudget();
  apriFormBudget();
  budgetNomeInput.focus();
});

budgetAnnullaModificaButton.addEventListener("click", () => {
  resetBudgetForm();
  nascondiFeedbackBudget();
  chiudiFormBudget();
});

budgetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  nascondiFeedbackBudget();

  if (!budgetForm.checkValidity()) {
    budgetForm.reportValidity();
    return;
  }

  const vociSelezionate = Array.from(budgetVociChecklist.querySelectorAll("input:checked")).map((cb) => cb.value);
  const gruppiSelezionati = Array.from(budgetGruppiChecklist.querySelectorAll("input:checked")).map((cb) => cb.value);

  if (vociSelezionate.length === 0 && gruppiSelezionati.length === 0) {
    mostraFeedbackBudget("Seleziona almeno una Voce spesa o un Gruppo spesa incluso", "danger");
    return;
  }

  const { anno, mese } = parseMeseInput(budgetMeseInput.value);
  const payload = {
    nome: budgetNomeInput.value.trim(),
    voci_spesa: vociSelezionate,
    gruppi_spesa: gruppiSelezionati,
    importo_mensile: parseFloat(budgetImportoInput.value),
    mese,
    anno,
  };

  const { error } = editingBudgetId
    ? await db.from("budget").update(payload).eq("id", editingBudgetId)
    : await db.from("budget").insert(payload);

  if (error) {
    mostraFeedbackBudget("Errore durante il salvataggio: " + error.message, "danger");
    return;
  }

  mostraFeedbackBudget("Budget salvato correttamente", "success");
  resetBudgetForm();
  await ricaricaBudgetETotali();
});

budgetMeseInput.value = meseCorrenteISO();
budgetMeseInput.addEventListener("change", inizializzaBudgetTab);
budgetTabButton.addEventListener("shown.bs.tab", apriTabBudget);

// Trigger nuovo deploy
//
//
