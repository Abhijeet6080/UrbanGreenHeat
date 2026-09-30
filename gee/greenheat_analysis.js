/*
 * ============================================================
 * GreenHeat — Google Earth Engine Analysis Script
 * Urban Heat & Green Cover Intelligence
 * ============================================================
 *
 * PURPOSE:
 *   Generates NDVI, LST, heat hotspots, and priority greening
 *   areas from Landsat 8/9 Collection 2 Level-2 data.
 *
 * DATA SOURCE:
 *   USGS Landsat 8/9 Collection 2, Level-2 Surface Reflectance
 *   and Surface Temperature products.
 *
 * HOW TO USE:
 *   1. Open Google Earth Engine Code Editor (code.earthengine.google.com)
 *   2. Paste this script
 *   3. Define your study area (see STEP 1 below)
 *   4. Adjust the date range if needed
 *   5. Click "Run"
 *   6. Export the results via the Tasks tab
 *   7. Download the exported GeoJSON files
 *   8. Place them in the data/ folder of the web application
 *
 * OUTPUTS:
 *   - ndvi.geojson    → NDVI grid with vegetation index values
 *   - lst.geojson     → Land Surface Temperature grid (°C)
 *   - hotspots.geojson → Heat hotspot areas
 *   - statistics.json  → Summary statistics
 *
 * ============================================================
 */

// ============================================================
// STEP 1: DEFINE STUDY AREA
// ============================================================
// Option A: Use a point and buffer (simple)
// Change the coordinates to your city of interest.
// The buffer creates a rectangular study area around the point.

var cityCenter = ee.Geometry.Point([77.5946, 12.9716]); // Bangalore, India
var studyArea = cityCenter.buffer(15000).bounds(); // 15 km buffer

// Option B: Draw a geometry in the GEE Code Editor
// 1. Use the drawing tools (top-left of the map)
// 2. Draw a rectangle or polygon over your study area
// 3. It will appear as a variable called "geometry"
// 4. Uncomment the line below and comment out the lines above:
// var studyArea = geometry;

// Option C: Use an administrative boundary from a GEE FeatureCollection
// var studyArea = ee.FeatureCollection('FAO/GAUL/2015/level2')
//   .filter(ee.Filter.eq('ADM2_NAME', 'Bangalore Urban'))
//   .geometry();

Map.centerObject(studyArea, 12);
Map.addLayer(studyArea, {color: 'blue'}, 'Study Area', true, 0.3);

// ============================================================
// STEP 2: CONFIGURATION
// ============================================================

var START_DATE = '2024-01-01';
var END_DATE   = '2024-06-30';
var CLOUD_COVER_MAX = 30; // Maximum cloud cover percentage

// Grid size for sampling (in meters)
// Smaller = more detail but larger files / longer processing
var GRID_SCALE = 500;

// Hotspot detection: percentile-based threshold
// Areas above this percentile of LST are flagged as hotspots
var HOTSPOT_PERCENTILE = 85;

// Low vegetation threshold (NDVI below this is considered low)
var LOW_NDVI_THRESHOLD = 0.2;

print('=== GreenHeat Analysis ===' );
print('Study period:', START_DATE, 'to', END_DATE);

// ============================================================
// STEP 3: CLOUD MASKING FUNCTION
// ============================================================
// Landsat Collection 2 Level-2 uses the QA_PIXEL band for
// cloud and cloud-shadow masking.

function maskL8L9clouds(image) {
  // Bit 3: Cloud, Bit 4: Cloud Shadow
  var qaBand = image.select('QA_PIXEL');
  var cloudBit = 1 << 3;
  var shadowBit = 1 << 4;
  var mask = qaBand.bitwiseAnd(cloudBit).eq(0)
    .and(qaBand.bitwiseAnd(shadowBit).eq(0));
  return image.updateMask(mask);
}

// ============================================================
// STEP 4: LOAD AND PROCESS LANDSAT IMAGERY
// ============================================================

// Load Landsat 8 Collection 2 Level-2
var landsat8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(studyArea)
  .filterDate(START_DATE, END_DATE)
  .filter(ee.Filter.lt('CLOUD_COVER', CLOUD_COVER_MAX))
  .map(maskL8L9clouds);

// Load Landsat 9 Collection 2 Level-2
var landsat9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
  .filterBounds(studyArea)
  .filterDate(START_DATE, END_DATE)
  .filter(ee.Filter.lt('CLOUD_COVER', CLOUD_COVER_MAX))
  .map(maskL8L9clouds);

// Merge both collections
var landsatCol = landsat8.merge(landsat9);

print('Total scenes after filtering:', landsatCol.size());

