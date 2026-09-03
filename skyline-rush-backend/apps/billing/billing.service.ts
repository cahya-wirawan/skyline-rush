import { IDatabase, getDatabase } from '@libs/db';
import { AuthService } from '@libs/auth';
import { incCounter } from '@libs/metrics';
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
    // AC-P3-8: attempts are the denominator of the receipt-validation
    // failure-rate alert.
    //
    // RF-06 — two distinct counters, deliberately. Guest tokens are issued
    // freely and unauthenticated, so anything a caller can trigger at will by
    // sending bad input (unknown SKU, malformed body, missing parental gate)
    // must NOT feed the paging alert's numerator; otherwise a handful of
    // garbage POSTs pins the ratio at 100% and pages billing. Those go to
    // skyline_receipt_client_rejections_total, which nothing pages on.
    // skyline_receipt_validation_failures_total is reserved for failures the
    // caller cannot manufacture: Apple-side verification errors, entitlement
    // grant failures, and a token whose player row no longer exists.
    incCounter('skyline_receipt_validations_total');

    // 0. Malformed body — purely caller-supplied, so a client rejection.
    //    Guarded explicitly so it cannot reach the grant block below and be
    //    misattributed as a genuine (pageable) validation failure.
    if (!dto || typeof dto.sku !== 'string' || typeof dto.transaction_id !== 'string' ||
        typeof dto.signed_transaction !== 'string') {
      incCounter('skyline_receipt_client_rejections_total');
      const err: any = new Error('sku, transaction_id and signed_transaction are required.');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const player = await this.db.getPlayerById(playerId);
    if (!player) {
      // Not caller-controllable: requires a validly signed token whose player
      // row has since disappeared — a genuine server-side inconsistency.
      incCounter('skyline_receipt_validation_failures_total');
      const err: any = new Error('Player not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 1. Age-bucket & Parental Gate Enforcement
    if (player.age_bucket === 'under_13') {
      const isGateValid = AuthService.verifyParentalGate(dto.parental_gate_token, playerId);
      if (!dto.parental_gate_passed || !isGateValid) {
        incCounter('skyline_receipt_client_rejections_total');
        const err: any = new Error('Parental gate required before purchase.');
        err.code = 'PARENTAL_GATE_REQUIRED';
        throw err;
      }
    }

    // 2. Validate SKU
    const entitlement = this.skuEntitlements[dto.sku];
    if (!entitlement) {
      incCounter('skyline_receipt_client_rejections_total');
      const err: any = new Error(`Unknown SKU: ${dto.sku}`);
      err.code = 'RECEIPT_INVALID';
      throw err;
    }

    // 3. Hard duplicate-grant check via platform_transaction_id
    const existingPurchase = await this.db.getPurchaseByTransactionId(dto.transaction_id);
    if (existingPurchase && (existingPurchase.status === 'granted' || existingPurchase.status === 'validated')) {
      incCounter('skyline_idempotent_replay_total');
      return { status: 'duplicate', entitlement };
    }

    // 4 + 5. Record the purchase and grant the entitlement. Everything past
    // this point is our side of the transaction: the player has paid, so a
    // failure here means money taken without goods delivered. That IS the
    // condition SkylineReceiptValidationFailureRate exists to page on.
    try {
      const purchaseResult = await this.db.createPurchase({
        player_id: playerId,
        sku: dto.sku,
        platform_transaction_id: dto.transaction_id,
        status: 'validated',
        raw_receipt_ref: dto.signed_transaction.substring(0, 32)
      });

      if (purchaseResult.isDuplicate) {
        incCounter('skyline_idempotent_replay_total');
        return { status: 'duplicate', entitlement };
      }

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
    } catch (err) {
      incCounter('skyline_receipt_validation_failures_total');
      throw err;
    }

    return { status: 'granted', entitlement };
  }

  async handleAppleWebhook(signedPayload: string): Promise<{ received: boolean }> {
    // DEFERRED / OUT OF SCOPE: real App Store Server Notification V2 JWS
    // verification (decoding the x5c chain, validating it up to Apple's root
    // CA, and checking the ES256 signature) is NOT implemented here. Until it
    // is, this endpoint MUST be treated as unauthenticated and untrusted
    // input: the only thing it can distinguish is a payload that decodes as a
    // base64 JSON envelope from one that does not. Nothing in this method may
    // therefore be read as "the payload is genuinely from Apple".
    //
    // RF-01: an undecodable payload previously fell through to a SYNTHESIZED
    // `REFUND` notification, so malformed anonymous input executed a
    // refund-reversal ledger write. A decode failure is now terminal: count it
    // and reject, never synthesize a notification and never touch the ledger.
    let notification: any;
    try {
      notification = JSON.parse(Buffer.from(signedPayload, 'base64').toString('utf8'));
    } catch {
      incCounter('skyline_appstore_webhook_signature_failures_total');
      const err: any = new Error('App Store notification payload could not be decoded.');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!notification || typeof notification !== 'object' || Array.isArray(notification)) {
      incCounter('skyline_appstore_webhook_signature_failures_total');
      const err: any = new Error('App Store notification payload is not a JSON object.');
      err.code = 'VALIDATION_ERROR';
      throw err;
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
