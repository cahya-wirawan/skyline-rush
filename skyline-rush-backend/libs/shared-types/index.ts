export type AgeBucket = 'under_13' | '13_15' | '16_plus';

export type Currency = 'chips' | 'cores';

export type LedgerReason =
  | 'run_pickup'
  | 'contract_reward'
  | 'supply_drop'
  | 'purchase'
  | 'redeploy_spend'
  | 'refund_reversal'
  | 'admin_adjustment'
  | 'unlock_spend';

export type IntegrityFlag = 'ok' | 'suspect' | 'excluded';

export type ItemType = 'runner' | 'board' | 'cosmetic_trail';

export type AcquiredVia = 'starter' | 'currency' | 'supply_drop' | 'pass_reward' | 'purchase' | 'earned';

export type PurchaseStatus = 'pending' | 'validated' | 'granted' | 'refunded' | 'revoked';

export interface PlayerModel {
  player_id: string;
  guest_device_id?: string | null;
  apple_user_id?: string | null;
  display_name: string;
  age_bucket: AgeBucket;
  created_at: Date;
  last_seen_at: Date;
}

export interface DeviceModel {
  device_id: string;
  player_id: string;
  platform: string;
  push_token?: string | null;
  app_version: string;
  last_seen_at: Date;
}

export interface EconomyBalanceModel {
  player_id: string;
  chips: number;
  cores: number;
  updated_at: Date;
}

export interface LedgerEntryModel {
  entry_id: string;
  player_id: string;
  currency: Currency;
  delta: number;
  reason: LedgerReason;
  idempotency_key: string;
  created_at: Date;
}

export interface RunModel {
  run_id: string;
  player_id: string;
  district_id: string;
  runner_id: string;
  board_id: string;
  meters: number;
  chips_collected: number;
  crashed_cause?: string | null;
  client_submitted_at: Date;
  server_received_at: Date;
  integrity_flag: IntegrityFlag;
  idempotency_key: string;
  duration_seconds?: number;
}

export interface OwnershipModel {
  player_id: string;
  item_type: ItemType;
  item_id: string;
  equipped: boolean;
  acquired_at: Date;
  acquired_via: AcquiredVia;
}

export interface ContractModel {
  contract_id: string;
  type: 'daily' | 'weekly_heist';
  objective: {
    metric: string;
    target: number;
  };
  reward: {
    chips?: number;
    cores?: number;
  };
  active_from: Date;
  active_to: Date;
}

export interface ContractProgressModel {
  player_id: string;
  contract_id: string;
  progress: number;
  completed_at?: Date | null;
  claimed_at?: Date | null;
  claim_idempotency_key?: string | null;
}

export interface SupplyDropTableEntry {
  reward: string;
  probability: number;
  item_type?: 'chips' | 'cores' | 'runner' | 'board' | 'cosmetic_trail';
  min_amount?: number;
  max_amount?: number;
}

export interface SupplyDropTableModel {
  table_id: string;
  version: number;
  entries: SupplyDropTableEntry[];
  published_at: Date;
}

export interface SupplyDropOpenModel {
  open_id: string;
  player_id: string;
  table_id: string;
  table_version: number;
  result: {
    reward: string;
    amount: number;
    item_type?: string;
  };
  acquired_via: 'earned' | 'purchased';
  opened_at: Date;
}

export interface PurchaseModel {
  purchase_id: string;
  player_id: string;
  sku: string;
  platform_transaction_id: string;
  status: PurchaseStatus;
  raw_receipt_ref?: string | null;
  created_at: Date;
  validated_at?: Date | null;
}

export interface ConsentRecordModel {
  player_id: string;
  age_bucket: AgeBucket;
  ad_personalization_allowed: boolean;
  analytics_allowed: boolean;
  policy_version: string;
  recorded_at: Date;
}

export interface FriendLinkModel {
  player_id: string;
  friend_player_id: string;
  source: 'game_center' | 'friend_code';
  created_at: Date;
}

export interface ContentPackModel {
  content_pack_id: string;
  district_id: string;
  version: string;
  cdn_url: string;
  checksum: string;
  published_at: Date;
  status: 'staged' | 'live' | 'rolled_back';
}

// API Payloads
export interface AuthGuestDto {
  guest_device_id: string;
  age_bucket: AgeBucket;
}

export interface AuthAppleDto {
  identity_token: string;
  guest_device_id?: string;
}

export interface AuthTokensResponse {
  player_id: string;
  access_token: string;
  refresh_token: string;
  age_bucket: AgeBucket;
}

export interface RunSubmitDto {
  district_id: string;
  runner_id: string;
  board_id: string;
  meters: number;
  chips_collected: number;
  crashed_cause?: string;
  client_submitted_at: string;
  duration_seconds: number;
  powerups_collected?: number;
}

export interface RedeployDto {
  run_id?: string;
  method: 'ad' | 'cores';
  ad_receipt?: string;
}

export interface PurchaseReceiptDto {
  sku: string;
  transaction_id: string;
  signed_transaction: string;
  parental_gate_passed?: boolean;
  parental_gate_token?: string;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}
