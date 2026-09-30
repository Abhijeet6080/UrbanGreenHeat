/**
 * GreenHeat — Urban Heat & Green Cover Intelligence
 * Main Application Script
 *
 * Loads GeoJSON/JSON data exported from Google Earth Engine
 * and renders an interactive Leaflet map with Chart.js visualizations.
 */

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  // Default map center (will be overridden by data bounds)
  defaultCenter: [12.83, 80.04], // Kattankulathur, Tamil Nadu
  defaultZoom: 13,

  // Data file paths (relative)
  dataFiles: {
    ndvi: 'data/ndvi.geojson',
    lst: 'data/lst.geojson',
    hotspots: 'data/hotspots.geojson',
    statistics: 'data/statistics.json'
  },

  // NDVI color scale
  ndviColors: [
    { val: -0.1, color: '#d73027' },
    { val: 0.0,  color: '#fc8d59' },
    { val: 0.15, color: '#fee08b' },
    { val: 0.3,  color: '#d9ef8b' },
    { val: 0.5,  color: '#91cf60' },
    { val: 0.8,  color: '#1a9850' }
  ],

  // LST color scale
  lstColors: [
    { val: 20, color: '#313695' },
    { val: 25, color: '#4575b4' },
    { val: 30, color: '#abd9e9' },
    { val: 35, color: '#fee090' },
    { val: 40, color: '#fdae61' },
    { val: 45, color: '#f46d43' },
    { val: 50, color: '#a50026' }
  ],

  // Point radius on map (px)
  pointRadius: 6
};

// ============================================================
// STATE
// ============================================================

const state = {
  map: null,
  layers: {
    ndvi: null,
    lst: null,
    hotspots: null,
    priority: null
  },
  data: {
    ndvi: null,
    lst: null,
    hotspots: null,
    statistics: null
  },
  charts: {
    scatter: null,
    bar: null
  }
};

// ============================================================
// UTILITIES
// ============================================================

/**
 * Interpolate between colors based on value
 */
function getColorForValue(value, colorScale) {
  if (value <= colorScale[0].val) return colorScale[0].color;
  if (value >= colorScale[colorScale.length - 1].val) return colorScale[colorScale.length - 1].color;

  for (let i = 0; i < colorScale.length - 1; i++) {
    if (value >= colorScale[i].val && value <= colorScale[i + 1].val) {
      const t = (value - colorScale[i].val) / (colorScale[i + 1].val - colorScale[i].val);
      return lerpColor(colorScale[i].color, colorScale[i + 1].color, t);
    }
  }
  return colorScale[colorScale.length - 1].color;
}

/**
 * Linear interpolation between two hex colors
 */
function lerpColor(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);

  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);

  return '#' + [rr, rg, rb].map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Safely fetch JSON/GeoJSON, returning null on failure
 */
async function safeFetch(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.warn(`Could not load ${url}:`, e.message);
    return null;
  }
}

// ============================================================
// MAP INITIALIZATION
// ============================================================

function initMap() {
  state.map = L.map('map', {
    center: CONFIG.defaultCenter,
    zoom: CONFIG.defaultZoom,
    zoomControl: true
  });

  // Base layers
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  });

  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri — Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19
  });

  osmLayer.addTo(state.map);

  // Base layer control
  L.control.layers({
    'Street Map': osmLayer,
    'Satellite': satelliteLayer
  }, {}, { position: 'topright', collapsed: true }).addTo(state.map);
}

// ============================================================
// NDVI LAYER
// ============================================================

