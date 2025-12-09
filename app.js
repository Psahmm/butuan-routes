/* ================================
   MAP INIT
================================ */
const map = L.map('map', { zoomControl: false }).setView([8.95, 125.54], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

L.control.zoom({ position: "bottomright" }).addTo(map);

/* ================================
   GLOBAL VARIABLES
================================ */
let startMarker = null;
let destMarker = null;
let pickupMarker = null;

let activeField = null;
let ROUTES = [];
const ROUTE_LAYERS = new Map();

/* ELEMENTS */
const startInput = document.getElementById("startInput");
const destInput = document.getElementById("destInput");
const startSuggestions = document.getElementById("startSuggestions");
const destSuggestions = document.getElementById("destSuggestions");

const directionsOverlay = document.getElementById("directionsOverlay");
const directionsBox = document.getElementById("directionsBox");

const routeCard = document.getElementById("routeCard");
const routeCardBody = document.getElementById("routeCardBody");

/* ================================
   OPEN DIRECTIONS
================================ */
document.getElementById("btnSearch").onclick = () => {
  activeField = null;
  clearAutocomplete();
  hideRouteCard();
  startInput.value = "";
  destInput.value = "";

  directionsOverlay.style.display = "block";
  directionsBox.style.display = "block";
};

function closeDirections() {
  directionsOverlay.style.display = "none";
  directionsBox.style.display = "none";
  clearAutocomplete();
}

document.getElementById("directionsClose").onclick = closeDirections;
directionsOverlay.onclick = closeDirections;

/* ================================
   AUTOCOMPLETE HELPERS
================================ */
function clearAutocomplete() {
  startSuggestions.style.display = "none";
  destSuggestions.style.display = "none";
  startSuggestions.innerHTML = "";
  destSuggestions.innerHTML = "";
}

async function fetchSuggestions(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json
    &limit=5
    &bounded=1
    &viewbox=125.50,8.99,125.60,8.90
    &q=${encodeURIComponent(q)}`.replace(/\s+/g, "");

  const res = await fetch(url);
  return await res.json();
}

/* ================================
   AUTOCOMPLETE LOGIC
================================ */
async function handleTyping(inputEl, suggestionsBox, type) {
  const q = inputEl.value.trim();
  if (!q) return clearAutocomplete();

  const results = await fetchSuggestions(q);

  suggestionsBox.innerHTML = "";
  suggestionsBox.style.display = "block";

  results.forEach(item => {
    const row = document.createElement("div");
    row.className = "ac-item";
    row.textContent = item.display_name;

    row.onclick = () => {
      inputEl.value = item.display_name;

      if (type === "start") {
        setStart(item.lat, item.lon, item.display_name);
      } else {
        setDestination(item.lat, item.lon, item.display_name);
        recommendRoute(item.lat, item.lon);
        closeDirections();
      }

      clearAutocomplete();
    };

    suggestionsBox.appendChild(row);
  });
}

/* INPUT LISTENERS */
startInput.addEventListener("input", () => {
  activeField = "start";
  handleTyping(startInput, startSuggestions, "start");
});

destInput.addEventListener("input", () => {
  activeField = "dest";
  handleTyping(destInput, destSuggestions, "dest");
});

/* ================================
   ENTER KEY HANDLING
================================ */
// Enter on start → jump to destination input
startInput.addEventListener("keypress", e => {
  if (e.key === "Enter") {
    destInput.focus();
    activeField = "dest";
  }
});

// Enter on destination → search + close modal
destInput.addEventListener("keypress", async e => {
  if (e.key === "Enter") {
    await manualSearch("dest");
    closeDirections();
  }
});

async function manualSearch(type) {
  const q = type === "start" ? startInput.value : destInput.value;
  const results = await fetchSuggestions(q);

  if (!results.length) {
    alert("Location not found.");
    return;
  }

  const best = results[0];

  if (type === "start") {
    setStart(best.lat, best.lon, best.display_name);
  } else {
    setDestination(best.lat, best.lon, best.display_name);
    recommendRoute(best.lat, best.lon);
  }

  clearAutocomplete();
}

/* ================================
   SET MARKERS
================================ */
function setStart(lat, lng, label="Start") {
  if (startMarker) map.removeLayer(startMarker);

  startMarker = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
      iconSize: [32, 32]
    })
  }).addTo(map);

  startInput.value = label;
}

function setDestination(lat, lng, label="Destination") {
  if (destMarker) map.removeLayer(destMarker);

  destMarker = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
      iconSize: [32, 32]
    })
  }).addTo(map);

  destInput.value = label;
}

/* ================================
   MAP CLICK HANDLING
================================ */
map.on("click", (e) => {
  if (!activeField) return;

  const { lat, lng } = e.latlng;

  if (activeField === "start") {
    setStart(lat, lng, `(${lat.toFixed(4)}, ${lng.toFixed(4)})`);
  } else {
    setDestination(lat, lng, `(${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    recommendRoute(lat, lng);
    closeDirections();
  }

  clearAutocomplete();
});

/* ================================
   SWAP MARKERS
================================ */
document.getElementById("swapBtn").onclick = () => {
  const sVal = startInput.value;
  const dVal = destInput.value;

  startInput.value = dVal;
  destInput.value = sVal;

  const sPos = startMarker ? startMarker.getLatLng() : null;
  const dPos = destMarker ? destMarker.getLatLng() : null;

  if (sPos) setDestination(sPos.lat, sPos.lng);
  if (dPos) setStart(dPos.lat, dPos.lng);

  activeField = "dest";
};

/* ================================
   GPS BUTTON
================================ */
document.getElementById("btnLocate").onclick = () => {
  if (!navigator.geolocation) return alert("Geolocation not supported.");

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      setStart(latitude, longitude, "My Location");
    },
    () => alert("Could not get your location.")
  );
};

