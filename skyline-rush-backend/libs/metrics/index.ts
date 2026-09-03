/**
 * Minimal process-local Prometheus counter registry (Phase 3 / AC-P3-8).
 *
 * Services below the Gateway (Economy, Billing) need to increment counters that
 * the Gateway's `/metrics` handler renders. Rather than threading a metrics
 * object through every constructor — which would change service signatures the
 * acceptance suite depends on — they share this tiny in-process registry.
 *
 * Deliberately dependency-free: adding prom-client would pull a runtime
 * dependency into a monorepo whose only existing exposition path is the
 * hand-rolled text renderer in gateway.app.ts.
 *
 * Scope note: counters are per-process. Under the multi-replica Kubernetes
 * deployment in k8s/, Prometheus scrapes each pod separately and aggregates
 * server-side (`sum(...)` in the alert rules), which is the normal counter
 * model — no cross-process state is required or implied.
 */

export type CounterName =
  | 'skyline_balance_reconciliation_errors_total'
  | 'skyline_receipt_validation_failures_total'
  | 'skyline_receipt_client_rejections_total'
  | 'skyline_receipt_validations_total'
  | 'skyline_idempotent_replay_total'
  | 'skyline_appstore_webhook_signature_failures_total';

export interface CounterSpec {
  name: CounterName;
  help: string;
}

export const COUNTER_SPECS: CounterSpec[] = [
  {
    name: 'skyline_balance_reconciliation_errors_total',
    help: 'Balance reads where the append-only ledger sum disagreed with the materialized economy_balance row'
  },
  {
    name: 'skyline_receipt_validation_failures_total',
    help: 'StoreKit receipt validations that failed on our side or on Apple\'s (verification error, entitlement grant failure, unknown player); numerator for the failure-rate page. Caller-supplied bad input is NOT counted here — see skyline_receipt_client_rejections_total'
  },
  {
    name: 'skyline_receipt_client_rejections_total',
    help: 'StoreKit receipt submissions rejected purely on caller-supplied input (unknown SKU, malformed body, missing or invalid parental gate). Not alertable: any client can drive this at will'
  },
  {
    name: 'skyline_receipt_validations_total',
    help: 'StoreKit receipt validations attempted; denominator for the failure-rate alert'
  },
  {
    name: 'skyline_idempotent_replay_total',
    help: 'Idempotent-replay hits served from an original result instead of re-executing: duplicate purchase receipts (billing), and supply-drop opens and contract claims replayed under an already-seen Idempotency-Key (economy)'
  },
  {
    name: 'skyline_appstore_webhook_signature_failures_total',
    help: 'App Store Server Notification payloads rejected as undecodable. NOTE: real JWS signature verification is not implemented yet, so this counts malformed payloads only, not verified spoofing'
  }
];

const counters = new Map<CounterName, number>();

for (const spec of COUNTER_SPECS) {
  counters.set(spec.name, 0);
}

/** Increment a counter. Never throws — instrumentation must not break a request. */
export function incCounter(name: CounterName, by = 1): void {
  if (!Number.isFinite(by) || by < 0) return;
  counters.set(name, (counters.get(name) || 0) + by);
}

export function getCounter(name: CounterName): number {
  return counters.get(name) || 0;
}

/** Render every registered counter in Prometheus text exposition format 0.0.4. */
export function renderCounters(): string {
  let body = '';
  for (const spec of COUNTER_SPECS) {
    body += `\n# HELP ${spec.name} ${spec.help}\n# TYPE ${spec.name} counter\n`;
    body += `${spec.name} ${counters.get(spec.name) || 0}\n`;
  }
  return body;
}

/** Test-suite helper. Not called from any request path. */
export function resetCounters(): void {
  for (const spec of COUNTER_SPECS) counters.set(spec.name, 0);
}
