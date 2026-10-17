"""
database/ingest_more_satellites.py

Ingest additional real satellites from starlink.tle and oneweb.tle into Oracle 21c XE
to provide up to 250+ full real satellites with valid TLEs.
Hardened with .env configuration, dynamic path resolution, and batch DML (executemany).
"""

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
import oracledb
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

def main(target_total: int = 250):
    user = os.getenv("ORACLE_USER", "ORBITAL_EYE")
    password = os.getenv("ORACLE_PASSWORD") or os.getenv("ORACLE_PASS", "OrbitalEye_2026")
    host = os.getenv("ORACLE_HOST", "localhost")
    port = os.getenv("ORACLE_PORT", "1521")
    service = os.getenv("ORACLE_SERVICE", "XEPDB1")
    dsn = os.getenv("ORACLE_DSN", f"{host}:{port}/{service}")

    starlink_path = PROJECT_ROOT / "starlink.tle"
    oneweb_path = PROJECT_ROOT / "oneweb.tle"

    conn = None
    try:
        conn = oracledb.connect(
            user=user,
            password=password,
            dsn=dsn
        )
        cursor = conn.cursor()

        # Get existing norad_ids
        cursor.execute("SELECT norad_id FROM satellites")
        existing_norads = set(row[0] for row in cursor.fetchall())
        print(f"Existing satellites in Oracle DB: {len(existing_norads)}")

        cursor.execute("SELECT NVL(MAX(satellite_id), 0) FROM satellites WHERE satellite_id < 9000")
        curr_sat_id = cursor.fetchone()[0]
        cursor.execute("SELECT NVL(MAX(tle_set_id), 0) FROM tle_sets WHERE tle_set_id < 9000")
        curr_tle_id = cursor.fetchone()[0]

        needed = target_total - len(existing_norads)
        if needed <= 0:
            print(f"Already have {len(existing_norads)} satellites (target was {target_total}). No ingestion needed.")
            return

        print(f"Targeting {needed} additional satellites from {starlink_path.name}...")

        candidates = []
        if starlink_path.exists():
            with open(starlink_path, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]
                for i in range(0, len(lines) - 2, 3):
                    name = lines[i]
                    l1 = lines[i+1]
                    l2 = lines[i+2]
                    try:
                        norad = int(l1[2:7])
                        if norad not in existing_norads:
                            candidates.append((norad, name, 2, l1, l2))  # operator_id 2 = SpaceX
                            existing_norads.add(norad)
                            if len(candidates) >= needed:
                                break
                    except Exception:
                        continue

        if not candidates:
            print("No new candidate satellites found to ingest.")
            return

        # Prepare batch payloads for high-throughput insertion
        epoch_dt = datetime(2026, 10, 3, 12, 0, 0, tzinfo=timezone.utc)
        sat_batch = []
        tle_batch = []

        for norad, name, op_id, l1, l2 in candidates:
            curr_sat_id += 1
            curr_tle_id += 1
            sat_batch.append((curr_sat_id, norad, name[:30], op_id, "ACTIVE", 260, "REALTIME"))
            tle_batch.append((curr_tle_id, curr_sat_id, l1, l2, epoch_dt, "REALTIME"))

        print(f"Executing batch insertion for {len(sat_batch)} satellites via cursor.executemany()...")
        cursor.executemany(
            """
            INSERT INTO satellites (satellite_id, norad_id, satellite_name, operator_id, status, mass_kg, dataset_tag)
            VALUES (:1, :2, :3, :4, :5, :6, :7)
            """,
            sat_batch
        )
        cursor.executemany(
            """
            INSERT INTO tle_sets (tle_set_id, satellite_id, tle_line1, tle_line2, epoch_utc, dataset_tag)
            VALUES (:1, :2, :3, :4, :5, :6)
            """,
            tle_batch
        )
        conn.commit()

        cursor.execute("SELECT COUNT(*) FROM satellites")
        total = cursor.fetchone()[0]
        print(f"Successfully added {len(sat_batch)} real satellites! Total in DB: {total}")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error during satellite ingestion: {e}")
        raise
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    target = int(sys.argv[1]) if len(sys.argv) > 1 else 250
    main(target)
