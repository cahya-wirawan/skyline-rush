import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { IDatabase } from './database.interface';
import {
  PlayerModel,
  DeviceModel,
  EconomyBalanceModel,
  LedgerEntryModel,
  RunModel,
  OwnershipModel,
  ContractModel,
  ContractProgressModel,
  ConsentRecordModel,
  SupplyDropTableModel,
  SupplyDropOpenModel,
  PurchaseModel,
  FriendLinkModel,
  ContentPackModel
} from '@libs/shared-types';

export class PostgresDatabase implements IDatabase {
  public pool: Pool;
  private defaultTables: Map<string, SupplyDropTableModel> = new Map();
  private defaultContracts: Map<string, ContractModel> = new Map();

  constructor(connectionString?: string) {
    const url =
      connectionString ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      'postgresql://postgres:postgres@localhost:5432/skyline_rush';
    this.pool = new Pool({ connectionString: url });
    this.initDefaults();
  }

  private initDefaults() {
    const tableId = 'standard-v7';
    const version = 7;
    this.defaultTables.set(`${tableId}:${version}`, {
      table_id: tableId,
      version: version,
      published_at: new Date('2026-08-31T00:00:00Z'),
      entries: [
        { reward: 'chips_small', probability: 0.55, item_type: 'chips', min_amount: 500, max_amount: 1000 },
        { reward: 'cores_small', probability: 0.25, item_type: 'cores', min_amount: 5, max_amount: 15 },
        { reward: 'cosmetic_trail_rare', probability: 0.05, item_type: 'cosmetic_trail', min_amount: 1, max_amount: 1 },
        { reward: 'board_epic', probability: 0.02, item_type: 'board', min_amount: 1, max_amount: 1 },
        { reward: 'chips_medium', probability: 0.13, item_type: 'chips', min_amount: 1500, max_amount: 2500 }
      ]
    });

    const today = new Date();
    const activeFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const activeTo = new Date(activeFrom.getTime() + 24 * 60 * 60 * 1000);

    const contracts: ContractModel[] = [
      {
        contract_id: 'daily_meters_1',
        type: 'daily',
        objective: { metric: 'meters', target: 2000 },
        reward: { chips: 250, cores: 2 },
        active_from: activeFrom,
        active_to: activeTo
      },
      {
        contract_id: 'daily_chips_2',
        type: 'daily',
        objective: { metric: 'chips', target: 300 },
        reward: { chips: 300 },
        active_from: activeFrom,
        active_to: activeTo
      },
      {
        contract_id: 'daily_powerups_3',
        type: 'daily',
        objective: { metric: 'powerups', target: 5 },
        reward: { chips: 200, cores: 3 },
        active_from: activeFrom,
        active_to: activeTo
      }
    ];

    for (const c of contracts) {
      this.defaultContracts.set(c.contract_id, c);
    }
  }

