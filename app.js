/* ================================
   MAP INIT
================================ */
const map = L.map('map', { zoomControl: false }).setView([8.95, 125.54], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

L.control.zoom({ position: "bottomright" }).addTo(map);

/* MARKERS */
let startMarker = null;
let destMarker = null;
let activeField = null;

/* DOM elements */
const overlay = document.getElementById("overlay");
const searchBox = document.getElementById("searchBox");
const startInput = document.getElementById("startInput");
const destInput = document.getElementById("destInput");
const startList = document.getElementById("startList");
const destList = document.getElementById("destList");

/* ================================
   SHOW / CLOSE SEARCH
================================ */
document.getElementById("btnSearch").onclick = () => {
  overlay.style.display = "block";
  searchBox.style.display = "block";
  startInput.value = "";
  destInput.value = "";
  clearSuggestions();
  activeField = null;
};

document.getElementById("closeSearch").onclick =
overlay.onclick = () => {
  overlay.style.display = "none";
  searchBox.style.display = "none";
  clearSuggestions();
};

/* ================================
   GEOLOCATION
================================ */
document.getElementById("btnLocate").onclick = () => {
  if (!navigator.geolocation) return alert("Geolocation not supported.");

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      if (startMarker) map.removeLayer(startMarker);

      startMarker = L.marker([latitude, longitude], {
        icon: L.icon({
          iconUrl: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          iconSize: [32, 32]
        })
      }).addTo(map);

      startInput.value = "My Location";
      activeField = "start";

      map.setView([latitude, longitude], 16);
    },
    () => alert("Unable to get your location"),
    { enableHighAccuracy: true }
  );
};

/* ================================
   NOMINATIM SEARCH — BUTUAN ONLY
================================ */
let controller = null;
let debounceTimer = null;

async function getSuggestions(query) {
  if (!query || query.length < 2) return [];

  if (controller) controller.abort();
  controller = new AbortController();

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=7&countrycodes=ph&bounded=1&viewbox=125.465,9.010,125.596,8.778&q=${encodeURIComponent(query + " Butuan City")}`;

  try {
    const r = await fetch(url, { signal: controller.signal });
    const data = await r.json();
    return data.filter(x => x.display_name.includes("Butuan"));
  } catch {
    return [];
  }
}

function showList(input, list, type) {
  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    const text = input.value.trim();
    if (text.length < 2) {
      list.style.display = "none";
      return;
    }

    const results = await getSuggestions(text);
    list.innerHTML = "";

    results.forEach(item => {
      const row = document.createElement("div");
      row.className = "sug-item";
      row.textContent = item.display_name;

      row.onclick = () => {
        if (type === "start") {
          placeStart(item.lat, item.lon, item.display_name);
        } else {
          placeDest(item.lat, item.lon, item.display_name);
        }
        overlay.style.display = "none";
        searchBox.style.display = "none";
        clearSuggestions();
      };

      list.appendChild(row);
    });

    list.style.display = "block";
  }, 250);
}

startInput.oninput = () => {
  activeField = "start";
  showList(startInput, startList, "start");
};
destInput.oninput = () => {
  activeField = "dest";
  showList(destInput, destList, "dest");
};

function clearSuggestions() {
  startList.innerHTML = "";
  destList.innerHTML = "";
  startList.style.display = "none";
  destList.style.display = "none";
}

/* ================================
   SEARCH CONFIRM BUTTON
================================ */
document.getElementById("searchConfirm").onclick = async () => {
  const q = destInput.value.trim();
  if (!q) return alert("Enter a destination");

  const results = await getSuggestions(q);
  if (results.length > 0) {
    placeDest(results[0].lat, results[0].lon, results[0].display_name);
  }

  overlay.style.display = "none";
  searchBox.style.display = "none";
  clearSuggestions();
};

/* ================================
   ENTER KEY
================================ */
startInput.onkeypress = e => {
  if (e.key === "Enter") {
    activeField = "dest";
    destInput.focus();
  }
};

destInput.onkeypress = e => {
  if (e.key === "Enter") {
    document.getElementById("searchConfirm").click();
  }
};

/* ================================
   MAP CLICK SETS MARKERS
================================ */
map.on("click", e => {
  if (activeField === "start") {
    placeStart(e.latlng.lat, e.latlng.lng, "Pinned Location");
  } else if (activeField === "dest") {
    placeDest(e.latlng.lat, e.latlng.lng, "Pinned Destination");
  }
});

/* ================================
   MARKER SETTERS
================================ */
function placeStart(lat, lng, label) {
  if (startMarker) map.removeLayer(startMarker);
  startMarker = L.marker([lat, lng]).addTo(map);
  startInput.value = label;
}
function placeDest(lat, lng, label) {
  if (destMarker) map.removeLayer(destMarker);
  destMarker = L.marker([lat, lng]).addTo(map);
  destInput.value = label;
}

/* ================================
   ROUTES TRAY
================================ */
const ROUTE_LAYERS = new Map();
let ROUTES = [];

(async () => {
  const files = Array.from({ length: 7 }, (_, i) => `route${i + 1}.json`);
  ROUTES = await Promise.all(files.map(f => fetch(f).then(r => r.json())));

  renderTray();
  addRouteLayers();
})();

function renderTray() {
  const list = document.getElementById("routesList");
  list.innerHTML = "";

  ROUTES.forEach(route => {
    const item = document.createElement("label");
    item.className = "route-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";

    cb.onchange = () => {
      const layer = ROUTE_LAYERS.get(route.id);
      if (cb.checked) {
        layer.addTo(map);
        map.fitBounds(layer.getBounds(), { padding: [120, 120] });
      } else {
        map.removeLayer(layer);
      }
    };

    const swatch = document.createElement("span");
    swatch.className = "route-swatch";
    swatch.style.background = route.color;

    const name = document.createElement("span");
    name.textContent = route.name;

    item.append(cb, swatch, name);
    list.appendChild(item);
  });
}

document.getElementById("routesToggle").onclick = () => {
  document.getElementById("tray").classList.toggle("open");
};

function addRouteLayers() {
  ROUTES.forEach(route => {
    const layer = L.geoJSON(route.geojson, {
      style: { color: route.color, weight: 5 }
    });
    ROUTE_LAYERS.set(route.id, layer);
  });
}

document.getElementById("btnShowAll").onclick = () => {
  ROUTES.forEach(route => {
    const layer = ROUTE_LAYERS.get(route.id);
    layer.addTo(map);
    map.fitBounds(layer.getBounds(), { padding: [120, 120] });
  });
};
document.getElementById("btnHideAll").onclick = () => {
  ROUTES.forEach(route => map.removeLayer(ROUTE_LAYERS.get(route.id)));
};
