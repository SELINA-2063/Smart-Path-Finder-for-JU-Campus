var todaysEvents = [
  
  { title: "Science Fair", location: "Science Building", time: "3:00 PM" },
  { title: "Book Exhibition", location: "Central Library", time: "11:00 AM" },
  { title: "Photography Exhibition", location: "TSC (Teacher-Student Center)", time: "5:00 PM" },
  { title: "Food Festival", location: "Central Cafeteria", time: "12:00 PM" }
];

function renderEventList() {
  let eventListDiv = document.getElementById('eventList');
  let html = '<b>📅 Today’s Events:</b><br><br>';
  todaysEvents.forEach((event, index) => {
    html += `<div class="event-item"
                onclick="zoomToEvent('${event.location}', '${event.title}')">
                📌 <b>${event.title}</b><br>
                📍 ${event.location}<br>
                🕒 ${event.time}
             </div>`;
  });
  eventListDiv.innerHTML = html;
}

function zoomToEvent(location, title) {
  let latlng = landmarks[location];
  if (latlng) {
    map.setView(latlng, 18);
    L.popup()
      .setLatLng(latlng)
      .setContent(`<b>${title}</b><br>${location}`)
      .openOn(map);
  }
}

var landmarks = {
  "Main Gate": [23.8826, 90.2669],
  "TSC (Teacher-Student Center)": [23.8840, 90.2702],
  "Central Library": [23.8827, 90.2687],
  "Science Building": [23.8822, 90.2705],
  "Amphitheatre": [23.8810, 90.2695],
  "Central Cafeteria": [23.8835, 90.2690],
  "Dairy Gate": [23.8794, 90.2662]
};

var graph = {
  "Main Gate": { "Central Library": 250, "Dairy Gate": 400 },
  "Dairy Gate": { "Main Gate": 400, "Amphitheatre": 300 },
  "Central Library": { "Main Gate": 250, "Amphitheatre": 150, "Central Cafeteria": 200 },
  "Amphitheatre": { "Dairy Gate": 300, "Central Library": 150, "Science Building": 200 },
  "Central Cafeteria": { "Central Library": 200, "TSC (Teacher-Student Center)": 150 },
  "Science Building": { "Amphitheatre": 200, "TSC (Teacher-Student Center)": 100 },
  "TSC (Teacher-Student Center)": { "Central Cafeteria": 150, "Science Building": 100 }
};

var map = L.map('map').setView([23.8826, 90.2669], 16);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

renderEventList();

var markers = {}, startPoint = null, currentPolyline = null, finalPathPolyline = null, obstacleLines = [], obstacles = [];
var routeInfo = document.getElementById('routeInfo');

for (let key in landmarks) {
  markers[key] = L.marker(landmarks[key]).addTo(map).bindPopup(key);
}

for (let key in markers) {
  markers[key].bindTooltip(key, { permanent: true, direction: 'right', offset: [10, 0] }).openTooltip();
}

function findShortestPath(start, end) {
  let distances = {}, prev = {}, queue = [];

  for (let node in graph) {
    distances[node] = Infinity;
    prev[node] = null;
    queue.push(node);
  }
  distances[start] = 0;

  while (queue.length) {
    queue.sort((a, b) => distances[a] - distances[b]);
    let current = queue.shift();
    if (current === end) break;

    for (let neighbor in graph[current]) {
      let isBlocked = obstacles.some(
        o => (o[0] === current && o[1] === neighbor) || (o[0] === neighbor && o[1] === current)
      );
      if (isBlocked) continue;

      let alt = distances[current] + graph[current][neighbor];
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        prev[neighbor] = current;
      }
    }
  }

  let path = [], u = end;
  if (prev[u] !== null || u === start) {
    while (u) {
      path.unshift(u);
      u = prev[u];
    }
  }
  return { path: path, distance: distances[end] };
}

function drawPath(path) {
  if (currentPolyline) map.removeLayer(currentPolyline);
  let latlngs = path.map(p => landmarks[p]);
  currentPolyline = L.polyline(latlngs, { color: 'blue', weight: 5 }).addTo(map);
  map.fitBounds(currentPolyline.getBounds());
}

function drawFinalPath(path) {
  if (finalPathPolyline) map.removeLayer(finalPathPolyline);
  let latlngs = path.map(p => landmarks[p]);
  finalPathPolyline = L.polyline(latlngs, { color: 'limegreen', weight: 5, dashArray: '15,10' }).addTo(map);
  obstacleLines.forEach(line => line.bringToFront());
  map.fitBounds(finalPathPolyline.getBounds());
}

function showObstaclesOnPath(path) {
  obstacleLines.forEach(line => map.removeLayer(line));
  obstacleLines = [];
  obstacles = [];
  for (let i = 0; i < path.length - 1; i++) {
    if (Math.random() < 0.5) {
      let latlngs = [landmarks[path[i]], landmarks[path[i+1]]];
      let line = L.polyline(latlngs, { color: 'red', weight: 5, dashArray: '5,5' }).addTo(map);
      obstacleLines.push(line);
      obstacles.push([path[i], path[i+1]]);
    }
  }
}

