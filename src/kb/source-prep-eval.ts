/**
 * Pure evaluator for a source-prep item's `assert` rules (kb/schema.ts) against the rows a live
 * probe returned. No IO — `doctor`'s heterogeneous path runs the SQL and hands the rows here, so
 * the pass/fail logic is unit-tested without a live MySQL. Each rule yields a {@link RuleEval}
 * carrying the observed value, so doctor can show WHY a check failed (e.g. "binlog_format=STATEMENT").
 */

import type { SourcePrepRule } from "./schema.ts";

export interface RuleEval {
  label: string;
  ok: boolean;
  /** The observed value (or the scanned text for `contains`), for the operator's eye. */
  observed: string;
}

type Row = Record<string, unknown>;

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/** Stringify every cell of every row into one blob (for `contains`, where the column is dynamic). */
function scanAll(rows: Row[]): string {
  return rows.map((r) => Object.values(r).map(str).join(" ")).join("\n");
}

/** Evaluate one rule against the probe's rows. */
export function evalRule(rule: SourcePrepRule, rows: Row[]): RuleEval {
  switch (rule.kind) {
    case "eq": {
      const observed = str(rows[0]?.[rule.column]);
      return { label: rule.label, ok: observed === rule.value, observed };
    }
    case "oneOf": {
      const observed = str(rows[0]?.[rule.column]);
      return { label: rule.label, ok: rule.values.includes(observed), observed };
    }
    case "empty": {
      const observed = str(rows[0]?.[rule.column]);
      return { label: rule.label, ok: observed === "", observed: observed || "(empty)" };
    }
    case "contains": {
      const blob = scanAll(rows);
      const hay = blob.toLowerCase();
      const missing = rule.all.filter((s) => !hay.includes(s.toLowerCase()));
      return {
        label: rule.label,
        ok: missing.length === 0,
        observed: missing.length === 0 ? "all present" : `missing: ${missing.join(", ")}`,
      };
    }
  }
}

/** Evaluate every rule in an assert. */
export function evalRules(rules: SourcePrepRule[], rows: Row[]): RuleEval[] {
  return rules.map((rule) => evalRule(rule, rows));
}
