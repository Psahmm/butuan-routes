/* ================================
   MAP INIT
================================ */
const map = L.map('map', { zoomControl: false }).setView([8.95, 125.54], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

L.control.zoom({ position: "bottomright" }).addTo(map);

/* ================================
   MARKERS
================================ */
let startMarker = null;
let destMarker = null;
let activeField = null;

/* ================================
   OPEN DIRECTIONS UI
================================ */
document.getElementById("btnSearch").onclick = () => {
  activeField = null;
  document.getElementById("directionsOverlay").style.display = "block";
  document.getElementById("directionsBox").style.display = "block";
};

function closeDirections() {
  document.getElementById("directionsOverlay").style.display = "none";
  document.getElementById("directionsBox").style.display = "none";
}

document.getElementById("directionsOverlay").onclick = closeDirections;
document.getElementById("directionsClose").onclick = closeDirections;

/* ================================
   SET ACTIVE FIELD
================================ */
document.getElementById("startInput").onclick = () => activeField = "start";
document.getElementById("destInput").onclick = () => activeField = "dest";

/* ================================
   SWAP BUTTON
================================ */
document.getElementById("swapBtn").onclick = () => {
  const s = document.getElementById("startInput").value;
  const d = document.getElementById("destInput").value;

  document.getElementById("startInput").value = d;
  document.getElementById("destInput").value = s;

  const sPos = startMarker ? startMarker.getLatLng() : null;
  const dPos = destMarker ? destMarker.getLatLng() : null;

  if (sPos) setDestination(sPos.lat, sPos.lng);
  if (dPos) setStart(dPos.lat, dPos.lng);
};

/* ================================
   MAP CLICK → fill active input
================================ */
map.on("click", (e) => {
  if (!activeField) return;

  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  if (activeField === "start") setStart(lat, lng);
  if (activeField === "dest") setDestination(lat, lng);
});

/* ================================
   SEARCH USING ENTER
================================ */
async function searchAndFill(inputId, type) {
  const query = document.getElementById(inputId).value.trim();
  if (!query) return;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.length) {
    alert("Location not found.");
    return;
  }

  const { lat, lon, display_name } = data[0];

  if (type === "start") setStart(lat, lon, display_name);
  if (type === "dest") setDestination(lat, lon, display_name);
}

document.getElementById("startInput").addEventListener("keypress", e => {
  if (e.key === "Enter") searchAndFill("startInput", "start");
});

document.getElementById("destInput").addEventListener("keypress", e => {
  if (e.key === "Enter") searchAndFill("destInput", "dest");
});

/* ================================
   MARKER SETTERS
================================ */
function setStart(lat, lng, label = "Start location") {
  if (startMarker) map.removeLayer(startMarker);

  startMarker = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
      iconSize: [32, 32]
    })
  }).addTo(map);

  document.getElementById("startInput").value = label;
  map.setView([lat, lng], 15);
}

function setDestination(lat, lng, label = "Destination") {
  if (destMarker) map.removeLayer(destMarker);

  destMarker = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
      iconSize: [32, 32]
    })
  }).addTo(map);

  document.getElementById("destInput").value = label;
  map.setView([lat, lng], 15);
}

/* ================================
   GPS
================================ */
document.getElementById("btnLocate").onclick = () => {
  if (!navigator.geolocation) return alert("Geolocation not supported.");

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setStart(lat, lng, "My Location");
    },
    () => alert("Unable to get your location.")
  );
};

/* ================================
   ROUTES TRAY
================================ */
const tray = document.getElementById("tray");
document.getElementById("routesToggle").onclick = () => {
  tray.classList.toggle("open");
};

let ROUTES = [];
const ROUTE_LAYERS = new Map();

(async () => {
  const files = Array.from({ length: 7 }, (_, i) => `route${i + 1}.json`);
  const results = await Promise.allSettled(
    files.map(async file => {
      const r = await fetch(file);
      return r.ok ? r.json() : null;
    })
  );

  ROUTES = results.filter(r => r.value).map(r => r.value);
  renderRoutesList();
  addRoutesToMap();
})();

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

    const txt = document.createElement("span");
    txt.textContent = route.name;

    row.append(cb, swatch, txt);
    list.appendChild(row);
  });

  document.getElementById("btnShowAll").onclick = () => toggleRoutes(true);
  document.getElementById("btnHideAll").onclick = () => toggleRoutes(false);
}

function addRoutesToMap() {
  ROUTES.forEach(route => {
    const layer = L.geoJSON(route.geojson, {
      style: { color: route.color, weight: 5 }
    });
    ROUTE_LAYERS.set(route.id, layer);
  });
}

function toggleRoutes(show) {
  ROUTES.forEach(route => {
    const layer = ROUTE_LAYERS.get(route.id);
    show ? layer.addTo(map) : map.removeLayer(layer);
  });
}

function zoomRoute(id) {
  const layer = ROUTE_LAYERS.get(id);
  if (!layer) return;
  try { map.fitBounds(layer.getBounds(), { padding: [40, 40] }); } catch {}
}