function updateRouteInfo(data) {
  if (!data.path.length) {
    routeInfo.innerHTML = '<b>No available path found avoiding obstacles!</b><br>The red dashed lines indicate roads currently blocked by obstacles. Please try a different route.';
    return;
  }
  let steps = data.path.map((p, i) => (i + 1) + '. ' + p).join('<br>');
  routeInfo.innerHTML = `<b>Total Distance:</b> ${data.distance} meters<br><b>Route Steps:</b><br>${steps}<br><br><i>Note:</i> Red dashed lines represent blocked paths due to obstacles and are avoided for safety.`;
}

for (let key in markers) {
  markers[key].on('click', function() {
    if (!startPoint) {
      startPoint = key;
      markers[key].bindPopup(key + " (Start)").openPopup();
      routeInfo.innerHTML = 'Select destination landmark.';
    } else {
      if (key === startPoint) {
        startPoint = null;
        routeInfo.innerHTML = '';
      } else {
        obstacles = [];
        let data = findShortestPath(startPoint, key);
        if (data.path.length > 0) {
          drawPath(data.path);
          showObstaclesOnPath(data.path);
          let updatedData = findShortestPath(startPoint, key);
          if (updatedData.path.length > 0) {
            drawFinalPath(updatedData.path);
            updateRouteInfo(updatedData);
            markers[key].bindPopup(key + " (End)").openPopup();
          } else {
            routeInfo.innerHTML = '<b>No available path found avoiding obstacles!</b>';
          }
        } else {
          routeInfo.innerHTML = '<b>No path found!</b>';
        }
        startPoint = null;
      }
    }
  });
}

// Draw all possible paths between landmarks
for (let from in graph) {
  for (let to in graph[from]) {
    if (from < to) {
      let latlngs = [landmarks[from], landmarks[to]];
      L.polyline(latlngs, { color: 'gray', weight: 2, dashArray: '5,5' }).addTo(map);
    }
  }
}


// Vehicle icons & routes
var vehicleIcons = [
  L.icon({ iconUrl: 'images/car1.png', iconSize: [40,40] }),
  L.icon({ iconUrl: 'images/car2.png', iconSize: [40,40] }),
  L.icon({ iconUrl: 'images/car3.png', iconSize: [40,40] })
];


var routes = [
  [landmarks["Main Gate"], landmarks["Central Library"], landmarks["Amphitheatre"], landmarks["Dairy Gate"], landmarks["Main Gate"]],
  [landmarks["TSC (Teacher-Student Center)"], landmarks["Central Cafeteria"], landmarks["Science Building"], landmarks["Amphitheatre"], landmarks["TSC (Teacher-Student Center)"]],
  [landmarks["Dairy Gate"], landmarks["Amphitheatre"], landmarks["Science Building"], landmarks["Central Cafeteria"], landmarks["Dairy Gate"]]
];

var vehicleMarkers = [], steps = 100, stepCounts = [0,0,0], currentIndexes = [0,0,0], nextIndexes = [1,1,1];

for (let i = 0; i < vehicleIcons.length; i++) {
  let marker = L.marker(routes[i][0], { icon: vehicleIcons[i] }).addTo(map);
  vehicleMarkers.push(marker);
}

function animateVehicles() {
  let infoText = '<b>Vehicles on Roads:</b><br>';
  for (let i = 0; i < vehicleMarkers.length; i++) {
    let startIdx = currentIndexes[i];
    let nextIdx = nextIndexes[i];

    let startLandmark = Object.keys(landmarks).find(key =>
      landmarks[key][0] === routes[i][startIdx][0] && landmarks[key][1] === routes[i][startIdx][1]
    );
    let endLandmark = Object.keys(landmarks).find(key =>
      landmarks[key][0] === routes[i][nextIdx][0] && landmarks[key][1] === routes[i][nextIdx][1]
    );

    infoText += `🚐 <b>Vehicle ${i+1}</b>: ${startLandmark} → ${endLandmark}<br>`;

    // Move vehicle marker along the route
    let startPoint = routes[i][startIdx];
    let endPoint = routes[i][nextIdx];

    let lat = startPoint[0] + (endPoint[0] - startPoint[0]) * (stepCounts[i] / steps);
    let lng = startPoint[1] + (endPoint[1] - startPoint[1]) * (stepCounts[i] / steps);

    vehicleMarkers[i].setLatLng([lat, lng]);

    stepCounts[i]++;
    if (stepCounts[i] > steps) {
      stepCounts[i] = 0;
      currentIndexes[i] = nextIdx;
      nextIndexes[i]++;
      if (nextIndexes[i] >= routes[i].length) nextIndexes[i] = 0;
    }
  }
  document.getElementById('vehicleRoadInfo').innerHTML = infoText;
}

setInterval(animateVehicles, 500);