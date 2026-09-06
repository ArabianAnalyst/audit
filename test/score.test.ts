import { test } from "node:test";
import assert from "node:assert/strict";
import { score } from "../src/score.js";
import { formatMoney } from "../src/money.js";
import type { Intake } from "../src/types.js";

const advisory: Intake = {
  spend: { what: ["API credits"], frequency: "daily", typical: { amount: 12.5, currency: "USD" } },
  reach: { tools: ["http", "stripe-sdk"], mcpServers: [], keysInRuntime: ["STRIPE_SECRET_KEY"], paymentPaths: 1 },
  custody: { where: "agent-runtime" },
  execution: { who: "agent-calls-rail" },
  binding: { mode: "any-in-policy" },
  limits: { perAction: { amount: 50, currency: "USD" }, perDay: { amount: 500, currency: "USD" }, enforcedAt: "at-settlement", reservedAtGrant: false },
  approval: { mode: "in-band", threshold: { amount: 100, currency: "USD" } },
  record: { exists: true, tamperEvident: false, settledAmountRecorded: false },
  drift: { changeFrequency: "weekly", recheck: "never" },
};

const enforcement: Intake = {
  spend: { what: ["compute"], frequency: "continuous", typical: { amount: 3, currency: "GBP" } },
  reach: { tools: ["purse-client"], mcpServers: ["purse"], keysInRuntime: [], paymentPaths: 1 },
  custody: { where: "separate-service" },
  execution: { who: "intent-to-executor" },
  binding: { mode: "bound-payee-and-amount" },
  limits: { perAction: { amount: 50, currency: "GBP" }, perDay: { amount: 500, currency: "GBP" }, enforcedAt: "before-spend", reservedAtGrant: true },
  approval: { mode: "out-of-band", threshold: { amount: 20, currency: "GBP" } },
  record: { exists: true, tamperEvident: true, settledAmountRecorded: true },
  drift: { changeFrequency: "daily", recheck: "at-deploy" },
};

test("money formats with a symbol for the three common currencies and a code otherwise", () => {
  assert.equal(formatMoney({ amount: 50, currency: "USD" }), "$50.00");
  assert.equal(formatMoney({ amount: 12.5, currency: "GBP" }), "£12.50");
  assert.equal(formatMoney({ amount: 3, currency: "EUR" }), "€3.00");
  assert.equal(formatMoney({ amount: 7, currency: "NGN" }), "7.00 NGN");
});

test("advisory with caps: forgery and misdirection open, blast radius in their numbers", () => {
  const r = score(advisory);
  assert.equal(r.posture, "advisory with caps, forgery open and misdirection open");
  const v = Object.fromEntries(r.exposure.map((e) => [e.dimension, e.verdict]));
  assert.deepEqual(v, {
    "single-path": "Exposed", "custody": "Exposed", "mediated-execution": "Exposed", "intent-binding": "Exposed",
    "no-splitting": "Exposed", "human-approval": "Exposed", "provable-audit": "Exposed", "continuous-verification": "Exposed",
  });
  assert.deepEqual(r.open, { forgery: "open", misdirection: "open", why: r.open.why });
  assert.ok(r.moneyPaths.some((p) => p.path.includes("STRIPE_SECRET_KEY") && p.mediated === false));
  assert.equal(r.topBreaches.length, 3);
  assert.deepEqual(r.topBreaches.map((b) => b.dimension), ["single-path", "custody", "mediated-execution"]);
  assert.match(r.topBreaches[0]!.blastRadius, /\$500\.00/);
  assert.ok(r.shortestPath.length >= 2 && r.shortestPath.length <= 4);
  assert.equal(r.shortestPath[0]!.kind, "governance-layer");
  assert.match(r.lastLine, /https:\/\/olurabian\.com\/work/);
  assert.ok(r.exposure.every((e) => e.question === undefined));
});

test("enforcement-grade except continuous verification", () => {
  const r = score(enforcement);
  assert.equal(r.posture, "enforcement-grade except continuous verification");
  const v = Object.fromEntries(r.exposure.map((e) => [e.dimension, e.verdict]));
  assert.equal(v["continuous-verification"], "Partial");
  for (const d of ["single-path", "custody", "mediated-execution", "intent-binding", "no-splitting", "human-approval", "provable-audit"]) assert.equal(v[d], "Closed", d);
  assert.deepEqual([r.open.forgery, r.open.misdirection], ["closed", "closed"]);
  assert.equal(r.topBreaches.length, 0);
  assert.ok(r.moneyPaths.some((p) => p.mediated === true));
  assert.equal(r.shortestPath.length, 2);
  assert.equal(r.shortestPath[0]!.kind, "practice");
});

test("everything unknown: eight Unknowns, each with its question, no breaches", () => {
  const r = score({});
  assert.equal(r.posture, "mostly unknown");
  assert.ok(r.exposure.every((e) => e.verdict === "Unknown" && typeof e.question === "string" && e.question.length > 10));
  assert.deepEqual([r.open.forgery, r.open.misdirection], ["unknown", "unknown"]);
  assert.equal(r.topBreaches.length, 0);
  assert.equal(r.moneyPaths[0]?.mediated, "unknown");
});

test("no cap at all reads as unbounded; a partial approval reads as Partial", () => {
  const r = score({ ...advisory, limits: { enforcedAt: "none", reservedAtGrant: false }, approval: { mode: "out-of-band" } });
  assert.match(r.topBreaches[0]!.blastRadius, /unbounded/);
  assert.equal(r.exposure.find((e) => e.dimension === "human-approval")!.verdict, "Partial");
});

test("score is pure and notes are echoed, never scored", () => {
  const a = score({ ...advisory, custody: { where: "agent-runtime", notes: "the key is in an env var" } });
  const b = score({ ...advisory, custody: { where: "agent-runtime", notes: "the key is in an env var" } });
  assert.deepEqual(a, b);
  assert.ok(a.notes.some((n) => n.dimension === "custody" && n.text === "the key is in an env var"));
  assert.equal(a.exposure.find((e) => e.dimension === "custody")!.verdict, "Exposed");
});

test("generated prose has no colon or em dash outside URLs", () => {
  for (const intake of [advisory, enforcement, {}]) {
    const r = score(intake);
    const prose = [r.posture, ...r.exposure.map((e) => e.finding + " " + (e.question ?? "")), ...r.topBreaches.map((b) => b.blastRadius + " " + b.fix), r.open.why, ...r.shortestPath.map((s) => s.step), r.lastLine.replace(/https?:\/\/\S+/g, "")].join("\n");
    assert.ok(!/—/.test(prose), "em dash");
    assert.ok(!/:/.test(prose), "colon in " + prose.split("\n").find((l) => l.includes(":")));
  }
});
