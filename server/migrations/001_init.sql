-- ============================================================
-- PinWay Database Schema — Migration 001
-- Run with: psql $DATABASE_URL -f migrations/001_init.sql
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── contacts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  relation   VARCHAR(50),
  phone      VARCHAR(30),          -- E.164 format
  email      VARCHAR(255),
  avatar     VARCHAR(10),          -- emoji avatar
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contact_has_delivery CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);

-- ─── pins ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pins (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Security
  pin_hash         VARCHAR(255) NOT NULL,   -- bcrypt hash, NEVER store plaintext

  -- Financials
  amount           NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  remaining_amount NUMERIC(10,2) NOT NULL CHECK (remaining_amount >= 0),

  -- Metadata
  description      VARCHAR(200) NOT NULL,

  -- Restrictions
  categories       JSONB NOT NULL DEFAULT '[]',  -- array of category IDs
  geo_restriction  VARCHAR(10) NOT NULL DEFAULT 'us'
                     CHECK (geo_restriction IN ('us','latam','eu','any')),
  max_uses         INTEGER NOT NULL DEFAULT 10 CHECK (max_uses > 0),
  uses_left        INTEGER NOT NULL CHECK (uses_left >= 0),
  per_tx_limit     NUMERIC(10,2) NOT NULL,
  daily_limit      NUMERIC(10,2) NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,

  -- Status
  status           VARCHAR(20) NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','frozen','revoked','expired')),
  revoked_at       TIMESTAMPTZ,

  -- Features
  auto_reload      BOOLEAN NOT NULL DEFAULT FALSE,
  rotate_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  rotate_hours     INTEGER NOT NULL DEFAULT 6,
  last_rotated_at  TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pins_user ON pins(user_id);
CREATE INDEX IF NOT EXISTS idx_pins_status ON pins(status);
CREATE INDEX IF NOT EXISTS idx_pins_expires ON pins(expires_at);
CREATE INDEX IF NOT EXISTS idx_pins_contact ON pins(contact_id);

-- ─── transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pin_id         UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,

  type           VARCHAR(20) NOT NULL
                   CHECK (type IN ('approved','declined')),
  amount         NUMERIC(10,2) NOT NULL,

  -- Merchant info
  merchant_name  VARCHAR(200),
  merchant_city  VARCHAR(100),
  mcc_code       VARCHAR(4),
  country_code   CHAR(2),

  -- For declined transactions
  reason         VARCHAR(100),

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_pin ON transactions(pin_id);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);

-- ─── blocked_merchants ────────────────────────────────────────
-- User-specific blocked merchant list (in addition to global blocks)
CREATE TABLE IF NOT EXISTS blocked_merchants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mcc_code    VARCHAR(4),
  name        VARCHAR(200),
  reason      VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_user ON blocked_merchants(user_id);

-- ─── Helper: auto-expire pins ─────────────────────────────────
-- Run this via a cron job (e.g., pg_cron or external scheduler):
-- UPDATE pins SET status = 'expired' WHERE expires_at < NOW() AND status = 'active';

-- ─── pin_audit_log ────────────────────────────────────────────
-- Immutable audit trail for every PIN lifecycle event.
-- Required for PCI-PIN compliance and buyer due diligence.
CREATE TABLE IF NOT EXISTS pin_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pin_id      UUID REFERENCES pins(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  event       VARCHAR(50) NOT NULL,
  -- Examples: PIN_CREATED, PIN_ROTATED, PIN_FROZEN, PIN_REVOKED,
  --           PIN_EXPIRED, TX_APPROVED, TX_DECLINED, AUTH_LOGIN,
  --           AUTH_FAILED, PIN_DELIVERY_SMS, PIN_DELIVERY_EMAIL
  actor_ip    INET,
  metadata    JSONB,          -- e.g. { "mcc": "5411", "amount": 34.91 }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs must never be deleted — no ON DELETE CASCADE here
CREATE INDEX IF NOT EXISTS idx_audit_pin    ON pin_audit_log(pin_id);
CREATE INDEX IF NOT EXISTS idx_audit_user   ON pin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_event  ON pin_audit_log(event);
CREATE INDEX IF NOT EXISTS idx_audit_time   ON pin_audit_log(created_at);

-- Revoke DELETE privilege so no application user can purge audit rows
-- Run as superuser after migration:
-- REVOKE DELETE ON pin_audit_log FROM pinway_user;
