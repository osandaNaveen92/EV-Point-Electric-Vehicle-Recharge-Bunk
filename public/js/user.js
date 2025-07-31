import { auth, db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

let currentUser = null;
let map, userMarker, selectedStation = null;
let directionsService, directionsRenderer;
let userLocation = null;

const navLinks = document.querySelectorAll(".sidebar-nav a");
const sectionTitle = document.getElementById("section-title");
const searchSection = document.getElementById("search-section");
const bookingsSection = document.getElementById("bookings-section");
const profileSection = document.getElementById("profile-section");
const stationDetails = document.getElementById("station-details");
const slotGrid = document.getElementById("slot-grid");
const bookingPanel = document.getElementById("booking-panel");
const bookingList = document.getElementById("booking-list");
const userProfile = document.getElementById("user-profile");

function showSection(section) {
  [searchSection, bookingsSection, profileSection].forEach(s => s.classList.add("hidden"));
  section.classList.remove("hidden");
}

navLinks.forEach(link => {
  link.addEventListener("click", () => {
    navLinks.forEach(l => l.classList.remove("active"));  
    link.classList.add("active");

    if (link.id === "nav-search") {
      if (sectionTitle) sectionTitle.textContent = "Search Station";
      showSection(searchSection);
    } else if (link.id === "nav-bookings") {
      if (sectionTitle) sectionTitle.textContent = "My Bookings";
      showSection(bookingsSection);
      loadMyBookings();
    } else if (link.id === "nav-profile") {
      if (sectionTitle) sectionTitle.textContent = "Profile";
      showSection(profileSection);
      loadUserProfile();
    }
  });
});

function initMap() {
  const defaultLocation = { lat: 20.5937, lng: 78.9629 };
  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultLocation,
    zoom: 12,
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        map.setCenter(userLocation);
        map.setZoom(14);
        new google.maps.Marker({
          position: userLocation,
          map: map,
          title: "You are here",
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          },
        });
        loadStations(userLocation);
      },
      () => {
        console.warn("Geolocation permission denied.");
        loadStations(defaultLocation);
      }
    );
  } else {
    console.warn("Geolocation not supported.");
    loadStations(defaultLocation);
  }
}
window.initMap = initMap;

async function loadStations(userPos) {
  const snapshot = await getDocs(collection(db, "bunks"));
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    console.log("Station data:", data);
    
    if (!data.lat || !data.lng || !data.hours) return;
    
    const [open, close] = data.hours.split("-").map(h => parseInt(h));
    const nowHour = new Date().getHours();
    const isOpen = nowHour >= open && nowHour <= close;
    
    const position = { lat: data.lat, lng: data.lng };
    
    const marker = new google.maps.Marker({
      position: position,
      map: map,
      title: data.name,
      icon: isOpen
        ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
        : "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
    });
    
    marker.addListener("click", () => {
      selectedStation = { id: docSnap.id, data: data, position: position };
      showRouteToStation(position);
      showStationDetails(docSnap.id, data);
    });
  });
}

function showRouteToStation(stationPosition) {
  if (!userLocation) {
    console.warn("User location not available for route calculation");
    return;
  }

  // Clear previous route
  if (directionsRenderer) {
    directionsRenderer.setDirections({ routes: [] });
  }

  // Initialize directions service if not already done
  if (!directionsService) {
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: "#4285F4",
        strokeWeight: 5,
      },
    });
    directionsRenderer.setMap(map);
  }

  const request = {
    origin: userLocation,
    destination: stationPosition,
    travelMode: google.maps.TravelMode.DRIVING,
  };

  directionsService.route(request, (result, status) => {
    if (status === "OK") {
      directionsRenderer.setDirections(result);
    } else {
      console.error("Directions request failed:", status);
    }
  });
}

function showStationDetails(id, data) {
  const distance = userLocation ? calculateDistance(userLocation, { lat: data.lat, lng: data.lng }) : "N/A";
  
  stationDetails.innerHTML = `
    <div class="station-info">
      <h3>${data.name}</h3>
      <p><strong>Distance:</strong> ${distance}</p>
      <p><strong>Price:</strong> ₹${data.price}/hour</p>
      <p><strong>Charger Type:</strong> ${data.charger}</p>
      <p><strong>Open Hours:</strong> ${data.hours}</p>
      <p><strong>Facilities:</strong> ${data.facilities}</p>
      <p><strong>Phone:</strong> ${data.phone}</p>
      <p><strong>Address:</strong> ${data.address}</p>
      <p><strong>Available Points:</strong> ${data.points}</p>
      <button class="book-btn" onclick="startBooking('${id}')">Book Slot</button>
    </div>
  `;
  stationDetails.classList.remove("hidden");
}

