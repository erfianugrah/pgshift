import { describe, expect, test } from "bun:test";
import type { SourcePrepRule } from "../src/kb/schema.ts";
import { evalRule, evalRules } from "../src/kb/source-prep-eval.ts";

describe("evalRule", () => {
  test("eq: stringifies the observed value (MySQL @@log_bin returns numeric 1)", () => {
    const rule: SourcePrepRule = { kind: "eq", column: "log_bin", value: "1", label: "log_bin on" };
    expect(evalRule(rule, [{ log_bin: 1 }])).toEqual({
      label: "log_bin on",
      ok: true,
      observed: "1",
    });
    expect(evalRule(rule, [{ log_bin: 0 }]).ok).toBe(false);
  });

  test("eq: string match (binlog_format)", () => {
    const rule: SourcePrepRule = { kind: "eq", column: "fmt", value: "ROW", label: "row" };
    expect(evalRule(rule, [{ fmt: "ROW" }]).ok).toBe(true);
    const bad = evalRule(rule, [{ fmt: "STATEMENT" }]);
    expect(bad.ok).toBe(false);
    expect(bad.observed).toBe("STATEMENT");
  });

  test("oneOf: membership", () => {
    const rule: SourcePrepRule = {
      kind: "oneOf",
      column: "m",
      values: ["ON", "ON_PERMISSIVE"],
      label: "m",
    };
    expect(evalRule(rule, [{ m: "ON_PERMISSIVE" }]).ok).toBe(true);
    expect(evalRule(rule, [{ m: "OFF" }]).ok).toBe(false);
  });

  test("empty: '' passes, non-empty fails, missing passes", () => {
    const rule: SourcePrepRule = { kind: "empty", column: "opt", label: "opt empty" };
    expect(evalRule(rule, [{ opt: "" }]).ok).toBe(true);
    expect(evalRule(rule, [{ opt: "PARTIAL_JSON" }]).ok).toBe(false);
    expect(evalRule(rule, [{}]).ok).toBe(true); // undefined → "" → empty
    expect(evalRule(rule, [{ opt: "" }]).observed).toBe("(empty)");
  });

  test("contains: scans ALL rows/cols case-insensitively (SHOW GRANTS shape)", () => {
    const rule: SourcePrepRule = {
      kind: "contains",
      all: ["REPLICATION SLAVE", "REPLICATION CLIENT"],
      label: "repl privs",
    };
    const grants = [
      { "Grants for dbz@%": "GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO `dbz`@`%`" },
      { "Grants for dbz@%": "GRANT SELECT ON `inventory`.* TO `dbz`@`%`" },
    ];
    expect(evalRule(rule, grants).ok).toBe(true);

    const missing = [{ g: "GRANT REPLICATION CLIENT ON *.* TO x" }];
    const r = evalRule(rule, missing);
    expect(r.ok).toBe(false);
    expect(r.observed).toContain("REPLICATION SLAVE");
  });
});

describe("evalRules", () => {
  test("evaluates every rule in order", () => {
    const rules: SourcePrepRule[] = [
      { kind: "eq", column: "a", value: "1", label: "a" },
      { kind: "eq", column: "b", value: "ROW", label: "b" },
    ];
    const out = evalRules(rules, [{ a: 1, b: "STATEMENT" }]);
    expect(out.map((x) => x.ok)).toEqual([true, false]);
  });
});
