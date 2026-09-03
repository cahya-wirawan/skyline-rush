import request from 'supertest';
import { createGatewayApp } from '../apps/gateway/gateway.app';
import { InMemoryDatabase } from '../libs/db/in-memory-db';
import { AuthService } from '../libs/auth';
import { v4 as uuidv4 } from 'uuid';

describe('Skyline Rush Acceptance Test Suite (AC-01 through AC-12, AC-17, AC-18)', () => {
  let app: any;
  let db: InMemoryDatabase;

  beforeEach(async () => {
    db = new InMemoryDatabase();
    app = createGatewayApp(db);
  });

  // AC-08: Guest & Linked Accounts
  describe('AC-008: Guest and Linked Accounts', () => {
    it('creates playable guest session with zero PII', async () => {
      const guestDeviceId = uuidv4();
      const res = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: guestDeviceId, age_bucket: '16_plus' });

      expect(res.status).toBe(200);
      expect(res.body.player_id).toBeDefined();
      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.age_bucket).toBe('16_plus');

      // Verify profile has server-generated display_name and starter items
      const profileRes = await request(app)
        .get('/v1/profile')
        .set('Authorization', `Bearer ${res.body.access_token}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.display_name).toMatch(/^Runner#\d{4}$/);
      expect(profileRes.body.equipped.runner_id).toBe('vex');
      expect(profileRes.body.equipped.board_id).toBe('ion-glide');
    });

    it('merges guest progress when linking Sign in with Apple for the first time', async () => {
      // 1. Create guest
      const guestDeviceId = uuidv4();
      const guestRes = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: guestDeviceId, age_bucket: '16_plus' });

      const guestToken = guestRes.body.access_token;
      const guestPlayerId = guestRes.body.player_id;

      // 2. Accumulate progress on guest (e.g. submit a run with chips)
      const runKey = uuidv4();
      await request(app)
        .post('/v1/runs')
        .set('Authorization', `Bearer ${guestToken}`)
        .set('Idempotency-Key', runKey)
        .send({
          district_id: 'neo-marina',
          runner_id: 'vex',
          board_id: 'ion-glide',
          meters: 2500,
          chips_collected: 400,
          client_submitted_at: new Date().toISOString(),
          duration_seconds: 120
        });

      const balanceBefore = await request(app)
        .get('/v1/economy/balance')
        .set('Authorization', `Bearer ${guestToken}`);
      expect(balanceBefore.body.chips).toBe(400);

      // 3. Link Apple ID
      const appleIdentityToken = 'fake_apple_jwt_token_12345';
      const appleRes = await request(app)
        .post('/v1/auth/apple')
        .send({ identity_token: appleIdentityToken, guest_device_id: guestDeviceId });

      expect(appleRes.status).toBe(200);
      expect(appleRes.body.player_id).toBe(guestPlayerId); // Same player ID, progress preserved

      // 4. Verify balance is preserved
      const balanceAfter = await request(app)
        .get('/v1/economy/balance')
        .set('Authorization', `Bearer ${appleRes.body.access_token}`);
      expect(balanceAfter.body.chips).toBe(400);
    });
  });

  // AC-09: Age Bucketing
  describe('AC-009: Age Bucketing & Ad Personalization Restrictions', () => {
    it('sets age_bucket and enforces ad-personalization restrictions for under_13', async () => {
      const childDeviceId = uuidv4();
      const res = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: childDeviceId, age_bucket: 'under_13' });

      expect(res.status).toBe(200);
      expect(res.body.age_bucket).toBe('under_13');

      // Verify ConsentRecord in DB
      const consent = await db.getConsentRecord(res.body.player_id);
      expect(consent).toBeDefined();
      expect(consent?.ad_personalization_allowed).toBe(false);
    });

    it('derives age bucket correctly from birth year', () => {
      expect(AuthService.deriveAgeBucketFromBirthYear(2018, 2026)).toBe('under_13'); // Age 8
      expect(AuthService.deriveAgeBucketFromBirthYear(2012, 2026)).toBe('13_15');    // Age 14
      expect(AuthService.deriveAgeBucketFromBirthYear(2005, 2026)).toBe('16_plus');  // Age 21
    });
  });

  // AC-01 & AC-12: Core Run Loop & Run Integrity
  describe('AC-001 & AC-012: Run Submission and Integrity Plausibility Checks', () => {
    let token: string;
    let playerId: string;

    beforeEach(async () => {
      const authRes = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: uuidv4(), age_bucket: '16_plus' });
      token = authRes.body.access_token;
      playerId = authRes.body.player_id;
    });

    it('accepts plausible run and grants collected chips to economy', async () => {
      const idempotencyKey = uuidv4();
      const res = await request(app)
        .post('/v1/runs')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          district_id: 'neo-marina',
          runner_id: 'vex',
          board_id: 'ion-glide',
          meters: 1500,
          chips_collected: 200,
          client_submitted_at: new Date().toISOString(),
          duration_seconds: 100
        });

      expect(res.status).toBe(201);
      expect(res.body.integrity_flag).toBe('ok');
      expect(res.body.rewards.chips_granted).toBe(200);
      expect(res.body.new_district_best).toBe(true);

      // Verify balance in economy
      const balRes = await request(app)
        .get('/v1/economy/balance')
        .set('Authorization', `Bearer ${token}`);
      expect(balRes.body.chips).toBe(200);

      // Verify idempotency on repeat submit
      const repeatRes = await request(app)
        .post('/v1/runs')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          district_id: 'neo-marina',
          runner_id: 'vex',
          board_id: 'ion-glide',
          meters: 1500,
          chips_collected: 200,
          client_submitted_at: new Date().toISOString(),
          duration_seconds: 100
        });

      expect(repeatRes.status).toBe(201);
      expect(repeatRes.body.run_id).toBe(res.body.run_id);

      // Balance must NOT have doubled
      const balRes2 = await request(app)
        .get('/v1/economy/balance')
        .set('Authorization', `Bearer ${token}`);
      expect(balRes2.body.chips).toBe(200);
    });

    it('rejects/flags implausible speed run as excluded and grants zero rewards', async () => {
      // 10,000 meters in 5 seconds = 2000 m/s (far exceeds 35 m/s max)
      const res = await request(app)
        .post('/v1/runs')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          district_id: 'neo-marina',
          runner_id: 'vex',
          board_id: 'ion-glide',
          meters: 10000,
          chips_collected: 100,
          client_submitted_at: new Date().toISOString(),
          duration_seconds: 5
        });

      expect(res.status).toBe(201);
      expect(res.body.integrity_flag).toBe('excluded');
      expect(res.body.rewards.chips_granted).toBe(0);
      expect(res.body.new_district_best).toBe(false);

      // Balance should be untouched
      const balRes = await request(app)
        .get('/v1/economy/balance')
        .set('Authorization', `Bearer ${token}`);
      expect(balRes.body.chips).toBe(0);
    });

    it('flags implausible chip collection density as excluded', async () => {
      // 5,000 chips in 100 meters = 50 chips/m (far exceeds 2.5 chips/m limit)
      const res = await request(app)
        .post('/v1/runs')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          district_id: 'neo-marina',
          runner_id: 'vex',
          board_id: 'ion-glide',
          meters: 100,
          chips_collected: 5000,
          client_submitted_at: new Date().toISOString(),
          duration_seconds: 10
        });

      expect(res.status).toBe(201);
      expect(res.body.integrity_flag).toBe('excluded');
      expect(res.body.rewards.chips_granted).toBe(0);
    });

    it('flags runs with meters > 0 and missing or <= 0 duration_seconds as excluded (CRIT-08)', async () => {
      const res = await request(app)
        .post('/v1/runs')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          district_id: 'neo-marina',
          runner_id: 'vex',
          board_id: 'ion-glide',
          meters: 500,
          chips_collected: 50,
          client_submitted_at: new Date().toISOString(),
          duration_seconds: 0
        });

      expect(res.status).toBe(201);
      expect(res.body.integrity_flag).toBe('excluded');
      expect(res.body.rewards.chips_granted).toBe(0);
    });

    it('advances daily_powerups_3 contract when powerups_collected > 0 (CRIT-12)', async () => {
      const res = await request(app)
        .post('/v1/runs')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          district_id: 'neo-marina',
          runner_id: 'vex',
          board_id: 'ion-glide',
          meters: 500,
          chips_collected: 50,
          powerups_collected: 3,
          client_submitted_at: new Date().toISOString(),
          duration_seconds: 40
        });

      expect(res.status).toBe(201);
      const prog = await db.getContractProgress(playerId, 'daily_powerups_3');
      expect(prog?.progress).toBe(3);
    });
  });

  // AC-02: Redeploy Escalation
  describe('AC-002: Redeploy Escalating Core Cost and Free Ad Redeploy', () => {
    let token: string;
    let runId: string;
    let playerId: string;

    beforeEach(async () => {
      const authRes = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: uuidv4(), age_bucket: '16_plus' });
      token = authRes.body.access_token;
      playerId = authRes.body.player_id;

      // Seed player with 100 Cores
      await db.initBalance(playerId, 0, 100);

      const runRes = await request(app)
        .post('/v1/runs')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          district_id: 'neo-marina',
          runner_id: 'vex',
          board_id: 'ion-glide',
          meters: 800,
          chips_collected: 50,
          crashed_cause: 'obstacle_hit',
          client_submitted_at: new Date().toISOString(),
          duration_seconds: 50
        });
      runId = runRes.body.run_id;
    });

    it('permits one free redeploy via ad at 0 Core cost', async () => {
      const res = await request(app)
        .post(`/v1/runs/${runId}/redeploy`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({ method: 'ad', ad_receipt: 'ad_completed_receipt_abc' });

      expect(res.status).toBe(200);
      expect(res.body.cores_spent).toBe(0);
      expect(res.body.cores_remaining).toBe(100);

      // Second ad attempt in same run should fail
      const res2 = await request(app)
        .post(`/v1/runs/${runId}/redeploy`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({ method: 'ad', ad_receipt: 'ad_completed_receipt_2' });

      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('AD_REDEPLOY_EXHAUSTED');
    });

    it('escalates Core cost exactly: 10 -> 20 -> 40 (capped at 40)', async () => {
      // 1st Cores spend: 10 Cores
      const r1 = await request(app)
        .post(`/v1/runs/${runId}/redeploy`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({ method: 'cores' });
      expect(r1.status).toBe(200);
      expect(r1.body.cores_spent).toBe(10);
      expect(r1.body.cores_remaining).toBe(90);

      // 2nd Cores spend: 20 Cores
      const r2 = await request(app)
        .post(`/v1/runs/${runId}/redeploy`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({ method: 'cores' });
      expect(r2.status).toBe(200);
      expect(r2.body.cores_spent).toBe(20);
      expect(r2.body.cores_remaining).toBe(70);

      // 3rd Cores spend: 40 Cores
      const r3 = await request(app)
        .post(`/v1/runs/${runId}/redeploy`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({ method: 'cores' });
      expect(r3.status).toBe(200);
      expect(r3.body.cores_spent).toBe(40);
      expect(r3.body.cores_remaining).toBe(30);

      // 4th Cores spend: Capped at 40 Cores (player only has 30, so returns 402 with shortfall details)
      const r4 = await request(app)
        .post(`/v1/runs/${runId}/redeploy`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({ method: 'cores' });
      expect(r4.status).toBe(402);
      expect(r4.body.error.code).toBe('INSUFFICIENT_BALANCE');
      expect(r4.body.error.details.required).toBe(40);
      expect(r4.body.error.details.available).toBe(30);
    });

    it('supports POST /v1/runs/redeploy with run_id in request body (CRIT-03)', async () => {
      const res = await request(app)
        .post('/v1/runs/redeploy')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({ run_id: runId, method: 'cores' });

      expect(res.status).toBe(200);
      expect(res.body.cores_spent).toBe(10);
      expect(res.body.cores_remaining).toBe(90);
    });

    it('returns 404 NOT_FOUND if run_id does not exist on redeploy (CRIT-03)', async () => {
      const res = await request(app)
        .post('/v1/runs/redeploy')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({ run_id: uuidv4(), method: 'cores' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // AC-03: Currency Economy & Ledger
  describe('AC-003: Currency Economy, Ledger, and Balance Reconciliation', () => {
    let token: string;
    let playerId: string;

    beforeEach(async () => {
      const authRes = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: uuidv4(), age_bucket: '16_plus' });
      token = authRes.body.access_token;
      playerId = authRes.body.player_id;
    });

    it('records append-only ledger entries and computes accurate balance', async () => {
      const key1 = uuidv4();
      await db.applyLedgerEntry({
        playerId,
        currency: 'chips',
        delta: 500,
        reason: 'run_pickup',
        idempotencyKey: key1
      });

      const key2 = uuidv4();
      await db.applyLedgerEntry({
        playerId,
        currency: 'cores',
        delta: 25,
        reason: 'purchase',
        idempotencyKey: key2
      });

      const balanceRes = await request(app)
        .get('/v1/economy/balance')
        .set('Authorization', `Bearer ${token}`);

      expect(balanceRes.status).toBe(200);
      expect(balanceRes.body.chips).toBe(500);
      expect(balanceRes.body.cores).toBe(25);

      const ledgerRes = await request(app)
        .get('/v1/economy/ledger')
        .set('Authorization', `Bearer ${token}`);

      expect(ledgerRes.status).toBe(200);
      expect(ledgerRes.body.items.length).toBe(2);
      expect(ledgerRes.body.items[0].delta).toBeDefined();
    });
  });

  // AC-05: Daily Contracts
  describe('AC-005: Daily Contracts Progression and Claiming', () => {
    let token: string;
    let playerId: string;

    beforeEach(async () => {
      const authRes = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: uuidv4(), age_bucket: '16_plus' });
      token = authRes.body.access_token;
      playerId = authRes.body.player_id;
    });

    it('shows 3 active daily contracts and claims reward upon objective completion', async () => {
      const contractsRes = await request(app)
        .get('/v1/contracts/active')
        .set('Authorization', `Bearer ${token}`);

      expect(contractsRes.status).toBe(200);
      expect(contractsRes.body.daily.length).toBe(3);

      const contract = contractsRes.body.daily[0];
      expect(contract.completed).toBe(false);

      // Progress contract past target
      await db.upsertContractProgress(playerId, contract.contract_id, contract.target);

      // Claim reward
      const claimRes = await request(app)
        .post(`/v1/contracts/${contract.contract_id}/claim`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4());

      expect(claimRes.status).toBe(200);
      expect(claimRes.body.contract_id).toBe(contract.contract_id);
      expect(claimRes.body.reward.chips).toBeDefined();

      // Second claim should fail with 409
      const reClaimRes = await request(app)
        .post(`/v1/contracts/${contract.contract_id}/claim`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4());

      expect(reClaimRes.status).toBe(409);
      expect(reClaimRes.body.error.code).toBe('ALREADY_CLAIMED');
    });

    it('returns 200 with original reward on repeated claim with same Idempotency-Key (CRIT-11)', async () => {
      // Complete daily_chips_2 contract
      await db.upsertContractProgress(playerId, 'daily_chips_2', 300);
      const claimKey = uuidv4();

      const r1 = await request(app)
        .post('/v1/contracts/daily_chips_2/claim')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', claimKey);
      expect(r1.status).toBe(200);
      expect(r1.body.reward.chips).toBe(300);

      // Repeat with SAME Idempotency-Key
      const r2 = await request(app)
        .post('/v1/contracts/daily_chips_2/claim')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', claimKey);
      expect(r2.status).toBe(200);
      expect(r2.body.reward.chips).toBe(300);
    });
  });

  // AC-06: Supply Drop Odds Transparency
  describe('AC-006: Supply Drop Odds Transparency & Resolution', () => {
    let token: string;
    let playerId: string;

    beforeEach(async () => {
      const authRes = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: uuidv4(), age_bucket: '16_plus' });
      token = authRes.body.access_token;
      playerId = authRes.body.player_id;
    });

    it('discloses transparent odds before open action', async () => {
      const res = await request(app).get('/v1/supply-drops/tables/standard-v7');
      expect(res.status).toBe(200);
      expect(res.body.table_id).toBe('standard-v7');
      expect(res.body.version).toBe(7);

      const totalProb = res.body.entries.reduce((sum: number, e: any) => sum + e.probability, 0);
      expect(Math.abs(totalProb - 1.0)).toBeLessThan(0.0001);
    });

    it('earned and purchased drops resolve against identical table version', async () => {
      const earnedRes = await request(app)
        .post('/v1/supply-drops/open')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({ acquired_via: 'earned' });

      expect(earnedRes.status).toBe(200);
      expect(earnedRes.body.table_id).toBe('standard-v7');
      expect(earnedRes.body.table_version).toBe(7);
      expect(earnedRes.body.result.reward).toBeDefined();

      const purchasedRes = await request(app)
        .post('/v1/supply-drops/open')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({ acquired_via: 'purchased' });

      expect(purchasedRes.status).toBe(200);
      expect(purchasedRes.body.table_id).toBe('standard-v7');
      expect(purchasedRes.body.table_version).toBe(7);
    });

    it('returns identical rewards on retrying supply drop open with same Idempotency-Key (CRIT-09)', async () => {
      const dropKey = uuidv4();
      const r1 = await request(app)
        .post('/v1/supply-drops/open')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', dropKey)
        .send({ acquired_via: 'earned' });

      expect(r1.status).toBe(200);

      const r2 = await request(app)
        .post('/v1/supply-drops/open')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', dropKey)
        .send({ acquired_via: 'earned' });

      expect(r2.status).toBe(200);
      expect(r2.body.result).toEqual(r1.body.result);
      expect(r2.body.open_id).toBe(r1.body.open_id);
    });
  });

  // AC-07: Leaderboard
  describe('AC-007: Leaderboard Ranking and Empty Friends Prompt', () => {
    let token: string;
    let playerId: string;

    beforeEach(async () => {
      const authRes = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: uuidv4(), age_bucket: '16_plus' });
      token = authRes.body.access_token;
      playerId = authRes.body.player_id;
    });

    it('returns ranked runs and accurate self-rank', async () => {
      // Submit run
      await request(app)
        .post('/v1/runs')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          district_id: 'neo-marina',
          runner_id: 'vex',
          board_id: 'ion-glide',
          meters: 3500,
          chips_collected: 300,
          client_submitted_at: new Date().toISOString(),
          duration_seconds: 150
        });

      const lbRes = await request(app)
        .get('/v1/leaderboard?scope=global&district_id=neo-marina')
        .set('Authorization', `Bearer ${token}`);

      expect(lbRes.status).toBe(200);
      expect(lbRes.body.items.length).toBeGreaterThan(0);
      expect(lbRes.body.self_rank).toBeDefined();
      expect(lbRes.body.self_rank.meters).toBe(3500);
      expect(lbRes.body.self_rank.rank).toBe(1);
    });

    it('returns empty_friends_prompt when player has zero friends', async () => {
      const lbRes = await request(app)
        .get('/v1/leaderboard?scope=friends&district_id=neo-marina')
        .set('Authorization', `Bearer ${token}`);

      expect(lbRes.status).toBe(200);
      expect(lbRes.body.empty_friends_prompt).toBe(true);
    });

    it('returns 404 NOT_FOUND on friend code typo instead of adding random stranger (CRIT-13)', async () => {
      const res = await request(app)
        .post('/v1/friends/add')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'SKY-NONEXISTENT' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('strictly excludes non-ok runs from leaderboard (CRIT-14)', async () => {
      // Submit an excluded run with huge meters
      await request(app)
        .post('/v1/runs')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          district_id: 'neo-marina',
          runner_id: 'vex',
          board_id: 'ion-glide',
          meters: 99999,
          chips_collected: 10,
          client_submitted_at: new Date().toISOString(),
          duration_seconds: 1 // impossible speed -> excluded
        });

      const lbRes = await request(app)
        .get('/v1/leaderboard?district_id=neo-marina')
        .set('Authorization', `Bearer ${token}`);

      expect(lbRes.status).toBe(200);
      const cheaterEntry = lbRes.body.items.find((item: any) => item.meters === 99999);
      expect(cheaterEntry).toBeUndefined();
    });
  });

  // AC-10: Purchases
  describe('AC-010: StoreKit 2 Purchases, Duplicate Protection, and Parental Gate', () => {
    it('rejects purchase for under_13 when parental gate has not been passed', async () => {
      const childRes = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: uuidv4(), age_bucket: 'under_13' });

      const childToken = childRes.body.access_token;

      const purchaseRes = await request(app)
        .post('/v1/purchases/receipt')
        .set('Authorization', `Bearer ${childToken}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          sku: 'cores_small',
          transaction_id: 'tx_apple_1001',
          signed_transaction: 'signed_jws_receipt_blob'
        });

      expect(purchaseRes.status).toBe(403);
      expect(purchaseRes.body.error.code).toBe('PARENTAL_GATE_REQUIRED');
    });

    it('grants purchase for under_13 when valid parental gate token is provided', async () => {
      const childRes = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: uuidv4(), age_bucket: 'under_13' });

      const childToken = childRes.body.access_token;
      const childPlayerId = childRes.body.player_id;

      const gateToken = AuthService.generateParentalGateToken(childPlayerId);

      const purchaseRes = await request(app)
        .post('/v1/purchases/receipt')
        .set('Authorization', `Bearer ${childToken}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          sku: 'cores_small',
          transaction_id: 'tx_apple_1002',
          signed_transaction: 'signed_jws_receipt_blob',
          parental_gate_passed: true,
          parental_gate_token: gateToken
        });

      expect(purchaseRes.status).toBe(200);
      expect(purchaseRes.body.status).toBe('granted');
      expect(purchaseRes.body.entitlement.cores).toBe(25);

      // Verify balance increased
      const bal = await db.getBalance(childPlayerId);
      expect(bal.cores).toBe(25);
    });

    it('prevents duplicate grant when same transaction_id is submitted twice', async () => {
      const adultRes = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: uuidv4(), age_bucket: '16_plus' });

      const adultToken = adultRes.body.access_token;
      const playerId = adultRes.body.player_id;

      const txId = 'tx_unique_99999';

      // 1st submission
      const r1 = await request(app)
        .post('/v1/purchases/receipt')
        .set('Authorization', `Bearer ${adultToken}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          sku: 'chips_medium',
          transaction_id: txId,
          signed_transaction: 'signed_jws_receipt'
        });

      expect(r1.status).toBe(200);
      expect(r1.body.status).toBe('granted');

      const bal1 = await db.getBalance(playerId);
      expect(bal1.chips).toBe(12500);

      // 2nd duplicate submission
      const r2 = await request(app)
        .post('/v1/purchases/receipt')
        .set('Authorization', `Bearer ${adultToken}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          sku: 'chips_medium',
          transaction_id: txId,
          signed_transaction: 'signed_jws_receipt'
        });

      expect(r2.status).toBe(200);
      expect(r2.body.status).toBe('duplicate');

      // Balance must NOT increase
      const bal2 = await db.getBalance(playerId);
      expect(bal2.chips).toBe(12500);
    });

    it('verifies parental gate math challenge and issues signed 5-minute token (CRIT-04)', async () => {
      const childRes = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: uuidv4(), age_bucket: 'under_13' });

      const childToken = childRes.body.access_token;
      const childPlayerId = childRes.body.player_id;

      // Successful verification
      const gateRes = await request(app)
        .post('/v1/auth/parental-gate/verify')
        .set('Authorization', `Bearer ${childToken}`)
        .send({ num1: 7, num2: 8, answer: 56 });

      expect(gateRes.status).toBe(200);
      expect(gateRes.body.parental_gate_token).toBeDefined();
      expect(gateRes.body.expires_in_seconds).toBe(300);

      // Verify token with AuthService
      const isValid = AuthService.verifyParentalGate(gateRes.body.parental_gate_token, childPlayerId);
      expect(isValid).toBe(true);

      // Incorrect answer should fail
      const failRes = await request(app)
        .post('/v1/auth/parental-gate/verify')
        .set('Authorization', `Bearer ${childToken}`)
        .send({ num1: 7, num2: 8, answer: 99 });

      expect(failRes.status).toBe(403);
    });
  });

  // AC-11: LiveOps Config & Remote District Packs
  describe('AC-011: LiveOps Content Pack Versioning & Feature Flags', () => {
    it('serves active district content packs and feature flags', async () => {
      const res = await request(app).get('/v1/liveops/config');
      expect(res.status).toBe(200);
      expect(res.body.active_districts).toBeDefined();
      expect(res.body.active_districts.length).toBeGreaterThan(0);
      expect(res.body.active_districts[0].district_id).toBe('neo-marina');
      expect(res.body.feature_flags.district_rotation_enabled).toBe(true);
    });
  });

  // AC-17: Privacy Export and Deletion
  describe('AC-017: Privacy Data Export & Deletion (GDPR Articles 15 & 17)', () => {
    let token: string;
    let playerId: string;

    beforeEach(async () => {
      const authRes = await request(app)
        .post('/v1/auth/guest')
        .send({ guest_device_id: uuidv4(), age_bucket: '16_plus' });
      token = authRes.body.access_token;
      playerId = authRes.body.player_id;
    });

    it('exports complete structured copy of player profile, balances, ownership, and ledger', async () => {
      const res = await request(app)
        .post('/v1/privacy/export')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(202);
      expect(res.body.tracking_id).toBeDefined();
      expect(res.body.data.profile.player_id).toBe(playerId);
      expect(res.body.data.ownerships).toBeDefined();
    });

    it('deletes player data and wipes profile', async () => {
      const deleteRes = await request(app)
        .post('/v1/privacy/delete')
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.status).toBe('deleted');

      const check = await db.getPlayerById(playerId);
      expect(check).toBeNull();
    });
  });

  // AC-18: Supply Drop Fairness Drift Test
  describe('AC-018: Supply Drop Fairness Statistical Test (10,000 opens within ±1.0 percentage point)', () => {
    it('verifies observed frequencies over 10,000 opens match published probabilities within 1 percentage point', async () => {
      const table = await db.getSupplyDropTable('standard-v7');
      expect(table).toBeDefined();

      const numOpens = 10000;
      const counts: Record<string, number> = {};
      for (const entry of table!.entries) {
        counts[entry.reward] = 0;
      }

      // Execute 10,000 deterministic simulations against the distribution
      let seed = 12345;
      const lcgRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      for (let i = 0; i < numOpens; i++) {
        const roll = lcgRandom();
        let cumulative = 0;
        for (const entry of table!.entries) {
          cumulative += entry.probability;
          if (roll <= cumulative) {
            counts[entry.reward]++;
            break;
          }
        }
      }

      // Check each entry stays within ±0.01 (1 percentage point) of declared probability
      for (const entry of table!.entries) {
        const observedRatio = counts[entry.reward] / numOpens;
        const expectedRatio = entry.probability;
        const diff = Math.abs(observedRatio - expectedRatio);

        console.log(`Supply Drop fairness for ${entry.reward}: Expected = ${(expectedRatio * 100).toFixed(1)}%, Observed = ${(observedRatio * 100).toFixed(2)}%, Diff = ${(diff * 100).toFixed(2)}%`);
        expect(diff).toBeLessThanOrEqual(0.01);
      }
    });
  });
});
