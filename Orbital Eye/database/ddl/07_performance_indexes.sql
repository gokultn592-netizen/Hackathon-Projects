-- database/ddl/07_performance_indexes.sql
-- Optimizes query performance for /api/encounters and /api/satellites/positions
-- Eliminates table full scans and speeds up queries across 4,500+ encounter pairs.

-- 1. Covering composite index for encounter pairs ordered by miss distance
-- Covers all columns selected by /api/encounters so Oracle never touches table blocks
CREATE INDEX idx_ep_dataset_miss ON encounter_pairs(
    dataset_tag, miss_distance_km, sat_a_norad, sat_b_norad,
    rel_velocity_kms, collision_prob, tca_utc, pair_id
);

-- 2. Indexes for fast norad minimum miss distance lookups in satellite positions subquery
CREATE INDEX idx_ep_lookup_a ON encounter_pairs(dataset_tag, sat_a_norad, miss_distance_km);
CREATE INDEX idx_ep_lookup_b ON encounter_pairs(dataset_tag, sat_b_norad, miss_distance_km);