/* ================================
   LOAD ROUTES (1–7)
================================ */
(async () => {
  const files = Array.from({ length: 7 }, (_, i) => `route${i + 1}.json`);

  const results = await Promise.allSettled(
    files.map(async f => {
      const r = await fetch(f);
      return r.ok ? r.json() : null;
    })
  );

  ROUTES = results.filter(r => r.value).map(r => r.value);

  renderRoutesList();
  addRoutesToMap();
})();

/* ================================
   ROUTES TRAY
================================ */
const tray = document.getElementById("tray");
document.getElementById("routesToggle").onclick = () => {
  tray.classList.toggle("open");
};

/* RENDER CHECKBOXES */
function renderRoutesList() {
  const list = document.getElementById("routesList");
  list.innerHTML = "";

  ROUTES.forEach(route => {
    const row = document.createElement("label");
    row.className = "route-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";

    cb.onchange = () => {
      const layer = ROUTE_LAYERS.get(route.id);

      if (cb.checked) {
        layer.addTo(map);
        zoomRoute(route.id);
      } else {
        map.removeLayer(layer);
      }
    };

    const swatch = document.createElement("span");
    swatch.className = "route-swatch";
    swatch.style.background = route.color;

    const name = document.createElement("span");
    name.textContent = route.name;

    row.append(cb, swatch, name);
    list.appendChild(row);
  });

  document.getElementById("btnShowAll").onclick = () => toggleRoutes(true);
  document.getElementById("btnHideAll").onclick = () => toggleRoutes(false);
}

function toggleRoutes(show) {
  ROUTES.forEach(route => {
    const layer = ROUTE_LAYERS.get(route.id);
    if (layer) show ? layer.addTo(map) : map.removeLayer(layer);
  });
}

/* ADD ROUTE LAYERS */
function addRoutesToMap() {
  ROUTES.forEach(route => {
    const layer = L.geoJSON(route.geojson, {
      style: { color: route.color, weight: 5 }
    });

    ROUTE_LAYERS.set(route.id, layer);
  });
}

function zoomRoute(id) {
  const layer = ROUTE_LAYERS.get(id);
  if (!layer) return;

  try {
    map.fitBounds(layer.getBounds(), { padding: [40, 40] });
  } catch {}
}

