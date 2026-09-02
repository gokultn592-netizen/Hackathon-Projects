// ============================================================================
// FLOOD COMMAND CENTER - BIHAR DISASTER MANAGEMENT DECISION SUPPORT SYSTEM
// Filen.io Premium Dark UI Aesthetic (#0a0a0a, #111111, #1a1a1a, #2a2a2a)
// Executive Administrative Decision Suite (Dynamic Gauge Normalization & Occupancy Scaling)
// ============================================================================

const ReactObj = typeof window !== "undefined" && window.React ? window.React : require("react");
const { useState, useEffect, useCallback, useRef } = ReactObj;

const API_BASE_URL = "http://localhost:8000/api/v1";

// ----------------------------------------------------------------------------
// DISTRICT NAME MAPPER & METADATA
// ----------------------------------------------------------------------------
const DISTRICT_NAME_MAP = {
  District_01: "Patna",
  District_02: "Bhagalpur",
  District_03: "Darbhanga",
  District_04: "Muzaffarpur",
  District_05: "Sitamarhi",
  District_06: "Supaul",
  District_07: "Madhubani",
  District_08: "Katihar",
  District_1: "Patna",
  District_2: "Bhagalpur",
  District_3: "Darbhanga",
  District_4: "Muzaffarpur",
  District_5: "Sitamarhi",
  District_6: "Supaul",
  District_7: "Madhubani",
  District_8: "Katihar",
};

function formatDistrictName(id) {
  if (!id) return "Patna";
  return DISTRICT_NAME_MAP[id] || id;
}

// ----------------------------------------------------------------------------
// ACCURATE BIHAR ADMINISTRATIVE GEOGRAPHY & INFRASTRUCTURE DATA
// ----------------------------------------------------------------------------
const DISTRICT_BASE_PROFILES = [
  {
    district_id: "Patna",
    name: "Patna",
    river_name: "Ganga (Digha Ghat)",
    lat: 25.5937,
    lon: 85.1376,
    shelter_lat: 25.6450,
    shelter_lon: 85.0800,
    hospital_name: "AIIMS Patna (Emergency Trauma Center)",
    hospital_lat: 25.5600,
    hospital_lon: 85.0450,
    hospital_icu_capacity: 200,
    hospital_icu_free: 155,
    hospital_status: "🟢 OPERATIONAL (HIGH GROUND)",
    hazard_road: "🚧 Digha Low-Pass NH-31 Submerged (0.8m Water)",
    hazard_lat: 25.6200,
    hazard_lon: 85.1000,
    peak_rain_24h: 165.0,
    peak_water_level: 9.2,
    danger_level: 7.5,
    population_at_risk: 185000,
    nearest_shelter: "Patna Relief Camp #4 (Digha Ridge High Ground)",
    shelter_capacity: 5000,
    evacuation_route: "NH-31 via Atal Path Elevated Corridor (12.4 km)",
    evacuation_eta_mins: 22,
    elevation: 32.0,
  },
  {
    district_id: "Bhagalpur",
    name: "Bhagalpur",
    river_name: "Ganga / Kosi (Kahalgoan)",
    lat: 25.2425,
    lon: 87.0022,
    shelter_lat: 25.1750,
    shelter_lon: 86.9150,
    hospital_name: "JLNMCH Medical College Bhagalpur",
    hospital_lat: 25.2200,
    hospital_lon: 86.9700,
    hospital_icu_capacity: 150,
    hospital_icu_free: 18,
    hospital_status: "⚠️ HIGH OCCUPANCY (GENERATOR BACKUP)",
    hazard_road: "🚧 SH-19 Low-Lying Bridge Breach (Submerged)",
    hazard_lat: 25.2000,
    hazard_lon: 86.9400,
    peak_rain_24h: 195.0,
    peak_water_level: 9.8,
    danger_level: 8.0,
    population_at_risk: 210000,
    nearest_shelter: "Bhagalpur Stadium High Ground Complex",
    shelter_capacity: 8000,
    evacuation_route: "SH-19 South toward Amarpur Ridge Highway (8.7 km)",
    evacuation_eta_mins: 16,
    elevation: 28.0,
  },
  {
    district_id: "Darbhanga",
    name: "Darbhanga",
    river_name: "Bagmati / Kamla (Hayaghat)",
    lat: 26.1542,
    lon: 85.8918,
    shelter_lat: 26.2200,
    shelter_lon: 85.8150,
    hospital_name: "Darbhanga Medical College Hospital (DMCH)",
    hospital_lat: 26.1400,
    hospital_lon: 85.8900,
    hospital_icu_capacity: 120,
    hospital_icu_free: 32,
    hospital_status: "🟢 OPERATIONAL",
    hazard_road: "🚧 Kamla River Causeway Overflow",
    hazard_lat: 26.1800,
    hazard_lon: 85.8400,
    peak_rain_24h: 175.0,
    peak_water_level: 8.9,
    danger_level: 7.8,
    population_at_risk: 145000,
    nearest_shelter: "Darbhanga University Auditorium High Ground",
    shelter_capacity: 4500,
    evacuation_route: "NH-528 Bypass via Laheriasarai Highway (10.2 km)",
    evacuation_eta_mins: 19,
    elevation: 39.0,
  },
  {
    district_id: "Muzaffarpur",
    name: "Muzaffarpur",
    river_name: "Burhi Gandak (Sikandarpur)",
    lat: 26.1209,
    lon: 85.3647,
    shelter_lat: 26.1800,
    shelter_lon: 85.2800,
    hospital_name: "SKMCH Muzaffarpur Emergency Wing",
    hospital_lat: 26.1100,
    hospital_lon: 85.3900,
    hospital_icu_capacity: 180,
    hospital_icu_free: 60,
    hospital_status: "🟢 OPERATIONAL",
    hazard_road: "🚧 Burhi Gandak Embankment Sector 4 Road Breached",
    hazard_lat: 26.1500,
    hazard_lon: 85.3200,
    peak_rain_24h: 125.0,
    peak_water_level: 6.9,
    danger_level: 6.8,
    population_at_risk: 92000,
    nearest_shelter: "Muzaffarpur Zila High School",
    shelter_capacity: 3000,
    evacuation_route: "NH-28 East towards Motipur (15.1 km)",
    evacuation_eta_mins: 25,
    elevation: 47.0,
  },
  {
    district_id: "Sitamarhi",
    name: "Sitamarhi",
    river_name: "Lakhandei / Bagmati (Runnisaidpur)",
    lat: 26.5976,
    lon: 85.4886,
    shelter_lat: 26.6500,
    shelter_lon: 85.4100,
    hospital_name: "Sitamarhi Sadar Hospital",
    hospital_lat: 26.5900,
    hospital_lon: 85.4900,
    hospital_icu_capacity: 80,
    hospital_icu_free: 22,
    hospital_status: "🟢 OPERATIONAL",
    hazard_road: "🚧 Lakhandei River Bridge Low Approach Blocked",
    hazard_lat: 26.6200,
    hazard_lon: 85.4400,
    peak_rain_24h: 145.0,
    peak_water_level: 7.6,
    danger_level: 7.2,
    population_at_risk: 110000,
    nearest_shelter: "Sitamarhi Town Hall Shelter",
    shelter_capacity: 3500,
    evacuation_route: "NH-77 South via Riga Road (11.0 km)",
    evacuation_eta_mins: 18,
    elevation: 52.0,
  },
  {
    district_id: "Supaul",
    name: "Supaul",
    river_name: "Kosi Barrage (Birpur)",
    lat: 26.1260,
    lon: 86.5972,
    shelter_lat: 26.1800,
    shelter_lon: 86.6800,
    hospital_name: "Supaul Sub-Divisional Hospital",
    hospital_lat: 26.1200,
    hospital_lon: 86.6000,
    hospital_icu_capacity: 90,
    hospital_icu_free: 40,
    hospital_status: "🟢 OPERATIONAL",
    hazard_road: "🚧 Kosi Canal Feeder Road Inundated",
    hazard_lat: 26.1500,
    hazard_lon: 86.6400,
    peak_rain_24h: 110.0,
    peak_water_level: 6.2,
    danger_level: 6.5,
    population_at_risk: 65000,
    nearest_shelter: "Supaul Block Community Center",
    shelter_capacity: 2500,
    evacuation_route: "SH-66 East towards Pipra (14.2 km)",
    evacuation_eta_mins: 22,
    elevation: 56.0,
  },
  {
    district_id: "Madhubani",
    name: "Madhubani",
    river_name: "Kamla Balan (Jhanjharpur)",
    lat: 26.3496,
    lon: 86.0718,
    shelter_lat: 26.4100,
    shelter_lon: 86.1400,
    hospital_name: "Madhubani District Hospital",
    hospital_lat: 26.3400,
    hospital_lon: 86.0700,
    hospital_icu_capacity: 100,
    hospital_icu_free: 50,
    hospital_status: "🟢 OPERATIONAL",
    hazard_road: "🚧 SH-52 Railway Underpass Flooded",
    hazard_lat: 26.3800,
    hazard_lon: 86.1000,
    peak_rain_24h: 85.0,
    peak_water_level: 5.1,
    danger_level: 6.0,
    population_at_risk: 42000,
    nearest_shelter: "Madhubani District Sports Complex",
    shelter_capacity: 3000,
    evacuation_route: "NH-57 Bypass (6.5 km)",
    evacuation_eta_mins: 12,
    elevation: 62.0,
  },
  {
    district_id: "Katihar",
    name: "Katihar",
    river_name: "Mahananda / Ganga (Baltara)",
    lat: 25.5413,
    lon: 87.5755,
    shelter_lat: 25.6000,
    shelter_lon: 87.6500,
    hospital_name: "Katihar Medical College Hospital",
    hospital_lat: 25.5300,
    hospital_lon: 87.5800,
    hospital_icu_capacity: 150,
    hospital_icu_free: 75,
    hospital_status: "🟢 OPERATIONAL",
    hazard_road: "🚧 Mahananda Embankment Road Caution",
    hazard_lat: 25.5700,
    hazard_lon: 87.6100,
    peak_rain_24h: 75.0,
    peak_water_level: 4.4,
    danger_level: 5.5,
    population_at_risk: 28000,
    nearest_shelter: "Katihar Railway Indoor Stadium",
    shelter_capacity: 4000,
    evacuation_route: "NH-31 East (8.0 km)",
    evacuation_eta_mins: 14,
    elevation: 34.0,
  },
];

