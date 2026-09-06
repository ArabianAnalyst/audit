import { test } from "node:test";
import assert from "node:assert/strict";
import { score, blastRadius } from "../src/score.js";
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

const allUnknown: Intake = {};

const noCapsVariant: Intake = { ...advisory, limits: { enforcedAt: "none", reservedAtGrant: false }, approval: { mode: "out-of-band" } };

const enforcementGradeVariant: Intake = { ...enforcement, drift: { changeFrequency: "daily", recheck: "on-change" } };

const noSplittingCorner: Intake = { limits: { reservedAtGrant: true, enforcedAt: "before-spend" } };

const blastNoCapsIntake: Intake = { ...advisory, limits: { enforcedAt: "before-spend", reservedAtGrant: "unknown" }, approval: { mode: "in-band" } };

const advisoryWithCapsWinsIntake: Intake = { execution: { who: "agent-calls-rail" }, limits: { perDay: { amount: 500, currency: "USD" }, enforcedAt: "at-settlement", reservedAtGrant: false } };

const approvalNoneBoundGrants: Intake = { ...enforcement, approval: { mode: "none" } };

const approvalNoneBindingUnknown: Intake = {
  custody: { where: "separate-service" },
  execution: { who: "intent-to-executor" },
  reach: { tools: [], mcpServers: [], keysInRuntime: [], paymentPaths: 1 },
  approval: { mode: "none" },
};

const ALL_INTAKES: Intake[] = [
  advisory,
  enforcement,
  allUnknown,
  noCapsVariant,
  enforcementGradeVariant,
  noSplittingCorner,
  blastNoCapsIntake,
  advisoryWithCapsWinsIntake,
  approvalNoneBoundGrants,
  approvalNoneBindingUnknown,
];

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
  assert.equal(r.shortestPath.length, 1);
  assert.equal(r.shortestPath[0]!.kind, "practice");
});

test("an enforcement-grade setup gets no steps and an honest last line", () => {
  const r = score(enforcementGradeVariant);
  assert.equal(r.posture, "enforcement-grade");
  assert.equal(r.shortestPath.length, 0);
  assert.equal(r.topBreaches.length, 0);
  assert.match(r.lastLine, /Nothing to close/);
});

test("everything unknown: eight Unknowns, each with its question, no breaches", () => {
  const r = score(allUnknown);
  assert.equal(r.posture, "mostly unknown");
  assert.ok(r.exposure.every((e) => e.verdict === "Unknown" && typeof e.question === "string" && e.question.length > 10));
  assert.deepEqual([r.open.forgery, r.open.misdirection], ["unknown", "unknown"]);
  assert.equal(r.topBreaches.length, 0);
  assert.equal(r.moneyPaths[0]?.mediated, "unknown");
  const q = Object.fromEntries(r.exposure.map((e) => [e.dimension, e.question]));
  assert.equal(q["single-path"], "What can the agent's runtime reach? List every tool, MCP server, SDK, and key in the agent's process.");
  assert.equal(q["no-splitting"], "What limits exist and where are they enforced? Per-action, daily, per-vendor. Checked before the spend or only at settlement.");
});

test("advisory with caps wins over mostly unknown", () => {
  const r = score(advisoryWithCapsWinsIntake);
  assert.match(r.posture, /^advisory with caps/);
});

test("no cap at all reads as unbounded; a partial approval reads as Partial", () => {
  const r = score(noCapsVariant);
  assert.match(r.topBreaches[0]!.blastRadius, /unbounded/);
  assert.equal(r.exposure.find((e) => e.dimension === "human-approval")!.verdict, "Partial");
});

test("no-splitting reads partial when budget is reserved but no cap exists", () => {
  const r = score(noSplittingCorner);
  const e = r.exposure.find((e) => e.dimension === "no-splitting")!;
  assert.equal(e.verdict, "Partial");
  assert.equal(e.finding, "Budget is reserved at approval, but no cap is described.");
});

test("blast sentences with no caps say unbounded", () => {
  assert.match(blastRadius("intent-binding", blastNoCapsIntake), /unbounded|\$[0-9]/);
  assert.match(blastRadius("no-splitting", blastNoCapsIntake), /unbounded|\$[0-9]/);
  assert.match(blastRadius("human-approval", blastNoCapsIntake), /unbounded|\$[0-9]/);
});

test("approval none with bound grants reads misdirection partial", () => {
  const r = score(approvalNoneBoundGrants);
  assert.equal(r.open.misdirection, "partial");
});

test("approval none with binding unknown stays unknown", () => {
  const r = score(approvalNoneBindingUnknown);
  assert.equal(r.open.misdirection, "unknown");
  assert.ok(!r.open.why.includes("Binding holds"));
});

test("score is pure and notes are echoed, never scored", () => {
  const a = score({ ...advisory, custody: { where: "agent-runtime", notes: "the key is in an env var" } });
  const b = score({ ...advisory, custody: { where: "agent-runtime", notes: "the key is in an env var" } });
  assert.deepEqual(a, b);
  assert.ok(a.notes.some((n) => n.dimension === "custody" && n.text === "the key is in an env var"));
  assert.equal(a.exposure.find((e) => e.dimension === "custody")!.verdict, "Exposed");
});

test("generated prose has no colon or em dash outside URLs", () => {
  for (const intake of ALL_INTAKES) {
    const r = score(intake);
    const prose = [r.posture, ...r.exposure.map((e) => e.finding + " " + (e.question ?? "")), ...r.topBreaches.map((b) => b.blastRadius + " " + b.fix), r.open.why, ...r.shortestPath.map((s) => s.step), r.lastLine.replace(/https?:\/\/\S+/g, "")].join("\n");
    assert.ok(!/—/.test(prose), "em dash");
    assert.ok(!/:/.test(prose), "colon in " + prose.split("\n").find((l) => l.includes(":")));
  }
});
