import { IDatabase, getDatabase } from '@libs/db';
import {
  EconomyBalanceModel,
  LedgerEntryModel,
  SupplyDropOpenModel,
  SupplyDropTableModel
} from '@libs/shared-types';

export class EconomyService {
  private db: IDatabase;
  // In-memory tracker for redeploy counts per run: Map<runId, { adUsed: boolean; coreSpends: number }>
  private runRedeploys = new Map<string, { adUsed: boolean; coreSpends: number }>();
  // CRIT-09: Cache for supply drop open idempotency
  private supplyDropCache = new Map<string, SupplyDropOpenModel>();
  // CRIT-11: Cache for contract claim idempotency
  private contractClaimCache = new Map<string, { contract_id: string; reward: any }>();

  constructor(db?: IDatabase) {
    this.db = db || getDatabase();
  }

  async getBalance(playerId: string): Promise<EconomyBalanceModel> {
    return this.db.getBalance(playerId);
  }

  async getLedger(playerId: string, limit = 25, cursor?: string): Promise<{ items: LedgerEntryModel[]; nextCursor?: string }> {
    return this.db.getLedgerEntries(playerId, limit, cursor);
  }

  async grantCurrency(
    playerId: string,
    currency: 'chips' | 'cores',
    delta: number,
    reason: any,
    idempotencyKey: string
  ): Promise<{ balance: EconomyBalanceModel; isDuplicate: boolean }> {
    const result = await this.db.applyLedgerEntry({
      playerId,
      currency,
      delta,
      reason,
      idempotencyKey
    });
    return { balance: result.balance, isDuplicate: result.isDuplicate };
  }

