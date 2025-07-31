// admin.js
import { db, auth } from "../js/firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const usersRef = collection(db, "users");
const bunksRef = collection(db, "bunks");
const bookingsRef = collection(db, "bookings");
const revenueCard = document.getElementById("total-revenue");
const dateFilterForm = document.getElementById("revenue-filter-form");

const dashboard = document.getElementById("dashboard");
const manage = document.getElementById("manage");
const bookings = document.getElementById("bookings");
const navLinks = document.querySelectorAll(".sidebar-nav a");

navLinks.forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    document.querySelectorAll(".content-section").forEach(sec => sec.classList.add("hidden"));
    navLinks.forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    const id = link.getAttribute("href").replace("#", "");
    document.getElementById(id).classList.remove("hidden");
    
    // Load bookings when bookings section is accessed
    if (id === 'bookings') {
      loadBookings();
    }
  });
});

// Dashboard Metrics
async function loadDashboardMetrics() {
  const [usersSnap, bunksSnap, bookingsSnap] = await Promise.all([
    getDocs(usersRef),
    getDocs(bunksRef),
    getDocs(bookingsRef)
  ]);

  if (document.getElementById("total-users"))
    document.getElementById("total-users").innerText = `Total Users: ${usersSnap.size}`;
  if (document.getElementById("total-bunks"))
    document.getElementById("total-bunks").innerText = `Total Bunks: ${bunksSnap.size}`;
  if (document.getElementById("active-bookings"))
    document.getElementById("active-bookings").innerText = `Active Bookings: ${bookingsSnap.size}`;
  let totalRevenue = 0;
  bookingsSnap.forEach(doc => {
    const data = doc.data();
    if (data.price) totalRevenue += Number(data.price);
  });
  if (revenueCard)
    revenueCard.innerText = `Revenue: $${totalRevenue}`;
}

loadDashboardMetrics();

if (dateFilterForm) {
  dateFilterForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const startDate = new Date(document.getElementById("start-date").value);
    const endDate = new Date(document.getElementById("end-date").value);
    if (isNaN(startDate) || isNaN(endDate)) {
      alert("Please select both start and end dates.");
      return;
    }

    const q = query(bookingsRef, where("date", ">=", Timestamp.fromDate(startDate)), where("date", "<=", Timestamp.fromDate(endDate)));
    const snapshot = await getDocs(q);
    let filteredRevenue = 0;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.price) filteredRevenue += Number(data.price);
    });
    if (document.getElementById("filtered-revenue"))
      document.getElementById("filtered-revenue").innerText = `Filtered Revenue: $${filteredRevenue}`;
  });
}

// Save Bunk under current admin
const bunkForm = document.getElementById("bunk-form");
let currentAdminId = null;
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
onAuthStateChanged(auth, user => {
  if (user) {
    currentAdminId = user.uid;
    loadAdminBunks();
  }
});

bunkForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentAdminId) {
    alert("Admin not authenticated.");
    return;
  }
  const startHour = document.getElementById("open-hours-start").value;
  const endHour = document.getElementById("open-hours-end").value;
  const openHours = `${startHour.padStart(2, "0")}:00-${endHour.padStart(2, "0")}:00`;
  const editId = bunkForm.getAttribute('data-edit-id');
  const lat = document.getElementById("bunk-lat").value;
  const lng = document.getElementById("bunk-lng").value;
  if (editId) {
    // Update bunk
    const bunkRef = doc(db, "bunks", editId);
    await updateDoc(bunkRef, {
      name: document.getElementById("station-name").value,
      address: document.getElementById("address").value,
      phone: document.getElementById("phone").value,
      hours: openHours,
      points: document.getElementById("charging-points").value,
      price: document.getElementById("price").value,
      charger: document.getElementById("charger-type").value,
      facilities: document.getElementById("facilities").value,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
    });
    alert("Bunk updated!");
    bunkForm.removeAttribute('data-edit-id');
    await loadAdminBunks();
    await updateStationCount();
  } else {
    // Add new bunk
    const newBunk = {
      name: document.getElementById("station-name").value,
      address: document.getElementById("address").value,
      phone: document.getElementById("phone").value,
      hours: openHours,
      points: document.getElementById("charging-points").value,
      price: document.getElementById("price").value,
      charger: document.getElementById("charger-type").value,
      facilities: document.getElementById("facilities").value,
      adminId: currentAdminId,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
    };
    await addDoc(collection(db, "bunks"), newBunk);
    alert("Bunk saved!");
    bunkForm.reset();
    await loadAdminBunks();
    await updateStationCount();
  }
});