// ============================================================
// STEP 5: CALCULATE NDVI
// ============================================================
// NDVI = (NIR - Red) / (NIR + Red)
// Landsat 8/9 Collection 2 Level-2 Surface Reflectance:
//   Band 4 (SR_B4) = Red
//   Band 5 (SR_B5) = NIR
// Scaling factor: multiply by 0.0000275, add -0.2

function addNDVI(image) {
  // Apply scaling factors to surface reflectance bands
  var red = image.select('SR_B4').multiply(0.0000275).add(-0.2);
  var nir = image.select('SR_B5').multiply(0.0000275).add(-0.2);
  var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');
  return image.addBands(ndvi);
}

var withNDVI = landsatCol.map(addNDVI);
var ndviComposite = withNDVI.select('NDVI').median().clip(studyArea);

print('NDVI composite generated');

// ============================================================
// STEP 6: EXTRACT LAND SURFACE TEMPERATURE
// ============================================================
// Landsat Collection 2 Level-2 Surface Temperature:
//   Band: ST_B10
//   Scaling factor: multiply by 0.00341802, add 149.0
//   Result is in Kelvin → subtract 273.15 for Celsius

function addLST(image) {
  var lstKelvin = image.select('ST_B10').multiply(0.00341802).add(149.0);
  var lstCelsius = lstKelvin.subtract(273.15).rename('LST');
  return image.addBands(lstCelsius);
}

var withLST = landsatCol.map(addLST);
var lstComposite = withLST.select('LST').median().clip(studyArea);

print('LST composite generated');

// ============================================================
// STEP 7: COMPUTE STATISTICS
// ============================================================

var ndviStats = ndviComposite.reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }).combine({
    reducer2: ee.Reducer.minMax(),
    sharedInputs: true
  }),
  geometry: studyArea,
  scale: 30,
  maxPixels: 1e9
});

var lstStats = lstComposite.reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }).combine({
    reducer2: ee.Reducer.minMax(),
    sharedInputs: true
  }).combine({
    reducer2: ee.Reducer.percentile([HOTSPOT_PERCENTILE]),
    sharedInputs: true
  }),
  geometry: studyArea,
  scale: 30,
  maxPixels: 1e9
});

print('NDVI Statistics:', ndviStats);
print('LST Statistics:', lstStats);

// ============================================================
// STEP 8: IDENTIFY HEAT HOTSPOTS
// ============================================================
// Methodology: Percentile-based hotspot detection
// Areas where LST exceeds the Nth percentile of the study
// area's temperature distribution are classified as hotspots.

var lstPercentile = ee.Number(lstStats.get('LST_p' + HOTSPOT_PERCENTILE));
print('Hotspot threshold (°C, p' + HOTSPOT_PERCENTILE + '):', lstPercentile);

var hotspotMask = lstComposite.gte(lstPercentile);
var hotspots = hotspotMask.selfMask().rename('hotspot');

// ============================================================
// STEP 9: IDENTIFY PRIORITY GREENING AREAS
// ============================================================
// Priority areas: high LST AND low NDVI
// These are locations that are both hot and lack vegetation,
// making them analytical candidates for urban greening.

var lowVeg = ndviComposite.lt(LOW_NDVI_THRESHOLD);
var highHeat = lstComposite.gte(lstPercentile);
var priorityAreas = lowVeg.and(highHeat).selfMask().rename('priority');

// ============================================================
// STEP 10: VISUALIZE ON MAP
// ============================================================

var ndviVis = {
  min: -0.1,
  max: 0.8,
  palette: ['#d73027','#fc8d59','#fee08b','#d9ef8b','#91cf60','#1a9850']
};

var lstVis = {
  min: 20,
  max: 50,
  palette: ['#313695','#4575b4','#74add1','#abd9e9','#fee090','#fdae61','#f46d43','#d73027','#a50026']
};

Map.addLayer(ndviComposite, ndviVis, 'NDVI');
Map.addLayer(lstComposite, lstVis, 'Land Surface Temperature (°C)');
Map.addLayer(hotspots, {palette: ['#ff0000']}, 'Heat Hotspots', true, 0.6);
Map.addLayer(priorityAreas, {palette: ['#ff6f00']}, 'Priority Greening Areas', true, 0.6);

// ============================================================
// STEP 11: SAMPLE DATA FOR EXPORT
// ============================================================
// Create a grid of sample points for export to GeoJSON.
// This converts the raster data to point features that
// the web dashboard can display.

// Combined NDVI + LST image for sampling
var combined = ndviComposite.addBands(lstComposite);

