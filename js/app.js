const KEY = "japanTravel2027";
const { initial, days: defaultDays, stays, checklist } = window.TripData;
let data;
let editingDayIndex = null;
let addingDay = false;

try {
  data = { ...initial, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
} catch (error) {
  console.error("Impossibile leggere i dati di viaggio salvati.", error);
  data = { ...initial };
}

if (!Array.isArray(data.itinerary)) {
  data.itinerary = defaultDays.map(day => ({ ...day }));
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(data));
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
          <span class="small">${escapeHTML(day.city)}</span>
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
  renderDays();
}

function removeDay(index) {
  if (!confirm(`Vuoi eliminare il giorno ${index + 1} dall'itinerario?`)) return;
  data.itinerary.splice(index, 1);
  persist();
  renderDays();
}

function renderHotels() {
  document.getElementById("hotelList").innerHTML = stays.map(stay => `
    <div class="card"><h3>🏨 ${stay[0]}</h3><p class="small">${stay[1]} · Da prenotare</p></div>`).join("") +
    data.hotels.map((hotel, index) => `
      <div class="card"><div class="row"><h3>${escapeHTML(hotel.name)}</h3><button class="secondary" onclick="removeHotel(${index})">Elimina</button></div>
      <p class="small">${escapeHTML(hotel.city)}<br>${escapeHTML(hotel.details)}</p></div>`).join("");
}

function addHotel() {
  const name = document.getElementById("hotelName").value.trim();
  const city = document.getElementById("hotelCity").value.trim();
  const details = document.getElementById("hotelDetails").value.trim();
  if (!name || !city) { alert("Inserisci almeno nome e città."); return; }
  data.hotels.push({ name, city, details });
  persist();
  renderHotels();
  ["hotelName", "hotelCity", "hotelDetails"].forEach(id => {
    document.getElementById(id).value = "";
  });
}

function removeHotel(index) { data.hotels.splice(index, 1); persist(); renderHotels(); }

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
  const done = checklist.filter((_, index) => data.checks[index]).length;
  document.getElementById("checkCount").textContent = done + "/" + checklist.length;
  document.getElementById("checkProgress").style.width = (done / checklist.length * 100) + "%";
  document.getElementById("checks").innerHTML = checklist.map((item, index) => `
    <label class="check"><input type="checkbox" ${data.checks[index] ? "checked" : ""} onchange="toggleCheck(${index},this.checked)">${item}</label>`).join("");
}

function toggleCheck(index, value) { data.checks[index] = value; persist(); renderChecks(); }

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
renderDays();
renderHotels();
renderBudget();
renderChecks();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}
