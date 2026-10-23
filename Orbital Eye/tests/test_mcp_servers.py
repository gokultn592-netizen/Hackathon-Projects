"""
Test Suite: MCP Servers (Model Context Protocol, JSON-RPC 2.0 over stdio).

The project ships two MCP servers:

1. `database/oracle_mcp_server.py` — direct Oracle 21c access
   (list tables, describe a table, run a read-only query, explain a plan).
2. `backend/orbitaleye_bridge_mcp.py` — live control of the running React
   frontend through the FastAPI bridge.

Verified requirements:
1. Both servers implement the MCP handshake: `initialize` returns the
   protocol version and the server identity, and `tools/list` returns the
   documented tool manifest.
2. The Oracle MCP server can actually reach the database and list the
   OrbitalEye tables with their row counts.
3. `oracle_describe_table` returns column metadata and primary-key flags.
4. `oracle_query` executes a read-only SELECT and refuses anything else.
   This is the security-relevant guardrail: the tool must never run a
   DELETE, UPDATE, INSERT or DROP against the live database.
5. Malformed JSON produces a JSON-RPC parse error instead of a crash.
6. The bridge MCP server reports a clean error (not an exception) when the
   backend is unreachable.
"""

import json
import os
import sys

import pytest

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATABASE_DIR = os.path.join(ROOT_DIR, "database")
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")


# ---------------------------------------------------------------------------
# Loading the MCP servers as importable modules
# ---------------------------------------------------------------------------

