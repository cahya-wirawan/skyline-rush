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

export interface IDatabase {
  // Player
  createPlayer(player: Omit<PlayerModel, 'player_id' | 'created_at' | 'last_seen_at'> & { player_id?: string }): Promise<PlayerModel>;
  getPlayerById(playerId: string): Promise<PlayerModel | null>;
  getPlayerByGuestDeviceId(guestDeviceId: string): Promise<PlayerModel | null>;
  getPlayerByAppleUserId(appleUserId: string): Promise<PlayerModel | null>;
  updatePlayer(playerId: string, partial: Partial<PlayerModel>): Promise<PlayerModel>;
  deletePlayer(playerId: string): Promise<void>;

  // Device
  upsertDevice(device: Omit<DeviceModel, 'device_id' | 'last_seen_at'>): Promise<DeviceModel>;
  getDevicesByPlayerId(playerId: string): Promise<DeviceModel[]>;

  // Economy Balance
  getBalance(playerId: string): Promise<EconomyBalanceModel>;
  initBalance(playerId: string, chips?: number, cores?: number): Promise<EconomyBalanceModel>;

  // Ledger & Transactions
  applyLedgerEntry(entry: {
    playerId: string;
    currency: 'chips' | 'cores';
    delta: number;
    reason: any;
    idempotencyKey: string;
  }): Promise<{ balance: EconomyBalanceModel; entry: LedgerEntryModel; isDuplicate: boolean }>;

  getLedgerEntries(playerId: string, limit?: number, cursor?: string): Promise<{ items: LedgerEntryModel[]; nextCursor?: string }>;

  /**
   * Read-only aggregate of the append-only ledger for one player, used solely
   * by the Phase 3 balance-reconciliation observability check
   * (EconomyService.reconcileBalance). Optional so that any future IDatabase
   * implementation stays valid without it; callers must treat `undefined` as
   * "reconciliation not supported" and skip the check rather than fail.
   *
   * This must never mutate state and must never be called from a write path.
   */
  getLedgerSums?(playerId: string): Promise<{ chips: number; cores: number }>;

  // Run
  createRun(run: Omit<RunModel, 'run_id' | 'server_received_at'>): Promise<{ run: RunModel; isDuplicate: boolean }>;
  getRunById(runId: string): Promise<RunModel | null>;
  getRunsByDistrict(districtId: string, limit?: number): Promise<RunModel[]>;
  getPlayerBestRun(playerId: string, districtId: string): Promise<RunModel | null>;

  // Ownership & Store
  getOwnerships(playerId: string): Promise<OwnershipModel[]>;
  grantOwnership(ownership: Omit<OwnershipModel, 'acquired_at'>): Promise<OwnershipModel>;
  setEquipped(playerId: string, itemType: 'runner' | 'board', itemId: string): Promise<void>;
  unlockItemAtomic(
    playerId: string,
    itemType: 'runner' | 'board',
    itemId: string,
    cost: number,
    idempotencyKey: string
  ): Promise<{ ok: boolean; balance: EconomyBalanceModel }>;

  // Contracts
  getActiveContracts(): Promise<ContractModel[]>;
  getContractById(contractId: string): Promise<ContractModel | null>;
  getContractProgress(playerId: string, contractId: string): Promise<ContractProgressModel | null>;
  upsertContractProgress(playerId: string, contractId: string, progress: number): Promise<ContractProgressModel>;
  claimContract(playerId: string, contractId: string, idempotencyKey?: string): Promise<{ contract: ContractModel; progress: ContractProgressModel }>;

  // Supply Drop
  getSupplyDropTable(tableId: string, version?: number): Promise<SupplyDropTableModel | null>;
  saveSupplyDropTable(table: SupplyDropTableModel): Promise<void>;
  recordSupplyDropOpen(open: Omit<SupplyDropOpenModel, 'open_id' | 'opened_at'>): Promise<SupplyDropOpenModel>;

  // Purchases
  createPurchase(purchase: Omit<PurchaseModel, 'purchase_id' | 'created_at'>): Promise<{ purchase: PurchaseModel; isDuplicate: boolean }>;
  getPurchaseByTransactionId(transactionId: string): Promise<PurchaseModel | null>;
  updatePurchaseStatus(purchaseId: string, status: any): Promise<PurchaseModel>;

  // Consent
  saveConsentRecord(record: Omit<ConsentRecordModel, 'recorded_at'>): Promise<ConsentRecordModel>;
  getConsentRecord(playerId: string): Promise<ConsentRecordModel | null>;

  // Friend Links
  addFriendLink(playerId: string, friendPlayerId: string, source: 'game_center' | 'friend_code'): Promise<FriendLinkModel>;
  getFriends(playerId: string): Promise<string[]>;

  // Content Packs
  getActiveContentPacks(): Promise<ContentPackModel[]>;
  saveContentPack(pack: ContentPackModel): Promise<void>;

  // Reset / Clear (for test suites)
  reset(): Promise<void>;
}
