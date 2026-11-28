const KEY = "japanTravel2027";
const { initial, days: defaultDays, stays: defaultStays, checklist: defaultChecklist, months } = window.TripData;
let data;
let editingDayIndex = null;
let addingDay = false;
let editingStayIndex = null;
let addingStay = false;
let editingHotelIndex = null;
let editingChecklistIndex = null;

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  data = { ...initial, ...saved };
} catch (error) {
  console.error("Impossibile leggere i dati di viaggio salvati.", error);
  data = { ...initial };
}

data.trip = { ...initial.trip, ...(data.trip || {}) };

if (!Array.isArray(data.itinerary)) {
  data.itinerary = defaultDays.map(day => ({ ...day }));
}

if (!Array.isArray(data.stays)) {
  data.stays = defaultStays.map(stay => ({ ...stay }));
}

if (!Array.isArray(data.checklist)) {
  const legacyChecks = data.checks || {};
  data.checklist = defaultChecklist.map((text, index) => ({
    id: `check-${index + 1}`,
    text
  }));
  data.checks = Object.fromEntries(data.checklist.map((item, index) => [
    item.id,
    Boolean(legacyChecks[index])
  ]));
} else {
  data.checklist = data.checklist.map((item, index) => ({
    id: String(item.id || `check-${index + 1}`),
    text: String(item.text || "")
  }));
  data.checks = data.checks || {};
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function renderTripSettings() {
  document.getElementById("tripMonth").innerHTML = months.map(month => `
    <option value="${month}">${month}</option>`).join("");
  document.getElementById("tripMonth").value = data.trip.month;
  document.getElementById("tripYear").value = data.trip.year;
  document.getElementById("tripDuration").value = data.itinerary.length;
  document.getElementById("tripSummary").textContent =
    `${data.trip.month} ${data.trip.year} · ${data.itinerary.length} giorni · Viaggio in solitaria`;
  const route = data.itinerary
    .map(day => String(day.city || "").trim())
    .filter((city, index, cities) => city && city !== cities[index - 1]);
  document.getElementById("tripRoute").textContent =
    route.length ? route.join(" → ") : "Aggiungi le tappe del tuo viaggio all’itinerario.";
  document.getElementById("tripDestinations").innerHTML = [...new Set(route)]
    .map(city => `<span class="tag">${escapeHTML(city)}</span>`).join("");
}

function saveTripDetails(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const month = String(formData.get("month") || "");
  const year = Number(formData.get("year"));
  const duration = Number(formData.get("duration"));
  if (!months.includes(month) || !Number.isInteger(year) || year < 2026 || year > 2200
    || !Number.isInteger(duration) || duration < 1 || duration > 365) {
    alert("Controlla mese, anno e durata del viaggio.");
    renderTripSettings();
    return;
  }

  const currentDuration = data.itinerary.length;
  if (duration < currentDuration
    && !confirm(`Riducendo la durata verranno eliminate le ultime ${currentDuration - duration} giornate dell'itinerario. Continuare?`)) {
    renderTripSettings();
    return;
  }

  if (duration < currentDuration) {
    data.itinerary.splice(duration);
  } else {
    while (data.itinerary.length < duration) {
      data.itinerary.push({ city: "", activity: "", maps: "" });
    }
  }
  data.trip = { month, year };
  persist();
  renderTripSettings();
  renderDays();
}

function showPage(id) {
  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  document.querySelectorAll("nav button").forEach(button => {
    button.classList.toggle("active", button.dataset.page === id);
  });
  document.getElementById(id).classList.add("active");
  window.scrollTo(0, 0);
}

function dayForm(day = { city: "", activity: "", maps: "" }, index = "null") {
  return `
    <form class="day-form" onsubmit="saveDay(event, ${index})">
      <label>Città o zona</label>
      <input name="city" value="${escapeHTML(day.city)}" placeholder="Es. Kyoto · Gion" required>
      <label>Programma della giornata</label>
      <textarea name="activity" placeholder="Attività, tappe e promemoria">${escapeHTML(day.activity)}</textarea>
      <label>Luogo o link Google Maps</label>
      <input name="maps" value="${escapeHTML(day.maps)}" placeholder="Es. Fushimi Inari, Kyoto o un link Maps">
      <div class="day-form-actions">
        <button type="submit">Salva giornata</button>
        <button type="button" class="secondary" onclick="cancelDayEdit()">Annulla</button>
      </div>
    </form>`;
}

function mapsHref(location) {
  const value = String(location || "").trim();
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      const shortMapsLink = host === "maps.app.goo.gl" || host === "goo.gl";
      const googleHost = host.startsWith("maps.google.")
        || /^google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(host)
        || /^www\.google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(host);
      const isGoogleMaps = shortMapsLink
        || (googleHost && (host.startsWith("maps.") || url.pathname.toLowerCase().includes("/maps")));
      if (isGoogleMaps) return url.href;
    } catch (error) {
      // Treat malformed links as place names and search for them on Maps.
    }
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
}