/* ================================
   DISTANCE / GEOMETRY HELPERS
================================ */
function dist(a, b) {
  const R = 6371e3;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLng = (b.lng - a.lng) * Math.PI/180;

  const lat1 = a.lat * Math.PI/180;
  const lat2 = b.lat * Math.PI/180;

  const h = Math.sin(dLat/2)**2 +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng/2)**2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

function getRouteDistanceToPoint(lat, lng, route) {
  let minDist = Infinity;
  let nearestPoint = null;

  L.geoJSON(route.geojson).eachLayer(layer => {
    if (layer instanceof L.Polyline) {
      const pts = layer.getLatLngs();

      pts.forEach(p => {
        const d = dist({lat, lng}, {lat: p.lat, lng: p.lng});

        if (d < minDist) {
          minDist = d;
          nearestPoint = p;
        }
      });
    }
  });

  return { minDist, nearestPoint };
}

/* ================================
   ROUTE RECOMMENDATION ENGINE
================================ */
function recommendRoute(destLat, destLng) {

  if (!startMarker) {
    alert("Please set your start point.");
    return;
  }

  const startPos = startMarker.getLatLng();

  let validRoutes = [];
  let routeInfo = [];

  ROUTES.forEach(route => {
    const nearStart = getRouteDistanceToPoint(startPos.lat, startPos.lng, route);
    const nearDest = getRouteDistanceToPoint(destLat, destLng, route);

    // Both within ~300m threshold
    if (nearDest.minDist < 300) {
      validRoutes.push(route);
    }

    routeInfo.push({
      route,
      distStart: nearStart.minDist,
      distDest: nearDest.minDist,
      pickupPoint: nearStart.nearestPoint
    });
  });

  if (validRoutes.length === 0) {
    routeInfo.sort((a, b) => a.distDest - b.distDest);
    const best = routeInfo[0];

    showRouteCard(`
      <p><b>Recommended Route:</b> ${best.route.name}</p>
      <p>Go to the 🚗 marked pickup point to catch the multicab.</p>
    `);

    highlightRoute(best.route.id);
    putPickupMarker(best.pickupPoint);

    return;
  }

  validRoutes.sort((a, b) => {
    const ad = getRouteDistanceToPoint(destLat, destLng, a).minDist;
    const bd = getRouteDistanceToPoint(destLat, destLng, b).minDist;
    return ad - bd;
  });

  const recommended = validRoutes[0];

  const others = validRoutes.slice(1)
    .map(r => r.name)
    .join(", ");

  let text = `
    <p><b>Recommended Route:</b> ${recommended.name}</p>
    <p>You can catch the multicab near your location.</p>
  `;

  if (others.length > 0) {
    text += `<p>Other possible routes: ${others}</p>`;
  }

  showRouteCard(text);

  highlightRoute(recommended.id);

  if (pickupMarker) {
    map.removeLayer(pickupMarker);
    pickupMarker = null;
  }
}

/* ================================
   PICKUP MARKER (🚗)
================================ */
function putPickupMarker(p) {
  if (!p) return;

  if (pickupMarker) map.removeLayer(pickupMarker);

  pickupMarker = L.marker([p.lat, p.lng], {
    icon: L.divIcon({
      className: "pickup-icon",
      html: "🚗",
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    })
  }).addTo(map);

  map.setView([p.lat, p.lng], 16);
}

/* ================================
   ROUTE HIGHLIGHTING
================================ */
function highlightRoute(id) {
  ROUTES.forEach(r => {
    const layer = ROUTE_LAYERS.get(r.id);
    if (layer) map.removeLayer(layer);
  });

  const layer = ROUTE_LAYERS.get(id);
  if (layer) layer.addTo(map);
}

/* ================================
   ROUTE CARD UI
================================ */
function showRouteCard(html) {
  routeCardBody.innerHTML = html;
  routeCard.classList.add("show");
}

function hideRouteCard() {
  routeCard.classList.remove("show");
}

document.getElementById("rcClose").onclick = hideRouteCard;
