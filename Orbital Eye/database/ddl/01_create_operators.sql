-- Orbital Eye DDL 01 — Operators / Admin Users (stub for deploy sequence)
-- This file satisfies deploy.sh numbering (01-06) without altering existing 03-06 DDL.
CREATE TABLE IF NOT EXISTS orbital_operators (
    operator_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR2(64) NOT NULL UNIQUE,
    role VARCHAR2(16) DEFAULT 'ANALYST',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_op_username ON orbital_operators(username);
