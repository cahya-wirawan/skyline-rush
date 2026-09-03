import { IDatabase, getDatabase } from '@libs/db';
import { AuthService } from '@libs/auth';
import { v4 as uuidv4 } from 'uuid';

export class PrivacyService {
  private db: IDatabase;

  constructor(db?: IDatabase) {
    this.db = db || getDatabase();
  }

  async exportData(playerId: string, parentalGateToken?: string) {
    const player = await this.db.getPlayerById(playerId);
    if (!player) {
      const err: any = new Error('Player not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (player.age_bucket === 'under_13') {
      const valid = AuthService.verifyParentalGate(parentalGateToken, playerId);
      if (!valid) {
        const err: any = new Error('Parental gate required before data export');
        err.code = 'PARENTAL_GATE_REQUIRED';
        throw err;
      }
    }

    const balances = await this.db.getBalance(playerId);
    const ownerships = await this.db.getOwnerships(playerId);
    const ledger = await this.db.getLedgerEntries(playerId, 1000);
    const devices = await this.db.getDevicesByPlayerId(playerId);
    const consent = await this.db.getConsentRecord(playerId);

    const exportPayload = {
      profile: player,
      consent,
      balances,
      ownerships,
      devices,
      ledger: ledger.items
    };

    return {
      tracking_id: uuidv4(),
      status: 'accepted',
      download_url: `https://export.skylinerush.game/downloads/${playerId}.json`,
      data: exportPayload
    };
  }

  async deleteData(playerId: string, parentalGateToken?: string) {
    const player = await this.db.getPlayerById(playerId);
    if (!player) {
      const err: any = new Error('Player not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (player.age_bucket === 'under_13') {
      const valid = AuthService.verifyParentalGate(parentalGateToken, playerId);
      if (!valid) {
        const err: any = new Error('Parental gate required before account deletion');
        err.code = 'PARENTAL_GATE_REQUIRED';
        throw err;
      }
    }

    await this.db.deletePlayer(playerId);
    return { status: 'deleted' };
  }
}
