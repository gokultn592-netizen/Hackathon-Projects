"""
Script to update encounter_pairs in Oracle DB with realistic, diverse miss distances and collision probabilities.
"""
import asyncio
import os
import oracledb
from dotenv import load_dotenv

load_dotenv()

async def update_encounters():
    user = os.getenv("ORACLE_USER", "ORBITAL_EYE")
    password = os.getenv("ORACLE_PASSWORD") or os.getenv("ORACLE_PASS")
    host = os.getenv("ORACLE_HOST", "localhost")
    port = os.getenv("ORACLE_PORT", "1521")
    service = os.getenv("ORACLE_SERVICE", "XEPDB1")
    dsn = f"{host}:{port}/{service}"

    print(f"Connecting to Oracle DB as {user} at {dsn}...")
    conn = await oracledb.connect_async(user=user, password=password, dsn=dsn)
    cursor = conn.cursor()

    # Fetch all pair_ids for REALTIME dataset
    await cursor.execute("SELECT pair_id FROM encounter_pairs WHERE dataset_tag = 'REALTIME' ORDER BY pair_id")
    rows = await cursor.fetchall()
    print(f"Found {len(rows)} REALTIME encounter pairs.")

    updates = []
    for (pair_id,) in rows:
        # Realistic tiered distribution
        if pair_id % 37 == 0:
            # CRITICAL (< 2.0 km, high collision probability)
            dist = round(0.35 + ((pair_id * 17) % 150) / 100.0, 2)
            prob = round(0.40 + ((pair_id * 31) % 55) / 100.0, 2)
        elif pair_id % 7 == 0:
            # CAUTION (2.0 - 9.9 km, moderate collision probability)
            dist = round(2.10 + ((pair_id * 23) % 780) / 100.0, 2)
            prob = round(0.06 + ((pair_id * 13) % 18) / 100.0, 2)
        else:
            # NOMINAL (10.0 - 48.0 km, 0.0 collision probability)
            dist = round(10.20 + ((pair_id * 19) % 3800) / 100.0, 2)
            prob = 0.0

        rel_vel = round(6.5 + ((pair_id * 7) % 75) / 10.0, 2)
        updates.append((dist, rel_vel, prob, pair_id))

    print(f"Updating {len(updates)} records in batch...")
    sql = """
        UPDATE encounter_pairs
        SET miss_distance_km = :1,
            rel_velocity_kms = :2,
            collision_prob = :3
        WHERE pair_id = :4
    """
    await cursor.executemany(sql, updates)
    await conn.commit()
    print("Update committed successfully!")

    # Verify distribution
    await cursor.execute("""
        SELECT 
            COUNT(CASE WHEN miss_distance_km < 2.0 THEN 1 END) AS crit_cnt,
            COUNT(CASE WHEN miss_distance_km >= 2.0 AND miss_distance_km < 10.0 THEN 1 END) AS caut_cnt,
            COUNT(CASE WHEN miss_distance_km >= 10.0 THEN 1 END) AS nom_cnt,
            MIN(miss_distance_km),
            MAX(miss_distance_km)
        FROM encounter_pairs
        WHERE dataset_tag = 'REALTIME'
    """)
    summary = await cursor.fetchone()
    print(f"Verification Summary -> Critical: {summary[0]}, Caution: {summary[1]}, Nominal: {summary[2]}, Min Dist: {summary[3]} km, Max Dist: {summary[4]} km")

    await cursor.close()
    await conn.close()

if __name__ == "__main__":
    asyncio.run(update_encounters())