// Sample points across the study area
var samplePoints = combined.sample({
  region: studyArea,
  scale: GRID_SCALE,
  numPixels: 2000,
  seed: 42,
  geometries: true
});

print('Sample points:', samplePoints.size());

// Split into separate feature collections for each data layer
var ndviPoints = samplePoints.map(function(f) {
  return f.set('ndvi', f.get('NDVI')).select(['ndvi']);
});

var lstPoints = samplePoints.map(function(f) {
  return f.set('lst', f.get('LST')).select(['lst']);
});

// Hotspot points (sample only hotspot areas)
var hotspotPoints = hotspots.sample({
  region: studyArea,
  scale: GRID_SCALE,
  numPixels: 500,
  seed: 42,
  geometries: true
});

// Priority greening area points
var priorityPoints = priorityAreas.sample({
  region: studyArea,
  scale: GRID_SCALE,
  numPixels: 500,
  seed: 42,
  geometries: true
});

// ============================================================
// STEP 12: EXPORT RESULTS
// ============================================================
// Run these exports from the Tasks tab in the GEE Code Editor.
// After export completes, download the files from Google Drive
// and place them in the data/ folder of the web application.

// Export NDVI points
Export.table.toDrive({
  collection: ndviPoints,
  description: 'greenheat_ndvi',
  fileFormat: 'GeoJSON',
  folder: 'GreenHeat'
});

// Export LST points
Export.table.toDrive({
  collection: lstPoints,
  description: 'greenheat_lst',
  fileFormat: 'GeoJSON',
  folder: 'GreenHeat'
});

// Export hotspot points
Export.table.toDrive({
  collection: hotspotPoints,
  description: 'greenheat_hotspots',
  fileFormat: 'GeoJSON',
  folder: 'GreenHeat'
});

// Export priority greening areas
Export.table.toDrive({
  collection: priorityPoints,
  description: 'greenheat_priority',
  fileFormat: 'GeoJSON',
  folder: 'GreenHeat'
});

// Export combined data for scatter plot (NDVI vs LST)
// This creates a simple table for the chart
var scatterData = samplePoints.map(function(f) {
  return f.select(['NDVI', 'LST']);
});

Export.table.toDrive({
  collection: scatterData,
  description: 'greenheat_scatter',
  fileFormat: 'CSV',
  folder: 'GreenHeat'
});

// ============================================================
// STEP 13: EXPORT STATISTICS AS A FEATURE (for statistics.json)
// ============================================================
// This exports key stats. After download, you may need to
// extract the properties into a simple JSON structure.

var statsFeature = ee.Feature(null, {
  ndvi_mean: ndviStats.get('NDVI_mean'),
  ndvi_stddev: ndviStats.get('NDVI_stdDev'),
  ndvi_min: ndviStats.get('NDVI_min'),
  ndvi_max: ndviStats.get('NDVI_max'),
  lst_mean: lstStats.get('LST_mean'),
  lst_stddev: lstStats.get('LST_stdDev'),
  lst_min: lstStats.get('LST_min'),
  lst_max: lstStats.get('LST_max'),
  hotspot_threshold: lstPercentile,
  total_scenes: landsatCol.size(),
  study_period_start: START_DATE,
  study_period_end: END_DATE,
  hotspot_percentile_used: HOTSPOT_PERCENTILE,
  low_ndvi_threshold: LOW_NDVI_THRESHOLD,
  grid_scale_meters: GRID_SCALE
});

Export.table.toDrive({
  collection: ee.FeatureCollection([statsFeature]),
  description: 'greenheat_statistics',
  fileFormat: 'GeoJSON',
  folder: 'GreenHeat'
});

print('=== Exports ready ===');
print('Go to the Tasks tab (top-right) and click RUN on each export task.');
print('Files will be saved to your Google Drive in the GreenHeat folder.');

// ============================================================
// NOTES
// ============================================================
// 
// After exporting:
// 1. Download files from Google Drive > GreenHeat folder
// 2. Rename them:
//    - greenheat_ndvi.geojson     → data/ndvi.geojson
//    - greenheat_lst.geojson      → data/lst.geojson  
//    - greenheat_hotspots.geojson → data/hotspots.geojson
//    - greenheat_priority.geojson → (merge into hotspots or keep separate)
//    - greenheat_statistics.geojson → extract properties → data/statistics.json
//    - greenheat_scatter.csv      → data/scatter_data.csv (or convert to JSON)
//
// 3. For statistics.json, extract the properties from the GeoJSON:
//    The exported GeoJSON has features[0].properties — copy those
//    properties into a clean JSON file.
//
// 4. Place all files in the data/ folder of the web application
// 5. Open the web application to see the data on the map
// ============================================================
