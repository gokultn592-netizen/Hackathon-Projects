-- Metadata Header --
-- DDL Script: TLE Sets Table Creation
-- Generated for OrbitalEye DBMS Edition
-- Project: OrbitalEye DBMS Edition
-- Note: Matches INSERT statements from seed_realtime.sql and seed_accident.sql

SET SERVEROUTPUT ON;

CREATE TABLE tle_sets (
    tle_set_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    satellite_id NUMBER NOT NULL,
    tle_line1 VARCHAR2(80) NOT NULL,
    tle_line2 VARCHAR2(80) NOT NULL,
    epoch_utc DATE NOT NULL,
    dataset_tag VARCHAR2(20) NOT NULL CHECK (dataset_tag IN ('REALTIME', 'ACCIDENT')),

    CONSTRAINT fk_tle_sets_satellite
        FOREIGN KEY (satellite_id)
        REFERENCES satellites(satellite_id)
);

CREATE INDEX idx_tle_sets_dataset_tag ON tle_sets(dataset_tag);
CREATE INDEX idx_tle_sets_epoch_utc ON tle_sets(epoch_utc);