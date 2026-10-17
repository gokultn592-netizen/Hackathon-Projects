#!/usr/bin/env python3
"""
OrbitalEye Oracle Database MCP Server
Compliant with Model Context Protocol (MCP) JSON-RPC 2.0 stdio specification.
Provides direct tool access to OrbitalEye's Oracle Database 21c (XEPDB1).
"""

import sys
import os
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

# Load .env from project root
project_root = Path(__file__).resolve().parent.parent
env_file = project_root / ".env"

if env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(env_file)
    except ImportError:
        pass

try:
    import oracledb
except ImportError:
    oracledb = None


def get_connection():
    if not oracledb:
        raise RuntimeError("oracledb package is not installed")
    user = os.getenv("ORACLE_USER", "ORBITAL_EYE")
    password = os.getenv("ORACLE_PASS") or os.getenv("ORACLE_PASSWORD", "OrbitalEye_2026")
    host = os.getenv("ORACLE_HOST", "localhost")
    port = int(os.getenv("ORACLE_PORT", "1521"))
    service = os.getenv("ORACLE_SERVICE", "XEPDB1")

    return oracledb.connect(
        user=user,
        password=password,
        host=host,
        port=port,
        service_name=service,
    )


# MCP Tool Definitions
TOOLS = [
    {
        "name": "oracle_list_tables",
        "description": "Lists all tables and views in the OrbitalEye Oracle schema along with row counts.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "oracle_describe_table",
        "description": "Returns column metadata, data types, nullability, and primary key constraints for a specific table in the Oracle database.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "table_name": {
                    "type": "string",
                    "description": "The name of the table to describe (case-insensitive, e.g. 'SATELLITES', 'ENCOUNTER_EVENTS', 'TLE_SETS')",
                }
            },
            "required": ["table_name"],
        },
    },
    {
        "name": "oracle_query",
        "description": "Executes a read-only SQL SELECT query against the OrbitalEye Oracle Database and returns structured rows as JSON.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "The SQL SELECT statement to execute.",
                },
                "max_rows": {
                    "type": "number",
                    "description": "Maximum number of rows to return (default: 50, maximum: 500).",
                },
            },
            "required": ["sql"],
        },
    },
    {
        "name": "oracle_explain_plan",
        "description": "Generates and returns the Oracle EXPLAIN PLAN execution hierarchy for a given SQL query to analyze indexing and performance.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "The SQL query to explain.",
                }
            },
            "required": ["sql"],
        },
    },
]


def handle_list_tables() -> str:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT table_name FROM user_tables ORDER BY table_name")
        tables = [row[0] for row in cur.fetchall()]
        
        result = []
        for t in tables:
            try:
                cur.execute(f"SELECT COUNT(*) FROM \"{t}\"")
                count = cur.fetchone()[0]
            except Exception:
                count = "N/A"
            result.append({"table_name": t, "row_count": count})
        return json.dumps(result, indent=2)
    finally:
        conn.close()


def handle_describe_table(table_name: str) -> str:
    conn = get_connection()
    try:
        cur = conn.cursor()
        t_upper = table_name.upper().strip()

        cur.execute("""
            SELECT column_name, data_type, data_length, data_precision, data_scale, nullable
            FROM user_tab_columns
            WHERE table_name = :tname
            ORDER BY column_id
        """, [t_upper])
        cols = cur.fetchall()

        if not cols:
            return f"Table '{table_name}' was not found in current Oracle schema."

        cur.execute("""
            SELECT cols.column_name
            FROM user_constraints cons
            JOIN user_cons_columns cols ON cons.constraint_name = cols.constraint_name
            WHERE cons.constraint_type = 'P' AND cons.table_name = :tname
        """, [t_upper])
        pk_cols = set(row[0] for row in cur.fetchall())

        metadata = []
        for c in cols:
            c_name, d_type, d_len, d_prec, d_scale, nullable = c
            type_str = d_type
            if d_type in ("VARCHAR2", "CHAR"):
                type_str = f"{d_type}({d_len})"
            elif d_type == "NUMBER" and d_prec:
                type_str = f"NUMBER({d_prec},{d_scale or 0})"

            metadata.append({
                "column": c_name,
                "type": type_str,
                "nullable": nullable == "Y",
                "primary_key": c_name in pk_cols,
            })

        return json.dumps({"table": t_upper, "columns": metadata}, indent=2)
    finally:
        conn.close()


