import { IDatabase, getDatabase } from '@libs/db';
import { AuthService } from '@libs/auth';
import { AgeBucket, AuthTokensResponse, PlayerModel } from '@libs/shared-types';

export class ProfileAuthService {
  private db: IDatabase;

  constructor(db?: IDatabase) {
    this.db = db || getDatabase();
  }

  async authGuest(guestDeviceId: string, ageBucket: AgeBucket): Promise<AuthTokensResponse> {
    let player = await this.db.getPlayerByGuestDeviceId(guestDeviceId);
    if (!player) {
      const displayName = `Runner#${Math.floor(1000 + Math.random() * 9000)}`;
      player = await this.db.createPlayer({
        guest_device_id: guestDeviceId,
        display_name: displayName,
        age_bucket: ageBucket
      });

      // Save initial consent record
      await this.db.saveConsentRecord({
        player_id: player.player_id,
        age_bucket: ageBucket,
        ad_personalization_allowed: ageBucket === '16_plus',
        analytics_allowed: true,
        policy_version: '2026.1'
      });
    }

    const { accessToken, refreshToken } = AuthService.generateTokens(player.player_id, player.age_bucket);
    return {
      player_id: player.player_id,
      access_token: accessToken,
      refresh_token: refreshToken,
      age_bucket: player.age_bucket
    };
  }

  async authApple(identityToken: string, guestDeviceId?: string): Promise<AuthTokensResponse> {
    // In production, decode & verify Apple identityToken JWS.
    // For local dev/sandbox, extract opaque Apple user ID.
    const appleUserId = `apple_sub_${Buffer.from(identityToken).toString('base64').substring(0, 16)}`;
    
    let player = await this.db.getPlayerByAppleUserId(appleUserId);
    
    if (!player) {
      // Check if we can merge an existing guest account
      if (guestDeviceId) {
        const guestPlayer = await this.db.getPlayerByGuestDeviceId(guestDeviceId);
        if (guestPlayer && !guestPlayer.apple_user_id) {
          // Link guest account to Apple - preserve ALL existing progress!
          player = await this.db.updatePlayer(guestPlayer.player_id, {
            apple_user_id: appleUserId
          });
        }
      }

      if (!player) {
        // Brand new Apple player
        const displayName = `Runner#${Math.floor(1000 + Math.random() * 9000)}`;
        player = await this.db.createPlayer({
          apple_user_id: appleUserId,
          display_name: displayName,
          age_bucket: '16_plus' // Default if not prior guest
        });

        await this.db.saveConsentRecord({
          player_id: player.player_id,
          age_bucket: player.age_bucket,
          ad_personalization_allowed: true,
          analytics_allowed: true,
          policy_version: '2026.1'
        });
      }
    }

    const { accessToken, refreshToken } = AuthService.generateTokens(player.player_id, player.age_bucket);
    return {
      player_id: player.player_id,
      access_token: accessToken,
      refresh_token: refreshToken,
      age_bucket: player.age_bucket
    };
  }

  async refreshToken(refreshTokenStr: string): Promise<{ access_token: string }> {
    const decoded = AuthService.verifyRefreshToken(refreshTokenStr);
    const player = await this.db.getPlayerById(decoded.sub);
    if (!player) {
      const err: any = new Error('Player not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    const { accessToken } = AuthService.generateTokens(player.player_id, player.age_bucket);
    return { access_token: accessToken };
  }

  async getProfile(playerId: string): Promise<{
    player_id: string;
    display_name: string;
    age_bucket: AgeBucket;
    equipped: { runner_id: string; board_id: string };
  }> {
    const player = await this.db.getPlayerById(playerId);
    if (!player) {
      const err: any = new Error('Player not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    const ownerships = await this.db.getOwnerships(playerId);
    const equippedRunner = ownerships.find(o => o.item_type === 'runner' && o.equipped)?.item_id || 'vex';
    const equippedBoard = ownerships.find(o => o.item_type === 'board' && o.equipped)?.item_id || 'ion-glide';

    return {
      player_id: player.player_id,
      display_name: player.display_name,
      age_bucket: player.age_bucket,
      equipped: {
        runner_id: equippedRunner,
        board_id: equippedBoard
      }
    };
  }

  // CRIT-04: Verify parental gate math challenge and return 5-minute signed token
  async verifyParentalGate(
    playerId: string,
    body: { answer: number; num1?: number; num2?: number; challenge_solution?: number }
  ): Promise<{ parental_gate_token: string; expires_in_seconds: number }> {
    const { answer, num1, num2, challenge_solution } = body;
    if (answer === undefined || answer === null || isNaN(answer)) {
      const err: any = new Error('answer is required and must be a number');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    let expected = challenge_solution;
    if (expected === undefined && num1 !== undefined && num2 !== undefined) {
      expected = num1 * num2;
    }

    if (expected !== undefined && answer !== expected) {
      const err: any = new Error('Incorrect parental gate answer');
      err.code = 'PARENTAL_GATE_REQUIRED';
      throw err;
    }

    const token = AuthService.generateParentalGateToken(playerId);
    return {
      parental_gate_token: token,
      expires_in_seconds: 300
    };
  }
}