function createNDVILayer(geojson) {
  return L.geoJSON(geojson, {
    pointToLayer: function (feature, latlng) {
      const ndvi = feature.properties.ndvi ?? feature.properties.NDVI ?? 0;
      return L.circleMarker(latlng, {
        radius: CONFIG.pointRadius,
        fillColor: getColorForValue(ndvi, CONFIG.ndviColors),
        fillOpacity: 0.8,
        color: '#fff',
        weight: 0.5
      });
    },
    onEachFeature: function (feature, layer) {
      const ndvi = feature.properties.ndvi ?? feature.properties.NDVI ?? 0;
      let category = 'Unknown';
      if (ndvi < 0) category = 'Water / Non-vegetated';
      else if (ndvi < 0.1) category = 'Bare soil / Built-up';
      else if (ndvi < 0.2) category = 'Very low vegetation';
      else if (ndvi < 0.3) category = 'Low vegetation';
      else if (ndvi < 0.5) category = 'Moderate vegetation';
      else category = 'Dense vegetation';

      layer.bindPopup(`
        <strong>NDVI</strong><br>
        Value: <b>${ndvi.toFixed(3)}</b><br>
        Category: ${category}
      `);
    }
  });
}

// ============================================================
// LST LAYER
// ============================================================

function createLSTLayer(geojson) {
  return L.geoJSON(geojson, {
    pointToLayer: function (feature, latlng) {
      const lst = feature.properties.lst ?? feature.properties.LST ?? 30;
      return L.circleMarker(latlng, {
        radius: CONFIG.pointRadius,
        fillColor: getColorForValue(lst, CONFIG.lstColors),
        fillOpacity: 0.8,
        color: '#fff',
        weight: 0.5
      });
    },
    onEachFeature: function (feature, layer) {
      const lst = feature.properties.lst ?? feature.properties.LST ?? 0;
      layer.bindPopup(`
        <strong>Land Surface Temperature</strong><br>
        Temperature: <b>${lst.toFixed(1)} °C</b><br>
        <em style="font-size:0.8em; color:#888;">Note: Surface temperature ≠ air temperature</em>
      `);
    }
  });
}

// ============================================================
// HOTSPOT LAYER
// ============================================================

function createHotspotLayer(geojson) {
  return L.geoJSON(geojson, {
    pointToLayer: function (feature, latlng) {
      return L.circleMarker(latlng, {
        radius: CONFIG.pointRadius + 2,
        fillColor: '#d32f2f',
        fillOpacity: 0.7,
        color: '#b71c1c',
        weight: 1.5
      });
    },
    style: function (feature) {
      // For polygon features
      return {
        fillColor: '#d32f2f',
        fillOpacity: 0.4,
        color: '#b71c1c',
        weight: 2
      };
    },
    onEachFeature: function (feature, layer) {
      const lst = feature.properties.lst ?? feature.properties.LST ?? null;
      const extra = lst ? `<br>LST: <b>${parseFloat(lst).toFixed(1)} °C</b>` : '';
      layer.bindPopup(`<strong>🔥 Heat Hotspot</strong>${extra}`);
    }
  });
}

// ============================================================
// PRIORITY GREENING LAYER
// ============================================================

function createPriorityLayer(geojson) {
  // Priority areas exported from GEE already contain only
  // locations with high LST + low NDVI. Each feature has
  // properties: priority, ndvi, lst.
  if (!geojson.features || geojson.features.length === 0) return null;

  return L.geoJSON(geojson, {
    pointToLayer: function (feature, latlng) {
      return L.circleMarker(latlng, {
        radius: CONFIG.pointRadius + 1,
        fillColor: '#ff6f00',
        fillOpacity: 0.7,
        color: '#e65100',
        weight: 1.5
      });
    },
    style: function () {
      return {
        fillColor: '#ff6f00',
        fillOpacity: 0.4,
        color: '#e65100',
        weight: 2
      };
    },
    onEachFeature: function (feature, layer) {
      const ndvi = feature.properties.ndvi ?? feature.properties.NDVI;
      const lst = feature.properties.lst ?? feature.properties.LST;
      let details = '<strong>🏗️ Priority Greening Area</strong><br>';
      details += '<em>Analytical priority for further urban-greening investigation</em>';
      if (ndvi !== undefined && ndvi !== null) {
        details += `<br>NDVI: <b>${parseFloat(ndvi).toFixed(3)}</b>`;
      }
      if (lst !== undefined && lst !== null) {
        details += `<br>LST: <b>${parseFloat(lst).toFixed(1)} °C</b>`;
      }
      layer.bindPopup(details);
    }
  });
}

// ============================================================
// STATISTICS
// ============================================================