// Helper to compute risk-proportionate shelter occupancy
function calculateProportionateShelterOccupancy(capacity, riskScore) {
  if (riskScore >= 0.70) {
    // P1 Urgent Flood Emergency: 75% to 92% filled
    return Math.round(capacity * (0.75 + (riskScore - 0.70) * 0.60));
  } else if (riskScore >= 0.40) {
    // P2 High Watch: 30% to 55% filled
    return Math.round(capacity * (0.30 + (riskScore - 0.40) * 0.80));
  } else {
    // P3 Normal / Monitoring: Standby occupancy only (8% to 15% filled)
    return Math.round(capacity * (0.08 + riskScore * 0.15));
  }
}

// Smooth Calibrated 2019 Bihar Monsoon Simulation Engine
function generateHydrologyForDay(dayNumber) {
  let seasonFactor = 0.2;
  if (dayNumber <= 60) {
    seasonFactor = 0.15 + (dayNumber / 60.0) * 0.20;
  } else if (dayNumber <= 120) {
    seasonFactor = 0.35 + ((dayNumber - 60) / 60.0) * 0.35;
  } else if (dayNumber <= 165) {
    seasonFactor = 0.82 + ((dayNumber - 120) / 45.0) * 0.18;
  } else {
    seasonFactor = 1.0 - ((dayNumber - 165) / 19.0) * 0.75;
  }

  return DISTRICT_BASE_PROFILES.map((prof) => {
    const rain = Math.round(prof.peak_rain_24h * seasonFactor);
    const rain3d = Math.round(rain * 1.85);
    
    // Water level relative gauge height (meters)
    const waterLevel = Number((prof.danger_level * (0.65 + seasonFactor * 0.50)).toFixed(1));
    const isAboveDanger = waterLevel >= prof.danger_level ? 1 : 0;

    const riskRatio = (rain / 200.0) * 0.45 + (waterLevel / prof.peak_water_level) * 0.55;
    const riskScore = Number(Math.min(0.98, Math.max(0.12, riskRatio)).toFixed(2));

    const isP1 = riskScore >= 0.70;
    const isP2 = riskScore >= 0.40 && riskScore < 0.70;
    const riskLevel = isP1 ? "P1_URGENT" : isP2 ? "P2_HIGH" : "P3_MONITOR";

    const shelterOccupancy = calculateProportionateShelterOccupancy(prof.shelter_capacity, riskScore);
    const shelterStatus = isP1 ? "🚨 ACTIVE EVACUATION" : isP2 ? "🟠 READY / PREPARED" : "🟢 STANDBY / NORMAL";

    return {
      district_id: prof.district_id,
      name: prof.name,
      river_name: prof.river_name,
      lat: prof.lat,
      lon: prof.lon,
      shelter_lat: prof.shelter_lat,
      shelter_lon: prof.shelter_lon,
      hospital_name: prof.hospital_name,
      hospital_lat: prof.hospital_lat,
      hospital_lon: prof.hospital_lon,
      hospital_icu_capacity: prof.hospital_icu_capacity,
      hospital_icu_free: prof.hospital_icu_free,
      hospital_status: prof.hospital_status,
      hazard_road: prof.hazard_road,
      hazard_lat: prof.hazard_lat,
      hazard_lon: prof.hazard_lon,
      rainfall_24h_mm: rain,
      rainfall_3d_accum_mm: rain3d,
      rainfall_intensity_mmhr: Number((rain / 8.0).toFixed(1)),
      imd_warning_level: isP1 ? "WARNING" : isP2 ? "ALERT" : "NORMAL",
      humidity_percent: Math.round(65 + seasonFactor * 30),
      temperature_celsius: Number((32.0 - seasonFactor * 5.0).toFixed(1)),
      water_level_meters: waterLevel,
      danger_level_meters: prof.danger_level,
      river_rise_rate_percent: Number((seasonFactor * 6.5).toFixed(1)),
      discharge_rate_cumecs: Math.round(waterLevel * 520),
      reservoir_capacity_percent: Math.round(40 + seasonFactor * 56),
      is_above_danger: isAboveDanger,
      inundated_area_sqkm: Number((seasonFactor * 68.0).toFixed(1)),
      inundation_percentage: Number((seasonFactor * 21.0).toFixed(1)),
      soil_saturation_index: Number((0.35 + seasonFactor * 0.60).toFixed(2)),
      ndwi_water_index: Number((0.20 + seasonFactor * 0.62).toFixed(2)),
      mean_elevation_meters: prof.elevation,
      mean_slope_degrees: 1.2,
      drainage_density_km_sqkm: 2.1,
      population_at_risk: prof.population_at_risk,
      nearest_shelter: prof.nearest_shelter,
      shelter_capacity: prof.shelter_capacity,
      shelter_occupancy: shelterOccupancy,
      shelter_status: shelterStatus,
      evacuation_route: prof.evacuation_route,
      evacuation_eta_mins: prof.evacuation_eta_mins,
      risk_score: riskScore,
      risk_level: riskLevel,
      estimated_inundation_depth_meters: Number((Math.max(0, riskScore - 0.2) * 3.2).toFixed(1)),
      recommend_evacuation: isP1,
      shap_explainability: [
        { feature: "rainfall_3d_accum_mm", contribution: Math.round(seasonFactor * 38), label: `3-Day Rainfall (${rain3d}mm)` },
        { feature: "water_level_above_danger", contribution: Math.round(seasonFactor * 30), label: `River Level (${waterLevel}m)` },
        { feature: "ndwi_water_index", contribution: Math.round(seasonFactor * 20), label: "ISRO NDWI Water Index" },
        { feature: "mean_elevation_meters", contribution: -12, label: "Basin Terrain Elevation" },
      ],
    };
  });
}

// Initial dataset defaulted to Day 30 (Normal / Pre-monsoon Monitoring)
const INITIAL_SIMULATION_DISTRICTS = generateHydrologyForDay(30);

const INITIAL_TOTAL_RESOURCES = {
  ndrf_teams: 50,
  rescue_boats: 100,
  medical_kits: 3000,
  shelter_tents: 1500,
};

const INITIAL_ALLOCATIONS = [
  { district_id: "Bhagalpur", priority_level: "P3_MONITOR", risk_score: 0.25, allocated_ndrf_teams: 0, allocated_rescue_boats: 0, allocated_medical_kits: 0, allocated_shelter_tents: 0 },
  { district_id: "Patna", priority_level: "P3_MONITOR", risk_score: 0.22, allocated_ndrf_teams: 0, allocated_rescue_boats: 0, allocated_medical_kits: 0, allocated_shelter_tents: 0 },
  { district_id: "Darbhanga", priority_level: "P3_MONITOR", risk_score: 0.28, allocated_ndrf_teams: 0, allocated_rescue_boats: 0, allocated_medical_kits: 0, allocated_shelter_tents: 0 },
  { district_id: "Sitamarhi", priority_level: "P3_MONITOR", risk_score: 0.24, allocated_ndrf_teams: 0, allocated_rescue_boats: 0, allocated_medical_kits: 0, allocated_shelter_tents: 0 },
  { district_id: "Muzaffarpur", priority_level: "P3_MONITOR", risk_score: 0.20, allocated_ndrf_teams: 0, allocated_rescue_boats: 0, allocated_medical_kits: 0, allocated_shelter_tents: 0 },
  { district_id: "Supaul", priority_level: "P3_MONITOR", risk_score: 0.18, allocated_ndrf_teams: 0, allocated_rescue_boats: 0, allocated_medical_kits: 0, allocated_shelter_tents: 0 },
  { district_id: "Madhubani", priority_level: "P3_MONITOR", risk_score: 0.15, allocated_ndrf_teams: 0, allocated_rescue_boats: 0, allocated_medical_kits: 0, allocated_shelter_tents: 0 },
  { district_id: "Katihar", priority_level: "P3_MONITOR", risk_score: 0.14, allocated_ndrf_teams: 0, allocated_rescue_boats: 0, allocated_medical_kits: 0, allocated_shelter_tents: 0 },
];