// Show bunks as cards in dashboard
async function loadAdminBunks() {
  if (!currentAdminId) return;
  const q = query(collection(db, "bunks"), where("adminId", "==", currentAdminId));
  const bunksSnap = await getDocs(q);
  const dashboardSection = document.getElementById("dashboard");
  let cardsHtml = '<div class="dashboard-bunks-cards" style="display:flex;gap:20px;flex-wrap:wrap;justify-content:center;margin-top:30px;">';
  bunksSnap.forEach(doc => {
    const bunk = doc.data();
    cardsHtml += `<div class="card bunk-card" data-id="${doc.id}">
      <h3>${bunk.name}</h3>
      <p>${bunk.address}</p>
      <p>Phone: ${bunk.phone}</p>
      <p>Charger: ${bunk.charger}</p>
      <button class="edit-bunk-btn" data-id="${doc.id}">Manage</button>
    </div>`;
  });
  cardsHtml += '</div>';
  // Remove previous bunk cards if any
  let oldCards = dashboardSection.querySelector('.dashboard-bunks-cards');
  if (oldCards) oldCards.remove();
  dashboardSection.insertAdjacentHTML('beforeend', cardsHtml);

  // Add click event to manage buttons
  dashboardSection.querySelectorAll('.edit-bunk-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const bunkId = btn.getAttribute('data-id');
      showBunkForEdit(bunkId);
    });
  });
}

// Show bunk details in manage section for editing
async function showBunkForEdit(bunkId) {
  // Switch to manage section
  document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));
  document.getElementById('manage').classList.remove('hidden');
  // Highlight nav
  navLinks.forEach(l => l.classList.remove('active'));
  document.querySelector('.sidebar-nav a[href="#manage"]').classList.add('active');
  // Fetch bunk data
  const bunkDoc = await getDocs(query(collection(db, "bunks"), where("adminId", "==", currentAdminId)));
let bunkData = null;
  bunkDoc.forEach(doc => {
    if (doc.id === bunkId) bunkData = doc.data();
  });
  if (!bunkData) return;
  // Fill form
  document.getElementById("station-name").value = bunkData.name || "";
  document.getElementById("address").value = bunkData.address || "";
  document.getElementById("phone").value = bunkData.phone || "";
  document.getElementById("open-hours").value = bunkData.hours || "";
  document.getElementById("charging-points").value = bunkData.points || "";
  document.getElementById("price").value = bunkData.price || "";
  document.getElementById("charger-type").value = bunkData.charger || "";
  document.getElementById("facilities").value = bunkData.facilities || "";
  // Store bunkId for update
  bunkForm.setAttribute('data-edit-id', bunkId);
}

// Show Bookings
async function loadBookings() {
  try {
    const bookingSnap = await getDocs(collection(db, "bookings"));
    const table = document.querySelector("#booking-table tbody");
    table.innerHTML = "";
    
    if (bookingSnap.empty) {
      table.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #6c757d;">No bookings found</td></tr>';
      updateBookingStats(0, 0);
      return;
    }

    let totalBookings = 0;
    let todayBookings = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    bookingSnap.forEach(doc => {
      const booking = doc.data();
      totalBookings++;

      // Check if booking is for today
      const bookingDate = booking.date?.toDate() || new Date(booking.createdAt?.toDate() || Date.now());
      if (bookingDate >= today && bookingDate < tomorrow) {
        todayBookings++;
      }

      // Format the date
      const formattedDate = bookingDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      // Create table row
      const row = `
        <tr>
          <td><strong>${booking.bookingId || doc.id}</strong></td>
          <td>${booking.userName || booking.name || 'N/A'}</td>
          <td>${booking.userEmail || booking.email || 'N/A'}</td>
          <td>${booking.phone || 'N/A'}</td>
          <td>${booking.stationName || 'N/A'}</td>
          <td>${booking.timeDisplay || booking.timeSlot + ':00' || 'N/A'}</td>
          <td>${booking.chargingPoint || 'N/A'}</td>
          <td>₹${booking.price || '0'}</td>
          <td><span class="status ${booking.status || 'confirmed'}">${(booking.status || 'confirmed').toUpperCase()}</span></td>
          <td>${formattedDate}</td>
        </tr>
      `;
      table.innerHTML += row;
    });

    updateBookingStats(totalBookings, todayBookings);
  } catch (error) {
    console.error("Error loading bookings:", error);
    const table = document.querySelector("#booking-table tbody");
    table.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #dc3545;">Error loading bookings. Please try again.</td></tr>';
  }
}

