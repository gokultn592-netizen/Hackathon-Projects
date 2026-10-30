-- Metadata Header --
-- Generation timestamp: 2026-10-25 06:46:30 UTC
-- Data source: Hardcoded published parameters (Kelso AMOS 2009 paper)
-- Record count: 27
-- Dataset tag: ACCIDENT
-- Project: OrbitalEye DBMS Edition
-- Note: Space-Track.org registration is pending for historical TLE validation.

SET SERVEROUTPUT ON;
SET SQLBLANKLINES ON;
BEGIN
  -- 2009 Iridium 33 / Cosmos 2251 collision simulation insert block
  BEGIN
    INSERT INTO operators (operator_id, operator_name, country, dataset_tag) VALUES (9001, 'Iridium Communications', 'USA', 'ACCIDENT');
    INSERT INTO operators (operator_id, operator_name, country, dataset_tag) VALUES (9002, 'Russian Space Forces', 'RUS', 'ACCIDENT');
    INSERT INTO satellites (satellite_id, norad_id, satellite_name, operator_id, status, mass_kg, dataset_tag) VALUES (9001, 24946, 'Iridium 33', 9001, 'DESTROYED', 560.0, 'ACCIDENT');
    INSERT INTO satellites (satellite_id, norad_id, satellite_name, operator_id, status, mass_kg, dataset_tag) VALUES (9002, 22675, 'Cosmos 2251', 9002, 'DESTROYED', 900.0, 'ACCIDENT');
    INSERT INTO tle_sets (tle_set_id, satellite_id, tle_line1, tle_line2, epoch_utc, dataset_tag) VALUES (9001, 9001, '1 24946U 97075C   09042.72916667  .00000158  00000-0  59815-4 0  999', '2 24946  51.6136 312.0438 0006076  85.5125  74.3278 15.09516279 4982', TO_DATE('2009-02-10 16:55:59', 'YYYY-MM-DD HH24:MI:SS'), 'ACCIDENT');
    INSERT INTO tle_sets (tle_set_id, satellite_id, tle_line1, tle_line2, epoch_utc, dataset_tag) VALUES (9002, 9002, '1 22675U 93036A   09042.72916667  .00000158  00000-0  59815-4 0  999', '2 22675  74.0000 133.0000 0011000 240.0000  14.0000 15.00000000  0001', TO_DATE('2009-02-10 16:55:59', 'YYYY-MM-DD HH24:MI:SS'), 'ACCIDENT');
    INSERT INTO encounter_pairs (pair_id, sat_a_norad, sat_b_norad, tca_utc, miss_distance_km, rel_velocity_kms, b_plane_angle_deg, collision_prob, dataset_tag) VALUES (9001, 24946, 22675, TO_DATE('2009-02-10 16:55:59', 'YYYY-MM-DD HH24:MI:SS'), 0.584, 11, 45, 1, 'ACCIDENT');
    INSERT INTO encounter_events (event_id, pair_id, event_type, event_time_utc, dataset_tag) VALUES (9001, 9001, 'COLLISION', TO_DATE('2009-02-10 16:55:59', 'YYYY-MM-DD HH24:MI:SS'), 'ACCIDENT');
INSERT ALL
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9001, 9001, 9001, 24946, 'FRAGMENT', 0.6, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9002, 9001, 9001, 22675, 'FRAGMENT', 0.7, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9003, 9001, 9001, 24946, 'FRAGMENT', 0.8, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9004, 9001, 9001, 22675, 'FRAGMENT', 0.9, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9005, 9001, 9001, 24946, 'FRAGMENT', 1, 790, 11, 'ACCIDENT')
SELECT * FROM DUAL;
INSERT ALL
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9006, 9001, 9001, 22675, 'FRAGMENT', 1.1, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9007, 9001, 9001, 24946, 'FRAGMENT', 1.2, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9008, 9001, 9001, 22675, 'FRAGMENT', 1.3, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9009, 9001, 9001, 24946, 'FRAGMENT', 1.4, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9010, 9001, 9001, 22675, 'FRAGMENT', 1.5, 790, 11, 'ACCIDENT')
SELECT * FROM DUAL;
INSERT ALL
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9011, 9001, 9001, 24946, 'FRAGMENT', 1.6, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9012, 9001, 9001, 22675, 'FRAGMENT', 1.7, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9013, 9001, 9001, 24946, 'FRAGMENT', 1.8, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9014, 9001, 9001, 22675, 'FRAGMENT', 1.9, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9015, 9001, 9001, 24946, 'FRAGMENT', 2, 790, 11, 'ACCIDENT')
SELECT * FROM DUAL;
INSERT ALL
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9016, 9001, 9001, 22675, 'FRAGMENT', 2.1, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9017, 9001, 9001, 24946, 'FRAGMENT', 2.2, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9018, 9001, 9001, 22675, 'FRAGMENT', 2.3, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9019, 9001, 9001, 24946, 'FRAGMENT', 2.4, 790, 11, 'ACCIDENT')
  INTO debris (debris_id, parent_event_id, parent_pair_id, debris_norad_ref, status, mass_kg, altitude_km, relative_velocity_kms, dataset_tag) VALUES (9020, 9001, 9001, 22675, 'FRAGMENT', 2.5, 790, 11, 'ACCIDENT')
SELECT * FROM DUAL;
  COMMIT;
  EXCEPTION
    WHEN OTHERS THEN
      DBMS_OUTPUT.PUT_LINE('Insert error in accident batch: ' || SQLERRM);
      ROLLBACK;
      RAISE;
  END;
END;
/
