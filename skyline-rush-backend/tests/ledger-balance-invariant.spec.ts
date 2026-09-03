/**
 * RC-02 — Ledger/materialized-balance invariant coverage.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * CLAUDE.md §1 requires that every balance mutation append a `ledger_entry` row
 * AND move the materialized `economy_balance` row, so that
 * `SUM(ledger_entry.delta) === economy_balance` holds for every player at all
 * times. `EconomyService.reconcileBalance()` enforces this at read time and
 * increments `skyline_balance_reconciliation_errors_total` (a `page: "true"`
 * alert) whenever it does not hold.
 *
 * `PostgresDatabase.unlockItemAtomic` violated that invariant: it wrote the
 * ledger row but never updated `economy_balance`. The bug survived four review
 * stages because `tests/acceptance.spec.ts` instantiates only
 * `InMemoryDatabase` — the Postgres SQL was never executed by anything.
 *
 * WHY THERE IS NO LIVE-POSTGRES TEST HERE
 * ---------------------------------------
 * This environment has no reachable PostgreSQL server: neither `DATABASE_URL`
 * nor `POSTGRES_URL` is set, `docker-compose.prod.yml` defines no test service
 * that CI starts, and adding a container/driver harness would mean a new
 * dev-dependency. So the coverage is layered:
 *
 *   1. `describe('invariant — every IDatabase implementation')` runs the
 *      implementation-agnostic assertion (ledger sum === materialized balance
 *      after a real unlock) against every implementation that can run without a
 *      server. This is the assertion that generalises: any future
 *      implementation added to the loop is checked for free.
 *   2. `describe('PostgresDatabase.unlockItemAtomic SQL path')` executes the
 *      REAL `PostgresDatabase` methods with `pool` replaced by a minimal
 *      in-memory SQL fake (below). The production SQL strings, their ordering,
 *      and their transaction boundaries are the code under test — only the
 *      wire protocol is faked. This is what actually catches RC-01: the fake
 *      applies `UPDATE economy_balance` and `INSERT INTO ledger_entry`
 *      independently, so an implementation that emits one without the other
 *      fails the invariant assertion exactly as a real server would.
 *   3. If `DATABASE_URL`/`POSTGRES_URL` IS set (e.g. in a CI job that does
 *      provision Postgres), the final block additionally runs the same
 *      invariant end-to-end against a live `PostgresDatabase`. It is skipped,
 *      not silently passed, when the variable is absent.
 *
 * What the fake does NOT cover, stated plainly: real `FOR UPDATE` lock
 * contention between concurrent connections, real `ON CONFLICT` constraint
 * behaviour, and real rollback semantics. Those need a live server (layer 3).
 */

import { v4 as uuidv4 } from 'uuid';
import { InMemoryDatabase } from '../libs/db/in-memory-db';
import { PostgresDatabase } from '../libs/db/postgres-db';
import { IDatabase } from '../libs/db/database.interface';

// ---------------------------------------------------------------------------
// Minimal in-memory SQL fake for the statements PostgresDatabase actually issues
// on the unlock path. Deliberately dumb: it pattern-matches the production SQL
// and mutates plain objects. It has no notion of "balance" beyond what the SQL
// tells it to write, which is the point — it cannot paper over a missing UPDATE.
// ---------------------------------------------------------------------------
interface FakeRow { [k: string]: any }

class FakePg {
  balances = new Map<string, FakeRow>();
  ledger: FakeRow[] = [];
  ownership: FakeRow[] = [];
  players = new Set<string>();
  log: string[] = [];
  inTransaction = false;
  committed = 0;
  rolledBack = 0;