function updateBookingStats(total, today) {
  const totalElement = document.getElementById('total-bookings-display');
  const todayElement = document.getElementById('today-bookings');
  
  if (totalElement) totalElement.textContent = total;
  if (todayElement) todayElement.textContent = today;
}

loadBookings();

// Logout
const logoutBtn = document.getElementById("logout");
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

// Live date/time for dashboard header
function updateDashboardDateTime() {
  const dtElem = document.getElementById("dashboard-datetime");
  if (!dtElem) return;
  const now = new Date();
  dtElem.textContent = now.toLocaleString();
}
setInterval(updateDashboardDateTime, 1000);
updateDashboardDateTime();

// Change section name on navigation
const sectionTitle = document.getElementById("section-title");
navLinks.forEach(link => {
  link.addEventListener("click", e => {
    const id = link.getAttribute("href").replace("#", "");
    if (sectionTitle) {
      // You can customize these names as needed
      if (id === "dashboard") sectionTitle.textContent = "Dashboard Overview";
      else if (id === "manage") sectionTitle.textContent = "Manage Bunks";
      else if (id === "bookings") sectionTitle.textContent = "Bookings";
      else sectionTitle.textContent = id.charAt(0).toUpperCase() + id.slice(1);
    }
  });
});

async function updateStationCount() {
  if (!currentAdminId) return;
  const q = query(collection(db, "bunks"), where("adminId", "==", currentAdminId));
  const bunksSnap = await getDocs(q);
  const stationCountElem = document.getElementById("station-count");
  if (stationCountElem) stationCountElem.textContent = bunksSnap.size;
}

// Google Map Picker for Bunk Location
let map, marker;
function initMapPicker() {
  const mapDiv = document.getElementById("map-picker");
  if (!mapDiv) return;
  // Default location (India center)
  const defaultLatLng = { lat: 22.9734, lng: 78.6569 };
  map = new google.maps.Map(mapDiv, {
    center: defaultLatLng,
    zoom: 5,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });

  marker = new google.maps.Marker({
    position: defaultLatLng,
    map: map,
    draggable: true
  });

  // Update hidden fields and display coordinates
  function updateCoords(latLng) {
    document.getElementById("bunk-lat").value = latLng.lat();
    document.getElementById("bunk-lng").value = latLng.lng();
    document.getElementById("map-coords").textContent =
      `Selected: ${latLng.lat().toFixed(6)}, ${latLng.lng().toFixed(6)}`;
  }

  // On map click, move marker
  map.addListener("click", function (e) {
    marker.setPosition(e.latLng);
    updateCoords(e.latLng);
  });

  // On marker drag, update coords
  marker.addListener("dragend", function (e) {
    updateCoords(marker.getPosition());
  });

  // Set initial coords
  updateCoords(marker.getPosition());

  // Places Autocomplete for search
  const input = document.getElementById("map-search");
  if (input) {
    const autocomplete = new google.maps.places.Autocomplete(input, {
      types: ["geocode"],
      componentRestrictions: { country: "in" } // restrict to India, remove if not needed
    });
    autocomplete.bindTo("bounds", map);

    autocomplete.addListener("place_changed", function () {
      const place = autocomplete.getPlace();
      if (!place.geometry) return;
      map.setCenter(place.geometry.location);
      map.setZoom(15);
      marker.setPosition(place.geometry.location);
      document.getElementById("bunk-lat").value = place.geometry.location.lat();
      document.getElementById("bunk-lng").value = place.geometry.location.lng();
      document.getElementById("map-coords").textContent =
        `Selected: ${place.geometry.location.lat().toFixed(6)}, ${place.geometry.location.lng().toFixed(6)}`;
    });
  }
}

// Re-initialize map when manage section is shown
document.querySelector('a[href="#manage"]').addEventListener("click", () => {
  setTimeout(initMapPicker, 300); // Wait for section to show
});

