// --- Map Setup ---
const map = L.map('map', { zoomControl: false }).setView([8.953, 125.55], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// UI refs
const tray = document.getElementById('tray');
const toggleBtn = document.getElementById('routesToggle');
const routesListEl = document.getElementById('routesList');
const btnShowAll = document.getElementById('btnShowAll');
const btnHideAll = document.getElementById('btnHideAll');

// Toggle tray open/close
toggleBtn.addEventListener('click', () => {
  const open = !tray.classList.contains('open');
  tray.classList.toggle('open', open);
  toggleBtn.setAttribute('aria-expanded', String(open));
});

// Data
let ROUTES = [];
const ROUTE_LAYERS = new Map();

// Load route1.json ... route7.json
(async () => {
  const filenames = Array.from({ length: 7 }, (_, i) => `route${i + 1}.json`);
  const results = await Promise.allSettled(
    filenames.map(async (url) => {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`Missing ${url}`);
      const data = await r.json();
      if (!data?.id || !data?.geojson) throw new Error(`${url} invalid`);
      return data;
    })
  );

  ROUTES = results.filter(x => x.status === 'fulfilled').map(x => x.value);
  if (ROUTES.length === 0) return;

  renderRoutesList(ROUTES);
  addRoutesToMap(ROUTES);
})();

// Build the checkbox list
function renderRoutesList(routes) {
  routesListEl.innerHTML = '';
  routes.forEach(route => {
    const id = `route-${route.id}`;
    const item = document.createElement('label');
    item.className = 'route-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.checked = false;

    cb.addEventListener('change', () => {
      const layer = ROUTE_LAYERS.get(route.id);
      if (!layer) return;
      if (cb.checked) layer.addTo(map); else map.removeLayer(layer);
      fitToAllVisible();
    });

    const swatch = document.createElement('span');
    swatch.className = 'route-swatch';
    swatch.style.background = route.color || '#e11d48';

    const name = document.createElement('span');
    name.className = 'route-name';
    name.textContent = route.name || `Route ${route.id}`;

    item.appendChild(cb);
    item.appendChild(swatch);
    item.appendChild(name);
    routesListEl.appendChild(item);
  });

  btnShowAll.onclick = () => setAllVisibility(true);
  btnHideAll.onclick = () => setAllVisibility(false);
}

function setAllVisibility(show) {
  ROUTES.forEach(route => {
    const cb = document.getElementById(`route-${route.id}`);
    if (cb) cb.checked = show;
    const layer = ROUTE_LAYERS.get(route.id);
    if (!layer) return;
    if (show) layer.addTo(map); else map.removeLayer(layer);
  });
  fitToAllVisible();
}

// Add GeoJSON layers
function addRoutesToMap(routes) {
  routes.forEach(route => {
    const style = { color: route.color || '#e11d48', weight: 5, opacity: 0.9 };
    const layer = L.geoJSON(route.geojson, { style }).bindPopup(route.name || `Route ${route.id}`);
    ROUTE_LAYERS.set(route.id, layer);
  });
}

// Fit map to visible routes
function fitToAllVisible() {
  const visible = [];
  ROUTE_LAYERS.forEach(layer => { if (map.hasLayer(layer)) visible.push(layer); });
  if (visible.length === 0) return;
  const group = L.featureGroup(visible);
  map.fitBounds(group.getBounds(), { padding: [30, 30] });
}

// --- Locate Me Button Logic ---
const btnLocate = document.getElementById('btnLocate');

btnLocate.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  btnLocate.disabled = true;
  btnLocate.textContent = "⌛";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (!window._userMarker) {
        window._userMarker = L.marker([lat, lng]).addTo(map);
      } else {
        window._userMarker.setLatLng([lat, lng]);
      }

      window._userMarker.bindPopup("📍 You are here").openPopup();
      map.setView([lat, lng], 16);

      btnLocate.disabled = false;
      btnLocate.textContent = "📍";
    },
    (err) => {
      alert("Unable to get your location: " + err.message);
      btnLocate.disabled = false;
      btnLocate.textContent = "📍";
    }
  );
});
