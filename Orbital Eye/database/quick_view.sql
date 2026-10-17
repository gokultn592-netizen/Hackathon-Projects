SET LINESIZE 200
SET PAGESIZE 100
SET WRAP OFF
SET TRIMOUT ON
SET TRIMSPOOL ON
SET FEEDBACK ON
SET HEADING ON
SET DEFINE OFF

COLUMN TABLE_NAME FORMAT A22 HEADING "TABLE NAME"
COLUMN NUM_ROWS FORMAT 999,999 HEADING "ROW COUNT"
COLUMN SATELLITE_NAME FORMAT A25 HEADING "SATELLITE NAME"
COLUMN STATUS FORMAT A12 HEADING "STATUS"
COLUMN NORAD_ID FORMAT 999999 HEADING "NORAD ID"
COLUMN MISS_DISTANCE_KM FORMAT 990.99 HEADING "MISS DIST (KM)"
COLUMN REL_VELOCITY_KMS FORMAT 990.99 HEADING "VREL (KM/S)"
COLUMN COLLISION_PROB FORMAT 0.9999 HEADING "PROB (PC)"
COLUMN PAIR_ID FORMAT 99999 HEADING "PAIR ID"
COLUMN SAT_A_NORAD FORMAT 999999 HEADING "SAT A NORAD"
COLUMN SAT_B_NORAD FORMAT 999999 HEADING "SAT B NORAD"
COLUMN EPOCH_START FORMAT A20 HEADING "EPOCH UTC"

PROMPT
PROMPT ===============================================================================
PROMPT               ORBITALEYE DBMS EDITION -- DATABASE SNAPSHOT
PROMPT ===============================================================================
PROMPT Connected to: ORBITAL_EYE@localhost:1521/XEPDB1
PROMPT

PROMPT [1] TABLE ROW COUNTS:
PROMPT ===============================================================================
SELECT table_name,
       CASE table_name
         WHEN 'SATELLITES' THEN (SELECT count(*) FROM satellites)
         WHEN 'TLE_SETS' THEN (SELECT count(*) FROM tle_sets)
         WHEN 'ENCOUNTER_PAIRS' THEN (SELECT count(*) FROM encounter_pairs)
         WHEN 'ENCOUNTER_EVENTS' THEN (SELECT count(*) FROM encounter_events)
         WHEN 'OPERATORS' THEN (SELECT count(*) FROM operators)
         WHEN 'DEBRIS' THEN (SELECT count(*) FROM debris)
         ELSE 0
       END AS num_rows
FROM user_tables
ORDER BY table_name;

PROMPT
PROMPT [2] ACTIVE SATELLITES SAMPLE (First 10 of 98 in Database):
PROMPT ===============================================================================
SELECT norad_id, satellite_name, status
FROM satellites
WHERE rownum <= 10;

PROMPT
PROMPT [3] TOP CRITICAL CONJUNCTIONS SAMPLE (Closest Miss Distances):
PROMPT ===============================================================================
SELECT pair_id, sat_a_norad, sat_b_norad, miss_distance_km, rel_velocity_kms, collision_prob
FROM encounter_pairs
WHERE miss_distance_km < 5.0 AND rownum <= 10
ORDER BY miss_distance_km ASC;

PROMPT
PROMPT ===============================================================================
PROMPT End of Database Inspection.
PROMPT ===============================================================================
PROMPT
EXIT;
