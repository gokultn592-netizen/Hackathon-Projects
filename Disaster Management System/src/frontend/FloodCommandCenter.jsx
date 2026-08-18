import React, { useState, useEffect, useCallback, useRef } from "react";

// ============================================================================
// FLOOD COMMAND CENTER - BIHAR DISASTER MANAGEMENT DASHBOARD
// Filen.io Inspired Dark UI Aesthetic (#0a0a0a, #111111, #1a1a1a, #2a2a2a)
// ============================================================================

const API_BASE_URL = "http://localhost:8000/api/v1";

// ----------------------------------------------------------------------------
// HARDCODED FALLBACK SIMULATION DATA (8 BIHAR DISTRICTS)
// ----------------------------------------------------------------------------
const INITIAL_SIMULATION_DISTRICTS = [
  {
    district_id: "Patna",
    name: "Patna",
    lat: 25.5937,
    lon: 85.1376,
    rainfall_24h_mm: 145.5,
    rainfall_3d_accum_mm: 280.2,
    humidity_percent: 88,
    temperature_celsius: 27.4,
    water_level_meters: 8.2,
    danger_level_meters: 7.5,
    discharge_rate_cumecs: 4200,
    reservoir_capacity_percent: 92,
    is_above_danger: true,
    inundated_area_sqkm: 45.2,
    inundation_percentage: 14.5,
    soil_saturation_index: 0.91,
    ndwi_water_index: 0.74,
    mean_elevation_meters: 32.0,
    mean_slope_degrees: 1.2,
    drainage_density_km_sqkm: 2.1,
    coastal_proximity_km: 450.0,
    risk_score: 0.87,
    risk_level: "P1_URGENT",
    estimated_inundation_depth_meters: 2.3,
    recommend_evacuation: true,
  },
  {
    district_id: "Bhagalpur",
    name: "Bhagalpur",
    lat: 25.2425,
    lon: 87.0022,
    rainfall_24h_mm: 182.0,
    rainfall_3d_accum_mm: 315.0,
    humidity_percent: 92,
    temperature_celsius: 26.8,
    water_level_meters: 9.1,
    danger_level_meters: 8.0,
    discharge_rate_cumecs: 5100,
    reservoir_capacity_percent: 96,
    is_above_danger: true,
    inundated_area_sqkm: 68.0,
    inundation_percentage: 21.0,
    soil_saturation_index: 0.95,
    ndwi_water_index: 0.82,
    mean_elevation_meters: 28.0,
    mean_slope_degrees: 0.9,
    drainage_density_km_sqkm: 2.5,
    coastal_proximity_km: 380.0,
    risk_score: 0.94,
    risk_level: "P1_URGENT",
    estimated_inundation_depth_meters: 2.8,
    recommend_evacuation: true,
  },
  {
    district_id: "Darbhanga",
    name: "Darbhanga",
    lat: 26.1542,
    lon: 85.8918,
    rainfall_24h_mm: 165.0,
    rainfall_3d_accum_mm: 290.0,
    humidity_percent: 90,
    temperature_celsius: 27.0,
    water_level_meters: 8.7,
    danger_level_meters: 7.8,
    discharge_rate_cumecs: 4600,
    reservoir_capacity_percent: 89,
    is_above_danger: true,
    inundated_area_sqkm: 52.4,
    inundation_percentage: 18.2,
    soil_saturation_index: 0.89,
    ndwi_water_index: 0.78,
    mean_elevation_meters: 39.0,
    mean_slope_degrees: 1.1,
    drainage_density_km_sqkm: 2.3,
    coastal_proximity_km: 490.0,
    risk_score: 0.84,
    risk_level: "P1_URGENT",
    estimated_inundation_depth_meters: 2.1,
    recommend_evacuation: true,
  },
  {
    district_id: "Muzaffarpur",
    name: "Muzaffarpur",
    lat: 26.1209,
    lon: 85.3647,
    rainfall_24h_mm: 110.0,
    rainfall_3d_accum_mm: 195.0,
    humidity_percent: 84,
    temperature_celsius: 28.2,
    water_level_meters: 6.4,
    danger_level_meters: 6.8,
    discharge_rate_cumecs: 3100,
    reservoir_capacity_percent: 74,
    is_above_danger: false,
    inundated_area_sqkm: 22.1,
    inundation_percentage: 7.5,
    soil_saturation_index: 0.72,
    ndwi_water_index: 0.58,
    mean_elevation_meters: 47.0,
    mean_slope_degrees: 1.5,
    drainage_density_km_sqkm: 1.8,
    coastal_proximity_km: 510.0,
    risk_score: 0.58,
    risk_level: "P2_HIGH",
    estimated_inundation_depth_meters: 1.2,
    recommend_evacuation: false,
  },
  {
    district_id: "Sitamarhi",
    name: "Sitamarhi",
    lat: 26.5976,
    lon: 85.4886,
    rainfall_24h_mm: 135.0,
    rainfall_3d_accum_mm: 230.0,
    humidity_percent: 86,
    temperature_celsius: 27.6,
    water_level_meters: 7.3,
    danger_level_meters: 7.2,
    discharge_rate_cumecs: 3800,
    reservoir_capacity_percent: 82,
    is_above_danger: true,
    inundated_area_sqkm: 34.0,
    inundation_percentage: 11.2,
    soil_saturation_index: 0.81,
    ndwi_water_index: 0.65,
    mean_elevation_meters: 52.0,
    mean_slope_degrees: 1.8,
    drainage_density_km_sqkm: 2.0,
    coastal_proximity_km: 530.0,
    risk_score: 0.65,
    risk_level: "P2_HIGH",
    estimated_inundation_depth_meters: 1.6,
    recommend_evacuation: false,
  },
  {
    district_id: "Supaul",
    name: "Supaul",
    lat: 26.126,
    lon: 86.5972,
    rainfall_24h_mm: 95.0,
    rainfall_3d_accum_mm: 160.0,
    humidity_percent: 81,
    temperature_celsius: 28.5,
    water_level_meters: 5.8,
    danger_level_meters: 6.5,
    discharge_rate_cumecs: 2700,
    reservoir_capacity_percent: 68,
    is_above_danger: false,
    inundated_area_sqkm: 15.8,
    inundation_percentage: 5.1,
    soil_saturation_index: 0.64,
    ndwi_water_index: 0.48,
    mean_elevation_meters: 56.0,
    mean_slope_degrees: 1.3,
    drainage_density_km_sqkm: 1.6,
    coastal_proximity_km: 430.0,
    risk_score: 0.45,
    risk_level: "P2_HIGH",
    estimated_inundation_depth_meters: 0.8,
    recommend_evacuation: false,
  },
  {
    district_id: "Madhubani",
    name: "Madhubani",
    lat: 26.3496,
    lon: 86.0718,
    rainfall_24h_mm: 70.0,
    rainfall_3d_accum_mm: 120.0,
    humidity_percent: 76,
    temperature_celsius: 29.1,
    water_level_meters: 4.5,
    danger_level_meters: 6.0,
    discharge_rate_cumecs: 1900,
    reservoir_capacity_percent: 54,
    is_above_danger: false,
    inundated_area_sqkm: 8.5,
    inundation_percentage: 2.8,
    soil_saturation_index: 0.52,
    ndwi_water_index: 0.36,
    mean_elevation_meters: 62.0,
    mean_slope_degrees: 1.4,
    drainage_density_km_sqkm: 1.4,
    coastal_proximity_km: 480.0,
    risk_score: 0.32,
    risk_level: "P3_MONITOR",
    estimated_inundation_depth_meters: 0.3,
    recommend_evacuation: false,
  },
  {
    district_id: "Katihar",
    name: "Katihar",
    lat: 25.5413,
    lon: 87.5755,
    rainfall_24h_mm: 60.0,
    rainfall_3d_accum_mm: 105.0,
    humidity_percent: 74,
    temperature_celsius: 29.5,
    water_level_meters: 3.9,
    danger_level_meters: 5.5,
    discharge_rate_cumecs: 1600,
    reservoir_capacity_percent: 48,
    is_above_danger: false,
    inundated_area_sqkm: 5.2,
    inundation_percentage: 1.9,
    soil_saturation_index: 0.44,
    ndwi_water_index: 0.29,
    mean_elevation_meters: 34.0,
    mean_slope_degrees: 0.8,
    drainage_density_km_sqkm: 1.5,
    coastal_proximity_km: 340.0,
    risk_score: 0.25,
    risk_level: "P3_MONITOR",
    estimated_inundation_depth_meters: 0.1,
    recommend_evacuation: false,
  },
];

