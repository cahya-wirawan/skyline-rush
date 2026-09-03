import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '@libs/auth';
import { ProfileAuthService } from '../profile-auth/profile-auth.service';
import { EconomyService } from '../economy/economy.service';
import { RunIntegrityService } from '../run-integrity/run-integrity.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { LiveOpsService } from '../liveops/liveops.service';
import { BillingService } from '../billing/billing.service';
import { PrivacyService } from '../privacy/privacy.service';
import { IDatabase, getDatabase } from '@libs/db';
import { renderCounters } from '@libs/metrics';

export interface AuthenticatedRequest extends Request {
  user?: {
    player_id: string;
    age_bucket: string;
  };
}

export function createGatewayApp(dbInstance?: IDatabase): express.Express {
  const app = express();
  // CRIT-16: Enable trust proxy for reverse proxy deployments
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cors());

  // CRIT-B3: Optional Redis client when REDIS_URL is provided
  let redisClient: Redis | null = null;
  if (process.env.REDIS_URL && process.env.NODE_ENV !== 'test') {
    try {
      redisClient = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1
      });
      redisClient.connect().catch(err => {
        console.warn('Redis connection failed:', err.message);
      });
    } catch (e: any) {
      console.warn('Redis init error:', e.message);
    }
  }

  // Metrics collection state
  let skylineActiveRunsTotal = 0;
  let skylineRedeployConversionsTotal = 0;
  let skylineFraudDroppedRunsTotal = 0;
  const httpRequestsTotal = new Map<string, number>();
  const requestDurations: number[] = [];

  // Structured JSON logging & metrics middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      requestDurations.push(duration);
      if (requestDurations.length > 1000) requestDurations.shift();

      // RED-210: Guard against metric cardinality explosion by using "unmatched" for unrouted paths
      const routePath = req.route?.path ? req.route.path : 'unmatched';
      const routeKey = `${req.method}_${routePath}_${res.statusCode}`;
      httpRequestsTotal.set(routeKey, (httpRequestsTotal.get(routeKey) || 0) + 1);

      if (process.env.NODE_ENV !== 'test') {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          method: req.method,
          path: req.originalUrl || req.url,
          status: res.statusCode,
          duration_ms: duration,
          client_ip: req.ip
        }));
      }
    });
    next();
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'skyline-rush-gateway', timestamp: new Date().toISOString() });
  });

  app.get('/health/live', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), service: 'skyline-rush-gateway' });
  });

  // CRIT-B2, RED-211: Execute database query and cache readiness result for 2 seconds
  let lastReadinessCheck: { status: number; body: any; timestamp: number } | null = null;
  app.get('/health/ready', async (req, res) => {
    const now = Date.now();
    if (lastReadinessCheck && (now - lastReadinessCheck.timestamp < 2000)) {
      return res.status(lastReadinessCheck.status).json(lastReadinessCheck.body);
    }

    try {
      const table = await db.getSupplyDropTable('standard-v7');
      if (!table) {
        const body = { status: 'not_ready', checks: { database: 'down', cache: 'down' } };
        lastReadinessCheck = { status: 503, body, timestamp: now };
        return res.status(503).json(body);
      }

      let cacheStatus = 'up';
      if (redisClient) {
        try {
          await redisClient.ping();
        } catch {
          cacheStatus = 'down';
        }
      }

      const body = {
        status: cacheStatus === 'up' ? 'ready' : 'degraded',
        checks: { database: 'up', cache: cacheStatus },
        uptime: process.uptime()
      };
      lastReadinessCheck = { status: 200, body, timestamp: now };
      res.status(200).json(body);
    } catch (err: any) {
      const body = { status: 'not_ready', error: err.message, checks: { database: 'down', cache: 'down' } };
      lastReadinessCheck = { status: 503, body, timestamp: now };
      res.status(503).json(body);
    }
  });

  app.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    let body = '# HELP http_requests_total Total number of HTTP requests\n# TYPE http_requests_total counter\n';
    for (const [key, count] of httpRequestsTotal.entries()) {
      const parts = key.split('_');
      const method = parts[0];
      const status = parts[parts.length - 1];
      const path = parts.slice(1, -1).join('_');
      body += `http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}\n`;
    }
    const avgDuration = requestDurations.length > 0 ? (requestDurations.reduce((a, b) => a + b, 0) / requestDurations.length / 1000) : 0;
    body += `\n# HELP http_request_duration_seconds Average HTTP request duration in seconds\n# TYPE http_request_duration_seconds gauge\nhttp_request_duration_seconds ${avgDuration.toFixed(4)}\n`;
    body += `\n# HELP skyline_active_runs_total Total active runs submitted\n# TYPE skyline_active_runs_total counter\nskyline_active_runs_total ${skylineActiveRunsTotal}\n`;
    body += `\n# HELP skyline_redeploy_conversions_total Total redeploy actions executed\n# TYPE skyline_redeploy_conversions_total counter\nskyline_redeploy_conversions_total ${skylineRedeployConversionsTotal}\n`;
    body += `\n# HELP skyline_fraud_dropped_runs_total Total runs dropped or excluded by anti-cheat\n# TYPE skyline_fraud_dropped_runs_total counter\nskyline_fraud_dropped_runs_total ${skylineFraudDroppedRunsTotal}\n`;

    // AC-P3-8: counters incremented from EconomyService / BillingService via the
    // shared in-process registry in @libs/metrics.
    //
    // Deliberately NOT exposed here: an outbox-flush success-rate metric. The
    // outbox is a purely client-side construct (see the client's Outbox / dead
    // letter handling and 10_OFFLINE_SYNC_AND_STORAGE.md) — the server cannot
    // observe a flush that never left the device, so a server-side gauge would
    // be fabricated. The nearest honest server-side signal is
    // skyline_idempotent_replay_total, which counts requests replayed under an
    // already-seen Idempotency-Key: that is what a client outbox retry looks
    // like when it does arrive. Real outbox-flush success rate has to come from
    // aggregated client telemetry, which this prototype does not ingest.
    body += renderCounters();

    res.send(body);
  });

  const webDir = path.resolve(__dirname, '../../../skyline-rush-client/web');
  app.use(express.static(webDir));

  const db = dbInstance || getDatabase();
  const profileService = new ProfileAuthService(db);
  const economyService = new EconomyService(db);
  const runService = new RunIntegrityService(db);
  const leaderboardService = new LeaderboardService(db);
  const liveOpsService = new LiveOpsService(db);
  const billingService = new BillingService(db);
  const privacyService = new PrivacyService(db);

  // Rate limiting tracker: Map<key, timestamps[]>
  const rateLimitMap = new Map<string, number[]>();

  // CRIT-16: Periodic rate limit memory cleanup
  const rateLimitCleanupInterval = setInterval(() => {
    const cutoff = Date.now() - 60000;
    for (const [key, timestamps] of rateLimitMap.entries()) {
      const valid = timestamps.filter(t => t > cutoff);
      if (valid.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, valid);
      }
    }
  }, 60000);
  rateLimitCleanupInterval.unref();

  const rateLimiter = (limitPerMin: number, keyPrefix: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const id = req.user?.player_id || req.ip || 'anon';
      const key = `${keyPrefix}:${id}`;
      const now = Date.now();
      const windowStart = now - 60000;

      let timestamps = rateLimitMap.get(key) || [];
      timestamps = timestamps.filter(t => t > windowStart);

      if (timestamps.length >= limitPerMin) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.'
          }
        });
      }

      timestamps.push(now);
      rateLimitMap.set(key, timestamps);
      next();
    };
  };

  // Auth Middleware
  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid Authorization header'
        }
      });
    }

    const token = authHeader.substring(7);
    try {
      const payload = AuthService.verifyAccessToken(token);
      req.user = {
        player_id: payload.sub,
        age_bucket: payload.age_bucket
      };
      next();
    } catch (err: any) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: err.message || 'Invalid token'
        }
      });
    }
  };

  // Idempotency Middleware
  const requireIdempotencyKey = (req: Request, res: Response, next: NextFunction) => {
    const key = req.header('Idempotency-Key');
    if (!key) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required Idempotency-Key header'
        }
      });
    }
    next();
  };

  // --- Auth Routes ---
  app.post('/v1/auth/guest', rateLimiter(60, 'auth'), async (req, res, next) => {
    try {
      const { guest_device_id, age_bucket } = req.body;
      if (!guest_device_id || !age_bucket) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'guest_device_id and age_bucket are required' }
        });
      }
      const result = await profileService.authGuest(guest_device_id, age_bucket);
      res.json(result);
    } catch (err) { next(err); }
  });

  app.post('/v1/auth/apple', rateLimiter(60, 'auth'), async (req, res, next) => {
    try {
      const { identity_token, guest_device_id } = req.body;
      if (!identity_token) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'identity_token is required' }
        });
      }
      const result = await profileService.authApple(identity_token, guest_device_id);
      res.json(result);
    } catch (err) { next(err); }
  });

  app.post('/v1/auth/refresh', rateLimiter(60, 'auth'), async (req, res, next) => {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'refresh_token is required' }
        });
      }
      const result = await profileService.refreshToken(refresh_token);
      res.json(result);
    } catch (err) { next(err); }
  });

  // CRIT-A1: Parental Gate challenge endpoint (does not leak solution or operands)
  app.get('/v1/auth/parental-gate/challenge', rateLimiter(30, 'auth'), (req, res) => {
    const challenge = profileService.createParentalGateChallenge();
    res.json(challenge);
  });

  // CRIT-A1: Parental Gate verification endpoint
  app.post('/v1/auth/parental-gate/verify', requireAuth, rateLimiter(30, 'auth'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await profileService.verifyParentalGate(req.user!.player_id, req.body);
      res.json(result);
    } catch (err) { next(err); }
  });

  app.get('/v1/profile', requireAuth, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await profileService.getProfile(req.user!.player_id);
      res.json(result);
    } catch (err) { next(err); }
  });

  // --- Run Routes ---
  app.post('/v1/runs', requireAuth, requireIdempotencyKey, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      skylineActiveRunsTotal++;
      const idempotencyKey = req.header('Idempotency-Key')!;
      const result = await runService.submitRun(req.user!.player_id, req.body, idempotencyKey);
      if (result.integrity_flag === 'excluded') {
        skylineFraudDroppedRunsTotal++;
      }
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  // CRIT-03: Redeploy with run_id in request body
  app.post('/v1/runs/redeploy', requireAuth, requireIdempotencyKey, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      skylineRedeployConversionsTotal++;
      const idempotencyKey = req.header('Idempotency-Key')!;
      const { run_id, method, ad_receipt } = req.body;
      const result = await economyService.redeploy(req.user!.player_id, run_id, method, ad_receipt, idempotencyKey);
      res.json(result);
    } catch (err) { next(err); }
  });

  // CRIT-03: Redeploy with run_id in path parameter
  app.post('/v1/runs/:run_id/redeploy', requireAuth, requireIdempotencyKey, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      skylineRedeployConversionsTotal++;
      const idempotencyKey = req.header('Idempotency-Key')!;
      const { method, ad_receipt } = req.body;
      const result = await economyService.redeploy(req.user!.player_id, req.params.run_id, method, ad_receipt, idempotencyKey);
      res.json(result);
    } catch (err) { next(err); }
  });

  // --- Economy Routes ---
  app.get('/v1/economy/balance', requireAuth, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const balance = await economyService.getBalance(req.user!.player_id);
      res.json({ chips: balance.chips, cores: balance.cores });
    } catch (err) { next(err); }
  });

  app.get('/v1/economy/ledger', requireAuth, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const cursor = req.query.cursor as string | undefined;
      const result = await economyService.getLedger(req.user!.player_id, limit, cursor);
      res.json(result);
    } catch (err) { next(err); }
  });

  // --- Contracts Routes ---
  app.get('/v1/contracts/active', requireAuth, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await economyService.getActiveContracts(req.user!.player_id);
      res.json(result);
    } catch (err) { next(err); }
  });

  app.post('/v1/contracts/:contract_id/claim', requireAuth, requireIdempotencyKey, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const idempotencyKey = req.header('Idempotency-Key')!;
      const result = await economyService.claimContract(req.user!.player_id, req.params.contract_id, idempotencyKey);
      res.json(result);
    } catch (err) { next(err); }
  });

  // --- Supply Drop Routes ---
  app.get('/v1/supply-drops/tables/:table_id', rateLimiter(60, 'general'), async (req, res, next) => {
    try {
      const table = await economyService.getSupplyDropTable(req.params.table_id);
      res.json(table);
    } catch (err) { next(err); }
  });

  app.post('/v1/supply-drops/open', requireAuth, requireIdempotencyKey, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const idempotencyKey = req.header('Idempotency-Key')!;
      const { acquired_via, table_id } = req.body;
      const result = await economyService.openSupplyDrop(req.user!.player_id, acquired_via, idempotencyKey, table_id);
      res.json(result);
    } catch (err) { next(err); }
  });

  // --- Roster Routes ---
  app.get('/v1/roster', requireAuth, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await economyService.getRoster(req.user!.player_id);
      res.json(result);
    } catch (err) { next(err); }
  });

  app.post('/v1/roster/equip', requireAuth, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const { item_type, item_id } = req.body;
      const result = await economyService.equipItem(req.user!.player_id, item_type, item_id);
      res.json(result);
    } catch (err) { next(err); }
  });

  app.post('/v1/roster/unlock', requireAuth, requireIdempotencyKey, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const idempotencyKey = req.header('Idempotency-Key')!;
      const { item_type, item_id } = req.body;
      const result = await economyService.unlockItem(req.user!.player_id, item_type, item_id, idempotencyKey);
      res.json(result);
    } catch (err) { next(err); }
  });

  // --- Leaderboard Routes ---
  app.get('/v1/leaderboard', requireAuth, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const scope = (req.query.scope as any) || 'global';
      const districtId = (req.query.district_id as string) || 'neo-marina';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const cursor = req.query.cursor as string | undefined;

      const result = await leaderboardService.getLeaderboard(req.user!.player_id, scope, districtId, limit, cursor);
      res.json(result);
    } catch (err) { next(err); }
  });

  app.post('/v1/friends/add', requireAuth, rateLimiter(60, 'general'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const { code } = req.body;
      const result = await leaderboardService.addFriend(req.user!.player_id, code);
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  // --- Purchases Routes ---
  app.post('/v1/purchases/receipt', requireAuth, requireIdempotencyKey, rateLimiter(10, 'purchases'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const idempotencyKey = req.header('Idempotency-Key')!;
      const result = await billingService.validateReceipt(req.user!.player_id, req.body, idempotencyKey);
      res.json(result);
    } catch (err) { next(err); }
  });

  // --- Privacy Routes ---
  app.post('/v1/privacy/export', requireAuth, rateLimiter(10, 'privacy'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const { parental_gate_token } = req.body || {};
      const result = await privacyService.exportData(req.user!.player_id, parental_gate_token);
      res.status(202).json(result);
    } catch (err) { next(err); }
  });

  app.post('/v1/privacy/data-export', requireAuth, rateLimiter(10, 'privacy'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const { parental_gate_token } = req.body || {};
      const result = await privacyService.exportData(req.user!.player_id, parental_gate_token);
      res.status(202).json(result);
    } catch (err) { next(err); }
  });

  app.post('/v1/privacy/delete', requireAuth, rateLimiter(10, 'privacy'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const { parental_gate_token } = req.body || {};
      const result = await privacyService.deleteData(req.user!.player_id, parental_gate_token);
      res.json(result);
    } catch (err) { next(err); }
  });

  app.post('/v1/privacy/delete-account', requireAuth, rateLimiter(10, 'privacy'), async (req: AuthenticatedRequest, res, next) => {
    try {
      const { parental_gate_token } = req.body || {};
      const result = await privacyService.deleteData(req.user!.player_id, parental_gate_token);
      res.json(result);
    } catch (err) { next(err); }
  });

  // --- LiveOps Routes ---
  app.get('/v1/liveops/config', rateLimiter(60, 'general'), async (req, res, next) => {
    try {
      const result = await liveOpsService.getConfig();
      res.json(result);
    } catch (err) { next(err); }
  });

  // --- Webhooks Routes ---
  app.post('/v1/webhooks/apple', async (req, res, next) => {
    try {
      const { signedPayload } = req.body;
      const result = await billingService.handleAppleWebhook(signedPayload);
      res.json(result);
    } catch (err) { next(err); }
  });

  // Central Error Handler Middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const code = err.code || 'INTERNAL_ERROR';
    let statusCode = 500;

    if (code === 'UNAUTHORIZED' || code === 'INVALID_REFRESH_TOKEN') statusCode = 401;
    else if (code === 'INSUFFICIENT_BALANCE') statusCode = 402;
    else if (code === 'PARENTAL_GATE_REQUIRED' || code === 'AGE_GATE_REQUIRED') statusCode = 403;
    else if (code === 'NOT_FOUND') statusCode = 404;
    else if (code === 'IDEMPOTENCY_CONFLICT' || code === 'ALREADY_CLAIMED' || code === 'NOT_COMPLETED' || code === 'AD_REDEPLOY_EXHAUSTED' || code === 'RUN_ENDED') statusCode = 409;
    else if (code === 'RECEIPT_INVALID') statusCode = 422;
    else if (code === 'RATE_LIMITED') statusCode = 429;
    else if (code === 'VALIDATION_ERROR') statusCode = 400;

    res.status(statusCode).json({
      error: {
        code,
        message: err.message || 'An error occurred',
        details: err.details
      }
    });
  });

  return app;
}