function calculateDistance(pos1, pos2) {
  const R = 6371; // Earth's radius in km
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
  const dLon = (pos2.lng - pos1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance.toFixed(1) + " km";
}

window.startBooking = async function (stationId) {
  if (!currentUser) {
    alert("Please login to book a slot");
    return;
  }

  const stationDoc = await getDoc(doc(db, "bunks", stationId));
  const station = stationDoc.data();
  const [start, end] = station.hours.split("-").map(h => parseInt(h));
  const slots = [];
  
  // Generate hourly slots
  for (let h = start; h < end; h++) {
    slots.push(h);
  }

  // Load existing bookings for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const q = query(
    collection(db, "bookings"),
    where("stationId", "==", stationId),
    where("date", ">=", Timestamp.fromDate(today)),
    where("date", "<", Timestamp.fromDate(tomorrow))
  );
  
  const snap = await getDocs(q);
  const bookedSlots = new Set();
  
  snap.forEach(doc => {
    const bookingData = doc.data();
    const timeSlot = bookingData.timeSlot;
    bookedSlots.add(timeSlot);
  });

  // Create slot grid
  slotGrid.innerHTML = `
    <h4>Available Time Slots - ${station.name}</h4>
    <p class="price-info">Price: ₹${station.price}/hour | Maximum 2 slots per booking</p>
    <div class="slots-container"></div>
    <div class="booking-summary">
      <p>Selected: <span id="selected-count">0</span>/2 slots</p>
      <p>Total Price: ₹<span id="total-price">0</span></p>
    </div>
  `;

  const slotsContainer = slotGrid.querySelector('.slots-container');
  
  slots.forEach(hour => {
    const isBooked = bookedSlots.has(hour);
    const slotEl = document.createElement("div");
    slotEl.className = `time-slot ${isBooked ? 'booked' : 'available'}`;
    slotEl.innerHTML = `
      <span class="time">${hour}:00 - ${hour + 1}:00</span>
      <span class="status">${isBooked ? 'Booked' : 'Available'}</span>
    `;
    
    if (!isBooked) {
      slotEl.addEventListener("click", () => toggleSlotSelection(slotEl, hour, station.price));
    }
    
    slotsContainer.appendChild(slotEl);
  });

  // Show booking panel with confirm button
  const confirmButton = document.getElementById("confirm-booking");
  if (confirmButton) {
    confirmButton.onclick = () => confirmBooking(stationId, station);
  }

  bookingPanel.classList.remove("hidden");
};

function toggleSlotSelection(slotEl, hour, pricePerHour) {
  const selectedSlots = document.querySelectorAll('.time-slot.selected');
  const isSelected = slotEl.classList.contains('selected');
  
  if (isSelected) {
    // Deselect slot
    slotEl.classList.remove('selected');
  } else {
    // Check if maximum slots reached
    if (selectedSlots.length >= 2) {
      alert("You can select maximum 2 slots per booking");
      return;
    }
    // Select slot
    slotEl.classList.add('selected');
  }
  
  updateBookingSummary(pricePerHour);
}

function updateBookingSummary(pricePerHour) {
  const selectedSlots = document.querySelectorAll('.time-slot.selected');
  const count = selectedSlots.length;
  const totalPrice = count * parseInt(pricePerHour);
  
  document.getElementById('selected-count').textContent = count;
  document.getElementById('total-price').textContent = totalPrice;
}

async function confirmBooking(stationId, station) {
  const selectedSlots = document.querySelectorAll('.time-slot.selected');
  
  if (selectedSlots.length === 0) {
    alert("Please select at least one time slot");
    return;
  }

  const confirmation = confirm(`Confirm booking for ${selectedSlots.length} slot(s) at ${station.name}?\nTotal: ₹${selectedSlots.length * parseInt(station.price)}`);
  
  if (!confirmation) return;

  try {
    const bookingPromises = [];
    const bookingId = generateBookingId();
    const chargingPoint = Math.floor(Math.random() * parseInt(station.points)) + 1;
    
    selectedSlots.forEach(slotEl => {
      const timeText = slotEl.querySelector('.time').textContent;
      const hour = parseInt(timeText.split(':')[0]);
      
      const bookingData = {
        bookingId: bookingId,
        stationId: stationId,
        stationName: station.name,
        userId: currentUser.uid,
        userName: currentUser.displayName || "EV User",
        userEmail: currentUser.email,
        phone: currentUser.phoneNumber || "Not provided",
        timeSlot: hour,
        timeDisplay: timeText,
        date: Timestamp.fromDate(new Date()),
        chargingPoint: chargingPoint,
        price: parseInt(station.price),
        status: "confirmed",
        createdAt: Timestamp.now()
      };
      
      bookingPromises.push(addDoc(collection(db, "bookings"), bookingData));
    });

    await Promise.all(bookingPromises);
    
    // Show success message
    alert(`Booking confirmed!\nBooking ID: ${bookingId}\nCharging Point: ${chargingPoint}`);
    
    // Hide booking panel and clear route
    bookingPanel.classList.add("hidden");
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] });
    }
    
    // Refresh bookings if on that tab
    if (!bookingsSection.classList.contains("hidden")) {
      loadMyBookings();
    }
    
  } catch (error) {
    console.error("Booking failed:", error);
    alert("Booking failed. Please try again.");
  }
}