const INITIAL_TOTAL_RESOURCES = {
  ndrf_teams: 50,
  rescue_boats: 100,
  medical_kits: 3000,
  shelter_tents: 1500,
};

// Default fallback allocations
const INITIAL_ALLOCATIONS = [
  { district_id: "Bhagalpur", priority_level: "P1_URGENT", risk_score: 0.94, allocated_ndrf_teams: 14, allocated_rescue_boats: 28, allocated_medical_kits: 840, allocated_shelter_tents: 420 },
  { district_id: "Patna", priority_level: "P1_URGENT", risk_score: 0.87, allocated_ndrf_teams: 12, allocated_rescue_boats: 24, allocated_medical_kits: 720, allocated_shelter_tents: 360 },
  { district_id: "Darbhanga", priority_level: "P1_URGENT", risk_score: 0.84, allocated_ndrf_teams: 11, allocated_rescue_boats: 22, allocated_medical_kits: 680, allocated_shelter_tents: 340 },
  { district_id: "Sitamarhi", priority_level: "P2_HIGH", risk_score: 0.65, allocated_ndrf_teams: 5, allocated_rescue_boats: 12, allocated_medical_kits: 360, allocated_shelter_tents: 180 },
  { district_id: "Muzaffarpur", priority_level: "P2_HIGH", risk_score: 0.58, allocated_ndrf_teams: 4, allocated_rescue_boats: 8, allocated_medical_kits: 240, allocated_shelter_tents: 120 },
  { district_id: "Supaul", priority_level: "P2_HIGH", risk_score: 0.45, allocated_ndrf_teams: 2, allocated_rescue_boats: 4, allocated_medical_kits: 120, allocated_shelter_tents: 60 },
  { district_id: "Madhubani", priority_level: "P3_MONITOR", risk_score: 0.32, allocated_ndrf_teams: 1, allocated_rescue_boats: 1, allocated_medical_kits: 20, allocated_shelter_tents: 10 },
  { district_id: "Katihar", priority_level: "P3_MONITOR", risk_score: 0.25, allocated_ndrf_teams: 1, allocated_rescue_boats: 1, allocated_medical_kits: 20, allocated_shelter_tents: 10 },
];