function updateStatistics(stats) {
  if (stats && stats.data_available !== false) {
    const ndviMean = stats.ndvi_mean;
    const lstMean = stats.lst_mean;

    if (ndviMean !== null && ndviMean !== undefined) {
      document.getElementById('stat-ndvi').textContent = parseFloat(ndviMean).toFixed(3);
    }
    if (lstMean !== null && lstMean !== undefined) {
      document.getElementById('stat-lst').textContent = parseFloat(lstMean).toFixed(1) + '°C';
    }
    if (stats.hotspot_threshold !== null && stats.hotspot_threshold !== undefined) {
      document.getElementById('stat-hotspots').textContent = '>' + parseFloat(stats.hotspot_threshold).toFixed(1) + '°C';
      document.querySelector('#stat-hotspots').closest('.stat-card').querySelector('.stat-sub').textContent =
        `p${stats.hotspot_percentile_used || 85} threshold`;
    }
    if (stats.low_ndvi_threshold !== null && stats.low_ndvi_threshold !== undefined) {
      document.getElementById('stat-priority').textContent = '<' + stats.low_ndvi_threshold;
      document.querySelector('#stat-priority').closest('.stat-card').querySelector('.stat-sub').textContent =
        'NDVI threshold for low vegetation';
    }

    // Study info
    if (stats.study_period_start && stats.study_period_end) {
      const info = document.getElementById('study-info');
      const areaName = stats.study_area_name || 'Not specified';
      info.innerHTML = `
        <strong>Area:</strong> ${areaName}<br>
        <strong>Period:</strong> ${stats.study_period_start} to ${stats.study_period_end}<br>
        <strong>Scenes:</strong> ${stats.total_scenes ?? 'N/A'}<br>
        <strong>Grid:</strong> ${stats.grid_scale_meters ?? 'N/A'}m
      `;
    }
  }
}

function updateStatsFromData() {
  // Calculate stats from loaded GeoJSON if statistics.json isn't populated
  let hotspotCount = 0;
  let priorityCount = 0;
  let ndviValues = [];
  let lstValues = [];

  if (state.data.ndvi) {
    state.data.ndvi.features.forEach(f => {
      const v = f.properties.ndvi ?? f.properties.NDVI;
      if (v !== null && v !== undefined) ndviValues.push(v);
    });
  }

  if (state.data.lst) {
    state.data.lst.features.forEach(f => {
      const v = f.properties.lst ?? f.properties.LST;
      if (v !== null && v !== undefined) lstValues.push(v);
    });
  }

  if (state.data.hotspots) {
    hotspotCount = state.data.hotspots.features.length;
  }

  // Update stat cards from actual data
  if (ndviValues.length > 0) {
    const avg = ndviValues.reduce((a, b) => a + b, 0) / ndviValues.length;
    document.getElementById('stat-ndvi').textContent = avg.toFixed(3);
  }
  if (lstValues.length > 0) {
    const avg = lstValues.reduce((a, b) => a + b, 0) / lstValues.length;
    document.getElementById('stat-lst').textContent = avg.toFixed(1) + '°C';
  }
  if (hotspotCount > 0) {
    document.getElementById('stat-hotspots').textContent = hotspotCount;
    document.querySelector('#stat-hotspots').closest('.stat-card').querySelector('.stat-sub').textContent =
      'detected hotspot points';
  }

  // Count low-veg areas from NDVI data
  const lowVeg = ndviValues.filter(v => v < 0.2).length;
  if (lowVeg > 0) {
    document.getElementById('stat-priority').textContent = lowVeg;
    document.querySelector('#stat-priority').closest('.stat-card').querySelector('.stat-sub').textContent =
      'points with NDVI < 0.2';
  }
}

// ============================================================
// CHARTS
// ============================================================