function generateBookingId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `BK${timestamp}${random}`.toUpperCase();
}

function loadMyBookings() {
  if (!currentUser) return;
  
  bookingList.innerHTML = "<div class='loading'>Loading your bookings...</div>";
  
  const q = query(
    collection(db, "bookings"), 
    where("userId", "==", currentUser.uid)
  );
  
  getDocs(q)
    .then(snapshot => {
      if (snapshot.empty) {
        bookingList.innerHTML = "<div class='no-bookings'>No bookings found.</div>";
        return;
      }

      // Group bookings by bookingId
      const bookingsMap = new Map();
      
      snapshot.forEach(doc => {
        const booking = doc.data();
        const bookingId = booking.bookingId;
        
        if (!bookingsMap.has(bookingId)) {
          bookingsMap.set(bookingId, {
            ...booking,
            timeSlots: [booking.timeDisplay],
            totalPrice: booking.price
          });
        } else {
          const existingBooking = bookingsMap.get(bookingId);
          existingBooking.timeSlots.push(booking.timeDisplay);
          existingBooking.totalPrice += booking.price;
        }
      });

      let html = "";
      bookingsMap.forEach(booking => {
        const bookingDate = booking.date.toDate().toLocaleDateString();
        const createdAt = booking.createdAt.toDate().toLocaleString();
        
        html += `
          <div class="booking-card">
            <div class="booking-header">
              <h4>Booking ID: ${booking.bookingId}</h4>
              <span class="status ${booking.status}">${booking.status.toUpperCase()}</span>
            </div>
            <div class="booking-details">
              <p><strong>Station:</strong> ${booking.stationName}</p>
              <p><strong>Date:</strong> ${bookingDate}</p>
              <p><strong>Time Slots:</strong> ${booking.timeSlots.join(', ')}</p>
              <p><strong>Charging Point:</strong> ${booking.chargingPoint}</p>
              <p><strong>Total Price:</strong> ₹${booking.totalPrice}</p>
              <p><strong>Booked On:</strong> ${createdAt}</p>
            </div>
          </div>
        `;
      });
      
      bookingList.innerHTML = html;
    })
    .catch(error => {
      console.error("Error loading bookings:", error);
      bookingList.innerHTML = "<div class='error'>Error loading bookings. Please try again.</div>";
    });
}

function loadUserProfile() {
  if (!currentUser) return;
  
  getDoc(doc(db, "users", currentUser.uid))
    .then(docSnap => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        userProfile.innerHTML = `
          <div class="profile-info">
            <h3>User Profile</h3>
            <p><strong>Name:</strong> ${d.name || currentUser.displayName || 'N/A'}</p>
            <p><strong>Email:</strong> ${d.email || currentUser.email}</p>
            <p><strong>Phone:</strong> ${d.phone || currentUser.phoneNumber || 'N/A'}</p>
          </div>
        `;
      } else {
        userProfile.innerHTML = `
          <div class="profile-info">
            <h3>User Profile</h3>
            <p><strong>Name:</strong> ${currentUser.displayName || 'N/A'}</p>
            <p><strong>Email:</strong> ${currentUser.email}</p>
            <p><strong>Phone:</strong> ${currentUser.phoneNumber || 'N/A'}</p>
          </div>
        `;
      }
    })
    .catch(error => {
      console.error("Error loading profile:", error);
      userProfile.innerHTML = "<div class='error'>Error loading profile.</div>";
    });
}

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    currentUser = user;
    updateWelcomeMessage();
  }
});

function updateWelcomeMessage() {
  const welcomeEl = document.getElementById('user-welcome');
  if (welcomeEl && currentUser) {
    const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
    welcomeEl.textContent = `Welcome, ${displayName}!`;
  }
}

function waitForGoogleMaps() {
  if (typeof google !== 'undefined' && google.maps) {
    initMap();
  } else {
    setTimeout(waitForGoogleMaps, 100);
  }
}

// Authentication state change listener
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    currentUser = user;
    updateWelcomeMessage();
  }
});

// Make directionsRenderer globally accessible for the close function
window.directionsRenderer = null;

if (sectionTitle) {
  sectionTitle.textContent = "Search Station";
}

// Start checking for Google Maps availability
waitForGoogleMaps();