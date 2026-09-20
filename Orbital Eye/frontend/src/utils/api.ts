import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export interface CatalogItem {
  name: string;
  cat_nr: number;
  tle_line1: string;
  tle_line2: string;
}

export interface ScreenResult {
  pair: [number, number];
  pair_id: string;
  reason: string;
}

export interface EncounterResult {
  tca_time_utc: string;
  min_distance_km: number;
  v_rel_km_s: number[];
  B_T: number;
  B_R: number;
  miss_distance_km: number;
  P_c: number;
}

export interface ManeuverResult {
  delta_v_km_s: number[];
  delta_v_magnitude_km_s: number;
  status: string;
  optimal_cost: number;
  post_maneuver_miss_estimated_km: number;
}

export const api = {
  async getCatalog(): Promise<CatalogItem[]> {
    const { data } = await axios.get(`${API_BASE}/catalog`);
    return data.items || data || [];
  },
  async postScreen(): Promise<ScreenResult[]> {
    const { data } = await axios.post(`${API_BASE}/screen`);
    return data.flagged || data || [];
  },
  async postAnalyzeEncounter(pairId?: string): Promise<EncounterResult> {
    const { data } = await axios.post(`${API_BASE}/analyze-encounter`, { pair_id: pairId || '25544_25544' });
    return data;
  },
  async postOptimizeManeuver(dataPayload: any): Promise<ManeuverResult> {
    const { data } = await axios.post(`${API_BASE}/optimize-maneuver`, dataPayload);
    return data;
  },
};