function renderDays() {
  const container = document.getElementById("days");
  const cards = data.itinerary.map((day, index) => {
    const isEditing = editingDayIndex === index;
    const mapLink = mapsHref(day.maps || day.city);
    return `
      <article class="card day-card">
        <div class="row">
          <span class="tag">GIORNO ${index + 1}</span>
          <span class="small">${escapeHTML(day.city || "Da definire")}</span>
        </div>
        <p class="small day-activity">${escapeHTML(day.activity)}</p>
        ${mapLink ? `<a class="maps-link" href="${escapeHTML(mapLink)}" target="_blank" rel="noopener noreferrer">Apri la zona su Google Maps ↗</a>` : ""}
        ${isEditing ? dayForm(day, index) : `
          <div class="day-actions">
            <button type="button" class="secondary" onclick="editDay(${index})">Modifica</button>
            <button type="button" class="secondary" onclick="removeDay(${index})">Elimina</button>
          </div>`}
      </article>`;
  }).join("");

  const newDayForm = addingDay ? `<div class="card">${dayForm()}</div>` : "";
  container.innerHTML = `${cards || '<div class="card empty-state small">Non hai ancora aggiunto giornate.</div>'}${newDayForm}`;
}

function addDay() {
  addingDay = true;
  editingDayIndex = null;
  renderDays();
  document.querySelector("#days .day-form input[name='city']").focus();
}

function editDay(index) {
  editingDayIndex = index;
  addingDay = false;
  renderDays();
  document.querySelector("#days .day-form input[name='city']").focus();
}

function cancelDayEdit() {
  editingDayIndex = null;
  addingDay = false;
  renderDays();
}

function saveDay(event, index) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const day = {
    city: String(formData.get("city") || "").trim(),
    activity: String(formData.get("activity") || "").trim(),
    maps: String(formData.get("maps") || "").trim()
  };
  if (!day.city) {
    alert("Inserisci la città o la zona della giornata.");
    return;
  }

  if (Number.isInteger(index)) {
    data.itinerary[index] = day;
  } else {
    data.itinerary.push(day);
  }
  persist();
  editingDayIndex = null;
  addingDay = false;
  renderTripSettings();
  renderDays();
}

function removeDay(index) {
  if (data.itinerary.length <= 1) {
    alert("L'itinerario deve contenere almeno una giornata.");
    return;
  }
  if (!confirm(`Vuoi eliminare il giorno ${index + 1} dall'itinerario?`)) return;
  data.itinerary.splice(index, 1);
  persist();
  renderTripSettings();
  renderDays();
}

function stayForm(stay = { city: "", nights: 1 }, index = "null") {
  return `
    <form class="stay-form" onsubmit="saveStay(event, ${index})">
      <label>Città o tappa</label>
      <input name="city" value="${escapeHTML(stay.city)}" placeholder="Es. Kyoto" required>
      <label>Notti</label>
      <input name="nights" type="number" min="1" max="365" value="${stay.nights}" required>
      <div class="form-actions">
        <button type="submit">Salva tappa</button>
        <button type="button" class="secondary" onclick="cancelStayEdit()">Annulla</button>
      </div>
    </form>`;
}

function renderStays() {
  document.getElementById("stayList").innerHTML = data.stays.map((stay, index) => `
    <div class="card stay-card">
      <div class="row">
        <div><h3>🏨 ${escapeHTML(stay.city)}</h3><p class="small">${stay.nights} ${stay.nights === 1 ? "notte" : "notti"} · Da prenotare</p></div>
        <div class="day-actions">
          <button type="button" class="secondary" onclick="editStay(${index})">Modifica</button>
          <button type="button" class="secondary" onclick="removeStay(${index})">Elimina</button>
        </div>
      </div>
      ${editingStayIndex === index ? stayForm(stay, index) : ""}
    </div>`).join("") +
    (addingStay ? `<div class="card">${stayForm()}</div>` : "");
}

