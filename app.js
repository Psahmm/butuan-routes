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
let bothMarkersSet = false;  // Track if both start and destination markers are set
let recommendedRouteLayer = null;  // To store recommended route

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
  bothMarkersSet = false;  // Reset when opening search
};

document.getElementById("closeSearch").onclick =
overlay.onclick = () => {
  if (bothMarkersSet) {
    overlay.style.display = "none";
    searchBox.style.display = "none";
    clearSuggestions();
  } else {
    alert("Please select both start and destination locations first.");
  }
};

/* ================================
   GEOLOCATION
================================ */
document.getElementById("btnLocate").onclick = () => {
  if (!navigator.geolocation) return alert("Geolocation not supported.");

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      if (!startMarker) {  // Only create the start marker if it doesn't exist
        startMarker = L.marker([latitude, longitude], {
          icon: L.icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            iconSize: [32, 32]
          })
        }).addTo(map);
      } else {
        startMarker.setLatLng([latitude, longitude]);  // Update marker position
      }

      startInput.value = "My Location";
      activeField = "start";

      map.setView([latitude, longitude], 16); // Focus on the user's location
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
  if (!query || query.length < 2) return []; // Only proceed if input has 2 or more characters

  if (controller) controller.abort(); // Abort previous request if any
  controller = new AbortController(); // Create a new AbortController for the new request

  // Nominatim search URL with no bounding box for broader area in Butuan
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=7&countrycodes=ph&q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json();

    // Filter the results to ensure they are Butuan-related
    const filteredResults = data.filter(item => item.display_name.includes("Butuan"));
    return filteredResults;
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return []; // Return empty if there's an error
  }
}

function showList(input, list, type) {
  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    const text = input.value.trim();
    if (text.length < 2) {
      list.style.display = "none"; // Hide suggestions if input length is less than 2
      return;
    }

    // Show loading indicator
    list.innerHTML = "<div class='loading'>Loading...</div>";
    list.style.display = "block";

    const results = await getSuggestions(text); // Get suggestions from Nominatim

    list.innerHTML = ""; // Clear loading text

    // Check if any suggestions were returned
    if (results.length > 0) {
      results.forEach(item => {
        const row = document.createElement("div");
        row.className = "sug-item"; // Add class for styling
        row.textContent = item.display_name; // Display the location name

        // On click, place marker and close search box
        row.onclick = () => {
          if (type === "start") {
            placeStart(item.lat, item.lon, item.display_name); // Place start marker
          } else {
            placeDest(item.lat, item.lon, item.display_name); // Place destination marker
          }
          // Prevent automatic closing of the search until both markers are set
          if (startMarker && destMarker) {
            bothMarkersSet = true;
          }
          clearSuggestions();
        };

        list.appendChild(row); // Append suggestion to the list
      });

      list.style.display = "block"; // Show suggestions
    } else {
      list.style.display = "none"; // Hide suggestions if no results
    }
  }, 50); // Faster response (debounce set to 50ms for quicker suggestions)
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

  // After selecting Start and Destination, recommend route
  getRecommendedRoute();

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

/* ================================
   RECOMMENDED ROUTE DISPLAY
================================ */
async function getRecommendedRoute() {
  // Logic for selecting the best route based on proximity to start and destination.
  // Here we are finding the closest route by comparing distances to the start and destination markers.

  const startLatLng = startMarker.getLatLng();
  const destLatLng = destMarker.getLatLng();
  let closestRoute = null;
  let minDistance = Infinity;

  ROUTES.forEach(route => {
    const routeLayer = ROUTE_LAYERS.get(route.id);
    routeLayer.getLayers().forEach(layer => {
      const routeLatLng = layer.getLatLngs()[0];  // Get the first point of the route line

      // Calculate the distance from start and destination markers
      const startDist = routeLatLng.distanceTo(startLatLng);
      const destDist = routeLatLng.distanceTo(destLatLng);
      const totalDist = startDist + destDist;

      // If this route is closer, update the closest route
      if (totalDist < minDistance) {
        minDistance = totalDist;
        closestRoute = route;
      }
    });
  });

  if (closestRoute) {
    // Add the closest route to the map
    const layer = ROUTE_LAYERS.get(closestRoute.id);
    if (recommendedRouteLayer) {
      map.removeLayer(recommendedRouteLayer);  // Remove previous recommendation
    }

    recommendedRouteLayer = layer;
    recommendedRouteLayer.addTo(map);
    map.fitBounds(recommendedRouteLayer.getBounds(), { padding: [120, 120] });

    // Show recommended route details in the popup
    document.getElementById("recommendedRoute").style.display = "block";
    document.getElementById("recommendedRoute").innerHTML = `
      <strong>Recommended Route: ${closestRoute.name}</strong><br>
      Pickup: ${startInput.value}<br>
      Drop-off: ${destInput.value}
    `;
  }
}