  private norm(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  async query(sql: string, params: any[] = []): Promise<{ rows: FakeRow[] }> {
    const q = this.norm(sql);
    this.log.push(q);

    if (q === 'BEGIN') {
      this.inTransaction = true;
      return { rows: [] };
    }
    if (q === 'COMMIT') {
      this.inTransaction = false;
      this.committed++;
      return { rows: [] };
    }
    if (q === 'ROLLBACK') {
      this.inTransaction = false;
      this.rolledBack++;
      return { rows: [] };
    }

    // --- player row lock -----------------------------------------------------
    if (/^SELECT player_id FROM player WHERE player_id = \$1 FOR UPDATE$/.test(q)) {
      return { rows: this.players.has(params[0]) ? [{ player_id: params[0] }] : [] };
    }

    // --- ownership -----------------------------------------------------------
    if (/^SELECT 1 FROM ownership WHERE player_id = \$1 AND item_type = \$2 AND item_id = \$3$/.test(q)) {
      const hit = this.ownership.find(
        o => o.player_id === params[0] && o.item_type === params[1] && o.item_id === params[2]
      );
      return { rows: hit ? [{ '?column?': 1 }] : [] };
    }
    if (/^INSERT INTO ownership /.test(q)) {
      const [player_id, item_type, item_id] = params;
      const exists = this.ownership.find(
        o => o.player_id === player_id && o.item_type === item_type && o.item_id === item_id
      );
      if (!exists) {
        this.ownership.push({
          player_id,
          item_type,
          item_id,
          equipped: false,
          acquired_via: 'currency',
          acquired_at: new Date()
        });
      }
      return { rows: [] };
    }
    if (/^SELECT \* FROM ownership WHERE player_id = \$1$/.test(q)) {
      return { rows: this.ownership.filter(o => o.player_id === params[0]) };
    }

    // --- ledger --------------------------------------------------------------
    if (/^SELECT \* FROM ledger_entry WHERE player_id = \$1 AND idempotency_key = \$2$/.test(q)) {
      return {
        rows: this.ledger.filter(e => e.player_id === params[0] && e.idempotency_key === params[1])
      };
    }
    if (/^INSERT INTO ledger_entry /.test(q)) {
      const [entry_id, player_id, currency, delta, reason, idempotency_key] = params;
      const row: FakeRow = {
        entry_id,
        player_id,
        currency,
        delta,
        reason,
        idempotency_key,
        created_at: new Date()
      };
      this.ledger.push(row);
      return { rows: [row] };
    }
    if (/^SELECT currency, COALESCE\(SUM\(delta\), 0\) AS total FROM ledger_entry WHERE player_id = \$1 GROUP BY currency$/i.test(q)) {
      const byCurrency = new Map<string, number>();
      for (const e of this.ledger) {
        if (e.player_id !== params[0]) continue;
        byCurrency.set(e.currency, (byCurrency.get(e.currency) || 0) + Number(e.delta));
      }
      return { rows: Array.from(byCurrency.entries()).map(([currency, total]) => ({ currency, total })) };
    }

    // --- economy_balance -----------------------------------------------------
    if (/^SELECT \* FROM economy_balance WHERE player_id = \$1( FOR UPDATE)?$/.test(q)) {
      const row = this.balances.get(params[0]);
      return { rows: row ? [row] : [] };
    }
    if (/^INSERT INTO economy_balance \(player_id, chips, cores, updated_at\) VALUES \(\$1, 0, 0, NOW\(\)\) RETURNING \*$/.test(q)) {
      const row = { player_id: params[0], chips: 0, cores: 0, updated_at: new Date() };
      this.balances.set(params[0], row);
      return { rows: [row] };
    }
    if (/^INSERT INTO economy_balance /.test(q)) {
      // initBalance upsert
      const row = { player_id: params[0], chips: params[1], cores: params[2], updated_at: new Date() };
      this.balances.set(params[0], row);
      return { rows: [row] };
    }
    if (/^UPDATE economy_balance SET chips = \$1, cores = \$2, updated_at = NOW\(\) WHERE player_id = \$3 RETURNING \*$/.test(q)) {
      const row = { player_id: params[2], chips: params[0], cores: params[1], updated_at: new Date() };
      this.balances.set(params[2], row);
      return { rows: [row] };
    }

    throw new Error(`FakePg: unhandled SQL: ${q}`);
  }

  async connect(): Promise<any> {
    return {
      query: (sql: string, params?: any[]) => this.query(sql, params),
      release: () => undefined
    };
  }
}

function makePostgresDbOnFake(fake: FakePg): PostgresDatabase {
  const db = new PostgresDatabase('postgresql://unused:unused@127.0.0.1:1/unused');
  // The real Pool is never connected to; swap it before any query is issued.
  (db as any).pool = fake;
  return db;
}

// ---------------------------------------------------------------------------

/** SUM(ledger_entry.delta) per currency must equal the materialized balance. */
async function assertLedgerMatchesBalance(db: IDatabase, playerId: string, label: string) {
  const balance = await db.getBalance(playerId);
  const sums = await (db as any).getLedgerSums(playerId);
  expect({ where: label, chips: sums.chips, cores: sums.cores }).toEqual({
    where: label,
    chips: balance.chips,
    cores: balance.cores
  });
}

describe('RC-02: ledger / materialized-balance invariant', () => {
  const UNLOCK_COST = 75;

  describe('invariant — every IDatabase implementation reachable without a server', () => {
    const implementations: Array<{ name: string; make: () => Promise<IDatabase> }> = [
      {
        name: 'InMemoryDatabase',
        make: async () => new InMemoryDatabase()
      },
      {
        name: 'PostgresDatabase (real SQL, faked wire)',
        make: async () => {
          const fake = new FakePg();
          const db = makePostgresDbOnFake(fake);
          // Seed the player row the FOR UPDATE lock targets.
          (db as any).__fake = fake;
          return db;
        }
      }
    ];

    for (const impl of implementations) {
      it(`${impl.name}: ledger sum equals economy_balance after a roster unlock`, async () => {
        const db = await impl.make();
        const playerId = uuidv4();
        const fake: FakePg | undefined = (db as any).__fake;
        if (fake) fake.players.add(playerId);

        // Fund via the sanctioned path so the ledger and the balance start in step.
        await db.applyLedgerEntry({
          playerId,
          currency: 'cores',
          delta: 200,
          reason: 'grant',
          idempotencyKey: uuidv4()
        });
        await assertLedgerMatchesBalance(db, playerId, `${impl.name} after funding`);

        const before = await db.getBalance(playerId);
        expect(before.cores).toBe(200);

        const result = await db.unlockItemAtomic(playerId, 'runner', 'nyx', UNLOCK_COST, uuidv4());
        expect(result.ok).toBe(true);

        // RC-01 regression: the returned balance must be the POST-spend value,
        // not a stale read of an un-decremented materialized row.
        expect(result.balance.cores).toBe(200 - UNLOCK_COST);

        const after = await db.getBalance(playerId);
        expect(after.cores).toBe(200 - UNLOCK_COST);

        // The invariant EconomyService.reconcileBalance() pages on.
        await assertLedgerMatchesBalance(db, playerId, `${impl.name} after unlock`);

        const owned = await db.getOwnerships(playerId);
        expect(owned.some(o => o.item_type === 'runner' && o.item_id === 'nyx')).toBe(true);
      });
    }
  });

  describe('PostgresDatabase.unlockItemAtomic SQL path', () => {
    let fake: FakePg;
    let db: PostgresDatabase;
    let playerId: string;

    beforeEach(async () => {
      fake = new FakePg();
      db = makePostgresDbOnFake(fake);
      playerId = uuidv4();
      fake.players.add(playerId);
      await db.applyLedgerEntry({
        playerId,
        currency: 'cores',
        delta: 200,
        reason: 'grant',
        idempotencyKey: uuidv4()
      });
      // Reset the recorders so each test observes only its own statements.
      fake.log.length = 0;
      fake.committed = 0;
      fake.rolledBack = 0;
    });

    it('writes the ledger row AND the economy_balance row inside one transaction (RC-01)', async () => {
      await db.unlockItemAtomic(playerId, 'runner', 'nyx', UNLOCK_COST, uuidv4());

      const begin = fake.log.findIndex(q => q === 'BEGIN');
      const commit = fake.log.findIndex(q => q === 'COMMIT');
      const ledgerInsert = fake.log.findIndex(q => q.startsWith('INSERT INTO ledger_entry'));
      const balanceUpdate = fake.log.findIndex(q => q.startsWith('UPDATE economy_balance SET'));
      const ownershipInsert = fake.log.findIndex(q => q.startsWith('INSERT INTO ownership'));
      const rowLock = fake.log.findIndex(q => q === 'SELECT player_id FROM player WHERE player_id = $1 FOR UPDATE');

      // The bug was a missing UPDATE, so assert it is emitted at all...
      expect(balanceUpdate).toBeGreaterThan(-1);
      expect(ledgerInsert).toBeGreaterThan(-1);
      // ...and that every write, plus the FOR UPDATE lock, sits between the
      // same BEGIN and COMMIT, so a failure rolls all of them back together.
      expect(begin).toBe(0);
      expect(commit).toBeGreaterThan(-1);
      for (const idx of [rowLock, ledgerInsert, balanceUpdate, ownershipInsert]) {
        expect(idx).toBeGreaterThan(begin);
        expect(idx).toBeLessThan(commit);
      }
      expect(fake.committed).toBe(1);
      expect(fake.rolledBack).toBe(0);

      // The row lock must be taken before either write, not after.
      expect(rowLock).toBeLessThan(ledgerInsert);
      expect(rowLock).toBeLessThan(balanceUpdate);
    });

    it('rejects an unaffordable unlock without writing a ledger row or moving the balance', async () => {
      await expect(
        db.unlockItemAtomic(playerId, 'runner', 'nyx', 5000, uuidv4())
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });

      expect(fake.rolledBack).toBe(1);
      const cores = fake.ledger.filter(e => e.currency === 'cores');
      expect(cores).toHaveLength(1); // only the original funding grant
      expect((await db.getBalance(playerId)).cores).toBe(200);
      await assertLedgerMatchesBalance(db, playerId, 'after rejected unlock');
      expect((await db.getOwnerships(playerId)).length).toBe(0);
    });

    it('does not double-charge when the same Idempotency-Key is replayed', async () => {
      const key = uuidv4();
      await db.unlockItemAtomic(playerId, 'runner', 'nyx', UNLOCK_COST, key);
      // Simulate a retry that arrives before the ownership row is visible, so
      // the ledger's idempotency key is the only thing standing between the
      // player and a second charge.
      fake.ownership.length = 0;
      const replay = await db.unlockItemAtomic(playerId, 'runner', 'nyx', UNLOCK_COST, key);

      expect(replay.balance.cores).toBe(200 - UNLOCK_COST);
      expect(fake.ledger.filter(e => e.idempotency_key === key)).toHaveLength(1);
      await assertLedgerMatchesBalance(db, playerId, 'after idempotent replay');
    });

    it('already-owned unlock is a no-op that neither charges nor diverges', async () => {
      await db.unlockItemAtomic(playerId, 'runner', 'nyx', UNLOCK_COST, uuidv4());
      const second = await db.unlockItemAtomic(playerId, 'runner', 'nyx', UNLOCK_COST, uuidv4());

      expect(second.ok).toBe(true);
      expect(second.balance.cores).toBe(200 - UNLOCK_COST);
      expect(fake.ledger.filter(e => e.reason === 'unlock_spend')).toHaveLength(1);
      await assertLedgerMatchesBalance(db, playerId, 'after already-owned unlock');
    });
  });

  // Layer 3: only runs where a real server is provisioned. Skipped (visibly),
  // never silently passed, when it is not.
  const liveUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const describeLive = liveUrl ? describe : describe.skip;
  describeLive('live PostgreSQL (requires DATABASE_URL or POSTGRES_URL)', () => {
    let db: PostgresDatabase;

    beforeAll(() => {
      db = new PostgresDatabase(liveUrl);
    });

    afterAll(async () => {
      await db.pool.end();
    });

    it('ledger sum equals economy_balance after a real roster unlock', async () => {
      const player = await db.createPlayer({
        guest_device_id: uuidv4(),
        display_name: 'RC02 Invariant Probe',
        age_bucket: '16_plus'
      } as any);
      await db.applyLedgerEntry({
        playerId: player.player_id,
        currency: 'cores',
        delta: 200,
        reason: 'grant',
        idempotencyKey: uuidv4()
      });

      const result = await db.unlockItemAtomic(player.player_id, 'runner', 'nyx', UNLOCK_COST, uuidv4());
      expect(result.balance.cores).toBe(200 - UNLOCK_COST);
      await assertLedgerMatchesBalance(db, player.player_id, 'live postgres after unlock');

      await db.deletePlayer(player.player_id);
    });
  });
});
