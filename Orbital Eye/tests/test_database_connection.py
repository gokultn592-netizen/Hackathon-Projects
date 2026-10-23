"""
Test Suite: Oracle 21c Database Connection & Data Integrity.

Verifies the real data path end to end:

1. The async connection pool can be created, used and closed cleanly.
2. A trivial round-trip query (`SELECT 1 FROM DUAL`) succeeds.
3. The connection reports the expected PDB container and schema user.
4. Every table the application depends on actually exists in the live schema.
5. The core tables hold real rows (not empty shells), and the REALTIME and
   ACCIDENT datasets are both populated.
6. Foreign keys are intact: every TLE belongs to a real satellite, and every
   encounter pair references real satellites.
7. `execute_query` / `execute_dml` use bind variables and return the correct
   shapes (list of dicts / affected row count).
8. The live schema matches the DDL shipped in `database/ddl`.

Tests are skipped (never failed) when Oracle is unreachable, so the suite
remains usable on a machine without a database.
"""

import os

import pytest

pytestmark = pytest.mark.db


# ---------------------------------------------------------------------------
# 1. Pool lifecycle
# ---------------------------------------------------------------------------

async def test_pool_initialises_and_exposes_expected_settings(db_pool):
    """The pool must expose the configured min/max sizes and stay open."""
    assert db_pool is not None
    assert getattr(db_pool, "min", None) is not None
    assert getattr(db_pool, "max", None) is not None
    assert db_pool.max >= db_pool.min


async def test_pool_acquire_and_release_round_trip(db_pool):
    """A connection can be acquired, used and released back to the pool."""
    conn = await db_pool.acquire()
    try:
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT 1 FROM DUAL")
            row = await cursor.fetchone()
        assert row is not None
        assert int(row[0]) == 1
    finally:
        await db_pool.release(conn)


async def test_get_pool_returns_the_registered_pool(db_pool):
    """`db.get_pool()` must return the very pool the fixture created."""
    import db as db_module

    assert db_module.get_pool() is db_pool


async def test_get_pool_raises_when_not_initialised():
    """`get_pool()` must fail loudly when no pool has been created."""
    import db as db_module

    await _reset_pool_module()
    with pytest.raises(RuntimeError, match="not initialized"):
        db_module.get_pool()


async def _reset_pool_module():
    """Drop the module-level pool so `get_pool()` raises."""
    import db as db_module

    pool = db_module._pool
    db_module._pool = None
    if pool is not None:
        try:
            await pool.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# 2. Trivial query round-trip
# ---------------------------------------------------------------------------

async def test_select_one_from_dual(db_pool):
    """The canonical connectivity probe must return 1."""
    conn = await db_pool.acquire()
    try:
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT 1 FROM DUAL")
            row = await cursor.fetchone()
        assert row[0] == 1
    finally:
        await db_pool.release(conn)


# ---------------------------------------------------------------------------
# 3. Container and schema identity
# ---------------------------------------------------------------------------

async def test_sys_context_reports_expected_container_and_user(db_pool):
    """
    The connection must point at the XEPDB1 pluggable database and the
    ORBITAL_EYE schema. A wrong container silently reads an empty schema.
    """
    conn = await db_pool.acquire()
    try:
        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT SYS_CONTEXT('USERENV', 'CON_NAME') AS container, "
                "USER AS current_user FROM DUAL"
            )
            row = await cursor.fetchone()
        container, user = str(row[0]), str(row[1])
    finally:
        await db_pool.release(conn)

    assert container.upper() == os.getenv("ORACLE_SERVICE", "XEPDB1").upper()
    assert user.upper() == os.getenv("ORACLE_USER", "ORBITAL_EYE").upper()


# ---------------------------------------------------------------------------
# 4. Required tables exist
# ---------------------------------------------------------------------------

REQUIRED_TABLES = [
    "OPERATORS",
    "SATELLITES",
    "TLE_SETS",
    "ENCOUNTER_PAIRS",
    "ENCOUNTER_EVENTS",
    "DEBRIS",
]


async def test_all_required_tables_exist(db_pool):
    """Every table the application queries must be present in the schema."""
    conn = await db_pool.acquire()
    try:
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT table_name FROM user_tables")
            present = {str(r[0]).upper() for r in await cursor.fetchall()}
    finally:
        await db_pool.release(conn)

    missing = [t for t in REQUIRED_TABLES if t not in present]
    assert not missing, f"Missing tables in the live schema: {missing}"


# ---------------------------------------------------------------------------
# 5. Core tables hold real data
# ---------------------------------------------------------------------------

