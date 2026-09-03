-- Skyline Rush Initial Database Schema (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Player
CREATE TABLE IF NOT EXISTS player (
  player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_device_id UUID UNIQUE,
  apple_user_id TEXT UNIQUE,
  display_name TEXT NOT NULL,
  age_bucket TEXT NOT NULL CHECK (age_bucket IN ('under_13', '13_15', '16_plus')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Device
CREATE TABLE IF NOT EXISTS device (
  device_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  push_token TEXT,
  app_version TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_player ON device(player_id);

-- Economy Balance (Materialized)
CREATE TABLE IF NOT EXISTS economy_balance (
  player_id UUID PRIMARY KEY REFERENCES player(player_id) ON DELETE CASCADE,
  chips BIGINT NOT NULL DEFAULT 0 CHECK (chips >= 0),
  cores BIGINT NOT NULL DEFAULT 0 CHECK (cores >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ledger Entry (Append-Only)
CREATE TABLE IF NOT EXISTS ledger_entry (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('chips', 'cores')),
  delta BIGINT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'run_pickup', 'contract_reward', 'supply_drop', 'purchase',
    'redeploy_spend', 'refund_reversal', 'admin_adjustment', 'unlock_spend'
  )),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ledger_player_idempotency UNIQUE (player_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_ledger_player_created ON ledger_entry(player_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_player_currency_created ON ledger_entry(player_id, currency, created_at);

-- Run
CREATE TABLE IF NOT EXISTS run (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
  district_id TEXT NOT NULL,
  runner_id TEXT NOT NULL,
  board_id TEXT NOT NULL,
  meters INTEGER NOT NULL CHECK (meters >= 0),
  chips_collected INTEGER NOT NULL CHECK (chips_collected >= 0),
  crashed_cause TEXT,
  duration_seconds NUMERIC(10, 2),
  client_submitted_at TIMESTAMPTZ NOT NULL,
  server_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  integrity_flag TEXT NOT NULL DEFAULT 'ok' CHECK (integrity_flag IN ('ok', 'suspect', 'excluded')),
  idempotency_key TEXT NOT NULL,
  CONSTRAINT uq_run_player_idempotency UNIQUE (player_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_run_leaderboard ON run(district_id, integrity_flag, meters DESC);
CREATE INDEX IF NOT EXISTS idx_run_player_received ON run(player_id, server_received_at);

-- Ownership
CREATE TABLE IF NOT EXISTS ownership (
  player_id UUID NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('runner', 'board', 'cosmetic_trail')),
  item_id TEXT NOT NULL,
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acquired_via TEXT NOT NULL CHECK (acquired_via IN ('starter', 'currency', 'supply_drop', 'pass_reward', 'purchase', 'earned')),
  PRIMARY KEY (player_id, item_type, item_id)
);

-- Contract Progress
CREATE TABLE IF NOT EXISTS contract_progress (
  player_id UUID NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
  contract_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  PRIMARY KEY (player_id, contract_id)
);

-- Consent Record
CREATE TABLE IF NOT EXISTS consent_record (
  player_id UUID PRIMARY KEY REFERENCES player(player_id) ON DELETE CASCADE,
  age_bucket TEXT NOT NULL CHECK (age_bucket IN ('under_13', '13_15', '16_plus')),
  ad_personalization_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  analytics_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  policy_version TEXT NOT NULL DEFAULT '2026.1',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supply Drop Table
CREATE TABLE IF NOT EXISTS supply_drop_table (
  table_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  entries JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (table_id, version)
);

-- Supply Drop Open
CREATE TABLE IF NOT EXISTS supply_drop_open (
  open_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
  table_id TEXT NOT NULL,
  table_version INTEGER NOT NULL,
  result JSONB NOT NULL,
  acquired_via TEXT NOT NULL CHECK (acquired_via IN ('earned', 'purchased')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (table_id, table_version) REFERENCES supply_drop_table(table_id, version)
);

-- Purchase
CREATE TABLE IF NOT EXISTS purchase (
  purchase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  platform_transaction_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'granted', 'refunded', 'revoked')),
  raw_receipt_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ
);

-- Friend Link
CREATE TABLE IF NOT EXISTS friend_link (
  player_id UUID NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
  friend_player_id UUID NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('game_center', 'friend_code')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, friend_player_id)
);

-- Content Pack
CREATE TABLE IF NOT EXISTS content_pack (
  content_pack_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id TEXT NOT NULL,
  version TEXT NOT NULL,
  cdn_url TEXT NOT NULL,
  checksum TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('staged', 'live', 'rolled_back'))
);

-- Seed Default Supply Drop Table (standard-v7)
INSERT INTO supply_drop_table (table_id, version, entries, published_at)
VALUES (
  'standard-v7',
  7,
  '[
    {"reward": "chips_small", "probability": 0.55, "item_type": "chips", "min_amount": 500, "max_amount": 1000},
    {"reward": "cores_small", "probability": 0.25, "item_type": "cores", "min_amount": 5, "max_amount": 15},
    {"reward": "cosmetic_trail_rare", "probability": 0.05, "item_type": "cosmetic_trail", "min_amount": 1, "max_amount": 1},
    {"reward": "board_epic", "probability": 0.02, "item_type": "board", "min_amount": 1, "max_amount": 1},
    {"reward": "chips_medium", "probability": 0.13, "item_type": "chips", "min_amount": 1500, "max_amount": 2500}
  ]'::jsonb,
  NOW()
) ON CONFLICT (table_id, version) DO NOTHING;