def handle_query(sql: str, max_rows: int = 50) -> str:
    clean_sql = sql.strip().rstrip(";")
    first_word = clean_sql.split()[0].upper() if clean_sql else ""
    if first_word not in ("SELECT", "WITH"):
        return "Error: oracle_query only permits read-only SELECT and WITH statements."

    limit = min(500, max(1, int(max_rows or 50)))
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(clean_sql)
        columns = [desc[0] for desc in cur.description] if cur.description else []
        rows = cur.fetchmany(limit)

        records = []
        for row in rows:
            record = {}
            for col_name, val in zip(columns, row):
                if hasattr(val, "isoformat"):
                    record[col_name] = val.isoformat()
                elif hasattr(val, "read"):
                    record[col_name] = val.read()
                else:
                    record[col_name] = val
            records.append(record)

        return json.dumps({
            "rows_returned": len(records),
            "columns": columns,
            "data": records,
        }, indent=2)
    finally:
        conn.close()


def handle_explain_plan(sql: str) -> str:
    clean_sql = sql.strip().rstrip(";")
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(f"EXPLAIN PLAN FOR {clean_sql}")
        cur.execute("SELECT plan_table_output FROM TABLE(DBMS_XPLAN.DISPLAY())")
        lines = [row[0] for row in cur.fetchall()]
        return "\n".join(lines)
    finally:
        conn.close()


def process_message(line: str) -> Optional[Dict[str, Any]]:
    if not line.strip():
        return None

    try:
        req = json.loads(line)
    except json.JSONDecodeError:
        return {
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32700, "message": "Parse error"},
        }

    msg_id = req.get("id")
    method = req.get("method")
    params = req.get("params", {})

    # 1. Initialize
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {},
                },
                "serverInfo": {
                    "name": "orbitaleye-oracle-mcp",
                    "version": "1.0.0",
                },
            },
        }

    # 2. Notification initialized
    if method == "notifications/initialized":
        return None

    # 3. Ping
    if method == "ping":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {},
        }

    # 4. List Tools
    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "tools": TOOLS,
            },
        }

    # 5. Call Tool
    if method == "tools/call":
        tool_name = params.get("name")
        args = params.get("arguments", {})

        try:
            if tool_name == "oracle_list_tables":
                out = handle_list_tables()
            elif tool_name == "oracle_describe_table":
                out = handle_describe_table(args.get("table_name", ""))
            elif tool_name == "oracle_query":
                out = handle_query(args.get("sql", ""), args.get("max_rows", 50))
            elif tool_name == "oracle_explain_plan":
                out = handle_explain_plan(args.get("sql", ""))
            else:
                return {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {"code": -32601, "message": f"Method/tool '{tool_name}' not found"},
                }

            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": out,
                        }
                    ],
                    "isError": False,
                },
            }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Oracle MCP Error: {str(e)}",
                        }
                    ],
                    "isError": True,
                },
            }

    # Unknown method
    if msg_id is not None:
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "error": {"code": -32601, "message": f"Method '{method}' not found"},
        }
    return None


def main():
    # Set standard I/O to unbuffered UTF-8 mode
    if sys.platform == "win32":
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)

    reader = sys.stdin
    writer = sys.stdout

    while True:
        try:
            line = reader.readline()
            if not line:
                break
            resp = process_message(line)
            if resp is not None:
                out_str = json.dumps(resp, ensure_ascii=False) + "\n"
                writer.write(out_str)
                writer.flush()
        except (KeyboardInterrupt, SystemExit):
            break
        except Exception as e:
            sys.stderr.write(f"Server exception: {e}\n")
            sys.stderr.flush()


if __name__ == "__main__":
    main()
