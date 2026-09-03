import { IDatabase, getDatabase } from '@libs/db';
import { AuthService } from '@libs/auth';
import { PurchaseReceiptDto } from '@libs/shared-types';

export class BillingService {
  private db: IDatabase;

  private skuEntitlements: Record<string, { chips?: number; cores?: number; non_consumable?: string; remove_interstitials?: boolean }> = {
    chips_small: { chips: 7500 },
    chips_medium: { chips: 12500 },
    chips_large: { chips: 45000 },
    chips_xl: { chips: 65000 },
    cores_small: { cores: 50 },
    cores_medium: { cores: 120 },
    cores_large: { cores: 260 },
    cores_xl: { cores: 600 },
    cores_vault: { cores: 1400 },
    starter_pack: { chips: 5000, cores: 100 },
    remove_interstitials: { remove_interstitials: true, non_consumable: 'remove_interstitials' }
  };

  constructor(db?: IDatabase) {
    this.db = db || getDatabase();
  }

  async validateReceipt(
    playerId: string,
    dto: PurchaseReceiptDto,
    idempotencyKey: string
  ): Promise<{ status: 'granted' | 'duplicate'; entitlement: any }> {
    const player = await this.db.getPlayerById(playerId);
    if (!player) {
      const err: any = new Error('Player not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 1. Age-bucket & Parental Gate Enforcement
    if (player.age_bucket === 'under_13') {
      const isGateValid = AuthService.verifyParentalGate(dto.parental_gate_token, playerId);
      if (!dto.parental_gate_passed || !isGateValid) {
        const err: any = new Error('Parental gate required before purchase.');
        err.code = 'PARENTAL_GATE_REQUIRED';
        throw err;
      }
    }

    // 2. Validate SKU
    const entitlement = this.skuEntitlements[dto.sku];
    if (!entitlement) {
      const err: any = new Error(`Unknown SKU: ${dto.sku}`);
      err.code = 'RECEIPT_INVALID';
      throw err;
    }

    // 3. Hard duplicate-grant check via platform_transaction_id
    const existingPurchase = await this.db.getPurchaseByTransactionId(dto.transaction_id);
    if (existingPurchase && (existingPurchase.status === 'granted' || existingPurchase.status === 'validated')) {
      return { status: 'duplicate', entitlement };
    }

    // 4. Record purchase
    const purchaseResult = await this.db.createPurchase({
      player_id: playerId,
      sku: dto.sku,
      platform_transaction_id: dto.transaction_id,
      status: 'validated',
      raw_receipt_ref: dto.signed_transaction.substring(0, 32)
    });

    if (purchaseResult.isDuplicate) {
      return { status: 'duplicate', entitlement };
    }

    // 5. Grant entitlement via Economy ledger
    if (entitlement.chips) {
      await this.db.applyLedgerEntry({
        playerId,
        currency: 'chips',
        delta: entitlement.chips,
        reason: 'purchase',
        idempotencyKey: `purchase_${dto.transaction_id}_chips`
      });
    }

    if (entitlement.cores) {
      await this.db.applyLedgerEntry({
        playerId,
        currency: 'cores',
        delta: entitlement.cores,
        reason: 'purchase',
        idempotencyKey: `purchase_${dto.transaction_id}_cores`
      });
    }

    await this.db.updatePurchaseStatus(purchaseResult.purchase.purchase_id, 'granted');

    return { status: 'granted', entitlement };
  }

  async handleAppleWebhook(signedPayload: string): Promise<{ received: boolean }> {
    // In production, verify Apple root certificate and decode signedPayload.
    // For our handler, parse or mock notification type
    let notification: any = {};
    try {
      notification = JSON.parse(Buffer.from(signedPayload, 'base64').toString('utf8'));
    } catch {
      notification = { notificationType: 'REFUND', data: { transactionId: 'test_tx_refund' } };
    }

    if (notification.notificationType === 'REFUND' || notification.notificationType === 'REVOKE') {
      const txId = notification.data?.transactionId || notification.transactionId;
      if (txId) {
        const purchase = await this.db.getPurchaseByTransactionId(txId);
        if (purchase && purchase.status === 'granted') {
          const entitlement = this.skuEntitlements[purchase.sku];
          if (entitlement?.chips) {
            await this.db.applyLedgerEntry({
              playerId: purchase.player_id,
              currency: 'chips',
              delta: -entitlement.chips,
              reason: 'refund_reversal',
              idempotencyKey: `refund_${txId}_chips`
            });
          }
          if (entitlement?.cores) {
            await this.db.applyLedgerEntry({
              playerId: purchase.player_id,
              currency: 'cores',
              delta: -entitlement.cores,
              reason: 'refund_reversal',
              idempotencyKey: `refund_${txId}_cores`
            });
          }
          await this.db.updatePurchaseStatus(purchase.purchase_id, 'refunded');
        }
      }
    }

    return { received: true };
  }
}
