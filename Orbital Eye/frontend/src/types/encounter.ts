export interface EncounterPairResponse {
  pair_id: number;
  sat_a_name: string;
  sat_b_name: string;
  miss_distance_km: number;
  rel_velocity_kms: number;
  tca_utc: string;
  collision_prob: number;
  sat_a_norad?: number;
  sat_b_norad?: number;
}