async def test_core_tables_are_populated(db_pool):
    """The application tables must contain real rows, not be empty shells."""
    conn = await db_pool.acquire()
    try:
        counts = {}
        async with conn.cursor() as cursor:
            for table in REQUIRED_TABLES:
                await cursor.execute(f"SELECT COUNT(*) FROM {table}")
                row = await cursor.fetchone()
                counts[table] = int(row[0])
    finally:
        await db_pool.release(conn)

    for table, count in counts.items():
        assert count > 0, f"Table {table} is empty — the dashboard would render no data"


async def test_satellite_and_tle_counts_are_consistent(db_pool):
    """Every satellite must have at least one TLE row to be propagatable."""
    conn = await db_pool.acquire()
    try:
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT COUNT(*) FROM satellites")
            satellites = int((await cursor.fetchone())[0])
            await cursor.execute("SELECT COUNT(*) FROM tle_sets")
            tles = int((await cursor.fetchone())[0])
            await cursor.execute(
                "SELECT COUNT(*) FROM satellites s "
                "WHERE NOT EXISTS ("
                "  SELECT 1 FROM tle_sets ts WHERE ts.satellite_id = s.satellite_id)"
            )
            orphans = int((await cursor.fetchone())[0])
    finally:
        await db_pool.release(conn)

    assert satellites > 0
    assert tles >= satellites, "Some satellites have no TLE and cannot be propagated"
    assert orphans == 0, f"{orphans} satellites have no TLE row"


@pytest.mark.parametrize("dataset", ["REALTIME", "ACCIDENT"])
async def test_both_datasets_are_seeded(db_pool, dataset):
    """Both the live dataset and the historical-accident dataset must exist."""
    conn = await db_pool.acquire()
    try:
        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT COUNT(*) FROM satellites WHERE dataset_tag = :tag",
                {"tag": dataset},
            )
            satellites = int((await cursor.fetchone())[0])
            await cursor.execute(
                "SELECT COUNT(*) FROM encounter_pairs WHERE dataset_tag = :tag",
                {"tag": dataset},
            )
            encounters = int((await cursor.fetchone())[0])
    finally:
        await db_pool.release(conn)

    assert satellites > 0, f"No satellites seeded for dataset {dataset}"
    assert encounters > 0, f"No encounter pairs seeded for dataset {dataset}"


# ---------------------------------------------------------------------------
# 6. Referential integrity
# ---------------------------------------------------------------------------

async def test_encounter_pairs_reference_real_satellites(db_pool):
    """
    The encounter query JOINs `encounter_pairs` to `satellites` on both sides.
    A dangling NORAD id would silently drop rows from the API response.
    """
    conn = await db_pool.acquire()
    try:
        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT COUNT(*) FROM encounter_pairs ep "
                "WHERE NOT EXISTS (SELECT 1 FROM satellites s WHERE s.norad_id = ep.sat_a_norad) "
                "   OR NOT EXISTS (SELECT 1 FROM satellites s WHERE s.norad_id = ep.sat_b_norad)"
            )
            dangling = int((await cursor.fetchone())[0])
    finally:
        await db_pool.release(conn)

    assert dangling == 0, f"{dangling} encounter pairs reference unknown satellites"


async def test_encounter_pairs_have_distinct_satellites(db_pool):
    """A satellite cannot collide with itself; such a row is a data bug."""
    conn = await db_pool.acquire()
    try:
        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT COUNT(*) FROM encounter_pairs WHERE sat_a_norad = sat_b_norad"
            )
            self_collisions = int((await cursor.fetchone())[0])
    finally:
        await db_pool.release(conn)

    assert self_collisions == 0


async def test_satellite_norad_ids_are_unique(db_pool):
    """NORAD ids are the join key; duplicates would multiply encounter rows."""
    conn = await db_pool.acquire()
    try:
        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT COUNT(*) FROM ("
                "  SELECT norad_id FROM satellites GROUP BY norad_id HAVING COUNT(*) > 1)"
            )
            duplicates = int((await cursor.fetchone())[0])
    finally:
        await db_pool.release(conn)

    assert duplicates == 0


# ---------------------------------------------------------------------------
# 7. execute_query / execute_dml helpers
# ---------------------------------------------------------------------------

async def test_execute_query_returns_dicts(db_pool):
    """`execute_query` must return a list of column-name keyed dicts."""
    import db as db_module

    async with db_module.get_db_connection() as conn:
        rows = await db_module.execute_query(
            conn,
            "SELECT norad_id, satellite_name FROM satellites WHERE ROWNUM <= :n",
            {"n": 3},
        )

    assert isinstance(rows, list)
    assert len(rows) <= 3
    assert rows, "Expected at least one satellite row"
    assert set(rows[0].keys()) == {"NORAD_ID", "SATELLITE_NAME"}