function createScatterChart() {
  if (!state.data.ndvi || !state.data.lst) return;

  // Build paired data from NDVI and LST points
  // If they share coordinates, pair them; otherwise use combined data
  const ndviMap = new Map();
  state.data.ndvi.features.forEach(f => {
    const coords = f.geometry.coordinates;
    const key = coords[0].toFixed(5) + ',' + coords[1].toFixed(5);
    ndviMap.set(key, f.properties.ndvi ?? f.properties.NDVI);
  });

  const pairs = [];
  state.data.lst.features.forEach(f => {
    const coords = f.geometry.coordinates;
    const key = coords[0].toFixed(5) + ',' + coords[1].toFixed(5);
    const ndvi = ndviMap.get(key);
    const lst = f.properties.lst ?? f.properties.LST;
    if (ndvi !== undefined && lst !== undefined) {
      pairs.push({ x: ndvi, y: lst });
    }
  });

  if (pairs.length === 0) return;

  // Hide placeholder, show canvas
  document.getElementById('scatter-placeholder').style.display = 'none';
  document.getElementById('scatter-canvas').style.display = 'block';

  // Calculate correlation
  const n = pairs.length;
  const sumX = pairs.reduce((s, p) => s + p.x, 0);
  const sumY = pairs.reduce((s, p) => s + p.y, 0);
  const sumXY = pairs.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pairs.reduce((s, p) => s + p.x * p.x, 0);
  const sumY2 = pairs.reduce((s, p) => s + p.y * p.y, 0);
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const r = denominator !== 0 ? numerator / denominator : 0;

  const ctx = document.getElementById('scatter-canvas').getContext('2d');

  // Color each point by its NDVI value
  const pointColors = pairs.map(p => getColorForValue(p.x, CONFIG.ndviColors));

  state.charts.scatter = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'NDVI vs LST',
        data: pairs,
        backgroundColor: pointColors,
        borderColor: 'rgba(0,0,0,0.1)',
        borderWidth: 0.5,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `Pearson r = ${r.toFixed(3)} (n=${n})`,
          font: { size: 13 }
        },
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              const p = context.raw;
              return `NDVI: ${p.x.toFixed(3)}, LST: ${p.y.toFixed(1)}°C`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'NDVI', font: { weight: 'bold' } },
          min: -0.1,
          max: 0.8
        },
        y: {
          title: { display: true, text: 'LST (°C)', font: { weight: 'bold' } }
        }
      }
    }
  });
}

function createBarChart() {
  if (!state.data.lst) return;

  const lstValues = state.data.lst.features
    .map(f => f.properties.lst ?? f.properties.LST)
    .filter(v => v !== null && v !== undefined);

  if (lstValues.length === 0) return;

  // Create histogram bins
  const minLST = Math.floor(Math.min(...lstValues));
  const maxLST = Math.ceil(Math.max(...lstValues));
  const binSize = 2; // 2°C bins
  const bins = [];
  const labels = [];

  for (let t = minLST; t < maxLST; t += binSize) {
    bins.push(0);
    labels.push(`${t}–${t + binSize}`);
  }

  lstValues.forEach(v => {
    const idx = Math.min(Math.floor((v - minLST) / binSize), bins.length - 1);
    if (idx >= 0 && idx < bins.length) bins[idx]++;
  });

  // Hide placeholder, show canvas
  document.getElementById('bar-placeholder').style.display = 'none';
  document.getElementById('bar-canvas').style.display = 'block';

  const ctx = document.getElementById('bar-canvas').getContext('2d');

  // Color bars by temperature
  const barColors = labels.map((_, i) => {
    const midTemp = minLST + i * binSize + binSize / 2;
    return getColorForValue(midTemp, CONFIG.lstColors);
  });

  state.charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Number of Points',
        data: bins,
        backgroundColor: barColors,
        borderColor: 'rgba(0,0,0,0.1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `LST Distribution (n=${lstValues.length})`,
          font: { size: 13 }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Temperature Range (°C)', font: { weight: 'bold' } }
        },
        y: {
          title: { display: true, text: 'Count', font: { weight: 'bold' } },
          beginAtZero: true
        }
      }
    }
  });
}

// ============================================================
// LAYER TOGGLE CONTROLS
// ============================================================