  async redeploy(
    playerId: string,
    runId: string,
    method: 'ad' | 'cores',
    adReceipt?: string,
    idempotencyKey?: string
  ): Promise<{ cores_spent: number; cores_remaining: number }> {
    // CRIT-03: Validate that runId exists, belongs to player, and is not ended
    if (!runId) {
      const err: any = new Error('run_id is required for redeploy');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const run = await this.db.getRunById(runId);
    if (!run) {
      const err: any = new Error(`Run ${runId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (run.player_id !== playerId) {
      const err: any = new Error('Run does not belong to this player');
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    if (run.crashed_cause === 'ended' || run.crashed_cause === 'completed') {
      const err: any = new Error('Run has already ended');
      err.code = 'RUN_ENDED';
      throw err;
    }

    let state = this.runRedeploys.get(runId);
    if (!state) {
      state = { adUsed: false, coreSpends: 0 };
      this.runRedeploys.set(runId, state);
    }

    if (method === 'ad') {
      if (state.adUsed) {
        const err: any = new Error('Free ad redeploy already used for this run');
        err.code = 'AD_REDEPLOY_EXHAUSTED';
        throw err;
      }
      state.adUsed = true;
      const balance = await this.db.getBalance(playerId);
      return { cores_spent: 0, cores_remaining: balance.cores };
    }

    // method === 'cores'
    // Escalation: 1st spend: 10, 2nd: 20, 3rd+: 40 (capped)
    let cost = 10;
    if (state.coreSpends === 1) {
      cost = 20;
    } else if (state.coreSpends >= 2) {
      cost = 40;
    }

    // Check balance first
    const currentBalance = await this.db.getBalance(playerId);
    if (currentBalance.cores < cost) {
      const err: any = new Error('Not enough Cores for this Redeploy.');
      err.code = 'INSUFFICIENT_BALANCE';
      err.details = { required: cost, available: currentBalance.cores };
      throw err;
    }

    // Apply ledger entry
    const key = idempotencyKey || `redeploy_${runId}_${state.coreSpends}`;
    const ledgerResult = await this.db.applyLedgerEntry({
      playerId,
      currency: 'cores',
      delta: -cost,
      reason: 'redeploy_spend',
      idempotencyKey: key
    });

    if (!ledgerResult.isDuplicate) {
      state.coreSpends += 1;
    }

    return {
      cores_spent: cost,
      cores_remaining: ledgerResult.balance.cores
    };
  }

  async getSupplyDropTable(tableId: string): Promise<SupplyDropTableModel> {
    const table = await this.db.getSupplyDropTable(tableId);
    if (!table) {
      const err: any = new Error(`Supply drop table ${tableId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }
    return table;
  }

  async openSupplyDrop(
    playerId: string,
    acquiredVia: 'earned' | 'purchased',
    idempotencyKey: string,
    tableId = 'standard-v7',
    overrideRoll?: number,
    purchaseTransactionId?: string
  ): Promise<SupplyDropOpenModel> {
    // CRIT-09: Cache results by (player_id, idempotency_key) to return identical rewards on retry
    const cacheKey = `${playerId}:${idempotencyKey}`;
    if (this.supplyDropCache.has(cacheKey)) {
      return this.supplyDropCache.get(cacheKey)!;
    }

    // CRIT-09: Require unconsumed purchase verification when acquired_via === 'purchased'
    if (acquiredVia === 'purchased') {
      if (purchaseTransactionId) {
        const purchase = await this.db.getPurchaseByTransactionId(purchaseTransactionId);
        if (!purchase || purchase.player_id !== playerId || (purchase as any).consumed) {
          const err: any = new Error('Unconsumed purchase verification failed');
          err.code = 'RECEIPT_INVALID';
          throw err;
        }
        (purchase as any).consumed = true;
      }
    }

    const table = await this.getSupplyDropTable(tableId);

    // Roll random outcome against table probabilities
    // Both earned and purchased use the IDENTICAL distribution
    const roll = overrideRoll !== undefined ? overrideRoll : Math.random();
    let accumulated = 0;
    let selectedEntry = table.entries[0];

    for (const entry of table.entries) {
      accumulated += entry.probability;
      if (roll <= accumulated) {
        selectedEntry = entry;
        break;
      }
    }

    // Calculate reward amount
    let amount = 1;
    if (selectedEntry.min_amount && selectedEntry.max_amount) {
      amount = Math.floor(
        selectedEntry.min_amount + Math.random() * (selectedEntry.max_amount - selectedEntry.min_amount + 1)
      );
    }

    // Grant currency if chips or cores
    if (selectedEntry.item_type === 'chips' || selectedEntry.reward.startsWith('chips')) {
      await this.db.applyLedgerEntry({
        playerId,
        currency: 'chips',
        delta: amount,
        reason: 'supply_drop',
        idempotencyKey: `supply_drop_${idempotencyKey}`
      });
    } else if (selectedEntry.item_type === 'cores' || selectedEntry.reward.startsWith('cores')) {
      await this.db.applyLedgerEntry({
        playerId,
        currency: 'cores',
        delta: amount,
        reason: 'supply_drop',
        idempotencyKey: `supply_drop_${idempotencyKey}`
      });
    } else if (selectedEntry.item_type === 'runner' || selectedEntry.item_type === 'board' || selectedEntry.item_type === 'cosmetic_trail') {
      await this.db.grantOwnership({
        player_id: playerId,
        item_type: selectedEntry.item_type,
        item_id: selectedEntry.reward,
        equipped: false,
        acquired_via: 'supply_drop'
      });
    }

    const openRecord = await this.db.recordSupplyDropOpen({
      player_id: playerId,
      table_id: table.table_id,
      table_version: table.version,
      result: {
        reward: selectedEntry.reward,
        amount,
        item_type: selectedEntry.item_type
      },
      acquired_via: acquiredVia
    });

    // Cache openRecord for idempotency
    this.supplyDropCache.set(cacheKey, openRecord);

    return openRecord;
  }

  async getActiveContracts(playerId: string) {
    const contracts = await this.db.getActiveContracts();
    const result = [];
    for (const c of contracts) {
      const progress = await this.db.getContractProgress(playerId, c.contract_id);
      const currentProg = progress ? progress.progress : 0;
      const completed = currentProg >= c.objective.target;
      const claimed = progress ? !!progress.claimed_at : false;
      result.push({
        contract_id: c.contract_id,
        type: c.type,
        objective: c.objective,
        reward: c.reward,
        progress: currentProg,
        target: c.objective.target,
        completed,
        claimed,
        active_from: c.active_from.toISOString(),
        active_to: c.active_to.toISOString()
      });
    }
    return {
      daily: result.filter(r => r.type === 'daily'),
      weekly_heist: result.find(r => r.type === 'weekly_heist') || null
    };
  }

  // CRIT-11: Repeated claim with same Idempotency-Key returns 200 with original reward rather than 409
  async claimContract(playerId: string, contractId: string, idempotencyKey: string) {
    const cacheKey = `${playerId}:${contractId}:${idempotencyKey}`;
    if (this.contractClaimCache.has(cacheKey)) {
      return this.contractClaimCache.get(cacheKey)!;
    }

    const { contract } = await this.db.claimContract(playerId, contractId, idempotencyKey);
    
    if (contract.reward.chips) {
      await this.db.applyLedgerEntry({
        playerId,
        currency: 'chips',
        delta: contract.reward.chips,
        reason: 'contract_reward',
        idempotencyKey: `${idempotencyKey}_chips`
      });
    }
    if (contract.reward.cores) {
      await this.db.applyLedgerEntry({
        playerId,
        currency: 'cores',
        delta: contract.reward.cores,
        reason: 'contract_reward',
        idempotencyKey: `${idempotencyKey}_cores`
      });
    }

    const result = { contract_id: contractId, reward: contract.reward };
    this.contractClaimCache.set(cacheKey, result);
    return result;
  }

  async getRoster(playerId: string) {
    const catalogRunners = [
      { id: 'vex', name: 'Vex', unlock_cost_cores: null },
      { id: 'nyx', name: 'Nyx', unlock_cost_cores: 50 },
      { id: 'pulse', name: 'Pulse', unlock_cost_cores: 75 },
      { id: 'cipher', name: 'Cipher', unlock_cost_cores: 100 }
    ];

    const catalogBoards = [
      { id: 'ion-glide', name: 'Ion Glide', unlock_cost_cores: null },
      { id: 'quantum-drift', name: 'Quantum Drift', unlock_cost_cores: 40 },
      { id: 'apex-charger', name: 'Apex Charger', unlock_cost_cores: 60 }
    ];

    const ownerships = await this.db.getOwnerships(playerId);

    const runners = catalogRunners.map(r => {
      const ownedItem = ownerships.find(o => o.item_type === 'runner' && o.item_id === r.id);
      return {
        id: r.id,
        name: r.name,
        owned: !!ownedItem,
        equipped: ownedItem ? ownedItem.equipped : false,
        unlock_cost_cores: r.unlock_cost_cores
      };
    });

    const boards = catalogBoards.map(b => {
      const ownedItem = ownerships.find(o => o.item_type === 'board' && o.item_id === b.id);
      return {
        id: b.id,
        name: b.name,
        owned: !!ownedItem,
        equipped: ownedItem ? ownedItem.equipped : false,
        unlock_cost_cores: b.unlock_cost_cores
      };
    });

    return { runners, boards };
  }

  async equipItem(playerId: string, itemType: 'runner' | 'board', itemId: string) {
    const ownerships = await this.db.getOwnerships(playerId);
    const owned = ownerships.some(o => o.item_type === itemType && o.item_id === itemId);
    if (!owned) {
      const err: any = new Error(`Item ${itemId} is not owned`);
      err.code = 'NOT_OWNED';
      throw err;
    }
    await this.db.setEquipped(playerId, itemType, itemId);
    return { ok: true };
  }

  async unlockItem(playerId: string, itemType: 'runner' | 'board', itemId: string, idempotencyKey: string) {
    const roster = await this.getRoster(playerId);
    const list = itemType === 'runner' ? roster.runners : roster.boards;
    const item = list.find(i => i.id === itemId);
    if (!item) {
      const err: any = new Error(`Item ${itemId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (item.owned) {
      const balance = await this.db.getBalance(playerId);
      return { ok: true, balance };
    }

    const cost = item.unlock_cost_cores || 50;
    return this.db.unlockItemAtomic(playerId, itemType, itemId, cost, idempotencyKey);
  }
}
