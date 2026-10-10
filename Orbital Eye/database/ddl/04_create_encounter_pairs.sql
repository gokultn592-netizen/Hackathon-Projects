-- Metadata Header --
-- DDL Script: Encounter Pairs Table Creation
-- Generated for OrbitalEye DBMS Edition
-- Project: OrbitalEye DBMS Edition
-- Note: Matches INSERT statements from seed_realtime.sql and seed_accident.sql
-- Columns verified: pair_id, sat_a_norad, sat_b_norad, tca_utc,
--   miss_distance_km, rel_velocity_kms, b_plane_angle_deg, collision_prob, dataset_tag

SET SERVEROUTPUT ON;

CREATE TABLE encounter_pairs (
    pair_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sat_a_norad NUMBER NOT NULL,
    sat_b_norad NUMBER NOT NULL,
    tca_utc DATE NOT NULL,
    miss_distance_km NUMBER,
    rel_velocity_kms NUMBER,
    b_plane_angle_deg NUMBER,
    collision_prob NUMBER,
    dataset_tag VARCHAR2(20) NOT NULL CHECK (dataset_tag IN ('REALTIME', 'ACCIDENT'))
);

-- Foreign Key Constraints
-- Note: encounter_events.pair_id references this pair_id (enforced in encounter_events DDL)

CREATE INDEX idx_encounter_pairs_norad ON encounter_pairs(sat_a_norad);
CREATE INDEX idx_encounter_pairs_norad_b ON encounter_pairs(sat_b_norad);
CREATE INDEX idx_encounter_pairs_dataset_tag ON encounter_pairs(dataset_tag);
CREATE INDEX idx_encounter_pairs_tca_utc ON encounter_pairs(tca_utc);