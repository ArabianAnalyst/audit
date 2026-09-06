import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(process.cwd(), "dist", "cli.js");
const run = (args: string[]) => execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8" });

test("--example prints a valid intake", () => {
  const intake = JSON.parse(run(["--example"])) as Record<string, unknown>;
  assert.equal(typeof intake.custody, "object");
});

test("--intake with --json prints the readout, --out writes both files", () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-"));
  const file = join(dir, "intake.json");
  writeFileSync(file, run(["--example"]));
  const r = JSON.parse(run(["--intake", file, "--json"])) as { posture: string };
  assert.match(r.posture, /advisory with caps/);
  const text = run(["--intake", file, "--out", dir]);
  assert.match(text, /1\. Posture/);
  assert.ok(existsSync(join(dir, "audit.md")) && existsSync(join(dir, "audit.html")));
  assert.match(readFileSync(join(dir, "audit.md"), "utf8"), /^# Agent Payment Security Audit/);
});

test("a bad intake file is a clear error", () => {
  assert.throws(() => execFileSync(process.execPath, [CLI, "--intake", "/nope/none.json"], { encoding: "utf8", stdio: "pipe" }), /cannot read intake/);
});