function setupLayerToggles() {
  const toggles = {
    'layer-ndvi': 'ndvi',
    'layer-lst': 'lst',
    'layer-hotspots': 'hotspots',
    'layer-priority': 'priority'
  };

  Object.entries(toggles).forEach(([checkboxId, layerKey]) => {
    const cb = document.getElementById(checkboxId);
    if (!cb) return;

    cb.addEventListener('change', () => {
      const layer = state.layers[layerKey];
      if (!layer) return;

      if (cb.checked) {
        layer.addTo(state.map);
      } else {
        state.map.removeLayer(layer);
      }
    });
  });
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadAllData() {
  const badge = document.getElementById('badge-text');
  const spinner = document.getElementById('badge-spinner');
  spinner.style.display = 'inline-block';
  badge.textContent = 'Loading data…';

  // Fetch all data files in parallel
  const [ndviData, lstData, hotspotsData, statsData] = await Promise.all([
    safeFetch(CONFIG.dataFiles.ndvi),
    safeFetch(CONFIG.dataFiles.lst),
    safeFetch(CONFIG.dataFiles.hotspots),
    safeFetch(CONFIG.dataFiles.statistics)
  ]);

  state.data.ndvi = ndviData;
  state.data.lst = lstData;
  state.data.hotspots = hotspotsData;
  state.data.statistics = statsData;

  let layersLoaded = 0;
  let bounds = null;

  // Create NDVI layer
  if (ndviData && ndviData.features && ndviData.features.length > 0) {
    state.layers.ndvi = createNDVILayer(ndviData);
    state.layers.ndvi.addTo(state.map);
    bounds = state.layers.ndvi.getBounds();
    layersLoaded++;
    document.getElementById('layer-ndvi').checked = true;
  }

  // Create LST layer
  if (lstData && lstData.features && lstData.features.length > 0) {
    state.layers.lst = createLSTLayer(lstData);
    // Don't add LST by default if NDVI is showing (overlap)
    if (!state.layers.ndvi) {
      state.layers.lst.addTo(state.map);
    } else {
      document.getElementById('layer-lst').checked = false;
    }
    if (!bounds) bounds = state.layers.lst.getBounds();
    else bounds.extend(state.layers.lst.getBounds());
    layersLoaded++;
  }

  // Create hotspots layer
  if (hotspotsData && hotspotsData.features && hotspotsData.features.length > 0) {
    state.layers.hotspots = createHotspotLayer(hotspotsData);
    state.layers.hotspots.addTo(state.map);
    if (!bounds) bounds = state.layers.hotspots.getBounds();
    else bounds.extend(state.layers.hotspots.getBounds());
    layersLoaded++;
    document.getElementById('layer-hotspots').checked = true;
  }

  // Try to create priority layer from hotspots data or separate file
  // First try a separate priority file
  const priorityData = await safeFetch('data/priority_areas.geojson');
  if (priorityData && priorityData.features && priorityData.features.length > 0) {
    state.layers.priority = createPriorityLayer(priorityData);
    if (state.layers.priority) {
      // Don't add by default
      document.getElementById('layer-priority').checked = false;
      layersLoaded++;
    }
  }

  // Fit map to data bounds
  if (bounds && bounds.isValid()) {
    state.map.fitBounds(bounds, { padding: [30, 30] });
  }

  // Update statistics
  if (statsData) {
    updateStatistics(statsData);
  }
  if (ndviData || lstData || hotspotsData) {
    updateStatsFromData();
  }

  // Create charts
  createScatterChart();
  createBarChart();

  // Update badge
  spinner.style.display = 'none';
  if (layersLoaded > 0) {
    badge.textContent = `${layersLoaded} layer${layersLoaded > 1 ? 's' : ''} loaded ✓`;
    document.getElementById('data-badge').classList.add('loaded');
  } else {
    badge.textContent = 'Awaiting data';
    document.getElementById('data-badge').classList.add('pending');
  }
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Hide chart canvases initially (show placeholders)
  document.getElementById('scatter-canvas').style.display = 'none';
  document.getElementById('bar-canvas').style.display = 'none';

  // Initialize map
  initMap();

  // Setup layer toggle handlers
  setupLayerToggles();

  // Load data
  loadAllData();
});