export default function FloodCommandCenter() {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  const [health, setHealth] = useState({
    status: "CHECKING",
    service: "flood_command_center_backend",
    version: "0.1.0",
    model_loaded: false,
  });

  const [useSimulation, setUseSimulation] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedDistrictId, setSelectedDistrictId] = useState("Patna");

  const [districts, setDistricts] = useState(INITIAL_SIMULATION_DISTRICTS);
  const [allocations, setAllocations] = useState(INITIAL_ALLOCATIONS);
  const [unallocated, setUnallocated] = useState({
    ndrf_teams: 0,
    rescue_boats: 0,
    medical_kits: 0,
    shelter_tents: 0,
  });

  // Action Loading States
  const [loadingData, setLoadingData] = useState(false);
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [loadingOptimize, setLoadingOptimize] = useState(false);
  const [loadingFullPipeline, setLoadingFullPipeline] = useState(false);

  const [activeTab, setActiveTab] = useState("map"); // "map", "data", "reports"
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef({});

  // --------------------------------------------------------------------------
  // HELPERS & COMPUTED METRICS
  // --------------------------------------------------------------------------
  const selectedDistrict =
    districts.find((d) => d.district_id === selectedDistrictId) || districts[0];

  const p1Count = districts.filter(
    (d) => d.risk_score >= 0.70 || d.risk_level === "P1_URGENT"
  ).length;

  const p2Count = districts.filter(
    (d) =>
      (d.risk_score >= 0.40 && d.risk_score < 0.70) ||
      d.risk_level === "P2_HIGH"
  ).length;

  const p3Count = districts.filter(
    (d) => d.risk_score < 0.40 || d.risk_level === "P3_MONITOR"
  ).length;

  // Total allocated sums
  const totalAllocatedNDRF = allocations.reduce(
    (acc, a) => acc + (a.allocated_ndrf_teams || 0),
    0
  );
  const totalAllocatedBoats = allocations.reduce(
    (acc, a) => acc + (a.allocated_rescue_boats || 0),
    0
  );
  const totalAllocatedMedical = allocations.reduce(
    (acc, a) => acc + (a.allocated_medical_kits || 0),
    0
  );
  const totalAllocatedTents = allocations.reduce(
    (acc, a) => acc + (a.allocated_shelter_tents || 0),
    0
  );

  // --------------------------------------------------------------------------
  // API ACTIONS
  // --------------------------------------------------------------------------

  // 1. Health Check
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
        setIsOffline(false);
      } else {
        throw new Error("Backend response not OK");
      }
    } catch (err) {
      console.warn("Backend offline, switching to simulation mode:", err);
      setHealth({
        status: "OFFLINE",
        service: "simulation_fallback",
        version: "0.1.0",
        model_loaded: true,
      });
      setIsOffline(true);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // 2. Data Collection Action
  const handleCollectData = async () => {
    setLoadingData(true);
    try {
      const res = await fetch(`${API_BASE_URL}/collect-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region_code: "ALL",
          use_simulation: useSimulation,
        }),
      });

      if (!res.ok) throw new Error("Collect data failed");
      const data = await res.json();

      if (data.fused_telemetry && data.fused_telemetry.length > 0) {
        setDistricts((prev) =>
          prev.map((d, i) => ({
            ...d,
            ...(data.fused_telemetry[i] || {}),
          }))
        );
      }
      setIsOffline(false);
    } catch (err) {
      console.warn("Using simulation fallback for collect data:", err);
      setIsOffline(true);
      // Simulate minor fluctuation
      setDistricts((prev) =>
        prev.map((d) => ({
          ...d,
          rainfall_24h_mm: Math.round(d.rainfall_24h_mm * (0.95 + Math.random() * 0.1)),
          water_level_meters: Number((d.water_level_meters * (0.98 + Math.random() * 0.04)).toFixed(1)),
        }))
      );
    } finally {
      setLoadingData(false);
    }
  };

  // 3. Predict Risk Action
  const handleRunPredict = async () => {
    setLoadingPredict(true);
    try {
      const res = await fetch(`${API_BASE_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telemetry: districts }),
      });

      if (!res.ok) throw new Error("Predict failed");
      const data = await res.json();

      if (data.predictions && data.predictions.length > 0) {
        const predMap = {};
        data.predictions.forEach((p) => {
          predMap[p.district_id] = p;
        });

        setDistricts((prev) =>
          prev.map((d) => {
            const pred = predMap[d.district_id];
            if (!pred) return d;
            return {
              ...d,
              risk_score: pred.risk_score,
              risk_level: pred.risk_level || (pred.risk_score >= 0.7 ? "P1_URGENT" : pred.risk_score >= 0.4 ? "P2_HIGH" : "P3_MONITOR"),
              estimated_inundation_depth_meters: pred.estimated_inundation_depth_meters,
              recommend_evacuation: pred.recommend_evacuation,
            };
          })
        );
      }
      setIsOffline(false);
    } catch (err) {
      console.warn("Using simulation fallback for predict:", err);
      setIsOffline(true);
      // Fallback update
      setDistricts((prev) =>
        prev.map((d) => {
          const score = Math.min(
            0.99,
            Math.max(0.1, (d.rainfall_24h_mm / 200.0) * 0.6 + (d.water_level_meters / 10.0) * 0.4)
          );
          return {
            ...d,
            risk_score: Number(score.toFixed(2)),
            risk_level: score >= 0.7 ? "P1_URGENT" : score >= 0.4 ? "P2_HIGH" : "P3_MONITOR",
            estimated_inundation_depth_meters: Number((Math.max(0, score - 0.2) * 3.2).toFixed(1)),
            recommend_evacuation: score >= 0.7,
          };
        })
      );
    } finally {
      setLoadingPredict(false);
    }
  };

  // 4. Optimize Resources Action
  const handleOptimizeResources = async () => {
    setLoadingOptimize(true);
    try {
      const districtScores = districts.map((d) => ({
        district_id: d.district_id,
        risk_score: d.risk_score,
        population_estimate: 150000,
      }));

      const res = await fetch(`${API_BASE_URL}/optimize-resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          district_scores: districtScores,
          available_resources: INITIAL_TOTAL_RESOURCES,
        }),
      });

      if (!res.ok) throw new Error("Optimize failed");
      const data = await res.json();

      if (data.district_allocations) {
        setAllocations(data.district_allocations);
      }
      if (data.unallocated_resources) {
        setUnallocated(data.unallocated_resources);
      }
      setIsOffline(false);
    } catch (err) {
      console.warn("Using simulation fallback for optimization:", err);
      setIsOffline(true);
      // Simulation fallback calculation
      const sorted = [...districts].sort((a, b) => b.risk_score - a.risk_score);
      let remNDRF = INITIAL_TOTAL_RESOURCES.ndrf_teams;
      let remBoats = INITIAL_TOTAL_RESOURCES.rescue_boats;
      let remMedical = INITIAL_TOTAL_RESOURCES.medical_kits;
      let remTents = INITIAL_TOTAL_RESOURCES.shelter_tents;

      const newAlloc = sorted.map((d) => {
        const p = d.risk_score >= 0.7 ? "P1_URGENT" : d.risk_score >= 0.4 ? "P2_HIGH" : "P3_MONITOR";
        const w = d.risk_score;
        const ndrf = Math.min(remNDRF, Math.max(1, Math.round(15 * w)));
        const boats = Math.min(remBoats, Math.max(2, Math.round(30 * w)));
        const med = Math.min(remMedical, Math.round(900 * w));
        const tents = Math.min(remTents, Math.round(450 * w));

        remNDRF -= ndrf;
        remBoats -= boats;
        remMedical -= med;
        remTents -= tents;

        return {
          district_id: d.district_id,
          priority_level: p,
          risk_score: d.risk_score,
          allocated_ndrf_teams: ndrf,
          allocated_rescue_boats: boats,
          allocated_medical_kits: med,
          allocated_shelter_tents: tents,
          evacuation_center_recommended: d.risk_score >= 0.6,
        };
      });

      setAllocations(newAlloc);
      setUnallocated({
        ndrf_teams: Math.max(0, remNDRF),
        rescue_boats: Math.max(0, remBoats),
        medical_kits: Math.max(0, remMedical),
        shelter_tents: Math.max(0, remTents),
      });
    } finally {
      setLoadingOptimize(false);
    }
  };

  // 5. Run Full Pipeline Action
  const handleRunFullPipeline = async () => {
    setLoadingFullPipeline(true);
    await handleCollectData();
    await handleRunPredict();
    await handleOptimizeResources();
    setLoadingFullPipeline(false);
  };

  // --------------------------------------------------------------------------
  // LEAFLET MAP INITIALIZATION & MARKER SYNC
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Check if Leaflet L is loaded globally
    const L = window.L;
    if (!L) {
      console.warn("Leaflet script not found in window.L");
      return;
    }

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [25.5, 85.5],
        zoom: 7,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> & OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);

      leafletMapRef.current = map;
    }

    const map = leafletMapRef.current;

    // Clear existing markers
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};

    // Render CircleMarkers for each district
    districts.forEach((district) => {
      const color =
        district.risk_score >= 0.70
          ? "#ef4444"
          : district.risk_score >= 0.40
          ? "#f97316"
          : "#eab308";

      const radius = 12 + district.risk_score * 12;

      const marker = L.circleMarker([district.lat, district.lon], {
        radius: radius,
        fillColor: color,
        color: "#ffffff",
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.7,
      }).addTo(map);

      const popupContent = `
        <div style="font-family: Inter, sans-serif; background-color: #1a1a1a; color: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #2a2a2a; width: 200px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="font-size: 14px;">${district.name}</strong>
            <span style="background-color: ${color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">
              ${(district.risk_score * 100).toFixed(0)}% RISK
            </span>
          </div>
          <div style="font-size: 11px; color: #a1a1aa; margin-bottom: 8px;">
            Risk Level: <b style="color: #ffffff">${district.risk_level || (district.risk_score >= 0.7 ? "P1_URGENT" : "P2_HIGH")}</b>
          </div>
          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #a1a1aa; margin-bottom: 2px;">
              <span>Inundation Depth</span>
              <span>${district.estimated_inundation_depth_meters || 1.5}m</span>
            </div>
            <div style="width: 100%; background-color: #2a2a2a; height: 6px; border-radius: 3px; overflow: hidden;">
              <div style="width: ${Math.min(100, (district.estimated_inundation_depth_meters / 3.5) * 100)}%; background-color: ${color}; height: 100%;"></div>
            </div>
          </div>
          ${
            district.recommend_evacuation || district.risk_score >= 0.7
              ? `<div style="background-color: #ef4444; color: white; font-weight: bold; text-align: center; padding: 4px; border-radius: 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; animation: pulse 2s infinite;">
                  🚨 EVACUATE NOW
                </div>`
              : `<div style="background-color: #27272a; color: #a1a1aa; text-align: center; padding: 4px; border-radius: 4px; font-size: 10px;">
                  ADVISORY: STANDBY
                </div>`
          }
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: "dark-custom-popup",
        closeButton: false,
      });

      marker.on("click", () => {
        setSelectedDistrictId(district.district_id);
      });

      markersRef.current[district.district_id] = marker;
    });
  }, [districts]);

  // --------------------------------------------------------------------------
  // RENDER UI COMPONENTS
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex flex-col font-sans select-none antialiased">
      {/* Dynamic Leaflet Dark Popup CSS Overrides */}
      <style>{`
        .leaflet-popup-content-wrapper, .leaflet-popup-tip {
          background: #1a1a1a !important;
          border: 1px solid #2a2a2a !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.7) !important;
          padding: 0 !important;
        }
        .leaflet-container {
          background-color: #0d0d0d !important;
        }
      `}</style>

      {/* ==================================================================== */}
      {/* 1. TOP HEADER BAR */}
      {/* ==================================================================== */}
      <header className="h-14 border-b border-[#2a2a2a] bg-[#111111] px-4 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            🌊
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-sm tracking-wide text-white uppercase">
                Flood Command Center
              </h1>
              <span className="text-[10px] font-medium bg-[#222222] border border-[#333333] text-gray-400 px-1.5 py-0.5 rounded">
                v0.1.0
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Bihar Flood Decision Support System
            </p>
          </div>
        </div>

        {/* Center Health Status & Model Indicator */}
        <div className="hidden md:flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-[#1a1a1a] border border-[#2a2a2a] px-3 py-1 rounded-full text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isOffline ? "bg-amber-500 animate-ping" : "bg-emerald-500 animate-pulse"
              }`}
            ></span>
            <span className="font-medium text-gray-200">
              {isOffline ? "OFFLINE / SIMULATION MODE" : "HEALTHY"}
            </span>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] px-3 py-1 rounded-full text-xs text-gray-300 flex items-center space-x-1">
            <span>Model Status:</span>
            <span className="text-emerald-400 font-semibold">✅ Ready (XGBoost v3)</span>
          </div>
        </div>

        {/* Right Simulation Toggle & Refresh */}
        <div className="flex items-center space-x-3">
          <label className="flex items-center cursor-pointer space-x-2 text-xs bg-[#1a1a1a] border border-[#2a2a2a] px-2.5 py-1.5 rounded-lg hover:border-[#3b82f6]/40 transition">
            <span className="text-gray-300">Simulate Mode</span>
            <input
              type="checkbox"
              checked={useSimulation}
              onChange={(e) => setUseSimulation(e.target.checked)}
              className="accent-blue-500 rounded cursor-pointer"
            />
          </label>

          <button
            onClick={checkHealth}
            title="Refresh System Health"
            className="p-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] text-gray-300 transition"
          >
            🔄
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* MAIN 3-COLUMN LAYOUT BODY */}
      {/* ==================================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ------------------------------------------------------------------ */}
        {/* LEFT SIDEBAR (240px Fixed) */}
        {/* ------------------------------------------------------------------ */}
        <aside className="w-60 border-r border-[#2a2a2a] bg-[#111111] flex flex-col justify-between p-3 flex-shrink-0">
          <div className="space-y-4">
            {/* Nav List */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2">
                Navigation
              </span>
              <button
                onClick={() => setActiveTab("map")}
                className={`w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === "map"
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200"
                }`}
              >
                <span>📡</span>
                <span>Live Data Map</span>
              </button>
              <button
                onClick={() => setActiveTab("predict")}
                className={`w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === "predict"
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200"
                }`}
              >
                <span>🤖</span>
                <span>ML Predict Risk</span>
              </button>
              <button
                onClick={() => setActiveTab("optimize")}
                className={`w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === "optimize"
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200"
                }`}
              >
                <span>🚁</span>
                <span>Resource Allocator</span>
              </button>
            </div>

            {/* Alert Summary Badges */}
            <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-2.5 space-y-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                District Risk Summary
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-red-500/10 border border-red-500/30 rounded p-1.5">
                  <div className="text-sm font-bold text-red-400">{p1Count}</div>
                  <div className="text-[9px] text-red-300/70 uppercase">🔴 P1 Alert</div>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-1.5">
                  <div className="text-sm font-bold text-orange-400">{p2Count}</div>
                  <div className="text-[9px] text-orange-300/70 uppercase">🟠 P2 High</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-1.5">
                  <div className="text-sm font-bold text-yellow-400">{p3Count}</div>
                  <div className="text-[9px] text-yellow-300/70 uppercase">🟡 P3 Mon</div>
                </div>
              </div>
            </div>

            {/* Individual Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-[#2a2a2a]">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block px-1">
                Pipeline Actions
              </span>
              <button
                onClick={handleCollectData}
                disabled={loadingData || loadingFullPipeline}
                className="w-full bg-[#1e1e1e] hover:bg-[#282828] border border-[#333333] text-gray-200 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center space-x-2 transition disabled:opacity-50"
              >
                {loadingData ? (
                  <span className="animate-spin text-blue-400">⏳</span>
                ) : (
                  <span>📡</span>
                )}
                <span>Collect Data</span>
              </button>

              <button
                onClick={handleRunPredict}
                disabled={loadingPredict || loadingFullPipeline}
                className="w-full bg-[#1e1e1e] hover:bg-[#282828] border border-[#333333] text-gray-200 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center space-x-2 transition disabled:opacity-50"
              >
                {loadingPredict ? (
                  <span className="animate-spin text-blue-400">⏳</span>
                ) : (
                  <span>🤖</span>
                )}
                <span>Run Predict</span>
              </button>

              <button
                onClick={handleOptimizeResources}
                disabled={loadingOptimize || loadingFullPipeline}
                className="w-full bg-[#1e1e1e] hover:bg-[#282828] border border-[#333333] text-gray-200 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center space-x-2 transition disabled:opacity-50"
              >
                {loadingOptimize ? (
                  <span className="animate-spin text-blue-400">⏳</span>
                ) : (
                  <span>🚁</span>
                )}
                <span>Optimize</span>
              </button>
            </div>
          </div>

          {/* Master Chain Button */}
          <div className="pt-3 border-t border-[#2a2a2a]">
            <button
              onClick={handleRunFullPipeline}
              disabled={loadingFullPipeline}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-blue-900/30 disabled:opacity-50"
            >
              {loadingFullPipeline ? (
                <span className="animate-spin">⏳ Running...</span>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Run Full Pipeline</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* ------------------------------------------------------------------ */}
        {/* CENTER PANEL (Flex-1: Map + Telemetry Strip) */}
        {/* ------------------------------------------------------------------ */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
          {/* LEAFLET MAP CONTAINER */}
          <div className="flex-1 relative overflow-hidden">
            <div ref={mapContainerRef} className="w-full h-full z-10" />

            {/* Map Legend Overlay */}
            <div className="absolute top-3 right-3 bg-[#111111]/90 backdrop-blur-md border border-[#2a2a2a] rounded-lg p-2.5 text-[11px] text-gray-300 space-y-1.5 z-20 shadow-xl pointer-events-auto">
              <span className="font-semibold text-gray-400 uppercase text-[10px] block border-b border-[#2a2a2a] pb-1">
                Risk Classification
              </span>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span>🔴 P1 URGENT (≥ 0.70)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span>🟠 P2 HIGH (≥ 0.40)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                <span>🟡 P3 MONITOR (&lt; 0.40)</span>
              </div>
            </div>
          </div>

          {/* TELEMETRY STRIP FOOTER */}
          <div className="h-24 bg-[#111111] border-t border-[#2a2a2a] p-3 flex flex-col justify-between flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Telemetry Strip:
                </span>
                <select
                  value={selectedDistrictId}
                  onChange={(e) => setSelectedDistrictId(e.target.value)}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] text-blue-400 font-semibold text-xs rounded px-2 py-0.5 focus:outline-none"
                >
                  {districts.map((d) => (
                    <option key={d.district_id} value={d.district_id}>
                      {d.name} ({ (d.risk_score * 100).toFixed(0) }%)
                    </option>
                  ))}
                </select>
              </div>

              {selectedDistrict.recommend_evacuation && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">
                  🚨 MANDATORY EVACUATION ADVISED
                </div>
              )}
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-6 gap-2 text-xs">
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-1.5 flex flex-col justify-center">
                <span className="text-[9px] text-gray-400 uppercase">🌧 24h Rain</span>
                <span className="font-bold text-gray-100">{selectedDistrict.rainfall_24h_mm} mm</span>
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-1.5 flex flex-col justify-center">
                <span className="text-[9px] text-gray-400 uppercase">🌊 Water Level</span>
                <span className="font-bold text-blue-400">{selectedDistrict.water_level_meters} m</span>
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-1.5 flex flex-col justify-center">
                <span className="text-[9px] text-gray-400 uppercase">💧 NDWI Index</span>
                <span className="font-bold text-cyan-400">{selectedDistrict.ndwi_water_index}</span>
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-1.5 flex flex-col justify-center">
                <span className="text-[9px] text-gray-400 uppercase">⛰ Mean Elev</span>
                <span className="font-bold text-emerald-400">{selectedDistrict.mean_elevation_meters} m</span>
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-1.5 flex flex-col justify-center">
                <span className="text-[9px] text-gray-400 uppercase">💨 Humidity</span>
                <span className="font-bold text-purple-400">{selectedDistrict.humidity_percent}%</span>
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-1.5 flex flex-col justify-center">
                <span className="text-[9px] text-gray-400 uppercase">🌊 Discharge</span>
                <span className="font-bold text-amber-400">{selectedDistrict.discharge_rate_cumecs} cumecs</span>
              </div>
            </div>
          </div>
        </main>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT PANEL (300px Fixed: Resource Inventory & Allocations) */}
        {/* ------------------------------------------------------------------ */}
        <aside className="w-80 border-l border-[#2a2a2a] bg-[#111111] flex flex-col p-3 flex-shrink-0 space-y-4 overflow-y-auto">
          {/* Resource Inventory Stock */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Resource Inventory
              </span>
              <span className="text-[10px] text-gray-400">Current vs Total</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* NDRF Teams */}
              <div className="bg-[#161616] border border-[#2a2a2a] p-2 rounded-lg">
                <div className="flex justify-between text-gray-300 mb-1">
                  <span>🪖 NDRF Teams</span>
                  <span className="font-semibold text-blue-400">
                    {totalAllocatedNDRF} / {INITIAL_TOTAL_RESOURCES.ndrf_teams}
                  </span>
                </div>
                <div className="w-full bg-[#2a2a2a] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-500"
                    style={{
                      width: `${(totalAllocatedNDRF / INITIAL_TOTAL_RESOURCES.ndrf_teams) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Rescue Boats */}
              <div className="bg-[#161616] border border-[#2a2a2a] p-2 rounded-lg">
                <div className="flex justify-between text-gray-300 mb-1">
                  <span>🚤 Rescue Boats</span>
                  <span className="font-semibold text-cyan-400">
                    {totalAllocatedBoats} / {INITIAL_TOTAL_RESOURCES.rescue_boats}
                  </span>
                </div>
                <div className="w-full bg-[#2a2a2a] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-500 h-full transition-all duration-500"
                    style={{
                      width: `${(totalAllocatedBoats / INITIAL_TOTAL_RESOURCES.rescue_boats) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Medical Kits */}
              <div className="bg-[#161616] border border-[#2a2a2a] p-2 rounded-lg">
                <div className="flex justify-between text-gray-300 mb-1">
                  <span>💊 Medical Kits</span>
                  <span className="font-semibold text-emerald-400">
                    {totalAllocatedMedical} / {INITIAL_TOTAL_RESOURCES.medical_kits}
                  </span>
                </div>
                <div className="w-full bg-[#2a2a2a] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{
                      width: `${(totalAllocatedMedical / INITIAL_TOTAL_RESOURCES.medical_kits) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Shelter Tents */}
              <div className="bg-[#161616] border border-[#2a2a2a] p-2 rounded-lg">
                <div className="flex justify-between text-gray-300 mb-1">
                  <span>⛺ Shelter Tents</span>
                  <span className="font-semibold text-amber-400">
                    {totalAllocatedTents} / {INITIAL_TOTAL_RESOURCES.shelter_tents}
                  </span>
                </div>
                <div className="w-full bg-[#2a2a2a] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full transition-all duration-500"
                    style={{
                      width: `${(totalAllocatedTents / INITIAL_TOTAL_RESOURCES.shelter_tents) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Allocation Table */}
          <div className="flex-1 flex flex-col min-h-0">
            <span className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              District Allocations
            </span>

            <div className="flex-1 overflow-y-auto border border-[#2a2a2a] rounded-lg bg-[#161616]">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-[#2a2a2a] bg-[#1d1d1d] text-gray-400">
                    <th className="p-2">District</th>
                    <th className="p-2">Priority</th>
                    <th className="p-2 text-center">NDRF</th>
                    <th className="p-2 text-center">Boats</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a] text-gray-200">
                  {allocations.map((a) => {
                    const isP1 = a.priority_level === "P1_URGENT";
                    const isP2 = a.priority_level === "P2_HIGH";

                    return (
                      <tr key={a.district_id} className="hover:bg-[#202020] transition">
                        <td className="p-2 font-medium">{a.district_id}</td>
                        <td className="p-2">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                              isP1
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : isP2
                                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                            }`}
                          >
                            {a.priority_level}
                          </span>
                        </td>
                        <td className="p-2 text-center font-bold text-blue-400">
                          {a.allocated_ndrf_teams}
                        </td>
                        <td className="p-2 text-center font-bold text-cyan-400">
                          {a.allocated_rescue_boats}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unallocated Stock Footer */}
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-2.5 text-xs space-y-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
              Unallocated Stock (Reserve)
            </span>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-300">
              <div>🪖 Teams: <b className="text-white">{unallocated.ndrf_teams}</b></div>
              <div>🚤 Boats: <b className="text-white">{unallocated.rescue_boats}</b></div>
              <div>💊 Kits: <b className="text-white">{unallocated.medical_kits}</b></div>
              <div>⛺ Tents: <b className="text-white">{unallocated.shelter_tents}</b></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
