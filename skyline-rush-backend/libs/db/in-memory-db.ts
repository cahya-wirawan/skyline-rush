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
import { v4 as uuidv4 } from 'uuid';

export class InMemoryDatabase implements IDatabase {
  public players = new Map<string, PlayerModel>();
  public devices = new Map<string, DeviceModel>();
  public balances = new Map<string, EconomyBalanceModel>();
  public ledger = new Map<string, LedgerEntryModel>();
  public runs = new Map<string, RunModel>();
  public ownerships = new Map<string, OwnershipModel>();
  public contracts = new Map<string, ContractModel>();
  public contractProgress = new Map<string, ContractProgressModel>();
  public consentRecords = new Map<string, ConsentRecordModel>();
  public supplyDropTables = new Map<string, SupplyDropTableModel>();
  public supplyDropOpens = new Map<string, SupplyDropOpenModel>();
  public purchases = new Map<string, PurchaseModel>();
  public friendLinks = new Map<string, FriendLinkModel>();
  public contentPacks = new Map<string, ContentPackModel>();

  constructor() {
    this.seedDefaults();
  }

  public seedDefaults() {
    // Seed default Supply Drop Table
    const tableId = 'standard-v7';
    const version = 7;
    const key = `${tableId}:${version}`;
    this.supplyDropTables.set(key, {
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

    // Seed default 3 Daily Contracts
    const today = new Date();
    const activeFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const activeTo = new Date(activeFrom.getTime() + 24 * 60 * 60 * 1000);

    const seedContracts: ContractModel[] = [
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

    for (const c of seedContracts) {
      this.contracts.set(c.contract_id, c);
    }

    // Seed default Content Pack for neo-marina
    this.contentPacks.set('neo-marina-1.0.0', {
      content_pack_id: '11111111-1111-1111-1111-111111111111',
      district_id: 'neo-marina',
      version: '1.0.0',
      cdn_url: 'https://cdn.skylinerush.game/districts/neo-marina-1.0.0.bundle',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      published_at: new Date('2026-08-31T00:00:00Z'),
      status: 'live'
    });
  }

  async reset(): Promise<void> {
    this.players.clear();
    this.devices.clear();
    this.balances.clear();
    this.ledger.clear();
    this.runs.clear();
    this.ownerships.clear();
    this.contractProgress.clear();
    this.consentRecords.clear();
    this.supplyDropTables.clear();
    this.supplyDropOpens.clear();
    this.purchases.clear();
    this.friendLinks.clear();
    this.contentPacks.clear();
    this.seedDefaults();
  }

  async createPlayer(playerData: Omit<PlayerModel, 'player_id' | 'created_at' | 'last_seen_at'> & { player_id?: string }): Promise<PlayerModel> {
    const playerId = playerData.player_id || uuidv4();
    const now = new Date();
    const player: PlayerModel = {
      player_id: playerId,
      guest_device_id: playerData.guest_device_id || null,
      apple_user_id: playerData.apple_user_id || null,
      display_name: playerData.display_name,
      age_bucket: playerData.age_bucket,
      created_at: now,
      last_seen_at: now
    };
    this.players.set(playerId, player);

    // Initialize balance
    await this.initBalance(playerId, 0, 0);

    // Grant starter items (Vex runner and Ion-Glide board)
    await this.grantOwnership({
      player_id: playerId,
      item_type: 'runner',
      item_id: 'vex',
      equipped: true,
      acquired_via: 'starter'
    });

    await this.grantOwnership({
      player_id: playerId,
      item_type: 'board',
      item_id: 'ion-glide',
      equipped: true,
      acquired_via: 'starter'
    });

    return player;
  }

  async getPlayerById(playerId: string): Promise<PlayerModel | null> {
    return this.players.get(playerId) || null;
  }

  async getPlayerByGuestDeviceId(guestDeviceId: string): Promise<PlayerModel | null> {
    for (const player of this.players.values()) {
      if (player.guest_device_id === guestDeviceId) {
        return player;
      }
    }
    return null;
  }

  async getPlayerByAppleUserId(appleUserId: string): Promise<PlayerModel | null> {
    for (const player of this.players.values()) {
      if (player.apple_user_id === appleUserId) {
        return player;
      }
    }
    return null;
  }

  async updatePlayer(playerId: string, partial: Partial<PlayerModel>): Promise<PlayerModel> {
    const existing = await this.getPlayerById(playerId);
    if (!existing) throw new Error('Player not found');
    const updated = { ...existing, ...partial, last_seen_at: new Date() };
    this.players.set(playerId, updated);
    return updated;
  }

  async deletePlayer(playerId: string): Promise<void> {
    this.players.delete(playerId);
    this.balances.delete(playerId);
    this.consentRecords.delete(playerId);
    for (const [k, d] of this.devices.entries()) {
      if (d.player_id === playerId) this.devices.delete(k);
    }
    for (const [k, o] of this.ownerships.entries()) {
      if (o.player_id === playerId) this.ownerships.delete(k);
    }
    for (const [k, cp] of this.contractProgress.entries()) {
      if (cp.player_id === playerId) this.contractProgress.delete(k);
    }
    for (const [k, fl] of this.friendLinks.entries()) {
      if (fl.player_id === playerId || fl.friend_player_id === playerId) this.friendLinks.delete(k);
    }
    // Runs and ledger entries are de-identified or deleted
    for (const [k, r] of this.runs.entries()) {
      if (r.player_id === playerId) this.runs.delete(k);
    }
  }

  async upsertDevice(deviceData: Omit<DeviceModel, 'device_id' | 'last_seen_at'>): Promise<DeviceModel> {
    const deviceId = uuidv4();
    const device: DeviceModel = {
      device_id: deviceId,
      ...deviceData,
      last_seen_at: new Date()
    };
    this.devices.set(deviceId, device);
    return device;
  }

  async getDevicesByPlayerId(playerId: string): Promise<DeviceModel[]> {
    return Array.from(this.devices.values()).filter(d => d.player_id === playerId);
  }

  async getBalance(playerId: string): Promise<EconomyBalanceModel> {
    let balance = this.balances.get(playerId);
    if (!balance) {
      balance = await this.initBalance(playerId, 0, 0);
    }
    return balance;
  }

  async initBalance(playerId: string, chips = 0, cores = 0): Promise<EconomyBalanceModel> {
    const balance: EconomyBalanceModel = {
      player_id: playerId,
      chips,
      cores,
      updated_at: new Date()
    };
    this.balances.set(playerId, balance);
    return balance;
  }

  async applyLedgerEntry(entryData: {
    playerId: string;
    currency: 'chips' | 'cores';
    delta: number;
    reason: any;
    idempotencyKey: string;
  }): Promise<{ balance: EconomyBalanceModel; entry: LedgerEntryModel; isDuplicate: boolean }> {
    // Check idempotency
    for (const existingEntry of this.ledger.values()) {
      if (
        existingEntry.player_id === entryData.playerId &&
        existingEntry.idempotency_key === entryData.idempotencyKey
      ) {
        const currentBalance = await this.getBalance(entryData.playerId);
        return { balance: currentBalance, entry: existingEntry, isDuplicate: true };
      }
    }

    const currentBalance = await this.getBalance(entryData.playerId);
    const newChips = entryData.currency === 'chips' ? currentBalance.chips + entryData.delta : currentBalance.chips;
    const newCores = entryData.currency === 'cores' ? currentBalance.cores + entryData.delta : currentBalance.cores;

    if (newChips < 0 || newCores < 0) {
      const err: any = new Error('Insufficient balance');
      err.code = 'INSUFFICIENT_BALANCE';
      err.details = {
        required: Math.abs(entryData.delta),
        available: entryData.currency === 'chips' ? currentBalance.chips : currentBalance.cores
      };
      throw err;
    }

    currentBalance.chips = newChips;
    currentBalance.cores = newCores;
    currentBalance.updated_at = new Date();
    this.balances.set(entryData.playerId, currentBalance);

    const entryId = uuidv4();
    const entry: LedgerEntryModel = {
      entry_id: entryId,
      player_id: entryData.playerId,
      currency: entryData.currency,
      delta: entryData.delta,
      reason: entryData.reason,
      idempotency_key: entryData.idempotencyKey,
      created_at: new Date()
    };
    this.ledger.set(entryId, entry);

    return { balance: currentBalance, entry, isDuplicate: false };
  }

  async getLedgerEntries(playerId: string, limit = 25, cursor?: string): Promise<{ items: LedgerEntryModel[]; nextCursor?: string }> {
    const all = Array.from(this.ledger.values())
      .filter(e => e.player_id === playerId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    let startIndex = 0;
    if (cursor) {
      const idx = all.findIndex(e => e.entry_id === cursor);
      if (idx !== -1) startIndex = idx + 1;
    }

    const items = all.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < all.length ? items[items.length - 1]?.entry_id : undefined;

    return { items, nextCursor };
  }

  async createRun(runData: Omit<RunModel, 'run_id' | 'server_received_at'>): Promise<{ run: RunModel; isDuplicate: boolean }> {
    for (const existingRun of this.runs.values()) {
      if (
        existingRun.player_id === runData.player_id &&
        existingRun.idempotency_key === runData.idempotency_key
      ) {
        return { run: existingRun, isDuplicate: true };
      }
    }

    const runId = uuidv4();
    const run: RunModel = {
      run_id: runId,
      ...runData,
      server_received_at: new Date()
    };
    this.runs.set(runId, run);

    return { run, isDuplicate: false };
  }

  async getRunById(runId: string): Promise<RunModel | null> {
    return this.runs.get(runId) || null;
  }

  // CRIT-14: Filter leaderboards strictly by integrity_flag === 'ok'
  async getRunsByDistrict(districtId: string, limit = 100): Promise<RunModel[]> {
    return Array.from(this.runs.values())
      .filter(r => r.district_id === districtId && r.integrity_flag === 'ok')
      .sort((a, b) => b.meters - a.meters)
      .slice(0, limit);
  }

  // CRIT-14: Filter leaderboards strictly by integrity_flag === 'ok'
  async getPlayerBestRun(playerId: string, districtId: string): Promise<RunModel | null> {
    const playerRuns = Array.from(this.runs.values())
      .filter(r => r.player_id === playerId && r.district_id === districtId && r.integrity_flag === 'ok')
      .sort((a, b) => b.meters - a.meters);

    return playerRuns[0] || null;
  }

  async getOwnerships(playerId: string): Promise<OwnershipModel[]> {
    return Array.from(this.ownerships.values()).filter(o => o.player_id === playerId);
  }

  async grantOwnership(data: Omit<OwnershipModel, 'acquired_at'>): Promise<OwnershipModel> {
    const key = `${data.player_id}:${data.item_type}:${data.item_id}`;
    const ownership: OwnershipModel = {
      ...data,
      acquired_at: new Date()
    };
    this.ownerships.set(key, ownership);
    return ownership;
  }

  async setEquipped(playerId: string, itemType: 'runner' | 'board', itemId: string): Promise<void> {
    for (const o of this.ownerships.values()) {
      if (o.player_id === playerId && o.item_type === itemType) {
        o.equipped = o.item_id === itemId;
      }
    }
  }

  // RED-205: Atomic unlock and deduction
  async unlockItemAtomic(
    playerId: string,
    itemType: 'runner' | 'board',
    itemId: string,
    cost: number,
    idempotencyKey: string
  ): Promise<{ ok: boolean; balance: EconomyBalanceModel }> {
    const ownershipKey = `${playerId}:${itemType}:${itemId}`;
    if (this.ownerships.has(ownershipKey)) {
      const balance = await this.getBalance(playerId);
      return { ok: true, balance };
    }

    const currentBalance = await this.getBalance(playerId);
    if (currentBalance.cores < cost) {
      const err: any = new Error('Insufficient Cores balance');
      err.code = 'INSUFFICIENT_BALANCE';
      err.details = { required: cost, available: currentBalance.cores };
      throw err;
    }

    const ledgerResult = await this.applyLedgerEntry({
      playerId,
      currency: 'cores',
      delta: -cost,
      reason: 'unlock_spend',
      idempotencyKey
    });

    await this.grantOwnership({
      player_id: playerId,
      item_type: itemType,
      item_id: itemId,
      equipped: false,
      acquired_via: 'currency'
    });

    return { ok: true, balance: ledgerResult.balance };
  }

  async getActiveContracts(): Promise<ContractModel[]> {
    const now = new Date();
    return Array.from(this.contracts.values()).filter(
      c => c.active_from <= now && c.active_to >= now
    );
  }

  async getContractById(contractId: string): Promise<ContractModel | null> {
    return this.contracts.get(contractId) || null;
  }

  async getContractProgress(playerId: string, contractId: string): Promise<ContractProgressModel | null> {
    return this.contractProgress.get(`${playerId}:${contractId}`) || null;
  }

  async upsertContractProgress(playerId: string, contractId: string, progress: number): Promise<ContractProgressModel> {
    const contract = await this.getContractById(contractId);
    const key = `${playerId}:${contractId}`;
    let cp = this.contractProgress.get(key);
    const completed = contract ? progress >= contract.objective.target : false;

    if (!cp) {
      cp = {
        player_id: playerId,
        contract_id: contractId,
        progress,
        completed_at: completed ? new Date() : null,
        claimed_at: null
      };
    } else {
      cp.progress = progress;
      if (completed && !cp.completed_at) {
        cp.completed_at = new Date();
      }
    }
    this.contractProgress.set(key, cp);
    return cp;
  }

  // CRIT-11: Idempotency support - repeated claim with same idempotency key succeeds
  async claimContract(playerId: string, contractId: string, idempotencyKey?: string): Promise<{ contract: ContractModel; progress: ContractProgressModel }> {
    const contract = await this.getContractById(contractId);
    if (!contract) {
      const err: any = new Error('Contract not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    const key = `${playerId}:${contractId}`;
    let cp = this.contractProgress.get(key);
    if (!cp || cp.progress < contract.objective.target) {
      const err: any = new Error('Contract objective not yet met');
      err.code = 'NOT_COMPLETED';
      throw err;
    }

    if (cp.claimed_at) {
      if (idempotencyKey && (cp as any).claim_idempotency_key === idempotencyKey) {
        return { contract, progress: cp };
      }
      const err: any = new Error('Contract already claimed');
      err.code = 'ALREADY_CLAIMED';
      throw err;
    }

    cp.claimed_at = new Date();
    if (idempotencyKey) {
      (cp as any).claim_idempotency_key = idempotencyKey;
    }
    this.contractProgress.set(key, cp);

    return { contract, progress: cp };
  }

  async getSupplyDropTable(tableId: string, version?: number): Promise<SupplyDropTableModel | null> {
    if (version) {
      return this.supplyDropTables.get(`${tableId}:${version}`) || null;
    }
    let latest: SupplyDropTableModel | null = null;
    for (const t of this.supplyDropTables.values()) {
      if (t.table_id === tableId) {
        if (!latest || t.version > latest.version) {
          latest = t;
        }
      }
    }
    return latest;
  }

  async saveSupplyDropTable(table: SupplyDropTableModel): Promise<void> {
    const key = `${table.table_id}:${table.version}`;
    this.supplyDropTables.set(key, table);
  }

  async recordSupplyDropOpen(openData: Omit<SupplyDropOpenModel, 'open_id' | 'opened_at'>): Promise<SupplyDropOpenModel> {
    const openId = uuidv4();
    const open: SupplyDropOpenModel = {
      open_id: openId,
      ...openData,
      opened_at: new Date()
    };
    this.supplyDropOpens.set(openId, open);
    return open;
  }

  async createPurchase(purchaseData: Omit<PurchaseModel, 'purchase_id' | 'created_at'>): Promise<{ purchase: PurchaseModel; isDuplicate: boolean }> {
    for (const existing of this.purchases.values()) {
      if (existing.platform_transaction_id === purchaseData.platform_transaction_id) {
        return { purchase: existing, isDuplicate: true };
      }
    }

    const purchaseId = uuidv4();
    const purchase: PurchaseModel = {
      purchase_id: purchaseId,
      ...purchaseData,
      created_at: new Date()
    };
    this.purchases.set(purchaseId, purchase);
    return { purchase, isDuplicate: false };
  }

  async getPurchaseByTransactionId(transactionId: string): Promise<PurchaseModel | null> {
    for (const p of this.purchases.values()) {
      if (p.platform_transaction_id === transactionId) return p;
    }
    return null;
  }

  async updatePurchaseStatus(purchaseId: string, status: any): Promise<PurchaseModel> {
    const purchase = this.purchases.get(purchaseId);
    if (!purchase) throw new Error('Purchase not found');
    purchase.status = status;
    if (status === 'validated' || status === 'granted') {
      purchase.validated_at = new Date();
    }
    this.purchases.set(purchaseId, purchase);
    return purchase;
  }

  async saveConsentRecord(recordData: Omit<ConsentRecordModel, 'recorded_at'>): Promise<ConsentRecordModel> {
    const record: ConsentRecordModel = {
      ...recordData,
      recorded_at: new Date()
    };
    this.consentRecords.set(recordData.player_id, record);
    return record;
  }

  async getConsentRecord(playerId: string): Promise<ConsentRecordModel | null> {
    return this.consentRecords.get(playerId) || null;
  }

  async addFriendLink(playerId: string, friendPlayerId: string, source: 'game_center' | 'friend_code'): Promise<FriendLinkModel> {
    const link: FriendLinkModel = {
      player_id: playerId,
      friend_player_id: friendPlayerId,
      source,
      created_at: new Date()
    };
    this.friendLinks.set(`${playerId}:${friendPlayerId}`, link);
    return link;
  }

  async getFriends(playerId: string): Promise<string[]> {
    const friends: string[] = [];
    for (const link of this.friendLinks.values()) {
      if (link.player_id === playerId) {
        friends.push(link.friend_player_id);
      }
    }
    return friends;
  }

  async getActiveContentPacks(): Promise<ContentPackModel[]> {
    return Array.from(this.contentPacks.values()).filter(cp => cp.status === 'live');
  }

  async saveContentPack(pack: ContentPackModel): Promise<void> {
    this.contentPacks.set(`${pack.district_id}-${pack.version}`, pack);
  }
}