def _load_oracle_mcp():
    """Import `database/oracle_mcp_server.py` as a module."""
    import importlib.util

    path = os.path.join(DATABASE_DIR, "oracle_mcp_server.py")
    spec = importlib.util.spec_from_file_location("oracle_mcp_server", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["oracle_mcp_server"] = module
    spec.loader.exec_module(module)
    return module


def _load_bridge_mcp():
    """Import `backend/orbitaleye_bridge_mcp.py` as a module."""
    import importlib.util

    path = os.path.join(BACKEND_DIR, "orbitaleye_bridge_mcp.py")
    spec = importlib.util.spec_from_file_location("orbitaleye_bridge_mcp", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["orbitaleye_bridge_mcp"] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def oracle_mcp():
    return _load_oracle_mcp()


@pytest.fixture(scope="module")
def bridge_mcp():
    return _load_bridge_mcp()


def _call(oracle_mcp, method, params=None, msg_id=1):
    """Send a JSON-RPC request to the Oracle MCP server and decode the reply."""
    request = {"jsonrpc": "2.0", "id": msg_id, "method": method}
    if params is not None:
        request["params"] = params

    response = oracle_mcp.process_message(json.dumps(request))
    assert response is not None, f"No response for method {method}"
    return response


def _call_tool(oracle_mcp, tool_name, arguments=None, msg_id=1):
    """Invoke a tool and return the decoded text payload."""
    response = _call(
        oracle_mcp,
        "tools/call",
        {"name": tool_name, "arguments": arguments or {}},
        msg_id=msg_id,
    )
    assert "result" in response, f"Tool {tool_name} returned an error: {response}"
    content = response["result"]["content"]
    assert content and content[0]["type"] == "text"
    return content[0]["text"]


# ---------------------------------------------------------------------------
# 1. Handshake
# ---------------------------------------------------------------------------

def test_oracle_mcp_initialize_handshake(oracle_mcp):
    """`initialize` must return the MCP protocol version and server identity."""
    response = _call(oracle_mcp, "initialize")

    assert response["jsonrpc"] == "2.0"
    assert response["id"] == 1

    result = response["result"]
    assert result["protocolVersion"] == "2024-11-05"
    assert result["serverInfo"]["name"] == "orbitaleye-oracle-mcp"
    assert result["serverInfo"]["version"] == "1.0.0"
    assert "tools" in result["capabilities"]


def test_oracle_mcp_ping(oracle_mcp):
    """`ping` must be answered with an empty result."""
    response = _call(oracle_mcp, "ping")
    assert response["result"] == {}


def test_oracle_mcp_notifications_initialized_returns_nothing(oracle_mcp):
    """A notification must not produce a response."""
    request = json.dumps(
        {"jsonrpc": "2.0", "method": "notifications/initialized"}
    )
    assert oracle_mcp.process_message(request) is None


def test_oracle_mcp_tools_list_exposes_the_documented_tools(oracle_mcp):
    """`tools/list` must expose exactly the four documented Oracle tools."""
    response = _call(oracle_mcp, "tools/list")
    tools = response["result"]["tools"]

    names = {t["name"] for t in tools}
    assert names == {
        "oracle_list_tables",
        "oracle_describe_table",
        "oracle_query",
        "oracle_explain_plan",
    }

    for tool in tools:
        assert tool["description"], f"{tool['name']} must have a description"
        assert tool["inputSchema"]["type"] == "object"


def test_oracle_mcp_rejects_unknown_tool(oracle_mcp):
    """An unknown tool name must produce a JSON-RPC method-not-found error."""
    response = _call(
        oracle_mcp, "tools/call", {"name": "oracle_drop_everything", "arguments": {}}
    )
    assert "error" in response
    assert response["error"]["code"] == -32601


def test_oracle_mcp_reports_parse_errors_for_malformed_json(oracle_mcp):
    """Malformed input must yield a parse error, not an unhandled exception."""
    response = oracle_mcp.process_message("{not valid json")
    assert response is not None
    assert response["error"]["code"] == -32700
    assert response["id"] is None


# ---------------------------------------------------------------------------
# 2. Oracle tools against the live database
# ---------------------------------------------------------------------------

@pytest.mark.db
def test_oracle_list_tables_returns_the_orbitaleye_schema(oracle_mcp):
    """The tool must list the real tables with their live row counts."""
    payload = json.loads(_call_tool(oracle_mcp, "oracle_list_tables"))
    assert isinstance(payload, list)
    assert payload

    by_name = {row["table_name"].upper(): row for row in payload}
    for table in ("SATELLITES", "TLE_SETS", "ENCOUNTER_PAIRS"):
        assert table in by_name, f"{table} missing from the tool output"
        assert by_name[table]["row_count"] > 0


@pytest.mark.db
def test_oracle_describe_table_returns_columns_and_primary_keys(oracle_mcp):
    """The describe tool must return the column metadata of the table."""
    payload = json.loads(_call_tool(oracle_mcp, "oracle_describe_table",
                                    {"table_name": "SATELLITES"}))
    assert payload["table"] == "SATELLITES"

    columns = {c["column"]: c for c in payload["columns"]}
    assert "NORAD_ID" in columns
    assert "SATELLITE_NAME" in columns

    norad = columns["NORAD_ID"]
    assert norad["primary_key"] is False, "NORAD_ID is UNIQUE, not the primary key"
    assert columns["SATELLITE_ID"]["primary_key"] is True
    assert "VARCHAR2" in columns["SATELLITE_NAME"]["type"]


@pytest.mark.db
def test_oracle_describe_table_reports_unknown_tables(oracle_mcp):
    """An unknown table must produce a message, not an exception."""
    text = _call_tool(oracle_mcp, "oracle_describe_table", {"table_name": "NOPE_TABLE"})
    assert "not found" in text.lower()


@pytest.mark.db
def test_oracle_query_executes_a_select(oracle_mcp):
    """A read-only SELECT must be executed and returned as structured rows."""
    payload = json.loads(
        _call_tool(
            oracle_mcp,
            "oracle_query",
            {"sql": "SELECT norad_id, satellite_name FROM satellites", "max_rows": 5},
        )
    )
    assert payload["rows_returned"] > 0
    assert payload["rows_returned"] <= 5
    assert "NORAD_ID" in payload["columns"]
    assert "SATELLITE_NAME" in payload["columns"]
    assert isinstance(payload["data"], list)


@pytest.mark.db
def test_oracle_query_caps_the_row_count(oracle_mcp):
    """`max_rows` must be clamped to the documented maximum of 500."""
    payload = json.loads(
        _call_tool(
            oracle_mcp,
            "oracle_query",
            {"sql": "SELECT norad_id FROM satellites", "max_rows": 100000},
        )
    )
    assert payload["rows_returned"] <= 500


@pytest.mark.db
@pytest.mark.parametrize(
    "statement",
    [
        "DELETE FROM satellites",
        "UPDATE satellites SET satellite_name = 'HACKED'",
        "INSERT INTO satellites (norad_id, satellite_name, operator_id, status, dataset_tag) "
        "VALUES (999999, 'HACKED', 1, 'ACTIVE', 'REALTIME')",
        "DROP TABLE satellites",
        "MERGE INTO satellites USING satellites ON (1=1) WHEN MATCHED THEN UPDATE SET status='X'",
    ],
)
def test_oracle_query_refuses_write_statements(oracle_mcp, statement):
    """
    Security guardrail: the query tool must refuse anything that is not a
    read-only SELECT / WITH statement, so an agent cannot mutate the
    production database through it.
    """
    text = _call_tool(oracle_mcp, "oracle_query", {"sql": statement})
    assert "read-only" in text.lower(), (
        f"Write statement was not rejected: {statement!r} -> {text!r}"
    )


@pytest.mark.db
def test_oracle_query_refuses_a_write_statement_with_a_leading_comment(oracle_mcp):
    """A statement that only *looks* read-only must still be rejected."""
    text = _call_tool(
        oracle_mcp, "oracle_query", {"sql": "/* harmless */ DELETE FROM satellites"}
    )
    assert "read-only" in text.lower()


@pytest.mark.db
def test_oracle_query_allows_a_with_statement(oracle_mcp):
    """`WITH` is a legitimate read-only form and must be accepted."""
    payload = json.loads(
        _call_tool(
            oracle_mcp,
            "oracle_query",
            {"sql": "WITH t AS (SELECT norad_id FROM satellites) SELECT COUNT(*) AS c FROM t"},
        )
    )
    assert payload["rows_returned"] == 1
    assert payload["data"][0]["C"] > 0


@pytest.mark.db
def test_oracle_explain_plan_returns_a_plan(oracle_mcp):
    """The explain tool must return Oracle's execution plan text."""
    text = _call_tool(
        oracle_mcp,
        "oracle_explain_plan",
        {"sql": "SELECT norad_id FROM satellites WHERE dataset_tag = 'REALTIME'"},
    )
    assert "SELECT STATEMENT" in text.upper() or "TABLE ACCESS" in text.upper()


# ---------------------------------------------------------------------------
# 3. Bridge MCP server
# ---------------------------------------------------------------------------

def test_bridge_mcp_initialize_handshake(bridge_mcp):
    """The bridge server must complete the MCP handshake."""
    request = json.dumps(
        {"jsonrpc": "2.0", "id": 7, "method": "initialize"}
    )
    response = json.loads(_execute_bridge_stdio(bridge_mcp, request))

    assert response["result"]["serverInfo"]["name"] == "orbitaleye-bridge"
    assert response["result"]["serverInfo"]["version"] == "1.0.0"
    assert response["result"]["protocolVersion"] == "2024-11-05"


def test_bridge_mcp_tools_list_exposes_the_documented_tools(bridge_mcp):
    """`tools/list` must expose the four documented bridge tools."""
    request = json.dumps(
        {"jsonrpc": "2.0", "id": 8, "method": "tools/list"}
    )
    response = json.loads(_execute_bridge_stdio(bridge_mcp, request))

    names = {t["name"] for t in response["result"]["tools"]}
    assert names == {
        "app_get_live_state",
        "app_get_console_errors",
        "app_control_ui",
        "app_diagnose_discrepancy",
    }


def test_bridge_mcp_control_ui_declares_every_supported_action(bridge_mcp):
    """The control tool must document every action the bridge implements."""
    request = json.dumps(
        {"jsonrpc": "2.0", "id": 9, "method": "tools/list"}
    )
    response = json.loads(_execute_bridge_stdio(bridge_mcp, request))

    control = next(
        t for t in response["result"]["tools"] if t["name"] == "app_control_ui"
    )
    actions = control["inputSchema"]["properties"]["action"]["enum"]
    assert set(actions) == {
        "SELECT_SATELLITE",
        "DESELECT_SATELLITE",
        "SET_LIMIT",
        "SET_DATASET",
        "TRIGGER_CAMERA",
        "SET_SPEED",
    }
    assert control["inputSchema"]["required"] == ["action"]


def test_bridge_mcp_tool_call_returns_structured_content(bridge_mcp):
    """
    A tool call must return MCP `content` blocks. The live-state tool talks to
    a backend that may not be running, so either a success payload or a
    structured error payload is acceptable — a crash is not.
    """
    request = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 10,
            "method": "tools/call",
            "params": {"name": "app_get_live_state", "arguments": {}},
        }
    )
    response = json.loads(_execute_bridge_stdio(bridge_mcp, request))

    assert "result" in response
    content = response["result"]["content"]
    assert content[0]["type"] == "text"

    payload = json.loads(content[0]["text"])
    assert payload["status"] in {"success", "error"}
    if payload["status"] == "error":
        assert "message" in payload


