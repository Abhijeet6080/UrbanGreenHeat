# 🌿 GreenHeat — Urban Heat & Green Cover Intelligence

**Satellite-based analysis of vegetation and land-surface temperature**

![Status](https://img.shields.io/badge/status-active-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Tech](https://img.shields.io/badge/tech-Leaflet%20%7C%20GEE%20%7C%20Chart.js-green)

---

## 🔥 Problem Statement

**Urban Heat Island and Green Cover Relationship**

Urban areas experience significantly higher temperatures compared to their rural surroundings — a phenomenon known as the Urban Heat Island (UHI) effect. This project investigates whether the lack of vegetation contributes to higher land surface temperatures and identifies priority areas for urban greening interventions.

## 🎯 Project Objective

Use satellite remote sensing data to:
1. Map vegetation density (NDVI) across an urban area
2. Map land surface temperature (LST)
3. Identify urban heat hotspots
4. Analyze the relationship between vegetation and surface temperature
5. Identify priority areas for urban greening interventions

## 📍 Study Area

**Kattankulathur, Chengalpattu district, Tamil Nadu, India**

The analysis covers the Kattankulathur urban/semi-urban area including the SRMIST campus and surrounding regions.

| Parameter | Value |
|-----------|-------|
| Latitude range | 12.80°N – 12.86°N |
| Longitude range | 80.00°E – 80.08°E |
| Approximate area | ~6 km × ~7 km |
| Dataset | Landsat 8/9 Collection 2 Level-2 |
| Period | 2025 (configurable) |

> **Note:** The analysis extent is not an official administrative boundary. It is the rectangular bounding box chosen for the GreenHeat project analysis.

## ✨ Features

- **Interactive Map** — Leaflet-based map with multiple data layers
- **NDVI Visualization** — Vegetation density mapped from satellite imagery
- **LST Visualization** — Land surface temperature heatmap
- **Heat Hotspot Detection** — Percentile-based hotspot identification
- **Priority Greening Areas** — Locations with high heat + low vegetation
- **NDVI vs LST Chart** — Scatter plot showing vegetation-temperature relationship
- **Statistics Dashboard** — Key metrics at a glance
- **Responsive Design** — Works on desktop and mobile
- **Methodology Documentation** — Full transparency on data processing

## 🛠 Technology Stack

| Component | Technology |
|-----------|------------|
| Satellite Analysis | Google Earth Engine |
| Satellite Data | USGS Landsat 8/9 Collection 2 Level-2 |
| Frontend | HTML5 + CSS3 + JavaScript |
| Mapping | Leaflet.js |
| Charts | Chart.js |
| Data Format | GeoJSON, CSV, JSON |
| GIS Validation | QGIS |
| Hosting | Vercel / GitHub Pages |
| Source Control | GitHub |

## 📡 Methodology

```
Satellite Imagery (Landsat 8/9)
        ↓
Cloud / Cloud-Shadow Masking (QA_PIXEL band)
        ↓
NDVI Calculation (NIR - Red) / (NIR + Red)
        ↓
LST Extraction (ST_B10 band, scaled to °C)
        ↓
Median Composite (reduces noise)
        ↓
Hotspot Detection (percentile-based threshold)
        ↓
NDVI–LST Relationship Analysis
        ↓
Priority Greening Areas (high LST + low NDVI)
```

### NDVI (Normalized Difference Vegetation Index)
- **Formula:** `NDVI = (NIR − Red) / (NIR + Red)`
- **Bands:** SR_B5 (NIR), SR_B4 (Red)
- **Scaling:** multiply by 0.0000275, add −0.2
- **Range:** −1 to +1 (higher = more vegetation)

### Land Surface Temperature (LST)
- **Band:** ST_B10
- **Scaling:** multiply by 0.00341802, add 149.0 (gives Kelvin)
- **Conversion:** subtract 273.15 for Celsius
- **Note:** LST ≠ air temperature; it measures the radiative surface temperature

### Hotspot Detection
- **Method:** Percentile-based classification
- **Default threshold:** 90th percentile of LST distribution within the study area
- **Rationale:** Identifies the warmest ~10% of the study area as hotspots
- **Note:** This is a relative (study-area-specific) threshold, not a universal scientific cutoff. The percentile is configurable in the GEE script.

## 📁 Project Structure

```
urban-green-heat/
│
├── index.html              # Main dashboard page
├── style.css               # Stylesheet
├── script.js               # Application logic
│
├── data/                   # Exported analysis results
│   ├── ndvi.geojson        # NDVI sample points
│   ├── lst.geojson         # LST sample points
│   ├── hotspots.geojson    # Heat hotspot locations
│   ├── priority_areas.geojson # Priority greening areas
│   └── statistics.json     # Summary statistics
│
├── gee/                    # Google Earth Engine scripts
│   └── greenheat_analysis.js
│
├── qgis/                   # QGIS project files (if any)
│
├── assets/                 # Images and media
│
├── README.md               # This file
└── .gitignore              # Git ignore rules
```

## 📊 Data Sources

| Source | Usage |
|--------|-------|
| [USGS Landsat 8/9](https://www.usgs.gov/landsat-missions) | Surface reflectance & surface temperature |
| [Google Earth Engine](https://earthengine.google.com/) | Satellite data processing platform |
| [OpenStreetMap](https://www.openstreetmap.org/) | Base map tiles |

## 🚀 How to Run Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/urban-green-heat.git
   cd urban-green-heat
   ```

2. **Serve locally** (any simple HTTP server):
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Or use VS Code Live Server extension
   ```

3. **Open in browser:**
   ```
   http://localhost:8000
   ```

### To generate your own data:

1. Open [Google Earth Engine Code Editor](https://code.earthengine.google.com/)
2. Paste the contents of `gee/greenheat_analysis.js`
3. Modify the study area coordinates for your city
4. Click **Run**
5. Go to the **Tasks** tab and run each export
6. Download files from Google Drive
7. Place them in the `data/` folder

## 🌐 How to Deploy

### Vercel (Recommended)
1. Push to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Deploy (zero configuration needed for static sites)

### GitHub Pages (Alternative)
1. Push to GitHub
2. Go to repository Settings → Pages
3. Select source branch (main) and root folder
4. Save

## ⚠️ Limitations

- LST represents land **surface** temperature, not air temperature
- Cloud cover may limit data availability in some regions/seasons
- Spatial resolution limited by Landsat (30m reflectance, 100m thermal)
- NDVI thresholds may need adjustment for different climatic regions
- Single time-period analysis; does not capture seasonal variation
- Hotspot detection uses statistical thresholds, not absolute temperature limits

## 🔮 Future Improvements

- [ ] Multi-temporal analysis (seasonal comparison)
- [ ] Integration with demographic/socioeconomic data
- [ ] Higher-resolution imagery (e.g., Sentinel-2 for NDVI)
- [ ] Air quality correlation analysis
- [ ] Automated data pipeline using Earth Engine Apps
- [ ] 3D building data integration for canyon effect analysis
- [ ] Cost-benefit analysis for greening interventions

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

## 👥 Team

Solo developer project — University Geospatial Hackathon 2026

---

*Built with 🌍 satellite data and 💚 for urban sustainability*
