import { v4 as uuidv4 } from 'uuid';
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

  // CRIT-A1: Generate parental gate math challenge with signed challenge_token
  createParentalGateChallenge(): { challenge_id: string; question: string; challenge_token: string } {
    const num1 = Math.floor(Math.random() * 8) + 3; // 3 to 10
    const num2 = Math.floor(Math.random() * 8) + 3; // 3 to 10
    const challengeId = uuidv4();
    const expectedAnswer = num1 * num2;
    const challengeToken = AuthService.generateParentalGateChallenge(challengeId, expectedAnswer);

    // NEVER leak challenge_solution, num1, or num2!
    return {
      challenge_id: challengeId,
      question: `${num1} × ${num2} = ?`,
      challenge_token: challengeToken
    };
  }

  // CRIT-A1, RED-201, RED-202, RED-203: Verify challenge_token and answer, rejecting tampering with 403
  async verifyParentalGate(
    playerId: string,
    body: { challenge_token?: string; answer?: number }
  ): Promise<{ parental_gate_token: string; expires_in_seconds: number }> {
    const { challenge_token, answer } = body || {};

    if (!challenge_token || typeof challenge_token !== 'string') {
      const err: any = new Error('challenge_token is required');
      err.code = 'PARENTAL_GATE_REQUIRED';
      throw err;
    }

    if (answer === undefined || answer === null || !Number.isInteger(answer)) {
      const err: any = new Error('answer is required and must be an integer');
      err.code = 'PARENTAL_GATE_REQUIRED';
      throw err;
    }

    const payload = AuthService.verifyParentalGateChallenge(challenge_token);

    if (Date.now() > payload.expires_at) {
      const err: any = new Error('Challenge has expired');
      err.code = 'PARENTAL_GATE_REQUIRED';
      throw err;
    }

    if (answer !== payload.expected_answer) {
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