def test_bridge_mcp_unknown_tool_returns_an_error(bridge_mcp):
    """An unknown tool name must produce a JSON-RPC error, not a crash."""
    request = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 11,
            "method": "tools/call",
            "params": {"name": "app_launch_missiles", "arguments": {}},
        }
    )
    response = json.loads(_execute_bridge_stdio(bridge_mcp, request))
    assert "error" in response
    assert response["error"]["code"] == -32603


def _execute_bridge_stdio(bridge_mcp, request_line):
    """
    Run one request line through the bridge server's stdio loop and capture
    the JSON response it writes to stdout.
    """
    import io
    from contextlib import redirect_stdout

    buffer = io.StringIO()

    class _FakeStdin:
        def __init__(self, line):
            self._lines = [line]
            self._done = False

        def __iter__(self):
            return iter(self._lines)

        def __next__(self):
            if self._done:
                raise StopIteration
            self._done = True
            return self._lines[0]

    original_stdin = sys.stdin
    sys.stdin = _FakeStdin(request_line)
    try:
        with redirect_stdout(buffer):
            bridge_mcp.main()
    finally:
        sys.stdin = original_stdin

    output = buffer.getvalue().strip()
    assert output, "The MCP server produced no stdout response"
    return output.splitlines()[-1]


if __name__ == "__main__":
    pytest.main(["-v", __file__])