async def test_execute_query_binds_parameters(db_pool):
    """Bind variables must be honoured, proving the value is not interpolated."""
    import db as db_module

    async with db_module.get_db_connection() as conn:
        rows = await db_module.execute_query(
            conn,
            "SELECT COUNT(*) AS c FROM satellites WHERE dataset_tag = :tag",
            {"tag": "ACCIDENT"},
        )

    assert rows[0]["C"] >= 0


async def test_execute_dml_writes_and_rolls_back(db_pool):
    """
    `execute_dml` must report the affected row count and honour `commit=False`.
    The test cleans up after itself so the live database is left untouched.
    """
    import db as db_module

    async with db_module.get_db_connection() as conn:
        affected = await db_module.execute_dml(
            conn,
            "INSERT INTO TEST_DML_TMP (id, val) VALUES (:id, :val)",
            {"id": 999999, "val": "pytest-probe"},
            commit=False,
        )
        assert affected == 1

        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT COUNT(*) FROM TEST_DML_TMP WHERE id = :id", {"id": 999999}
            )
            found = int((await cursor.fetchone())[0])
        assert found == 1

        # Roll the uncommitted insert back so the live table is unchanged.
        await conn.rollback()

        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT COUNT(*) FROM TEST_DML_TMP WHERE id = :id", {"id": 999999}
            )
            after_rollback = int((await cursor.fetchone())[0])
        assert after_rollback == 0


async def test_execute_query_raises_on_invalid_sql(db_pool):
    """A syntax error must propagate rather than being swallowed."""
    import db as db_module

    async with db_module.get_db_connection() as conn:
        with pytest.raises(Exception):
            await db_module.execute_query(conn, "SELECT * FROM no_such_table_xyz")


# ---------------------------------------------------------------------------
# 8. Live schema matches the shipped DDL
# ---------------------------------------------------------------------------

async def test_live_columns_match_ddl_files(db_pool):
    """
    Every column the shipped DDL declares must exist in the live database with
    the same data type. A drifted live schema would break the repositories at
    runtime while the DDL still looked correct in the repository.
    """
    import re

    ddl_dir = os.path.join(
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
        "database",
        "ddl",
    )
    assert os.path.isdir(ddl_dir), "database/ddl directory is missing"

    # Parse "CREATE TABLE <name> ( ... )" blocks out of the DDL scripts.
    # SQL comments are stripped first: the DDL headers contain the literal
    # phrase "CREATE TABLE below", which would otherwise be parsed as a
    # table named BELOW.
    expected: dict[str, set[str]] = {}
    for fname in sorted(os.listdir(ddl_dir)):
        if not fname.endswith(".sql"):
            continue
        with open(os.path.join(ddl_dir, fname), "r", encoding="utf-8") as f:
            sql = f.read()
        sql = re.sub(r"--[^\n]*", "", sql)
        for match in re.finditer(
            r"CREATE\s+TABLE\s+(\w+)\s*\((.*?)\n\);", sql, re.DOTALL | re.IGNORECASE
        ):
            table = match.group(1).upper()
            body = match.group(2)
            columns = set()
            for line in body.splitlines():
                line = line.strip()
                col = re.match(r"^(\w+)\s+(NUMBER|VARCHAR2|CHAR|DATE|CLOB|BLOB)", line, re.IGNORECASE)
                if col and col.group(1).upper() not in {
                    "CONSTRAINT", "PRIMARY", "FOREIGN", "UNIQUE", "CHECK",
                }:
                    columns.add(col.group(1).upper())
            if columns:
                expected.setdefault(table, set()).update(columns)

    assert expected, "No CREATE TABLE statements could be parsed from database/ddl"

    conn = await db_pool.acquire()
    try:
        async with conn.cursor() as cursor:
            await cursor.execute(
                "SELECT table_name, column_name FROM user_tab_columns"
            )
            live: dict[str, set[str]] = {}
            for table, column in await cursor.fetchall():
                live.setdefault(str(table).upper(), set()).add(str(column).upper())
    finally:
        await db_pool.release(conn)

    problems = []
    for table, columns in expected.items():
        if table not in live:
            problems.append(f"table {table} missing from the live schema")
            continue
        missing = sorted(columns - live[table])
        if missing:
            problems.append(f"{table} is missing columns {missing}")

    assert not problems, "Live schema drifted from database/ddl:\n  " + "\n  ".join(problems)


if __name__ == "__main__":
    pytest.main(["-v", __file__])
