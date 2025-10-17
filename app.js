// --- Map setup ---
const map = L.map('map').setView([8.953, 125.55], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const statusEl = document.getElementById('status');
const routesListEl = document.getElementById('routesList');
const btnShowAll = document.getElementById('btnShowAll');
const btnHideAll = document.getElementById('btnHideAll');

function setStatus(msg) { statusEl.textContent = msg; }

let ROUTES = [];
const ROUTE_LAYERS = new Map(); // id -> Leaflet layer

// --- Load route1.json ... route7.json (skip missing) ---
(async () => {
  try {
    const filenames = Array.from({ length: 7 }, (_, i) => `route${i + 1}.json`);

    const results = await Promise.allSettled(
      filenames.map(async (url) => {
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) throw new Error(`Missing ${url}`);
        const data = await r.json(); // expects { id, name, color, geojson }
        if (!data?.id || !data?.geojson) throw new Error(`${url} has invalid shape`);
        return data;
      })
    );

    // Keep only successful loads
    ROUTES = results
      .filter(res => res.status === 'fulfilled')
      .map(res => res.value);

    if (ROUTES.length === 0) {
      setStatus('No route files found (route1.json–route7.json).');
      return;
    }

    renderRoutesList(ROUTES);
    addRoutesToMap(ROUTES);
    fitToAllVisible();
    setStatus(`Loaded ${ROUTES.length} route(s).`);
  } catch (err) {
    setStatus('Error: ' + err.message);
  }
})();

// --- Build the checkbox list ---
function renderRoutesList(routes) {
  routesListEl.innerHTML = '';
  routes.forEach(route => {
    const id = `route-${route.id}`;
    const item = document.createElement('label');
    item.className = 'route-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.checked = true;
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
}

// --- Add GeoJSON layers to the map ---
function addRoutesToMap(routes) {
  routes.forEach(route => {
    const style = { color: route.color || '#e11d48', weight: 5, opacity: 0.9 };
    const layer = L.geoJSON(route.geojson, { style })
      .bindPopup(route.name || `Route ${route.id}`);
    layer.addTo(map);
    ROUTE_LAYERS.set(route.id, layer);
  });
}

// --- Fit map bounds to visible routes ---
function fitToAllVisible() {
  const visible = [];
  ROUTE_LAYERS.forEach(layer => { if (map.hasLayer(layer)) visible.push(layer); });
  if (visible.length === 0) return;
  const group = L.featureGroup(visible);
  map.fitBounds(group.getBounds(), { padding: [30, 30] });
}