function setMapToCoords(lat, lng) {
  if (map && marker) {
    const latLng = new google.maps.LatLng(lat, lng);
    map.setCenter(latLng);
    marker.setPosition(latLng);
    document.getElementById("bunk-lat").value = lat;
    document.getElementById("bunk-lng").value = lng;
    document.getElementById("map-coords").textContent =
      `Selected: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

// Manage Slots Section
const manageSlotsSection = document.getElementById("manage-slots");
const stationSelect = document.getElementById("station-select");
const slotsContainer = document.getElementById("slots-container");

// Load stations for current admin
async function loadStationsForSlots() {
  if (!currentAdminId) return;
  const q = query(collection(db, "bunks"), where("adminId", "==", currentAdminId));
  const bunksSnap = await getDocs(q);
  stationSelect.innerHTML = "";
  bunksSnap.forEach(doc => {
    const bunk = doc.data();
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = bunk.name;
    stationSelect.appendChild(option);
  });
  if (stationSelect.options.length > 0) {
    loadSlotsForStation(stationSelect.value);
  } else {
    slotsContainer.innerHTML = "<p>No stations found.</p>";
  }
}

// Load slots for selected station
async function loadSlotsForStation(stationId) {
  slotsContainer.innerHTML = "<p>Loading slots...</p>";
  const bunkDoc = await getDocs(query(collection(db, "bunks"), where("adminId", "==", currentAdminId)));
  let bunkData = null;
  bunkDoc.forEach(doc => {
    if (doc.id === stationId) bunkData = doc.data();
  });
  if (!bunkData) {
    slotsContainer.innerHTML = "<p>Station not found.</p>";
    return;
  }
  // Get open hours (e.g., "08:00-20:00")
  let openHours = bunkData.hours || "00:00-23:00";
  let [startHourStr, endHourStr] = openHours.split("-");
  let startHour = parseInt(startHourStr);
  let endHour = parseInt(endHourStr);
  if (isNaN(startHour) || isNaN(endHour)) {
    startHour = 0; endHour = 23;
  }
  const hoursArray = [];
  for (let h = startHour; h <= endHour; h++) {
    hoursArray.push(h);
  }

  // Get today's bookings for this station
  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const bookingsQ = query(
    collection(db, "bookings"),
    where("stationId", "==", stationId),
    where("date", ">=", Timestamp.fromDate(today)),
    where("date", "<", Timestamp.fromDate(tomorrow))
  );
  const bookingsSnap = await getDocs(bookingsQ);
  const bookingsByHour = {};
  bookingsSnap.forEach(doc => {
    const data = doc.data();
    const bookingHour = new Date(data.time).getHours();
    bookingsByHour[bookingHour] = {
      id: doc.id,
      name: data.name,
      phone: data.phone,
      chargingPoint: data.chargingPoint || "",
    };
  });

  // Render slots
  let slotsHtml = "";
  hoursArray.forEach(hour => {
    const isBooked = bookingsByHour[hour];
    slotsHtml += `<div class="slot-box${isBooked ? " booked" : ""}">
      <div class="slot-hour">${hour}:00 - ${hour+1}:00</div>
      ${isBooked ? `<div class="booking-details">
        <strong>ID:</strong> ${isBooked.id}<br>
        <strong>Name:</strong> ${isBooked.name}<br>
        <strong>Phone:</strong> ${isBooked.phone}<br>
        <strong>Point:</strong> ${isBooked.chargingPoint}
      </div>` : `<div class="booking-details">Available</div>`}
    </div>`;
  });
  slotsContainer.innerHTML = slotsHtml;
}

// Event listeners
  document.querySelector('a[href="#manage-slots"]').addEventListener("click", () => {
    document.querySelectorAll(".content-section").forEach(sec => sec.classList.add("hidden"));
    manageSlotsSection.classList.remove("hidden");
    navLinks.forEach(l => l.classList.remove("active"));
    document.querySelector('.sidebar-nav a[href="#manage-slots"]').classList.add("active");
    if (sectionTitle) sectionTitle.textContent = "Manage Slots";
    loadStationsForSlots();
  });
  
  stationSelect.addEventListener("change", () => {
    loadSlotsForStation(stationSelect.value);
  });
  
  // Populate open hours dropdowns
  function populateOpenHourDropdowns() {
    const startSelect = document.getElementById("open-hours-start");
    const endSelect = document.getElementById("open-hours-end");
    if (!startSelect || !endSelect) return;
    startSelect.innerHTML = "";
    endSelect.innerHTML = "";
    for (let h = 0; h < 24; h++) {
      const label = h.toString().padStart(2, "0") + ":00";
      startSelect.innerHTML += `<option value="${h}">${label}</option>`;
      endSelect.innerHTML += `<option value="${h}">${label}</option>`;
    }
    startSelect.value = "8"; // default 08:00
    endSelect.value = "20"; // default 20:00
  }
  populateOpenHourDropdowns();