function addStay() {
  addingStay = true;
  editingStayIndex = null;
  renderStays();
  document.querySelector("#stayList .stay-form input[name='city']").focus();
}

function editStay(index) {
  editingStayIndex = index;
  addingStay = false;
  renderStays();
  document.querySelector("#stayList .stay-form input[name='city']").focus();
}

function cancelStayEdit() {
  editingStayIndex = null;
  addingStay = false;
  renderStays();
}

function saveStay(event, index) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const stay = {
    city: String(formData.get("city") || "").trim(),
    nights: Number(formData.get("nights"))
  };
  if (!stay.city || !Number.isInteger(stay.nights) || stay.nights < 1 || stay.nights > 365) {
    alert("Inserisci una tappa e un numero di notti valido.");
    return;
  }
  if (Number.isInteger(index)) data.stays[index] = stay;
  else data.stays.push(stay);
  persist();
  editingStayIndex = null;
  addingStay = false;
  renderStays();
}

function removeStay(index) {
  if (!confirm(`Vuoi eliminare la tappa ${data.stays[index].city}?`)) return;
  data.stays.splice(index, 1);
  persist();
  renderStays();
}

function renderHotels() {
  renderStays();
  document.getElementById("hotelList").innerHTML = data.hotels.map((hotel, index) => `
    <div class="card"><div class="row"><h3>${escapeHTML(hotel.name)}</h3>
      <div class="day-actions">
        <button type="button" class="secondary" onclick="editHotel(${index})">Modifica</button>
        <button type="button" class="secondary" onclick="removeHotel(${index})">Elimina</button>
      </div>
    </div>
    <p class="small">${escapeHTML(hotel.city)}${hotel.details ? `<br>${escapeHTML(hotel.details)}` : ""}</p></div>`).join("") ||
    '<div class="card empty-state small">Non hai ancora aggiunto prenotazioni.</div>';
}

