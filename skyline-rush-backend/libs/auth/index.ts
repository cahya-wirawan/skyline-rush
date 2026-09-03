import * as jwt from 'jsonwebtoken';
import { AgeBucket } from '@libs/shared-types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_super_secret_jwt_key_2026';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'dev_super_secret_refresh_key_2026';
const PARENTAL_GATE_SECRET = process.env.PARENTAL_GATE_SECRET || 'dev_parental_gate_secret_2026';

export interface JwtPayload {
  sub: string; // player_id
  age_bucket: AgeBucket;
  iat?: number;
  exp?: number;
}

export interface ParentalGateTokenPayload {
  player_id: string;
  verified_at: number;
}

export class AuthService {
  static generateTokens(playerId: string, ageBucket: AgeBucket): { accessToken: string; refreshToken: string } {
    const payload: JwtPayload = {
      sub: playerId,
      age_bucket: ageBucket
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ sub: playerId }, REFRESH_SECRET, { expiresIn: '30d' });

    return { accessToken, refreshToken };
  }

  static verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (err: any) {
      const error: any = new Error('Invalid or expired access token');
      error.code = 'UNAUTHORIZED';
      throw error;
    }
  }

  static verifyRefreshToken(token: string): { sub: string } {
    try {
      return jwt.verify(token, REFRESH_SECRET) as { sub: string };
    } catch (err: any) {
      const error: any = new Error('Invalid or expired refresh token');
      error.code = 'INVALID_REFRESH_TOKEN';
      throw error;
    }
  }

  static generateParentalGateToken(playerId: string): string {
    const payload: ParentalGateTokenPayload = {
      player_id: playerId,
      verified_at: Date.now()
    };
    return jwt.sign(payload, PARENTAL_GATE_SECRET, { expiresIn: '5m' }); // 5 min freshness window
  }

  static verifyParentalGate(token: string | undefined, playerId: string, freshnessSeconds = 300): boolean {
    if (!token) return false;
    try {
      const decoded = jwt.verify(token, PARENTAL_GATE_SECRET) as ParentalGateTokenPayload;
      if (decoded.player_id !== playerId) return false;
      const ageMs = Date.now() - decoded.verified_at;
      return ageMs >= 0 && ageMs <= freshnessSeconds * 1000;
    } catch {
      return false;
    }
  }

  static deriveAgeBucketFromBirthYear(birthYear: number, currentYear = new Date().getFullYear()): AgeBucket {
    const age = currentYear - birthYear;
    if (age < 13) return 'under_13';
    if (age <= 15) return '13_15';
    return '16_plus';
  }
}
