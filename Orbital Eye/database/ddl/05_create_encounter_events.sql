-- Metadata Header --
-- DDL Script: Encounter Events Table Creation
-- Generated for OrbitalEye DBMS Edition
-- Project: OrbitalEye DBMS Edition
-- Note: Matches INSERT statements from seed_realtime.sql and seed_accident.sql
-- Columns verified: event_id, pair_id, event_type, event_time_utc, dataset_tag

SET SERVEROUTPUT ON;

CREATE TABLE encounter_events (
    event_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pair_id NUMBER NOT NULL,
    event_type VARCHAR2(30) NOT NULL,
    event_time_utc DATE NOT NULL,
    dataset_tag VARCHAR2(20) NOT NULL CHECK (dataset_tag IN ('REALTIME', 'ACCIDENT')),

    -- Foreign Key: event references its parent pair
    CONSTRAINT fk_encounter_events_pair
        FOREIGN KEY (pair_id)
        REFERENCES encounter_pairs(pair_id)
);

CREATE INDEX idx_encounter_events_pair ON encounter_events(pair_id);
CREATE INDEX idx_encounter_events_dataset_tag ON encounter_events(dataset_tag);
CREATE INDEX idx_encounter_events_time ON encounter_events(event_time_utc);