import { IDatabase, getDatabase } from '@libs/db';
import { IntegrityFlag, RunModel, RunSubmitDto } from '@libs/shared-types';

export class RunIntegrityService {
  private db: IDatabase;

  // Maximum physically possible constraints
  private readonly MAX_SPEED_METERS_PER_SEC = 35.0; // 12 m/s base + boost
  private readonly MAX_CHIPS_PER_METER = 2.5; // Max track density with 2x multiplier
  private readonly MAX_ABSOLUTE_METERS = 2000000;
  private readonly MAX_ABSOLUTE_CHIPS = 1000000;

  constructor(db?: IDatabase) {
    this.db = db || getDatabase();
  }

  evaluateIntegrity(data: {
    meters: number;
    chips_collected: number;
    duration_seconds?: number;
  }): IntegrityFlag {
    if (data.meters < 0 || data.chips_collected < 0) {
      return 'excluded';
    }

    if (data.meters > this.MAX_ABSOLUTE_METERS || data.chips_collected > this.MAX_ABSOLUTE_CHIPS) {
      return 'excluded';
    }

    // CRIT-08: Require duration_seconds; flag meters > 0 without valid positive duration as excluded
    if (data.meters > 0 && (!data.duration_seconds || data.duration_seconds <= 0)) {
      return 'excluded';
    }

    // Speed check if duration is provided
    if (data.duration_seconds !== undefined && data.duration_seconds > 0) {
      const speed = data.meters / data.duration_seconds;
      if (speed > this.MAX_SPEED_METERS_PER_SEC) {
        return 'excluded';
      }
      if (speed > 28.0) {
        return 'suspect';
      }
    }

    // Chip density check (only meaningful if meters > 40)
    if (data.meters > 40) {
      const chipDensity = data.chips_collected / data.meters;
      if (chipDensity > this.MAX_CHIPS_PER_METER) {
        return 'excluded';
      }
      if (chipDensity > 2.0) {
        return 'suspect';
      }
    }

    return 'ok';
  }

  async submitRun(
    playerId: string,
    dto: RunSubmitDto,
    idempotencyKey: string
  ): Promise<{
    run_id: string;
    integrity_flag: IntegrityFlag;
    rewards: { chips_granted: number; cores_granted: number; pass_xp_granted: number };
    new_district_best: boolean;
  }> {
    const integrityFlag = this.evaluateIntegrity({
      meters: dto.meters,
      chips_collected: dto.chips_collected,
      duration_seconds: dto.duration_seconds
    });

    const previousBest = await this.db.getPlayerBestRun(playerId, dto.district_id);
    const newDistrictBest = integrityFlag === 'ok' && (!previousBest || dto.meters > previousBest.meters);

    const rewards = {
      chips_granted: integrityFlag === 'ok' ? dto.chips_collected : 0,
      cores_granted: integrityFlag === 'ok' ? Math.floor(dto.meters / 5000) : 0,
      pass_xp_granted: integrityFlag === 'ok' ? Math.floor(dto.meters / 100) + Math.floor(dto.chips_collected / 20) : 0
    };

    const runResult = await this.db.createRun({
      player_id: playerId,
      district_id: dto.district_id,
      runner_id: dto.runner_id,
      board_id: dto.board_id,
      meters: dto.meters,
      chips_collected: dto.chips_collected,
      crashed_cause: dto.crashed_cause || null,
      duration_seconds: dto.duration_seconds,
      client_submitted_at: new Date(dto.client_submitted_at),
      integrity_flag: integrityFlag,
      idempotency_key: idempotencyKey
    });

    if (!runResult.isDuplicate && integrityFlag === 'ok') {
      // Grant collected chips to economy
      if (rewards.chips_granted > 0) {
        await this.db.applyLedgerEntry({
          playerId,
          currency: 'chips',
          delta: rewards.chips_granted,
          reason: 'run_pickup',
          idempotencyKey: `run_${idempotencyKey}_chips`
        });
      }

      // Grant cores if earned
      if (rewards.cores_granted > 0) {
        await this.db.applyLedgerEntry({
          playerId,
          currency: 'cores',
          delta: rewards.cores_granted,
          reason: 'run_pickup',
          idempotencyKey: `run_${idempotencyKey}_cores`
        });
      }

      // Update contract progress
      const contracts = await this.db.getActiveContracts();
      for (const c of contracts) {
        if (c.objective.metric === 'meters') {
          const prog = await this.db.getContractProgress(playerId, c.contract_id);
          const current = prog ? prog.progress : 0;
          await this.db.upsertContractProgress(playerId, c.contract_id, current + dto.meters);
        } else if (c.objective.metric === 'chips') {
          const prog = await this.db.getContractProgress(playerId, c.contract_id);
          const current = prog ? prog.progress : 0;
          await this.db.upsertContractProgress(playerId, c.contract_id, current + dto.chips_collected);
        } else if (c.objective.metric === 'powerups' && (dto.powerups_collected || 0) > 0) {
          // CRIT-12: Progress powerup objectives when powerups_collected > 0
          const prog = await this.db.getContractProgress(playerId, c.contract_id);
          const current = prog ? prog.progress : 0;
          await this.db.upsertContractProgress(playerId, c.contract_id, current + dto.powerups_collected!);
        }
      }
    }

    return {
      run_id: runResult.run.run_id,
      integrity_flag: runResult.run.integrity_flag,
      rewards,
      new_district_best: newDistrictBest
    };
  }
}
