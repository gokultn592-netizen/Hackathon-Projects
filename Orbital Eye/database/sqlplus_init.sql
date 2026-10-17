SET LINESIZE 200
SET PAGESIZE 50
SET WRAP OFF
SET TRIMOUT ON
SET TRIMSPOOL ON
SET FEEDBACK ON
SET HEADING ON
SET TIME OFF
SET TIMING OFF
SET DEFINE OFF

COLUMN TABLE_NAME FORMAT A22 HEADING "TABLE NAME"
COLUMN NUM_ROWS FORMAT 999,999 HEADING "ROW COUNT"
COLUMN SATELLITE_NAME FORMAT A22 HEADING "SATELLITE NAME"
COLUMN STATUS FORMAT A12 HEADING "STATUS"
COLUMN NORAD_ID FORMAT 999999 HEADING "NORAD ID"
COLUMN MISS_DISTANCE_KM FORMAT 990.99 HEADING "MISS DIST (KM)"
COLUMN REL_VELOCITY_KMS FORMAT 990.99 HEADING "VREL (KM/S)"
COLUMN COLLISION_PROB FORMAT 0.99 HEADING "PROB (PC)"
COLUMN PAIR_ID FORMAT 99999 HEADING "PAIR ID"
COLUMN SAT_A_NAME FORMAT A20 HEADING "SAT A"
COLUMN SAT_B_NAME FORMAT A20 HEADING "SAT B"

PROMPT
PROMPT ===============================================================================
PROMPT   ORBITALEYE DBMS EDITION -- ORACLE DATABASE 21c XE CONSOLE
PROMPT ===============================================================================
PROMPT   Connected User: ORBITAL_EYE
PROMPT   Target Host   : localhost:1521
PROMPT   Service (PDB) : XEPDB1
PROMPT
PROMPT   LIVE DATABASE TABLES & RECORD COUNTS:
PROMPT   =============================================================================

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
PROMPT   HANDY SQL COMMANDS YOU CAN RUN RIGHT NOW:
PROMPT   =============================================================================
PROMPT   * View Active Satellites:
PROMPT     SELECT satellite_name, norad_id, status FROM satellites WHERE rownum <= 10;
PROMPT
PROMPT   * View Critical Conjunction Encounters (< 2 km):
PROMPT     SELECT pair_id, sat_a_norad, sat_b_norad, miss_distance_km, collision_prob
PROMPT     FROM encounter_pairs WHERE miss_distance_km < 2.0 AND rownum <= 10;
PROMPT
PROMPT   * View Real TLE Ephemerides:
PROMPT     SELECT s.satellite_name, ts.tle_line1 FROM tle_sets ts
PROMPT     JOIN satellites s ON ts.satellite_id = s.satellite_id WHERE rownum <= 5;
PROMPT
PROMPT   * Inspect Table Structure:
PROMPT     DESCRIBE satellites;
PROMPT     DESCRIBE encounter_pairs;
PROMPT
PROMPT   Type EXIT to close the SQL*Plus console.
PROMPT ===============================================================================
PROMPT