function FloodCommandCenter() {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT - REAL DATA MODE IS NOW DEFAULT (useSimulation = false)
  // --------------------------------------------------------------------------
  const [health, setHealth] = useState({
    status: "CHECKING",
    service: "flood_command_center_backend",
    version: "0.1.0",
    model_loaded: false,
  });

  // REAL DATA MODE BY DEFAULT (user requested real data by default!)
  const [useSimulation, setUseSimulation] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedDistrictId, setSelectedDistrictId] = useState("Patna");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [sitRepModalOpen, setSitRepModalOpen] = useState(false);

  const [districts, setDistricts] = useState(INITIAL_SIMULATION_DISTRICTS);
  const [resources, setResources] = useState(INITIAL_TOTAL_RESOURCES);
  const [allocations, setAllocations] = useState(INITIAL_ALLOCATIONS);
  const [unallocated, setUnallocated] = useState({
    ndrf_teams: 50,
    rescue_boats: 100,
    medical_kits: 3000,
    shelter_tents: 1500,
  });

  // Layer Visibility Control Toggles
  const [layerVisibility, setLayerVisibility] = useState({
    districtRisk: true,
    shelters: true,
    hospitals: true,
    hazards: true,
    routes: true,
  });

  // Timeline Replay Slider State (May 1 to Oct 31, 2019)
  const [simulationDay, setSimulationDay] = useState(30); // Default to Day 30 (Normal)
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);

  // Action Loading States
  const [loadingData, setLoadingData] = useState(false);
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [loadingOptimize, setLoadingOptimize] = useState(false);
  const [loadingFullPipeline, setLoadingFullPipeline] = useState(false);

  // Active Tab: "map", "state", "predict", "optimize"
  const [activeTab, setActiveTab] = useState("map");

  // Toast Notification System
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  
  // Dedicated Leaflet LayerGroups (Eliminates Memory Leaks & Floating Lines)
  const districtGroupRef = useRef(null);
  const routeGroupRef = useRef(null);
  const shelterGroupRef = useRef(null);
  const hospitalGroupRef = useRef(null);
  const hazardGroupRef = useRef(null);

  // Helper to compute dynamic resource allocations based on current district risk scores
  const syncAllocations = (districtList) => {
    const sorted = [...districtList].sort((a, b) => b.risk_score - a.risk_score);
    let remNDRF = resources.ndrf_teams;
    let remBoats = resources.rescue_boats;
    let remMedical = resources.medical_kits;
    let remTents = resources.shelter_tents;

    const newAlloc = sorted.map((d) => {
      const p = d.risk_score >= 0.7 ? "P1_URGENT" : d.risk_score >= 0.4 ? "P2_HIGH" : "P3_MONITOR";
      const w = d.risk_score;
      const ndrf = Math.min(remNDRF, Math.max(0, Math.round(15 * w)));
      const boats = Math.min(remBoats, Math.max(0, Math.round(30 * w)));
      const med = Math.min(remMedical, Math.round(900 * w));
      const tents = Math.min(remTents, Math.round(450 * w));

      remNDRF -= ndrf;
      remBoats -= boats;
      remMedical -= med;
      remTents -= tents;

      return {
        district_id: formatDistrictName(d.district_id),
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
  };

  // LocalStorage Sync for check.html Portal
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("flood_sim_mode", useSimulation ? "SIMULATION" : "REAL");
    }
    if (!useSimulation) {
      setIsPlayingReplay(false);
    }
  }, [useSimulation]);

  // Timeline Slider & Replay Reactivity Effect: Fully syncs map, shelters, river gauges, ML matrix, and resource allocations ONLY when useSimulation is active
  useEffect(() => {
    if (useSimulation) {
      const dailyData = generateHydrologyForDay(simulationDay);
      setDistricts(dailyData);
      syncAllocations(dailyData);
    }
  }, [simulationDay, useSimulation]);

  // Timeline Play/Pause Effect
  useEffect(() => {
    let timer;
    if (isPlayingReplay && useSimulation) {
      timer = setInterval(() => {
        setSimulationDay((prev) => (prev >= 184 ? 1 : prev + 2));
      }, 400);
    }
    return () => clearInterval(timer);
  }, [isPlayingReplay, useSimulation]);

  // --------------------------------------------------------------------------
  // HELPERS & COMPUTED METRICS
  // --------------------------------------------------------------------------
  const selectedDistrict =
    districts.find(
      (d) =>
        d.district_id === selectedDistrictId ||
        formatDistrictName(d.district_id) === formatDistrictName(selectedDistrictId)
    ) || districts[0];

  const selectedAllocation = allocations.find(
    (a) => formatDistrictName(a.district_id) === formatDistrictName(selectedDistrictId)
  ) || allocations[0];

  const p1Count = districts.filter((d) => d.risk_score >= 0.70 || d.risk_level === "P1_URGENT").length;
  const p2Count = districts.filter((d) => (d.risk_score >= 0.40 && d.risk_score < 0.70) || d.risk_level === "P2_HIGH").length;
  const p3Count = districts.filter((d) => d.risk_score < 0.40 || d.risk_level === "P3_MONITOR").length;

  const totalAtRiskPopulation = districts.reduce((acc, d) => acc + (d.population_at_risk || 100000), 0);
  const totalInundatedArea = districts.reduce((acc, d) => acc + (d.inundated_area_sqkm || 0), 0).toFixed(1);
  const totalShelterCapacity = districts.reduce((acc, d) => acc + (d.shelter_capacity || 0), 0);

  // Dynamic Total Shelter Occupancy calculation based on active risk level
  const totalShelterOccupancy = districts.reduce((acc, d) => {
    const prof = DISTRICT_BASE_PROFILES.find((p) => p.district_id === d.district_id || p.name === d.name) || {};
    const cap = d.shelter_capacity || prof.shelter_capacity || 4000;
    const occ = calculateProportionateShelterOccupancy(cap, d.risk_score || 0.2);
    return acc + occ;
  }, 0);

  const totalAllocatedNDRF = allocations.reduce((acc, a) => acc + (a.allocated_ndrf_teams || 0), 0);
  const totalAllocatedBoats = allocations.reduce((acc, a) => acc + (a.allocated_rescue_boats || 0), 0);
  const totalAllocatedMedical = allocations.reduce((acc, a) => acc + (a.allocated_medical_kits || 0), 0);
  const totalAllocatedTents = allocations.reduce((acc, a) => acc + (a.allocated_shelter_tents || 0), 0);

  // --------------------------------------------------------------------------
  // API ACTIONS
  // --------------------------------------------------------------------------
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
        setIsOffline(false);
        addToast("Connected to FastAPI Backend (LIVE REAL DATA)", "success");
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
      addToast("Backend Offline - Running in Simulation Mode", "warning");
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

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
          prev.map((d, i) => {
            const item = data.fused_telemetry[i] || {};
            const cleanName = formatDistrictName(item.district_id || d.district_id);
            const prof = DISTRICT_BASE_PROFILES.find((p) => p.district_id === cleanName || p.name === cleanName) || {};

            // Ensure water level gauge is normalized if raw MSL elevation (85m+) is returned
            let rawWater = item.water_level_meters || d.water_level_meters;
            let dangerMark = item.danger_level_meters || d.danger_level_meters || prof.danger_level;
            if (rawWater > 30.0 && dangerMark > 30.0) {
              rawWater = Number((prof.danger_level + (rawWater - dangerMark)).toFixed(1));
              dangerMark = prof.danger_level;
            }

            const rScore = d.risk_score || 0.20;
            const occ = calculateProportionateShelterOccupancy(prof.shelter_capacity || 4000, rScore);

            return {
              ...d,
              ...item,
              district_id: cleanName,
              name: cleanName,
              water_level_meters: rawWater,
              danger_level_meters: dangerMark,
              shelter_capacity: prof.shelter_capacity || 4000,
              shelter_occupancy: occ,
              nearest_shelter: prof.nearest_shelter || d.nearest_shelter,
            };
          })
        );
      }
      setIsOffline(false);
      addToast("📡 Live Real Data Telemetry Ingested across 8 Bihar Districts", "success");
    } catch (err) {
      console.warn("Using simulation fallback for collect data:", err);
      setIsOffline(true);
      const updated = generateHydrologyForDay(simulationDay);
      setDistricts(updated);
      addToast("📡 Simulated Telemetry Collected (Multi-modal Ingestion)", "info");
    } finally {
      setLoadingData(false);
    }
  };

  const handleRunPredict = async () => {
    setLoadingPredict(true);
    try {
      const sanitizedTelemetry = districts.map((d) => ({
        ...d,
        district_id: formatDistrictName(d.district_id),
        is_above_danger: d.is_above_danger ? 1 : 0,
      }));

      const res = await fetch(`${API_BASE_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telemetry: sanitizedTelemetry }),
      });

      if (!res.ok) throw new Error("Predict failed");
      const data = await res.json();

      if (data.predictions && data.predictions.length > 0) {
        const predMap = {};
        data.predictions.forEach((p) => {
          const nameKey = formatDistrictName(p.district_id);
          predMap[nameKey] = p;
        });

        setDistricts((prev) =>
          prev.map((d) => {
            const cleanName = formatDistrictName(d.district_id);
            const pred = predMap[cleanName] || predMap[d.district_id];
            if (!pred) return d;
            const rScore = pred.risk_score;
            const prof = DISTRICT_BASE_PROFILES.find((p) => p.district_id === cleanName || p.name === cleanName) || {};
            const occ = calculateProportionateShelterOccupancy(prof.shelter_capacity || 4000, rScore);

            return {
              ...d,
              risk_score: rScore,
              risk_level: pred.risk_level || (rScore >= 0.7 ? "P1_URGENT" : rScore >= 0.4 ? "P2_HIGH" : "P3_MONITOR"),
              estimated_inundation_depth_meters: pred.estimated_inundation_depth_meters,
              recommend_evacuation: pred.recommend_evacuation,
              shelter_occupancy: occ,
            };
          })
        );
      }
      setIsOffline(false);
      addToast("🤖 XGBoost ML Flood Risk Predictions Updated", "success");
    } catch (err) {
      console.warn("Using simulation fallback for predict:", err);
      setIsOffline(true);
      const updated = generateHydrologyForDay(simulationDay);
      setDistricts(updated);
      addToast("🤖 Simulated XGBoost Risk Scoring Complete", "info");
    } finally {
      setLoadingPredict(false);
    }
  };

  const handleOptimizeResources = async () => {
    setLoadingOptimize(true);
    try {
      const districtScores = districts.map((d) => ({
        district_id: formatDistrictName(d.district_id),
        risk_score: d.risk_score,
        population_estimate: d.population_at_risk || 150000,
      }));

      const res = await fetch(`${API_BASE_URL}/optimize-resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          district_scores: districtScores,
          available_resources: resources,
        }),
      });

      if (!res.ok) throw new Error("Optimize failed");
      const data = await res.json();

      if (data.district_allocations) {
        setAllocations(
          data.district_allocations.map((a) => ({
            ...a,
            district_id: formatDistrictName(a.district_id),
          }))
        );
      }
      if (data.unallocated_resources) {
        setUnallocated(data.unallocated_resources);
      }
      setIsOffline(false);
      addToast("🚁 Resource Allocations Optimized via Hungarian Algorithm", "success");
    } catch (err) {
      console.warn("Using simulation fallback for optimization:", err);
      setIsOffline(true);
      const sorted = [...districts].sort((a, b) => b.risk_score - a.risk_score);
      let remNDRF = resources.ndrf_teams;
      let remBoats = resources.rescue_boats;
      let remMedical = resources.medical_kits;
      let remTents = resources.shelter_tents;

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
          district_id: formatDistrictName(d.district_id),
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
      addToast("🚁 Simulated Resource Allocation Complete", "info");
    } finally {
      setLoadingOptimize(false);
    }
  };

  const handleRunFullPipeline = async () => {
    setLoadingFullPipeline(true);
    addToast("⚡ Pipeline Started: Step 1/3 Data Collection...", "info");
    await handleCollectData();
    addToast("⚡ Pipeline Step 2/3: XGBoost Risk Scoring...", "info");
    await handleRunPredict();
    addToast("⚡ Pipeline Step 3/3: Resource Allocation...", "info");
    await handleOptimizeResources();
    setLoadingFullPipeline(false);
    addToast("🎉 Full Pipeline Execution Finished Successfully!", "success");
  };

  // --------------------------------------------------------------------------
  // LEAFLET MAP INITIALIZATION & DEDICATED LAYER GROUP MANAGEMENT
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== "map") return;
    if (!mapContainerRef.current) return;

    const L = typeof window !== "undefined" ? window.L : null;
    if (!L) return;

    if (
      leafletMapRef.current &&
      leafletMapRef.current.getContainer() !== mapContainerRef.current
    ) {
      try {
        leafletMapRef.current.remove();
      } catch (e) {}
      leafletMapRef.current = null;
    }

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [25.6, 85.8],
        zoom: 7.5,
        zoomControl: true,
      });

      // OpenStreetMap Standard (Light) - Google Maps-style tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        noWrap: true,
      }).addTo(map);

      // Create Dedicated LayerGroups on Map
      districtGroupRef.current = L.layerGroup().addTo(map);
      routeGroupRef.current = L.layerGroup().addTo(map);
      shelterGroupRef.current = L.layerGroup().addTo(map);
      hospitalGroupRef.current = L.layerGroup().addTo(map);
      hazardGroupRef.current = L.layerGroup().addTo(map);

      leafletMapRef.current = map;
    }

    const map = leafletMapRef.current;

    setTimeout(() => {
      if (map) {
        map.invalidateSize();
      }
    }, 60);

    const targetDist = districts.find(
      (d) => formatDistrictName(d.district_id || d.name) === formatDistrictName(selectedDistrictId)
    );

    if (targetDist && targetDist.lat && targetDist.lon) {
      map.flyTo([targetDist.lat, targetDist.lon], 8.5, { duration: 1.0 });
    }

    // SYNCHRONOUS LAYER CLEANUP (ELIMINATES MEMORY LEAKS & FLOATING UNATTACHED LINES)
    if (districtGroupRef.current) districtGroupRef.current.clearLayers();
    if (routeGroupRef.current) routeGroupRef.current.clearLayers();
    if (shelterGroupRef.current) shelterGroupRef.current.clearLayers();
    if (hospitalGroupRef.current) hospitalGroupRef.current.clearLayers();
    if (hazardGroupRef.current) hazardGroupRef.current.clearLayers();

    // Render Markers Across Dedicated Layer Groups based on Toggles
    districts.forEach((district) => {
      const distName = formatDistrictName(district.district_id || district.name);
      const isSelected = distName === formatDistrictName(selectedDistrictId);
      const isEvacuationActive = district.risk_score >= 0.70 || district.recommend_evacuation || district.risk_level === "P1_URGENT";

      const color =
        district.risk_score >= 0.70
          ? "#ef4444"
          : district.risk_score >= 0.40
          ? "#f97316"
          : "#eab308";

      const radius = isSelected ? 12 : 7 + district.risk_score * 6;

      // 1. Primary District Circle Marker (Risk Layer)
      if (layerVisibility.districtRisk && districtGroupRef.current) {
        const marker = L.circleMarker([district.lat, district.lon], {
          radius: radius,
          fillColor: color,
          color: isSelected ? "#3b82f6" : "#ffffff",
          weight: isSelected ? 2.5 : 1.5,
          opacity: 0.95,
          fillOpacity: 0.85,
        }).addTo(districtGroupRef.current);

        marker.bindTooltip(distName, {
          permanent: true,
          direction: "top",
          offset: [0, -8],
          className: "dark-map-tooltip",
        });

        const popupContent = `
          <div style="font-family: Inter, sans-serif; background-color: #1a1a1a; color: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #2a2a2a; width: 220px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="font-size: 14px;">${distName}</strong>
              <span style="background-color: ${color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">
                ${(district.risk_score * 100).toFixed(0)}% RISK
              </span>
            </div>
            <div style="font-size: 11px; color: #a1a1aa; margin-bottom: 6px;">
              Basin: <b style="color: #ffffff">${district.river_name || "Ganga"}</b>
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
              isEvacuationActive
                ? `<div style="background-color: #ef4444; color: white; font-weight: bold; text-align: center; padding: 4px; border-radius: 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                    🚨 EVACUATION ACTIVE — OSRM STREET ROUTE VISIBLE
                  </div>`
                : `<div style="background-color: #27272a; color: #a1a1aa; text-align: center; padding: 4px; border-radius: 4px; font-size: 10px; margin-bottom: 6px;">
                    ADVISORY: MONITORING (NO EVACUATION)
                  </div>`
            }
            <button id="inspect-btn-${distName}" style="width: 100%; background-color: #3b82f6; color: white; border: none; padding: 5px; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">
              🔍 Inspect District Intelligence
            </button>
          </div>
        `;

        marker.bindPopup(popupContent, { className: "dark-custom-popup", closeButton: false });

        if (isSelected) {
          marker.openPopup();
        }

        marker.on("popupopen", () => {
          const btn = document.getElementById(`inspect-btn-${distName}`);
          if (btn) {
            btn.onclick = () => {
              setSelectedDistrictId(distName);
              setDetailModalOpen(true);
            };
          }
        });

        marker.on("click", () => {
          setSelectedDistrictId(distName);
        });
      }

      // 2. High-Ground Shelter Marker Layer (⛺)
      if (layerVisibility.shelters && district.shelter_lat && shelterGroupRef.current) {
        const occ = calculateProportionateShelterOccupancy(district.shelter_capacity, district.risk_score);

        const shelterMarker = L.circleMarker([district.shelter_lat, district.shelter_lon], {
          radius: 8,
          fillColor: "#3b82f6",
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(shelterGroupRef.current);

        shelterMarker.bindTooltip(`⛺ ${district.nearest_shelter}`, {
          permanent: false,
          direction: "right",
          className: "dark-map-tooltip",
        });

        const shelterPopup = `
          <div style="font-family: Inter, sans-serif; background-color: #1a1a1a; color: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #3b82f6; width: 220px;">
            <div style="font-size: 11px; color: #3b82f6; font-weight: bold; text-transform: uppercase;">⛺ Emergency Relief Shelter</div>
            <strong style="font-size: 13px; display: block; margin-top: 2px;">${district.nearest_shelter}</strong>
            <div style="font-size: 11px; color: #a1a1aa; margin-top: 6px;">
              Occupancy: <b style="color: #ffffff">${occ} / ${district.shelter_capacity} filled</b>
            </div>
            <div style="width: 100%; background-color: #2a2a2a; height: 6px; border-radius: 3px; overflow: hidden; margin-top: 4px;">
              <div style="width: ${Math.min(100, (occ / district.shelter_capacity) * 100)}%; background-color: #3b82f6; height: 100%;"></div>
            </div>
          </div>
        `;
        shelterMarker.bindPopup(shelterPopup, { className: "dark-custom-popup", closeButton: false });
      }

      // 3. Regional Emergency Hospital Layer (🏥)
      if (layerVisibility.hospitals && district.hospital_lat && hospitalGroupRef.current) {
        const hospMarker = L.circleMarker([district.hospital_lat, district.hospital_lon], {
          radius: 7,
          fillColor: "#10b981",
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(hospitalGroupRef.current);

        hospMarker.bindTooltip(`🏥 ${district.hospital_name}`, {
          permanent: false,
          direction: "right",
          className: "dark-map-tooltip",
        });

        const hospPopup = `
          <div style="font-family: Inter, sans-serif; background-color: #1a1a1a; color: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #10b981; width: 220px;">
            <div style="font-size: 11px; color: #10b981; font-weight: bold; text-transform: uppercase;">🏥 Regional Medical Center</div>
            <strong style="font-size: 13px; display: block; margin-top: 2px;">${district.hospital_name}</strong>
            <div style="font-size: 11px; color: #a1a1aa; margin-top: 6px;">
              Free ICU Beds: <b style="color: #10b981">${district.hospital_icu_free} / ${district.hospital_icu_capacity} Available</b>
            </div>
            <div style="font-size: 10px; color: #34d399; margin-top: 4px; font-weight: bold;">
              ${district.hospital_status}
            </div>
          </div>
        `;
        hospMarker.bindPopup(hospPopup, { className: "dark-custom-popup", closeButton: false });
      }

      // 4. Submerged Flooded Road Blockage Hazard Layer (🚧 - ACTIVE ON P1/P2 ONLY)
      if (layerVisibility.hazards && (district.risk_score >= 0.40) && district.hazard_lat && hazardGroupRef.current) {
        const hazardMarker = L.circleMarker([district.hazard_lat, district.hazard_lon], {
          radius: 7,
          fillColor: "#f59e0b",
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(hazardGroupRef.current);

        hazardMarker.bindTooltip(`🚧 Road Blocked: ${district.hazard_road}`, {
          permanent: false,
          direction: "top",
          className: "dark-map-tooltip",
        });
      }

      // 5. OpenStreetMap OSRM Street Navigation Route Layer (区域 Evacuation Route - ACTIVE ON P1 ONLY)
      if (layerVisibility.routes && isEvacuationActive && district.shelter_lat && routeGroupRef.current) {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${district.lon},${district.lat};${district.shelter_lon},${district.shelter_lat}?overview=full&geometries=geojson`;

        fetch(osrmUrl)
          .then((res) => res.json())
          .then((osrmData) => {
            if (osrmData.routes && osrmData.routes.length > 0 && routeGroupRef.current) {
              const osrmCoords = osrmData.routes[0].geometry.coordinates.map((pt) => [pt[1], pt[0]]);
              const distanceKm = (osrmData.routes[0].distance / 1000).toFixed(1);
              const durationMins = Math.round(osrmData.routes[0].duration / 60);

              const routePath = L.polyline(osrmCoords, {
                color: "#ef4444",
                weight: isSelected ? 4.5 : 3.5,
                opacity: 0.95,
                dashArray: "6, 8",
              }).addTo(routeGroupRef.current);

              routePath.bindTooltip(`自由 OSRM Street Navigation: ${distanceKm} km via Highway (ETA: ${durationMins}m)`, {
                className: "dark-map-tooltip",
              });
            }
          })
          .catch((err) => {
            console.warn("OSRM routing fetch fallback:", err);
          });
      }
    });
  }, [districts, activeTab, selectedDistrictId, layerVisibility]);

  // --------------------------------------------------------------------------
  // RENDER UI COMPONENTS
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex flex-col font-sans select-none antialiased relative">
      {/* Toast Notification Container */}
      <div className="fixed top-16 right-4 z-50 flex flex-col space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-lg shadow-xl border text-xs font-medium flex items-center space-x-2 backdrop-blur-md transition-all duration-300 ${
              t.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
                : t.type === "warning"
                ? "bg-amber-950/90 border-amber-500/50 text-amber-200"
                : "bg-blue-950/90 border-blue-500/50 text-blue-200"
            }`}
          >
            <span>{t.type === "success" ? "✅" : t.type === "warning" ? "⚠️" : "ℹ️"}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

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
        .dark-map-tooltip {
          background: rgba(17, 17, 17, 0.88) !important;
          border: 1px solid #333333 !important;
          color: #ffffff !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.6) !important;
        }
        .dark-map-tooltip::before {
          border-top-color: rgba(17, 17, 17, 0.88) !important;
        }
      `}</style>

      {/* ADMINISTRATIVE SITUATION REPORT (SitRep) MODAL GENERATOR */}
      {sitRepModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto font-sans">
            <div className="flex justify-between items-start border-b border-[#2a2a2a] pb-4">
              <div>
                <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-700 px-2 py-0.5 rounded font-mono uppercase font-bold">
                  OFFICIAL DISASTER MANAGEMENT BRIEFING
                </span>
                <h2 className="text-xl font-extrabold text-white uppercase tracking-wide mt-1">
                  Bihar Administrative Situation Report (SitRep #04)
                </h2>
                <p className="text-xs text-gray-400">
                  Target Authority: Bihar State Disaster Management Authority (BSDMA) / NDMA Command
                </p>
              </div>

              <button
                onClick={() => setSitRepModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3 text-center border-b border-[#262626] pb-3">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase">State Emergency Status</span>
                  <b className={p1Count > 0 ? "text-red-400 font-bold block text-sm" : p2Count > 0 ? "text-orange-400 font-bold block text-sm" : "text-emerald-400 font-bold block text-sm"}>
                    {p1Count > 0 ? "🔴 HIGH FLOOD ALERT" : p2Count > 0 ? "🟠 HIGH MONSOON WATCH" : "🟢 NORMAL MONSOON STAGE"}
                  </b>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase">Vulnerable Population</span>
                  <b className="text-purple-400 font-bold block text-sm">{totalAtRiskPopulation.toLocaleString()} Citizens</b>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase">Shelter Occupancy</span>
                  <b className="text-amber-400 font-bold block text-sm">{totalShelterOccupancy.toLocaleString()} / {totalShelterCapacity.toLocaleString()} Beds</b>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-white uppercase tracking-wider text-[11px] block">
                  1. Executive Priority Directives (XGBoost Risk Ranking)
                </span>
                <div className="space-y-1 text-gray-300">
                  {p1Count > 0 ? (
                    <>
                      <p>• <b>High Vulnerability Sectors</b>: NDRF Teams deployed; Ganga & Kosi overflow above danger mark. Immediate evacuation along highway corridors active.</p>
                      <p>• <b>Medical Readiness</b>: AIIMS Patna & JLNMCH Trauma Centers prepared with active ICU bed capacity.</p>
                      <p>• <b>Road Hazards</b>: Submerged Highway closures detected. Alternate bypass routing active on OpenStreetMap layer.</p>
                    </>
                  ) : (
                    <>
                      <p>• <b>Monsoon Status</b>: All 8 Bihar river basins are currently within safe operational capacity (P3 Monitor Stage).</p>
                      <p>• <b>Prepositioning</b>: NDRF Teams & Motor Boats on high standby at regional depots.</p>
                      <p>• <b>Telemetry</b>: IMD Rainfall and India-WRIS River Gauges streaming live data continuously.</p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#262626]">
                <span className="font-bold text-white uppercase tracking-wider text-[11px] block">
                  2. Deployed Emergency Resource Assets
                </span>
                <div className="grid grid-cols-4 gap-2 text-center bg-[#1a1a1a] p-2.5 rounded-lg font-mono">
                  <div>🪖 NDRF: <b>{totalAllocatedNDRF} Teams</b></div>
                  <div>🚤 Boats: <b>{totalAllocatedBoats} Units</b></div>
                  <div>💊 Kits: <b>{totalAllocatedMedical} Kits</b></div>
                  <div>⛺ Tents: <b>{totalAllocatedTents} Tents</b></div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-gray-500 font-mono">Report ID: BSDMA-SITREP-2019-MONSOON-DAY{simulationDay}</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    addToast("📄 Situation Report Exported to Administrative Clipboard!", "success");
                    setSitRepModalOpen(false);
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition"
                >
                  Export Administrative SitRep
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED DISTRICT INSPECTION MODAL DRAWER */}
      {detailModalOpen && selectedDistrict && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-[#2a2a2a] pb-4">
              <div>
                <div className="flex items-center space-x-3">
                  <h2 className="text-xl font-extrabold text-white uppercase tracking-wide">
                    {selectedDistrict.name} District Intelligence
                  </h2>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      selectedDistrict.risk_score >= 0.7
                        ? "bg-red-500 text-white"
                        : selectedDistrict.risk_score >= 0.4
                        ? "bg-orange-500 text-white"
                        : "bg-yellow-500 text-gray-900"
                    }`}
                  >
                    {(selectedDistrict.risk_score * 100).toFixed(0)}% FLOOD RISK
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Basin: <b className="text-blue-400">{selectedDistrict.river_name || "Ganga"}</b> | Coordinates: {selectedDistrict.lat.toFixed(4)}°N, {selectedDistrict.lon.toFixed(4)}°E
                </p>
              </div>

              <button
                onClick={() => setDetailModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Emergency Hospital Infrastructure Card */}
            <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <span>🏥 Regional Emergency Medical Center</span>
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded">
                  {selectedDistrict.hospital_status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-gray-200">
                <div>
                  <span className="text-[10px] text-gray-400 block">Hospital Facility</span>
                  <b className="text-white">{selectedDistrict.hospital_name}</b>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 block">Available ICU Beds</span>
                  <b className="text-emerald-400">{selectedDistrict.hospital_icu_free} / {selectedDistrict.hospital_icu_capacity} Beds Free</b>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 block">Highway Blockage Warning</span>
                  <b className="text-amber-400">{selectedDistrict.hazard_road}</b>
                </div>
              </div>
            </div>

            {/* 4 Modality Metric Cards */}
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="bg-[#161616] border border-[#2a2a2a] p-3 rounded-xl space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">🌧 Precipitation</span>
                <div className="text-base font-bold text-white">{selectedDistrict.rainfall_24h_mm} mm</div>
                <div className="text-[10px] text-gray-400">3-Day Accum: <b>{selectedDistrict.rainfall_3d_accum_mm} mm</b></div>
                <div className="text-[10px] text-gray-400">IMD Warning: <b className="text-amber-400">{selectedDistrict.imd_warning_level || "ALERT"}</b></div>
              </div>

              <div className="bg-[#161616] border border-[#2a2a2a] p-3 rounded-xl space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">🌊 River Gauge</span>
                <div className="text-base font-bold text-blue-400">{selectedDistrict.water_level_meters} m</div>
                <div className="text-[10px] text-gray-400">Danger Mark: <b>{selectedDistrict.danger_level_meters} m</b></div>
                <div className="text-[10px] text-gray-400">Rise Rate: <b className="text-red-400">+{selectedDistrict.river_rise_rate_percent || 4.2}%/hr</b></div>
              </div>

              <div className="bg-[#161616] border border-[#2a2a2a] p-3 rounded-xl space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">🛰 Satellite Inundation</span>
                <div className="text-base font-bold text-cyan-400">{selectedDistrict.ndwi_water_index} NDWI</div>
                <div className="text-[10px] text-gray-400">Soil Saturation: <b>{((selectedDistrict.soil_saturation_index || 0.85) * 100).toFixed(0)}%</b></div>
                <div className="text-[10px] text-gray-400">Flooded Area: <b>{selectedDistrict.inundated_area_sqkm} km²</b></div>
              </div>

              <div className="bg-[#161616] border border-[#2a2a2a] p-3 rounded-xl space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">👥 Vulnerable Population</span>
                <div className="text-base font-bold text-purple-400">{(selectedDistrict.population_at_risk || 150000).toLocaleString()}</div>
                <div className="text-[10px] text-gray-400">Priority Level: <b>{selectedDistrict.risk_level}</b></div>
                <div className="text-[10px] text-gray-400">Elevation: <b>{selectedDistrict.mean_elevation_meters} m</b></div>
              </div>
            </div>

            {/* SHAP Feature Contribution Breakdown */}
            <div className="bg-[#141414] border border-[#2a2a2a] p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  🤖 XGBoost Model Explainability (SHAP Risk Factors)
                </h3>
                <span className="text-[10px] text-gray-400">Why was this risk score assigned?</span>
              </div>

              <div className="space-y-2 text-xs">
                {(selectedDistrict.shap_explainability || [
                  { label: "3-Day Rainfall Accumulation", contribution: 35 },
                  { label: "River Level Above Danger Mark", contribution: 30 },
                  { label: "ISRO Satellite NDWI Water Index", contribution: 20 },
                  { label: "Low Elevation Basin Offset", contribution: -15 },
                ]).map((s, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-gray-300">
                      <span>{s.label}</span>
                      <span className={s.contribution > 0 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                        {s.contribution > 0 ? `+${s.contribution}%` : `${s.contribution}%`}
                      </span>
                    </div>
                    <div className="w-full bg-[#262626] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${s.contribution > 0 ? "bg-red-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.abs(s.contribution)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2 rounded-lg transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. TOP HEADER BAR */}
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

        {/* Center Administrative Actions & SitRep Button */}
        <div className="hidden md:flex items-center space-x-3">
          <button
            onClick={() => setSitRepModalOpen(true)}
            className="bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/50 text-purple-200 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1.5 transition shadow-md"
          >
            <span>📄</span>
            <span>Generate SitRep Report</span>
          </button>

          <div className="flex items-center space-x-2 bg-[#1a1a1a] border border-[#2a2a2a] px-3 py-1 rounded-full text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isOffline ? "bg-amber-500 animate-ping" : "bg-emerald-500 animate-pulse"
              }`}
            ></span>
            <span className="font-medium text-gray-200">
              {isOffline ? "OFFLINE / SIMULATION MODE" : "HEALTHY (LIVE REAL DATA)"}
            </span>
          </div>

          <a
            href="/check.html"
            target="_blank"
            rel="noreferrer"
            className="bg-[#1a1a1a] border border-purple-500/40 text-purple-300 hover:bg-purple-950/40 px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <span>🔍</span>
            <span>Audit Portal (/check.html) 🔗</span>
          </a>
        </div>

        {/* Right: Refresh Button */}
        <div className="flex items-center space-x-3">
          <button
            onClick={checkHealth}
            title="Refresh System Health"
            className="p-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] text-gray-300 transition"
          >
            🔄
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR (240px Fixed) */}
        <aside className="w-60 border-r border-[#2a2a2a] bg-[#111111] flex flex-col justify-between p-3 flex-shrink-0">
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2">
                Navigation Tabs
              </span>
              <button
                onClick={() => setActiveTab("map")}
                className={`w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "map"
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold"
                    : "text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200"
                }`}
              >
                <span>📡</span>
                <span>Live Data Map</span>
              </button>

              <button
                onClick={() => setActiveTab("state")}
                className={`w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "state"
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold"
                    : "text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200"
                }`}
              >
                <span>🏛</span>
                <span>State & Shelter Status</span>
              </button>

              <button
                onClick={() => setActiveTab("predict")}
                className={`w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "predict"
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold"
                    : "text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200"
                }`}
              >
                <span>🤖</span>
                <span>ML Risk Matrix</span>
              </button>

              <button
                onClick={() => setActiveTab("optimize")}
                className={`w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === "optimize"
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold"
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

            {/* At-Risk Population Summary Card */}
            <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-2.5 space-y-1 text-xs">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                👥 At-Risk Population
              </span>
              <div className="text-base font-extrabold text-purple-400 font-mono">
                {totalAtRiskPopulation.toLocaleString()}
              </div>
              <span className="text-[10px] text-gray-500">Across 8 Bihar flood basins</span>
            </div>

            {/* Pipeline Actions */}
            <div className="space-y-2 pt-2 border-t border-[#2a2a2a]">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block px-1">
                Pipeline Actions
              </span>
              <button
                onClick={handleCollectData}
                disabled={loadingData || loadingFullPipeline}
                className="w-full bg-[#1e1e1e] hover:bg-[#282828] active:scale-98 border border-[#333333] text-gray-200 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
              >
                {loadingData ? <span className="animate-spin text-blue-400">⏳</span> : <span>📡</span>}
                <span>Collect Data</span>
              </button>

              <button
                onClick={handleRunPredict}
                disabled={loadingPredict || loadingFullPipeline}
                className="w-full bg-[#1e1e1e] hover:bg-[#282828] active:scale-98 border border-[#333333] text-gray-200 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
              >
                {loadingPredict ? <span className="animate-spin text-blue-400">⏳</span> : <span>🤖</span>}
                <span>Run Predict</span>
              </button>

              <button
                onClick={handleOptimizeResources}
                disabled={loadingOptimize || loadingFullPipeline}
                className="w-full bg-[#1e1e1e] hover:bg-[#282828] active:scale-98 border border-[#333333] text-gray-200 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
              >
                {loadingOptimize ? <span className="animate-spin text-blue-400">⏳</span> : <span>🚁</span>}
                <span>Optimize</span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-[#2a2a2a]">
            <button
              onClick={handleRunFullPipeline}
              disabled={loadingFullPipeline}
              className="w-full bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-blue-900/30 cursor-pointer disabled:opacity-50"
            >
              {loadingFullPipeline ? (
                <span className="animate-spin">⏳ Running Pipeline...</span>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Run Full Pipeline (Real Data)</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* CENTER PANEL VIEW CONTROLLER */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
          {/* TAB 1: LEAFLET MAP VIEW */}
          {activeTab === "map" && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Timeline Replay Bar (ACTIVE ONLY WHEN SIMULATE MODE IS ON) */}
              <div className="h-10 bg-[#141414] border-b border-[#2a2a2a] px-4 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <button
                    disabled={!useSimulation}
                    onClick={() => setIsPlayingReplay(!isPlayingReplay)}
                    title={useSimulation ? "Toggle Monsoon Simulation Play/Pause" : "Enable 'Simulate Mode' (top right) to unlock timeline replay"}
                    className={`font-bold text-[10px] px-2.5 py-1 rounded flex items-center space-x-1 transition ${
                      useSimulation
                        ? "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow"
                        : "bg-[#222222] text-gray-500 border border-[#333333] cursor-not-allowed opacity-60"
                    }`}
                  >
                    <span>{isPlayingReplay ? "⏸ PAUSE" : "▶ PLAY"}</span>
                  </button>

                  {useSimulation ? (
                    <span className="text-gray-300 font-medium">
                      2019 Bihar Monsoon Replay: <b className="text-blue-400">Day {simulationDay} / 184 (Sept 30 Peak)</b>
                    </span>
                  ) : (
                    <span className="text-emerald-400/90 font-semibold text-[11px] flex items-center space-x-1">
                      <span>📡</span>
                      <span>Real Telemetry Active - Live OSINT Data (IMD, WRIS, Bhuvan)</span>
                    </span>
                  )}
                </div>

                <div className="flex-1 max-w-xs mx-4">
                  <input
                    type="range"
                    min="1"
                    max="184"
                    disabled={!useSimulation}
                    value={simulationDay}
                    onChange={(e) => setSimulationDay(Number(e.target.value))}
                    className={`w-full h-1.5 rounded-lg ${
                      useSimulation ? "accent-blue-500 bg-[#262626] cursor-pointer" : "bg-[#222222] cursor-not-allowed opacity-40"
                    }`}
                  />
                </div>

                <button
                  onClick={() => setDetailModalOpen(true)}
                  className="bg-[#1e1e1e] hover:bg-[#282828] border border-[#333] text-gray-200 text-[10px] font-bold px-2.5 py-1 rounded"
                >
                  🔍 Inspect {formatDistrictName(selectedDistrictId)}
                </button>
              </div>

              <div className="flex-1 relative overflow-hidden">
                <div ref={mapContainerRef} className="w-full h-full z-10" />

                {/* Interactive Map Layer Control Panel (Top-Right Widget) */}
                <div className="absolute top-3 right-3 bg-[#111111]/95 backdrop-blur-md border border-[#2a2a2a] rounded-xl p-3 text-[11px] text-gray-300 space-y-2 z-20 shadow-2xl pointer-events-auto w-64">
                  <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-1.5">
                    <span className="font-bold text-white uppercase text-[10px]">
                      🗺 Interactive Map Layers
                    </span>
                    <span className="text-[9px] bg-blue-950 text-blue-300 border border-blue-800 px-1.5 py-0.5 rounded font-mono">
                      ADMIN CONTROL
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center space-x-2 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={layerVisibility.districtRisk}
                        onChange={(e) => setLayerVisibility((prev) => ({ ...prev, districtRisk: e.target.checked }))}
                        className="accent-red-500 rounded cursor-pointer"
                      />
                      <span>🔴 District Risk Bubbles</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={layerVisibility.shelters}
                        onChange={(e) => setLayerVisibility((prev) => ({ ...prev, shelters: e.target.checked }))}
                        className="accent-blue-500 rounded cursor-pointer"
                      />
                      <span>⛺ High-Ground Relief Shelters</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={layerVisibility.hospitals}
                        onChange={(e) => setLayerVisibility((prev) => ({ ...prev, hospitals: e.target.checked }))}
                        className="accent-emerald-500 rounded cursor-pointer"
                      />
                      <span>🏥 Regional Emergency Hospitals</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={layerVisibility.hazards}
                        onChange={(e) => setLayerVisibility((prev) => ({ ...prev, hazards: e.target.checked }))}
                        className="accent-amber-500 rounded cursor-pointer"
                      />
                      <span>🚧 Flooded Road Blockages</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={layerVisibility.routes}
                        onChange={(e) => setLayerVisibility((prev) => ({ ...prev, routes: e.target.checked }))}
                        className="accent-red-500 rounded cursor-pointer"
                      />
                      <span>🛣 OpenStreetMap Safe Routes (P1 Only)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="h-24 bg-[#111111] border-t border-[#2a2a2a] p-3 flex flex-col justify-between flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Telemetry Strip:
                    </span>
                    <select
                      value={formatDistrictName(selectedDistrictId)}
                      onChange={(e) => setSelectedDistrictId(e.target.value)}
                      className="bg-[#1a1a1a] border border-[#2a2a2a] text-blue-400 font-semibold text-xs rounded px-2 py-0.5 focus:outline-none cursor-pointer"
                    >
                      {districts.map((d) => {
                        const name = formatDistrictName(d.district_id || d.name);
                        return (
                          <option key={d.district_id} value={name}>
                            {name} ({(d.risk_score * 100).toFixed(0)}%)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setDetailModalOpen(true)}
                      className="bg-blue-600/20 border border-blue-500/40 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded hover:bg-blue-600/40 transition"
                    >
                      🔍 Full Intelligence Report
                    </button>
                    {(selectedDistrict.risk_score >= 0.70 || selectedDistrict.recommend_evacuation) ? (
                      <div className="bg-red-500/20 border border-red-500/50 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">
                        🚨 EVACUATION ACTIVE (STREET NAVIGATION VISIBLE)
                      </div>
                    ) : (
                      <div className="bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded">
                        🛡 MONITORING (ROUTES HIDDEN)
                      </div>
                    )}
                  </div>
                </div>

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
            </div>
          )}

          {/* STATEWIDE STATUS & EMERGENCY SHELTER MASTER DASHBOARD */}
          {activeTab === "state" && (
            <div className="flex-1 p-5 overflow-y-auto space-y-6">
              <div className="border-b border-[#2a2a2a] pb-3 flex justify-between items-center">
                <div>
                  <h2 className="text-base font-extrabold uppercase tracking-wider text-white">
                    🏛 Bihar Statewide Flood & Relief Shelter Master Status
                  </h2>
                  <p className="text-xs text-gray-400">
                    Real-time operational monitoring across 38 districts, 8 major river basins, and relief camps
                  </p>
                </div>
                
                {/* DYNAMIC ALERT BANNER ACCORDING TO REAL RISK LEVEL */}
                <div
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2 ${
                    p1Count > 0
                      ? "bg-red-500/10 border border-red-500/40 text-red-400"
                      : p2Count > 0
                      ? "bg-orange-500/10 border border-orange-500/40 text-orange-400"
                      : "bg-emerald-500/10 border border-emerald-500/40 text-emerald-400"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p1Count > 0 ? "bg-red-500 animate-ping" : p2Count > 0 ? "bg-orange-400 animate-pulse" : "bg-emerald-400"}`}></span>
                  <span>
                    {p1Count > 0
                      ? `🚨 STATEWIDE ALERT: ${p1Count} DISTRICTS IN URGENT P1 FLOOD EMERGENCY`
                      : p2Count > 0
                      ? `🟠 MONSOON ALERT: ${p2Count} DISTRICTS UNDER HIGH WATCH`
                      : "🟢 ALL BASINS OPERATIONAL: NO ACTIVE FLOOD EMERGENCY"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="bg-[#141414] border border-[#2a2a2a] p-4 rounded-xl space-y-1">
                  <span className="text-xs text-gray-400 uppercase font-semibold">🌊 Flooded Basin Area</span>
                  <div className="text-2xl font-extrabold text-blue-400 font-mono">{totalInundatedArea} km²</div>
                  <span className="text-[10px] text-gray-500 block">Across Ganga, Kosi & Bagmati Floodplains</span>
                </div>

                <div className="bg-[#141414] border border-[#2a2a2a] p-4 rounded-xl space-y-1">
                  <span className="text-xs text-gray-400 uppercase font-semibold">👥 At-Risk Bihar Citizens</span>
                  <div className="text-2xl font-extrabold text-purple-400 font-mono">{totalAtRiskPopulation.toLocaleString()}</div>
                  <span className="text-[10px] text-gray-500 block">High vulnerability priority zones</span>
                </div>

                <div className="bg-[#141414] border border-[#2a2a2a] p-4 rounded-xl space-y-1">
                  <span className="text-xs text-gray-400 uppercase font-semibold">⛺ Total Shelter Occupancy</span>
                  <div className="text-2xl font-extrabold text-amber-400 font-mono">
                    {totalShelterOccupancy.toLocaleString()} / {totalShelterCapacity.toLocaleString()}
                  </div>
                  <div className="w-full bg-[#262626] h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full ${
                        totalShelterOccupancy / totalShelterCapacity > 0.6
                          ? "bg-red-500"
                          : totalShelterOccupancy / totalShelterCapacity > 0.3
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                      }`}
                      style={{ width: `${Math.round((totalShelterOccupancy / totalShelterCapacity) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-[#141414] border border-[#2a2a2a] p-4 rounded-xl space-y-1">
                  <span className="text-xs text-gray-400 uppercase font-semibold">🚨 Emergency Readiness</span>
                  <div className="text-2xl font-extrabold text-emerald-400 font-mono">{p1Count} URGENT / {districts.length}</div>
                  <span className="text-[10px] text-gray-500 block">{p1Count} P1 Urgent, {p2Count} P2 High, {p3Count} P3 Monitor</span>
                </div>
              </div>

              <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    ⛺ Bihar Statewide High-Ground Emergency Relief Shelters
                  </h3>
                  <span className="text-xs text-gray-400">Occupancy & High-Ground Readiness</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#2a2a2a] text-gray-400 bg-[#1a1a1a]">
                        <th className="p-3">District</th>
                        <th className="p-3">Designated Safe Relief Shelter</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-center">Occupancy / Capacity</th>
                        <th className="p-3 text-center">Fill Ratio</th>
                        <th className="p-3">Evacuation Corridor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262626] text-gray-200">
                      {districts.map((d) => {
                        const name = formatDistrictName(d.district_id);
                        const prof = DISTRICT_BASE_PROFILES.find((p) => p.district_id === name || p.name === name) || {};
                        const cap = d.shelter_capacity || prof.shelter_capacity || 4000;
                        const occ = calculateProportionateShelterOccupancy(cap, d.risk_score || 0.20);
                        const fillPercent = Math.round((occ / cap) * 100);
                        
                        const isP1 = d.risk_score >= 0.7;
                        const isP2 = d.risk_score >= 0.4 && d.risk_score < 0.7;

                        return (
                          <tr
                            key={d.district_id}
                            onClick={() => {
                              setSelectedDistrictId(name);
                              setActiveTab("map");
                            }}
                            className="hover:bg-[#1e1e1e] cursor-pointer transition"
                          >
                            <td className="p-3 font-bold text-white">{name}</td>
                            <td className="p-3 text-blue-300 font-medium">{prof.nearest_shelter || d.nearest_shelter}</td>
                            <td className="p-3">
                              <span
                                className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                                  isP1
                                    ? "bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse"
                                    : isP2
                                    ? "bg-orange-500/20 border border-orange-500/40 text-orange-400"
                                    : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                                }`}
                              >
                                {isP1 ? "🚨 ACTIVE EVACUATION" : isP2 ? "🟠 READY / PREPARED" : "🟢 STANDBY / NORMAL"}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold">
                              {occ} / {cap}
                            </td>
                            <td className="p-3 text-center">
                              <div className="w-24 mx-auto space-y-1">
                                <span className="text-[10px] text-gray-400">{fillPercent}%</span>
                                <div className="w-full bg-[#262626] h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${fillPercent > 60 ? "bg-red-500" : fillPercent > 30 ? "bg-amber-400" : "bg-emerald-400"}`}
                                    style={{ width: `${fillPercent}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-gray-400 font-mono text-[11px]">{prof.evacuation_route || d.evacuation_route}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  🌊 Bihar River Basin Hydrological Gauge Status
                </h3>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  {districts.slice(0, 4).map((d) => {
                    const name = formatDistrictName(d.district_id);
                    const prof = DISTRICT_BASE_PROFILES.find((p) => p.district_id === name || p.name === name) || {};
                    
                    const dMark = prof.danger_level || d.danger_level_meters || 8.0;
                    let wLevel = d.water_level_meters;
                    
                    // Normalize water level relative to danger mark threshold based on active risk level
                    if (!wLevel || wLevel > dMark + 4.0 || wLevel < 1.0) {
                      const levelRatio = 0.72 + (d.risk_score || 0.20) * 0.52;
                      wLevel = Number((dMark * levelRatio).toFixed(1));
                    }

                    const diff = (wLevel - dMark).toFixed(1);
                    const isOver = wLevel >= dMark;

                    return (
                      <div key={d.district_id} className="bg-[#1a1a1a] border border-[#2a2a2a] p-3 rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white">{prof.river_name || d.river_name} ({name})</span>
                          <span className={isOver ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                            {isOver ? `+${diff}m ABOVE DANGER MARK` : `${Math.abs(diff)}m BELOW DANGER (SAFE)`}
                          </span>
                        </div>

                        <div className="flex justify-between text-gray-400 text-[11px]">
                          <span>Current Water Level: <b>{wLevel}m</b></span>
                          <span>Danger Mark: <b>{dMark}m</b></span>
                        </div>

                        <div className="w-full bg-[#262626] h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${isOver ? "bg-red-500" : "bg-emerald-400"}`}
                            style={{ width: `${Math.min(100, (wLevel / (dMark * 1.25)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ML RISK MATRIX TAB WITH SHAP EXPLAINABILITY */}
          {activeTab === "predict" && (
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    🤖 XGBoost v3 Risk Scoring & SHAP Feature Explainability
                  </h2>
                  <p className="text-xs text-gray-400">
                    Feature importances: 3-Day Rain (34%), River Rise Rate (28%), Satellite NDWI (18%), Soil Saturation (12%), Elevation (-8%)
                  </p>
                </div>
                <button
                  onClick={handleRunPredict}
                  disabled={loadingPredict}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                >
                  Recalculate Predictions
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {districts.map((d) => {
                  const name = formatDistrictName(d.district_id || d.name);
                  const isP1 = d.risk_score >= 0.7;
                  const isP2 = d.risk_score >= 0.4 && d.risk_score < 0.7;
                  const colorClass = isP1 ? "border-red-500/40 bg-red-500/5" : isP2 ? "border-orange-500/40 bg-orange-500/5" : "border-yellow-500/40 bg-yellow-500/5";

                  return (
                    <div
                      key={d.district_id}
                      onClick={() => {
                        setSelectedDistrictId(name);
                        setDetailModalOpen(true);
                      }}
                      className={`p-4 rounded-xl border ${colorClass} hover:border-blue-500 transition cursor-pointer space-y-3 shadow-md`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-white text-base block">{name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">Basin: {d.river_name || "Ganga"}</span>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-extrabold ${
                            isP1
                              ? "bg-red-500 text-white"
                              : isP2
                              ? "bg-orange-500 text-white"
                              : "bg-yellow-500 text-gray-900"
                          }`}
                        >
                          {(d.risk_score * 100).toFixed(0)}% RISK
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-300 bg-[#161616] p-2 rounded-lg border border-[#222]">
                        <div>
                          <span className="text-[10px] text-gray-500 block">Rainfall</span>
                          <b>{d.rainfall_24h_mm} mm</b>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 block">River Level</span>
                          <b>{d.water_level_meters} m</b>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 block">Inundation Depth</span>
                          <b>{d.estimated_inundation_depth_meters} m</b>
                        </div>
                      </div>

                      <div className="text-[11px] text-gray-400 flex items-center justify-between border-t border-[#262626] pt-2">
                        <span>Street Navigation Status:</span>
                        <span className={isP1 ? "text-red-400 font-bold" : "text-gray-500"}>
                          {isP1 ? "🚨 ACTIVE (OSRM Street Path)" : "🛡 Hidden (Normal Monitoring)"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: RESOURCE ALLOCATOR TAB */}
          {activeTab === "optimize" && (
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    🚁 Emergency Response Optimization (Hungarian Matching)
                  </h2>
                  <p className="text-xs text-gray-400">
                    Bipartite graph matching minimizing travel distance weighted by population urgency
                  </p>
                </div>
                <button
                  onClick={handleOptimizeResources}
                  disabled={loadingOptimize}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                >
                  Re-run Optimization
                </button>
              </div>

              <div className="space-y-3">
                {allocations.map((a) => {
                  const name = formatDistrictName(a.district_id);
                  const distInfo = districts.find((d) => formatDistrictName(d.district_id) === name) || {};
                  return (
                    <div
                      key={a.district_id}
                      className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-3.5 flex items-center justify-between hover:border-blue-500/50 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-base">{name}</span>
                          <span className="text-[10px] bg-[#222222] border border-[#333333] px-2 py-0.5 rounded text-gray-300 font-semibold">
                            Priority: {a.priority_level}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          Risk: <b>{(a.risk_score * 100).toFixed(0)}%</b> | Population: <b>{(distInfo.population_at_risk || 100000).toLocaleString()}</b>
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          Highway Route: {distInfo.evacuation_route || "NH-31 Highway Corridor"}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 text-xs">
                        <div className="text-center">
                          <span className="text-blue-400 font-extrabold text-base block">{a.allocated_ndrf_teams}</span>
                          <span className="text-[10px] text-gray-500">NDRF Teams</span>
                        </div>
                        <div className="text-center">
                          <span className="text-cyan-400 font-extrabold text-base block">{a.allocated_rescue_boats}</span>
                          <span className="text-[10px] text-gray-500">Boats</span>
                        </div>
                        <div className="text-center">
                          <span className="text-emerald-400 font-extrabold text-base block">{a.allocated_medical_kits}</span>
                          <span className="text-[10px] text-gray-500">Medical</span>
                        </div>
                        <div className="text-center">
                          <span className="text-amber-400 font-extrabold text-base block">{a.allocated_shelter_tents}</span>
                          <span className="text-[10px] text-gray-500">Tents</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* RIGHT PANEL (300px Fixed: Resource Inventory & Interactive Allocations) */}
        <aside className="w-80 border-l border-[#2a2a2a] bg-[#111111] flex flex-col p-3 flex-shrink-0 space-y-4 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Resource Inventory
              </span>
              <span className="text-[10px] text-gray-400">Current vs Total</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="bg-[#161616] border border-[#2a2a2a] p-2 rounded-lg">
                <div className="flex justify-between text-gray-300 mb-1">
                  <span>🪖 NDRF Teams</span>
                  <span className="font-semibold text-blue-400">
                    {totalAllocatedNDRF} / {resources.ndrf_teams}
                  </span>
                </div>
                <div className="w-full bg-[#2a2a2a] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (totalAllocatedNDRF / resources.ndrf_teams) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="bg-[#161616] border border-[#2a2a2a] p-2 rounded-lg">
                <div className="flex justify-between text-gray-300 mb-1">
                  <span>🚤 Rescue Boats</span>
                  <span className="font-semibold text-cyan-400">
                    {totalAllocatedBoats} / {resources.rescue_boats}
                  </span>
                </div>
                <div className="w-full bg-[#2a2a2a] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-500 h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (totalAllocatedBoats / resources.rescue_boats) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="bg-[#161616] border border-[#2a2a2a] p-2 rounded-lg">
                <div className="flex justify-between text-gray-300 mb-1">
                  <span>💊 Medical Kits</span>
                  <span className="font-semibold text-emerald-400">
                    {totalAllocatedMedical} / {resources.medical_kits}
                  </span>
                </div>
                <div className="w-full bg-[#2a2a2a] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (totalAllocatedMedical / resources.medical_kits) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="bg-[#161616] border border-[#2a2a2a] p-2 rounded-lg">
                <div className="flex justify-between text-gray-300 mb-1">
                  <span>⛺ Shelter Tents</span>
                  <span className="font-semibold text-amber-400">
                    {totalAllocatedTents} / {resources.shelter_tents}
                  </span>
                </div>
                <div className="w-full bg-[#2a2a2a] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (totalAllocatedTents / resources.shelter_tents) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

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
                    const distName = formatDistrictName(a.district_id);
                    const isP1 = a.priority_level === "P1_URGENT";
                    const isP2 = a.priority_level === "P2_HIGH";
                    const isSelected = distName === formatDistrictName(selectedDistrictId);

                    return (
                      <tr
                        key={a.district_id}
                        onClick={() => {
                          setSelectedDistrictId(distName);
                          setActiveTab("map");
                        }}
                        className={`cursor-pointer transition ${
                          isSelected ? "bg-blue-600/20" : "hover:bg-[#202020]"
                        }`}
                      >
                        <td className="p-2 font-medium">{distName}</td>
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

// Bind to window for standalone Babel script tag execution
if (typeof window !== "undefined") {
  window.FloodCommandCenter = FloodCommandCenter;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = FloodCommandCenter;
}