function saveHotel(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const hotel = {
    name: String(formData.get("name") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    details: String(formData.get("details") || "").trim()
  };
  if (!hotel.name || !hotel.city) {
    alert("Inserisci almeno il nome della struttura e la città.");
    return;
  }
  if (Number.isInteger(editingHotelIndex)) data.hotels[editingHotelIndex] = hotel;
  else data.hotels.push(hotel);
  persist();
  cancelHotelEdit();
  renderHotels();
}

function editHotel(index) {
  const hotel = data.hotels[index];
  editingHotelIndex = index;
  document.getElementById("hotelName").value = hotel.name;
  document.getElementById("hotelCity").value = hotel.city;
  document.getElementById("hotelDetails").value = hotel.details || "";
  document.getElementById("hotelFormTitle").textContent = "Modifica prenotazione";
  document.getElementById("hotelSubmit").textContent = "Aggiorna prenotazione";
  document.getElementById("cancelHotelEdit").hidden = false;
  document.getElementById("hotelForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelHotelEdit() {
  editingHotelIndex = null;
  document.getElementById("hotelForm").reset();
  document.getElementById("hotelFormTitle").textContent = "Aggiungi una prenotazione";
  document.getElementById("hotelSubmit").textContent = "Salva struttura";
  document.getElementById("cancelHotelEdit").hidden = true;
}

function removeHotel(index) {
  if (!confirm(`Vuoi eliminare la prenotazione di ${data.hotels[index].name}?`)) return;
  if (editingHotelIndex === index) cancelHotelEdit();
  else if (editingHotelIndex > index) editingHotelIndex -= 1;
  data.hotels.splice(index, 1);
  persist();
  renderHotels();
}

function saveBudget() {
  data.budget = Math.max(0, Number(document.getElementById("budgetInput").value) || 0);
  persist();
  renderBudget();
}

function addExpense() {
  const name = document.getElementById("expenseName").value.trim();
  const category = document.getElementById("expenseCategory").value;
  const amount = Number(document.getElementById("expenseAmount").value);
  if (!name || !Number.isFinite(amount) || amount <= 0) {
    alert("Inserisci descrizione e importo validi.");
    return;
  }
  data.expenses.push({ name, category, amount });
  persist();
  renderBudget();
  document.getElementById("expenseName").value = "";
  document.getElementById("expenseAmount").value = "";
}

function removeExpense(index) { data.expenses.splice(index, 1); persist(); renderBudget(); }

function renderBudget() {
  const total = data.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remaining = data.budget - total;
  const percent = data.budget ? Math.min(100, total / data.budget * 100) : 0;
  document.getElementById("budgetInput").value = data.budget;
  document.getElementById("spent").textContent = total.toFixed(2);
  document.getElementById("remaining").textContent = remaining.toFixed(2);
  document.getElementById("budgetProgress").style.width = percent + "%";
  document.getElementById("homeBudget").textContent = data.budget.toFixed(0) + " €";
  document.getElementById("homeSpent").textContent = total.toFixed(2) + " €";
  document.getElementById("homeProgress").style.width = percent + "%";
  document.getElementById("expenses").innerHTML = data.expenses.map((expense, index) => `
    <div class="card"><div class="row"><div><b>${escapeHTML(expense.name)}</b><div class="small">${escapeHTML(expense.category)}</div></div>
    <span class="amount">${expense.amount.toFixed(2)} €</span></div>
    <button class="secondary" onclick="removeExpense(${index})">Elimina</button></div>`).join("");
}

function renderChecks() {
  const done = data.checklist.filter(item => data.checks[item.id]).length;
  document.getElementById("checkCount").textContent = done + "/" + data.checklist.length;
  document.getElementById("checkProgress").style.width =
    (data.checklist.length ? done / data.checklist.length * 100 : 0) + "%";
  document.getElementById("checks").innerHTML = data.checklist.map((item, index) => `
    <div class="check-item">
      <div class="check-item-row">
        <label class="check">
          <input type="checkbox" ${data.checks[item.id] ? "checked" : ""}
            onchange="toggleCheck(${index}, this.checked)">
          <span>${escapeHTML(item.text)}</span>
        </label>
        <div class="check-actions">
          <button type="button" class="secondary" onclick="editChecklistItem(${index})">Modifica</button>
          <button type="button" class="secondary" onclick="removeChecklistItem(${index})">Elimina</button>
        </div>
      </div>
      ${editingChecklistIndex === index ? checklistEditForm(item, index) : ""}
    </div>`).join("") ||
    '<p class="small empty-state">Checklist vuota: aggiungi un promemoria qui sopra.</p>';
}

function checklistEditForm(item, index = "null") {
  return `
    <form class="checklist-edit-form" onsubmit="saveChecklistItem(event, ${index})">
      <label>Testo del promemoria</label>
      <input name="text" value="${escapeHTML(item.text)}" required>
      <div class="form-actions">
        <button type="submit">Salva</button>
        <button type="button" class="secondary" onclick="cancelChecklistEdit()">Annulla</button>
      </div>
    </form>`;
}

function saveChecklistItem(event, index) {
  event.preventDefault();
  const text = String(new FormData(event.currentTarget).get("text") || "").trim();
  if (!text) {
    alert("Inserisci il testo del promemoria.");
    return;
  }
  if (Number.isInteger(index)) {
    data.checklist[index].text = text;
  } else {
    const id = `check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    data.checklist.push({ id, text });
    data.checks[id] = false;
    document.getElementById("newChecklistItem").value = "";
  }
  editingChecklistIndex = null;
  persist();
  renderChecks();
}

function editChecklistItem(index) {
  editingChecklistIndex = index;
  renderChecks();
  document.querySelector(".checklist-edit-form input[name='text']").focus();
}

function cancelChecklistEdit() {
  editingChecklistIndex = null;
  renderChecks();
}

function removeChecklistItem(index) {
  const item = data.checklist[index];
  if (!confirm(`Vuoi eliminare "${item.text}" dalla checklist?`)) return;
  delete data.checks[item.id];
  data.checklist.splice(index, 1);
  editingChecklistIndex = null;
  persist();
  renderChecks();
}

function toggleCheck(index, value) {
  const item = data.checklist[index];
  if (!item) return;
  data.checks[item.id] = value;
  persist();
  renderChecks();
}

function saveNotes() {
  data.notes = document.getElementById("notesText").value;
  persist();
  document.getElementById("notesStatus").textContent = "Appunti salvati sul dispositivo ✓";
}

function escapeHTML(value) {
  return String(value || "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

document.getElementById("notesText").value = data.notes || "";
renderTripSettings();
renderDays();
renderHotels();
renderBudget();
renderChecks();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}