  async createPlayer(playerData: Omit<PlayerModel, 'player_id' | 'created_at' | 'last_seen_at'> & { player_id?: string }): Promise<PlayerModel> {
    const id = playerData.player_id || uuidv4();
    const res = await this.pool.query(
      `INSERT INTO player (player_id, guest_device_id, apple_user_id, display_name, age_bucket, created_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [id, playerData.guest_device_id || null, playerData.apple_user_id || null, playerData.display_name, playerData.age_bucket]
    );
    const row = res.rows[0];
    await this.initBalance(row.player_id, 0, 0);
    return this.mapPlayer(row);
  }

  async getPlayerById(playerId: string): Promise<PlayerModel | null> {
    const res = await this.pool.query(`SELECT * FROM player WHERE player_id = $1`, [playerId]);
    if (res.rows.length === 0) return null;
    return this.mapPlayer(res.rows[0]);
  }

  async getPlayerByGuestDeviceId(guestDeviceId: string): Promise<PlayerModel | null> {
    const res = await this.pool.query(`SELECT * FROM player WHERE guest_device_id = $1`, [guestDeviceId]);
    if (res.rows.length === 0) return null;
    return this.mapPlayer(res.rows[0]);
  }

  async getPlayerByAppleUserId(appleUserId: string): Promise<PlayerModel | null> {
    const res = await this.pool.query(`SELECT * FROM player WHERE apple_user_id = $1`, [appleUserId]);
    if (res.rows.length === 0) return null;
    return this.mapPlayer(res.rows[0]);
  }

  async updatePlayer(playerId: string, partial: Partial<PlayerModel>): Promise<PlayerModel> {
    const updates: string[] = ['last_seen_at = NOW()'];
    const values: any[] = [playerId];
    let idx = 2;

    if (partial.display_name !== undefined) {
      updates.push(`display_name = $${idx++}`);
      values.push(partial.display_name);
    }
    if (partial.apple_user_id !== undefined) {
      updates.push(`apple_user_id = $${idx++}`);
      values.push(partial.apple_user_id);
    }
    if (partial.guest_device_id !== undefined) {
      updates.push(`guest_device_id = $${idx++}`);
      values.push(partial.guest_device_id);
    }
    if (partial.age_bucket !== undefined) {
      updates.push(`age_bucket = $${idx++}`);
      values.push(partial.age_bucket);
    }

    const res = await this.pool.query(
      `UPDATE player SET ${updates.join(', ')} WHERE player_id = $1 RETURNING *`,
      values
    );
    return this.mapPlayer(res.rows[0]);
  }

  async deletePlayer(playerId: string): Promise<void> {
    await this.pool.query(`DELETE FROM player WHERE player_id = $1`, [playerId]);
  }

  async upsertDevice(device: Omit<DeviceModel, 'device_id' | 'last_seen_at'>): Promise<DeviceModel> {
    const deviceId = uuidv4();
    const res = await this.pool.query(
      `INSERT INTO device (device_id, player_id, platform, push_token, app_version, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [deviceId, device.player_id, device.platform, device.push_token || null, device.app_version]
    );
    return this.mapDevice(res.rows[0]);
  }

  async getDevicesByPlayerId(playerId: string): Promise<DeviceModel[]> {
    const res = await this.pool.query(`SELECT * FROM device WHERE player_id = $1`, [playerId]);
    return res.rows.map(this.mapDevice);
  }

  async getBalance(playerId: string): Promise<EconomyBalanceModel> {
    const res = await this.pool.query(`SELECT * FROM economy_balance WHERE player_id = $1`, [playerId]);
    if (res.rows.length === 0) {
      return this.initBalance(playerId, 0, 0);
    }
    return this.mapBalance(res.rows[0]);
  }

  async initBalance(playerId: string, chips = 0, cores = 0): Promise<EconomyBalanceModel> {
    const res = await this.pool.query(
      `INSERT INTO economy_balance (player_id, chips, cores, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (player_id) DO UPDATE
       SET chips = EXCLUDED.chips, cores = EXCLUDED.cores, updated_at = NOW()
       RETURNING *`,
      [playerId, chips, cores]
    );
    return this.mapBalance(res.rows[0]);
  }

  /**
   * RC-01: THE single code path that mutates currency.
   *
   * CLAUDE.md §1 requires every balance mutation to append a `ledger_entry` row
   * AND to keep the materialized `economy_balance` row in step. Both writes live
   * here, behind one `SELECT ... FOR UPDATE` row lock, so no caller can append a
   * ledger row without also moving the materialized balance (which is exactly
   * the divergence `unlockItemAtomic` used to introduce, permanently tripping
   * the `skyline_balance_reconciliation_errors_total` reconciliation check).
   *
   * Runs on a caller-supplied client so it can be composed into a larger
   * transaction (see `unlockItemAtomic`, which needs the ownership insert to
   * commit or roll back together with the spend). The caller owns
   * BEGIN/COMMIT/ROLLBACK; this method neither opens nor closes a transaction,
   * and signals insufficient funds by throwing so the caller's ROLLBACK undoes
   * everything it did.
   */
  private async applyLedgerEntryTx(
    client: PoolClient,
    entryData: {
      playerId: string;
      currency: 'chips' | 'cores';
      delta: number;
      reason: any;
      idempotencyKey: string;
    }
  ): Promise<{ balance: EconomyBalanceModel; entry: LedgerEntryModel; isDuplicate: boolean }> {
    const existingEntry = await client.query(
      `SELECT * FROM ledger_entry WHERE player_id = $1 AND idempotency_key = $2`,
      [entryData.playerId, entryData.idempotencyKey]
    );
    if (existingEntry.rows.length > 0) {
      const balRes = await client.query(`SELECT * FROM economy_balance WHERE player_id = $1`, [entryData.playerId]);
      return {
        balance: this.mapBalance(balRes.rows[0]),
        entry: this.mapLedgerEntry(existingEntry.rows[0]),
        isDuplicate: true
      };
    }

    const balRes = await client.query(
      `SELECT * FROM economy_balance WHERE player_id = $1 FOR UPDATE`,
      [entryData.playerId]
    );
    let balance = balRes.rows[0];
    if (!balance) {
      const initRes = await client.query(
        `INSERT INTO economy_balance (player_id, chips, cores, updated_at)
         VALUES ($1, 0, 0, NOW()) RETURNING *`,
        [entryData.playerId]
      );
      balance = initRes.rows[0];
    }

    const currentChips = parseInt(balance.chips, 10);
    const currentCores = parseInt(balance.cores, 10);

    const newChips = entryData.currency === 'chips' ? currentChips + entryData.delta : currentChips;
    const newCores = entryData.currency === 'cores' ? currentCores + entryData.delta : currentCores;

    if (newChips < 0 || newCores < 0) {
      const err: any = new Error('Insufficient balance');
      err.code = 'INSUFFICIENT_BALANCE';
      err.details = {
        required: Math.abs(entryData.delta),
        available: entryData.currency === 'chips' ? currentChips : currentCores
      };
      throw err;
    }

    const updatedBalRes = await client.query(
      `UPDATE economy_balance SET chips = $1, cores = $2, updated_at = NOW() WHERE player_id = $3 RETURNING *`,
      [newChips, newCores, entryData.playerId]
    );

    const entryId = uuidv4();
    const insertEntryRes = await client.query(
      `INSERT INTO ledger_entry (entry_id, player_id, currency, delta, reason, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [entryId, entryData.playerId, entryData.currency, entryData.delta, entryData.reason, entryData.idempotencyKey]
    );

    return {
      balance: this.mapBalance(updatedBalRes.rows[0]),
      entry: this.mapLedgerEntry(insertEntryRes.rows[0]),
      isDuplicate: false
    };
  }

  async applyLedgerEntry(entryData: {
    playerId: string;
    currency: 'chips' | 'cores';
    delta: number;
    reason: any;
    idempotencyKey: string;
  }): Promise<{ balance: EconomyBalanceModel; entry: LedgerEntryModel; isDuplicate: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await this.applyLedgerEntryTx(client, entryData);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getLedgerEntries(playerId: string, limit = 25, cursor?: string): Promise<{ items: LedgerEntryModel[]; nextCursor?: string }> {
    let query = `SELECT * FROM ledger_entry WHERE player_id = $1 ORDER BY created_at DESC LIMIT $2`;
    let params: any[] = [playerId, limit + 1];

    if (cursor) {
      const cursorRes = await this.pool.query(`SELECT created_at FROM ledger_entry WHERE entry_id = $1`, [cursor]);
      if (cursorRes.rows.length > 0) {
        query = `SELECT * FROM ledger_entry WHERE player_id = $1 AND created_at < $2 ORDER BY created_at DESC LIMIT $3`;
        params = [playerId, cursorRes.rows[0].created_at, limit + 1];
      }
    }

    const res = await this.pool.query(query, params);
    const rows = res.rows;
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(this.mapLedgerEntry);
    const nextCursor = hasMore ? items[items.length - 1]?.entry_id : undefined;

    return { items, nextCursor };
  }

  async getLedgerSums(playerId: string): Promise<{ chips: number; cores: number }> {
    // Read-only aggregate; no lock is taken because a concurrent write would at
    // worst produce a transient mismatch, and the reconciliation check treats a
    // single divergent read as a signal, not as a transactional guarantee.
    const res = await this.pool.query(
      `SELECT currency, COALESCE(SUM(delta), 0) AS total
         FROM ledger_entry
        WHERE player_id = $1
        GROUP BY currency`,
      [playerId]
    );
    const sums = { chips: 0, cores: 0 };
    for (const row of res.rows) {
      if (row.currency === 'chips') sums.chips = Number(row.total);
      else if (row.currency === 'cores') sums.cores = Number(row.total);
    }
    return sums;
  }

  async createRun(runData: Omit<RunModel, 'run_id' | 'server_received_at'>): Promise<{ run: RunModel; isDuplicate: boolean }> {
    const existing = await this.pool.query(
      `SELECT * FROM run WHERE player_id = $1 AND idempotency_key = $2`,
      [runData.player_id, runData.idempotency_key]
    );
    if (existing.rows.length > 0) {
      return { run: this.mapRun(existing.rows[0]), isDuplicate: true };
    }

    const runId = uuidv4();
    const res = await this.pool.query(
      `INSERT INTO run (run_id, player_id, district_id, runner_id, board_id, meters, chips_collected, crashed_cause, duration_seconds, client_submitted_at, server_received_at, integrity_flag, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12)
       RETURNING *`,
      [
        runId,
        runData.player_id,
        runData.district_id,
        runData.runner_id,
        runData.board_id,
        runData.meters,
        runData.chips_collected,
        runData.crashed_cause || null,
        runData.duration_seconds || null,
        runData.client_submitted_at,
        runData.integrity_flag,
        runData.idempotency_key
      ]
    );
    return { run: this.mapRun(res.rows[0]), isDuplicate: false };
  }

  async getRunById(runId: string): Promise<RunModel | null> {
    const res = await this.pool.query(`SELECT * FROM run WHERE run_id = $1`, [runId]);
    if (res.rows.length === 0) return null;
    return this.mapRun(res.rows[0]);
  }

  // CRIT-14: Filter strictly by integrity_flag = 'ok'
  async getRunsByDistrict(districtId: string, limit = 100): Promise<RunModel[]> {
    const res = await this.pool.query(
      `SELECT * FROM run WHERE district_id = $1 AND integrity_flag = 'ok' ORDER BY meters DESC LIMIT $2`,
      [districtId, limit]
    );
    return res.rows.map(this.mapRun);
  }

  // CRIT-14: Filter strictly by integrity_flag = 'ok'
  async getPlayerBestRun(playerId: string, districtId: string): Promise<RunModel | null> {
    const res = await this.pool.query(
      `SELECT * FROM run WHERE player_id = $1 AND district_id = $2 AND integrity_flag = 'ok' ORDER BY meters DESC LIMIT 1`,
      [playerId, districtId]
    );
    if (res.rows.length === 0) return null;
    return this.mapRun(res.rows[0]);
  }

  async getOwnerships(playerId: string): Promise<OwnershipModel[]> {
    const res = await this.pool.query(`SELECT * FROM ownership WHERE player_id = $1`, [playerId]);
    return res.rows.map(this.mapOwnership);
  }

  async grantOwnership(ownership: Omit<OwnershipModel, 'acquired_at'>): Promise<OwnershipModel> {
    const res = await this.pool.query(
      `INSERT INTO ownership (player_id, item_type, item_id, equipped, acquired_at, acquired_via)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (player_id, item_type, item_id) DO UPDATE
       SET acquired_at = NOW()
       RETURNING *`,
      [ownership.player_id, ownership.item_type, ownership.item_id, ownership.equipped, ownership.acquired_via]
    );
    return this.mapOwnership(res.rows[0]);
  }

  async setEquipped(playerId: string, itemType: 'runner' | 'board', itemId: string): Promise<void> {
    await this.pool.query(`UPDATE ownership SET equipped = false WHERE player_id = $1 AND item_type = $2`, [playerId, itemType]);
    await this.pool.query(
      `INSERT INTO ownership (player_id, item_type, item_id, equipped, acquired_at, acquired_via)
       VALUES ($1, $2, $3, true, NOW(), 'starter')
       ON CONFLICT (player_id, item_type, item_id) DO UPDATE SET equipped = true`,
      [playerId, itemType, itemId]
    );
  }

  // RED-205: Atomic item unlock with row locking to prevent double-charge races
  async unlockItemAtomic(
    playerId: string,
    itemType: 'runner' | 'board',
    itemId: string,
    cost: number,
    idempotencyKey: string
  ): Promise<{ ok: boolean; balance: EconomyBalanceModel }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Row lock on player to prevent double-charge races
      await client.query('SELECT player_id FROM player WHERE player_id = $1 FOR UPDATE', [playerId]);

      // Check if already owned
      const ownedRes = await client.query(
        'SELECT 1 FROM ownership WHERE player_id = $1 AND item_type = $2 AND item_id = $3',
        [playerId, itemType, itemId]
      );
      if (ownedRes.rows.length > 0) {
        const ownedBalRes = await client.query(`SELECT * FROM economy_balance WHERE player_id = $1`, [playerId]);
        await client.query('COMMIT');
        const balance =
          ownedBalRes.rows.length > 0 ? this.mapBalance(ownedBalRes.rows[0]) : await this.initBalance(playerId, 0, 0);
        return { ok: true, balance };
      }

      // RC-01: the spend goes through the shared applyLedgerEntryTx path, which
      // writes the ledger row AND the materialized economy_balance row under the
      // same FOR UPDATE lock. The previous hand-rolled INSERT wrote only the
      // ledger, leaving economy_balance permanently stale (and higher than the
      // player actually had). Passing this transaction's client keeps the
      // affordability check, the spend and the ownership insert atomic together:
      // any throw below reaches the catch, which rolls the whole thing back.
      //
      // Affordability is now decided by applyLedgerEntryTx's non-negative guard
      // over economy_balance — the materialized row that CLAUDE.md §1 makes
      // authoritative — instead of a separate COALESCE(SUM(delta)) over the
      // ledger. With both writes on one path the two are equal by construction,
      // so this is the same decision made once rather than twice.
      const ledgerResult = await this.applyLedgerEntryTx(client, {
        playerId,
        currency: 'cores',
        delta: -cost,
        reason: 'unlock_spend',
        idempotencyKey
      });

      // Insert ownership
      await client.query(
        `INSERT INTO ownership (player_id, item_type, item_id, equipped, acquired_via, acquired_at)
         VALUES ($1, $2, $3, FALSE, 'currency', NOW())
         ON CONFLICT (player_id, item_type, item_id) DO NOTHING`,
        [playerId, itemType, itemId]
      );

      await client.query('COMMIT');
      return { ok: true, balance: ledgerResult.balance };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getActiveContracts(): Promise<ContractModel[]> {
    return Array.from(this.defaultContracts.values());
  }

  async getContractById(contractId: string): Promise<ContractModel | null> {
    return this.defaultContracts.get(contractId) || null;
  }

  async getContractProgress(playerId: string, contractId: string): Promise<ContractProgressModel | null> {
    const res = await this.pool.query(
      `SELECT * FROM contract_progress WHERE player_id = $1 AND contract_id = $2`,
      [playerId, contractId]
    );
    if (res.rows.length === 0) return null;
    return this.mapContractProgress(res.rows[0]);
  }

  async upsertContractProgress(playerId: string, contractId: string, progress: number): Promise<ContractProgressModel> {
    const contract = await this.getContractById(contractId);
    const target = contract ? contract.objective.target : 999999;
    const completed = progress >= target;

    const res = await this.pool.query(
      `INSERT INTO contract_progress (player_id, contract_id, progress, completed_at, claimed_at)
       VALUES ($1, $2, $3, CASE WHEN $4::boolean THEN NOW() ELSE NULL END, NULL)
       ON CONFLICT (player_id, contract_id) DO UPDATE
       SET progress = EXCLUDED.progress,
           completed_at = CASE WHEN $4::boolean AND contract_progress.completed_at IS NULL THEN NOW() ELSE contract_progress.completed_at END
       RETURNING *`,
      [playerId, contractId, progress, completed]
    );
    return this.mapContractProgress(res.rows[0]);
  }

  // RED-206: Atomic conditional update on claimContract with claim_idempotency_key
  async claimContract(playerId: string, contractId: string, idempotencyKey?: string): Promise<{ contract: ContractModel; progress: ContractProgressModel }> {
    const contract = await this.getContractById(contractId);
    if (!contract) {
      const err: any = new Error('Contract not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    const target = contract.objective.target;

    // Atomic conditional update
    const updateRes = await this.pool.query(
      `UPDATE contract_progress
       SET claimed_at = NOW(), claim_idempotency_key = $3
       WHERE player_id = $1 AND contract_id = $2 AND claimed_at IS NULL AND progress >= $4
       RETURNING *`,
      [playerId, contractId, idempotencyKey || null, target]
    );

    if (updateRes.rows.length > 0) {
      return { contract, progress: this.mapContractProgress(updateRes.rows[0]) };
    }

    // Inspect existing progress
    const existingRes = await this.pool.query(
      `SELECT * FROM contract_progress WHERE player_id = $1 AND contract_id = $2`,
      [playerId, contractId]
    );
    const existing = existingRes.rows[0];

    if (!existing || existing.progress < target) {
      const err: any = new Error('Contract objective not yet met');
      err.code = 'NOT_COMPLETED';
      throw err;
    }

    if (existing.claimed_at) {
      if (idempotencyKey && existing.claim_idempotency_key === idempotencyKey) {
        return { contract, progress: this.mapContractProgress(existing) };
      }
      const err: any = new Error('Contract already claimed');
      err.code = 'ALREADY_CLAIMED';
      throw err;
    }

    const err: any = new Error('Contract claim failed');
    err.code = 'ALREADY_CLAIMED';
    throw err;
  }

  async getSupplyDropTable(tableId: string, version?: number): Promise<SupplyDropTableModel | null> {
    const v = version || 7;
    return this.defaultTables.get(`${tableId}:${v}`) || null;
  }

  async saveSupplyDropTable(table: SupplyDropTableModel): Promise<void> {
    this.defaultTables.set(`${table.table_id}:${table.version}`, table);
  }

  async recordSupplyDropOpen(open: Omit<SupplyDropOpenModel, 'open_id' | 'opened_at'>): Promise<SupplyDropOpenModel> {
    const openId = uuidv4();
    const openRecord: SupplyDropOpenModel = {
      open_id: openId,
      ...open,
      opened_at: new Date()
    };
    return openRecord;
  }

  async createPurchase(purchase: Omit<PurchaseModel, 'purchase_id' | 'created_at'>): Promise<{ purchase: PurchaseModel; isDuplicate: boolean }> {
    const purchaseId = uuidv4();
    const existing = await this.getPurchaseByTransactionId(purchase.platform_transaction_id);
    if (existing) {
      return { purchase: existing, isDuplicate: true };
    }
    const model: PurchaseModel = {
      purchase_id: purchaseId,
      player_id: purchase.player_id,
      sku: purchase.sku,
      platform_transaction_id: purchase.platform_transaction_id,
      status: purchase.status,
      raw_receipt_ref: purchase.raw_receipt_ref,
      created_at: new Date()
    };
    return { purchase: model, isDuplicate: false };
  }

  async getPurchaseByTransactionId(transactionId: string): Promise<PurchaseModel | null> {
    return null;
  }

  async updatePurchaseStatus(purchaseId: string, status: any): Promise<PurchaseModel> {
    return {
      purchase_id: purchaseId,
      player_id: '',
      sku: '',
      platform_transaction_id: '',
      status,
      created_at: new Date()
    };
  }

  async saveConsentRecord(record: Omit<ConsentRecordModel, 'recorded_at'>): Promise<ConsentRecordModel> {
    const res = await this.pool.query(
      `INSERT INTO consent_record (player_id, age_bucket, ad_personalization_allowed, analytics_allowed, policy_version, recorded_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (player_id) DO UPDATE
       SET age_bucket = EXCLUDED.age_bucket,
           ad_personalization_allowed = EXCLUDED.ad_personalization_allowed,
           analytics_allowed = EXCLUDED.analytics_allowed,
           policy_version = EXCLUDED.policy_version,
           recorded_at = NOW()
       RETURNING *`,
      [record.player_id, record.age_bucket, record.ad_personalization_allowed, record.analytics_allowed, record.policy_version]
    );
    return this.mapConsentRecord(res.rows[0]);
  }

  async getConsentRecord(playerId: string): Promise<ConsentRecordModel | null> {
    const res = await this.pool.query(`SELECT * FROM consent_record WHERE player_id = $1`, [playerId]);
    if (res.rows.length === 0) return null;
    return this.mapConsentRecord(res.rows[0]);
  }

  async addFriendLink(playerId: string, friendPlayerId: string, source: 'game_center' | 'friend_code'): Promise<FriendLinkModel> {
    const link: FriendLinkModel = {
      player_id: playerId,
      friend_player_id: friendPlayerId,
      source,
      created_at: new Date()
    };
    return link;
  }

  async getFriends(playerId: string): Promise<string[]> {
    return [];
  }

  async getActiveContentPacks(): Promise<ContentPackModel[]> {
    return [];
  }

  async saveContentPack(pack: ContentPackModel): Promise<void> {}

  async reset(): Promise<void> {
    await this.pool.query(`TRUNCATE TABLE player, device, economy_balance, ledger_entry, run, ownership, contract_progress, consent_record CASCADE`);
  }

  // Mappers
  private mapPlayer(r: any): PlayerModel {
    return {
      player_id: r.player_id,
      guest_device_id: r.guest_device_id,
      apple_user_id: r.apple_user_id,
      display_name: r.display_name,
      age_bucket: r.age_bucket,
      created_at: new Date(r.created_at),
      last_seen_at: new Date(r.last_seen_at)
    };
  }

  private mapDevice(r: any): DeviceModel {
    return {
      device_id: r.device_id,
      player_id: r.player_id,
      platform: r.platform,
      push_token: r.push_token,
      app_version: r.app_version,
      last_seen_at: new Date(r.last_seen_at)
    };
  }

  private mapBalance(r: any): EconomyBalanceModel {
    return {
      player_id: r.player_id,
      chips: parseInt(r.chips, 10),
      cores: parseInt(r.cores, 10),
      updated_at: new Date(r.updated_at)
    };
  }

  private mapLedgerEntry(r: any): LedgerEntryModel {
    return {
      entry_id: r.entry_id,
      player_id: r.player_id,
      currency: r.currency,
      delta: parseInt(r.delta, 10),
      reason: r.reason,
      idempotency_key: r.idempotency_key,
      created_at: new Date(r.created_at)
    };
  }

  private mapRun(r: any): RunModel {
    return {
      run_id: r.run_id,
      player_id: r.player_id,
      district_id: r.district_id,
      runner_id: r.runner_id,
      board_id: r.board_id,
      meters: parseInt(r.meters, 10),
      chips_collected: parseInt(r.chips_collected, 10),
      crashed_cause: r.crashed_cause,
      client_submitted_at: new Date(r.client_submitted_at),
      server_received_at: new Date(r.server_received_at),
      integrity_flag: r.integrity_flag,
      idempotency_key: r.idempotency_key,
      duration_seconds: r.duration_seconds ? parseFloat(r.duration_seconds) : undefined
    };
  }

  private mapOwnership(r: any): OwnershipModel {
    return {
      player_id: r.player_id,
      item_type: r.item_type,
      item_id: r.item_id,
      equipped: r.equipped,
      acquired_at: new Date(r.acquired_at),
      acquired_via: r.acquired_via
    };
  }

  private mapContractProgress(r: any): ContractProgressModel {
    return {
      player_id: r.player_id,
      contract_id: r.contract_id,
      progress: parseInt(r.progress, 10),
      completed_at: r.completed_at ? new Date(r.completed_at) : null,
      claimed_at: r.claimed_at ? new Date(r.claimed_at) : null,
      claim_idempotency_key: r.claim_idempotency_key || null
    };
  }

  private mapConsentRecord(r: any): ConsentRecordModel {
    return {
      player_id: r.player_id,
      age_bucket: r.age_bucket,
      ad_personalization_allowed: r.ad_personalization_allowed,
      analytics_allowed: r.analytics_allowed,
      policy_version: r.policy_version,
      recorded_at: new Date(r.recorded_at)
    };
  }
}
