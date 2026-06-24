import { type CheckItem, Checks } from "./schema.ts";

/**
 * Live readiness checks promoted from `doctor`'s inline control flow to data. Each is a
 * single-row SQL probe + an expected value; doctor runs them via `runCheck` and renders its
 * existing pass/fail strings, while `guide`'s future live walk runs the same items. Grounded
 * in the Postgres docs (docs.erfi.io) so `kb drift` can age-check them.
 *
 * Extraction is incremental and output-preserving: a check moves here only when doctor's
 * emitted strings stay byte-identical (see test/integration.test.ts).
 */
const RAW: CheckItem[] = [
  {
    id: "source.wal_level_logical",
    phase: "source-prep",
    severity: "fail",
    title: "source wal_level",
    detect: { sql: "SHOW wal_level", column: "wal_level" },
    expect: "logical",
    guidance:
      "Logical replication requires wal_level=logical on the SOURCE. Managed providers set it " +
      "via a parameter group/server parameter (see the provider guide); self-hosted: set " +
      "wal_level=logical in postgresql.conf. It can only be changed at server start, so restart " +
      "the source, then re-check.",
    provenance: {
      source: "/docs/postgres/runtime-config-wal.md",
      lastSynced: "2026-06-24",
    },
  },
];

/** Validated at module load — a malformed check crashes loudly, never silently skips. */
export const checks: readonly CheckItem[] = Checks.parse(RAW);

/** Look up a check by id (throws if absent — ids are compile-time-ish constants in doctor). */
export function check(id: string): CheckItem {
  const found = checks.find((c) => c.id === id);
  if (!found) throw new Error(`unknown check id: ${id}`);
  return found;
}

export interface CheckResult {
  id: string;
  /** The observed value from `detect.column`, or null when the probe returned no row. */
  observed: string | null;
  ok: boolean;
}

/** Runs the probe and queries `detect.column`. `query` returns the result rows. */
export type QueryFn = (sql: string) => Promise<readonly Record<string, unknown>[]>;

/**
 * Execute one check: run its `detect.sql`, read `detect.column` from the first row, compare to
 * `expect`. IO is injected as `query` so the comparison logic is unit-testable without a live
 * connection. doctor passes `(sql) => db.unsafe(sql)`.
 */
export async function runCheck(query: QueryFn, item: CheckItem): Promise<CheckResult> {
  const rows = await query(item.detect.sql);
  const raw = rows[0]?.[item.detect.column];
  const observed = raw == null ? null : String(raw);
  return { id: item.id, observed, ok: observed === item.expect };
}
