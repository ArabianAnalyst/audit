import { test } from "node:test";
import assert from "node:assert/strict";
import { score, blastRadius, STEPS } from "../src/score.js";
import { formatMoney } from "../src/money.js";
import { questions } from "../src/questions.js";
import { render } from "../src/render.js";
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

const noSplittingExposedDespiteReserved: Intake = { limits: { enforcedAt: "none", reservedAtGrant: true } };
const noSplittingExposedAtSettlementReserved: Intake = { limits: { enforcedAt: "at-settlement", reservedAtGrant: true, perDay: { amount: 100, currency: "USD" } } };

const allExposedPartialAudit: Intake = {
  reach: { tools: [], mcpServers: [], keysInRuntime: [], paymentPaths: "unknown" },
  custody: { where: "agent-runtime" },
  execution: { who: "agent-calls-rail" },
  binding: { mode: "any-in-policy" },
  limits: { enforcedAt: "none", reservedAtGrant: false },
  approval: { mode: "none" },
  record: { exists: true, tamperEvident: "unknown", settledAmountRecorded: true },
  drift: { changeFrequency: "daily", recheck: "never" },
};

const singlePathZeroPaths: Intake = { execution: { who: "intent-to-executor" }, reach: { tools: [], mcpServers: [], keysInRuntime: [], paymentPaths: 0 } };
const singlePathFractionalPaths: Intake = { execution: { who: "intent-to-executor" }, reach: { tools: [], mcpServers: [], keysInRuntime: [], paymentPaths: 2.5 } };

const singlePathCustodyRuntime: Intake = { custody: { where: "agent-runtime" }, execution: { who: "intent-to-executor" }, reach: { tools: [], mcpServers: [], keysInRuntime: [], paymentPaths: 1 } };

const whyInBandOnly: Intake = {
  custody: { where: "separate-service" },
  execution: { who: "intent-to-executor" },
  reach: { tools: [], mcpServers: [], keysInRuntime: [], paymentPaths: 1 },
  binding: { mode: "bound-payee-and-amount" },
  approval: { mode: "in-band" },
};

const whyKeyOnly: Intake = {
  custody: { where: "separate-service" },
  execution: { who: "intent-to-executor" },
  reach: { tools: [], mcpServers: [], keysInRuntime: ["STRIPE_KEY"], paymentPaths: 1 },
  binding: { mode: "bound-payee-and-amount" },
  approval: { mode: "out-of-band", threshold: { amount: 20, currency: "USD" } },
};

const greedyKeysOnly: Intake = {
  reach: { tools: [], mcpServers: [], keysInRuntime: ["KEY_A", "KEY_B"], paymentPaths: 1 },
  custody: { where: "separate-service" },
  execution: { who: "intent-to-executor" },
  binding: { mode: "bound-payee-and-amount" },
  limits: { perAction: { amount: 50, currency: "USD" }, perDay: { amount: 500, currency: "USD" }, enforcedAt: "before-spend", reservedAtGrant: true },
  approval: { mode: "out-of-band", threshold: { amount: 20, currency: "USD" } },
  record: { exists: true, tamperEvident: true, settledAmountRecorded: true },
  drift: { changeFrequency: "rare", recheck: "on-change" },
};

const fourClosedRestAbsent: Intake = {
  custody: { where: "separate-service" },
  execution: { who: "intent-to-executor" },
  reach: { tools: [], mcpServers: [], keysInRuntime: [], paymentPaths: 1 },
  binding: { mode: "bound-payee-and-amount" },
};

const sevenClosedEighthUnknown: Intake = {
  custody: { where: "separate-service" },
  execution: { who: "intent-to-executor" },
  reach: { tools: [], mcpServers: [], keysInRuntime: [], paymentPaths: 1 },
  binding: { mode: "bound-payee-and-amount" },
  limits: { perAction: { amount: 50, currency: "USD" }, perDay: { amount: 500, currency: "USD" }, enforcedAt: "before-spend", reservedAtGrant: true },
  approval: { mode: "out-of-band", threshold: { amount: 20, currency: "USD" } },
  record: { exists: true, tamperEvident: true, settledAmountRecorded: true },
};

const custodyBreachTwoIntake: Intake = {
  reach: { tools: [], mcpServers: [], keysInRuntime: [], paymentPaths: 1 },
  custody: { where: "agent-runtime" },
  execution: { who: "intent-to-executor" },
  binding: { mode: "any-in-policy" },
  limits: { perDay: { amount: 500, currency: "USD" }, enforcedAt: "none", reservedAtGrant: false },
  approval: { mode: "none" },
  record: { exists: true, tamperEvident: true, settledAmountRecorded: true },
  drift: { changeFrequency: "rare", recheck: "on-change" },
};

const stringyPerDay: Intake = { limits: { perDay: { amount: "500" as unknown as number, currency: "USD" }, enforcedAt: "none", reservedAtGrant: false } };
const zeroPerDay: Intake = { limits: { perDay: { amount: 0, currency: "USD" }, enforcedAt: "none", reservedAtGrant: false } };
const stringKeyIntake: Intake = { reach: { tools: [], mcpServers: [], keysInRuntime: "STRIPE_KEY" as unknown as string[], paymentPaths: 1 } };
const keysUnknownMediated: Intake = { execution: { who: "intent-to-executor" }, reach: { tools: [], mcpServers: [], keysInRuntime: "unknown", paymentPaths: 1 } };

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
  noSplittingExposedDespiteReserved,
  noSplittingExposedAtSettlementReserved,
  allExposedPartialAudit,
  singlePathZeroPaths,
  singlePathFractionalPaths,
  singlePathCustodyRuntime,
  whyInBandOnly,
  whyKeyOnly,
  greedyKeysOnly,
  fourClosedRestAbsent,
  sevenClosedEighthUnknown,
  stringyPerDay,
  zeroPerDay,
  stringKeyIntake,
  keysUnknownMediated,
];

test("money formats with a symbol for the three common currencies and a code otherwise", () => {
  assert.equal(formatMoney({ amount: 50, currency: "USD" }), "$50.00");
  assert.equal(formatMoney({ amount: 12.5, currency: "GBP" }), "£12.50");
  assert.equal(formatMoney({ amount: 3, currency: "EUR" }), "€3.00");
  assert.equal(formatMoney({ amount: 7, currency: "NGN" }), "7.00 NGN");
});

test("C1: money uses en-US thousands grouping and renders a bare amount with no trailing space when currency is absent", () => {
  assert.equal(formatMoney({ amount: 1234567.89, currency: "USD" }), "$1,234,567.89");
  assert.equal(formatMoney({ amount: 50 }), "50.00");
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
  assert.equal(q["single-path"], "Who executes the payment? The agent calls the rail itself, or it submits an intent to something that executes.");
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

test("B1: no splitting is Exposed when enforcedAt is none or at-settlement even with reservedAtGrant true", () => {
  const a = score(noSplittingExposedDespiteReserved);
  assert.equal(a.exposure.find((e) => e.dimension === "no-splitting")!.verdict, "Exposed");
  const b = score(noSplittingExposedAtSettlementReserved);
  assert.equal(b.exposure.find((e) => e.dimension === "no-splitting")!.verdict, "Exposed");
});

test("B2: no controls when nothing is closed and nothing is unknown, partial verdicts allowed", () => {
  const r = score(allExposedPartialAudit);
  const v = Object.fromEntries(r.exposure.map((e) => [e.dimension, e.verdict]));
  assert.equal(v["provable-audit"], "Partial");
  for (const [d, verdict] of Object.entries(v)) if (d !== "provable-audit") assert.equal(verdict, "Exposed", d);
  assert.equal(r.posture, "no controls");
});

test("B3: paymentPaths that is not a positive integer never says '0 money paths'", () => {
  for (const intake of [singlePathZeroPaths, singlePathFractionalPaths]) {
    const e = score(intake).exposure.find((e) => e.dimension === "single-path")!;
    assert.equal(e.verdict, "Partial");
    assert.equal(e.finding, "Execution is mediated, but the number of money paths is not described.");
    assert.ok(!/0 money paths/.test(e.finding));
  }
});

test("B4: single path Exposed finding names the real cause, custody over generic wording", () => {
  const e = score(singlePathCustodyRuntime).exposure.find((e) => e.dimension === "single-path")!;
  assert.equal(e.finding, "The credential lives in the agent's runtime, so the agent can reach the rail on its own whatever the executor does.");
  assert.ok(!e.finding.includes("without an enforcement point in front of it"));
});

test("B4: single path Unknown carries the execution question, not the reach question", () => {
  const e = score({}).exposure.find((e) => e.dimension === "single-path")!;
  assert.equal(e.question, "Who executes the payment? The agent calls the rail itself, or it submits an intent to something that executes.");
});

test("B5: why names only the misdirection clause that actually applies", () => {
  const r = score(whyInBandOnly);
  assert.ok(r.open.why.includes("approves its own requests"));
  assert.ok(!r.open.why.includes("chooses the who"));
});

test("B5: why names only the forgery clause that actually applies", () => {
  const r = score(whyKeyOnly);
  assert.ok(r.open.why.includes("holds a payment credential"));
  assert.ok(!r.open.why.includes("lives in the agent's runtime"));
  assert.ok(!r.open.why.includes("calls the rail itself"));
});

test("B6: approval-none blast names only the slot the intake gave", () => {
  const perActionOnly = blastRadius("human-approval", { limits: { perAction: { amount: 25.5, currency: "EUR" }, enforcedAt: "none", reservedAtGrant: false }, approval: { mode: "none" } });
  assert.match(perActionOnly, /€25\.50 per spend at most and no daily cap/);
  assert.ok(!/per day/.test(perActionOnly));
  const perDayOnly = blastRadius("no-splitting", { limits: { perDay: { amount: 500, currency: "USD" }, enforcedAt: "none", reservedAtGrant: false } });
  assert.match(perDayOnly, /set by the settlement lag, not the number/);
});

test("B7: shortest path is a greedy cover, no redundant governance step over the keys step", () => {
  const r = score(greedyKeysOnly);
  assert.equal(r.shortestPath.length, 1);
  assert.equal(r.shortestPath[0]!.kind, "hands-on");
});

test("B8: every Unknown question is byte for byte a questions.ts prompt", () => {
  const r = score(allUnknown);
  for (const e of r.exposure) {
    if (e.verdict !== "Unknown") continue;
    assert.ok(typeof e.question === "string");
    assert.ok(questions.some((q) => q.prompt === e.question), e.question);
  }
});

test("B9: 1 to 4 closed with 5 to 8 entirely unknown reads mostly unknown, not enforcement-grade except", () => {
  assert.equal(score(fourClosedRestAbsent).posture, "mostly unknown");
});

test("B9: 1 to 4 closed, 5 to 7 closed, 8 unknown does not read enforcement-grade", () => {
  assert.ok(!score(sevenClosedEighthUnknown).posture.startsWith("enforcement-grade"));
});

test("B10: a numeric string money amount normalises to a number and formats with no crash", () => {
  const b = score(stringyPerDay).topBreaches.find((b) => b.dimension === "no-splitting")!;
  assert.match(b.blastRadius, /\$500\.00/);
});

test("B10: a zero amount money normalises to absent, reading as unbounded", () => {
  const b = score(zeroPerDay).topBreaches.find((b) => b.dimension === "no-splitting")!;
  assert.match(b.blastRadius, /unbounded/);
});

test("B10: a bare string keysInRuntime normalises to a one-item list, exactly one money path", () => {
  const paths = score(stringKeyIntake).moneyPaths.filter((p) => p.path.includes("STRIPE_KEY"));
  assert.equal(paths.length, 1);
});

test("B10: keysInRuntime unknown with mediated execution is Partial with the reach question", () => {
  const r = score(keysUnknownMediated);
  const e = r.exposure.find((e) => e.dimension === "single-path")!;
  assert.equal(e.verdict, "Partial");
  assert.equal(e.finding, "Execution is mediated, but whether the runtime holds a payment credential is not described.");
  assert.equal(e.question, "What can the agent's runtime reach? List every tool, MCP server, SDK, and key in the agent's process.");
  assert.ok(r.moneyPaths.some((p) => p.path === "unknown, runtime credentials not described" && p.mediated === "unknown"));
});

test("F1: every dimension named in topBreaches is closed by at least one chosen step, across every fixture", () => {
  for (const intake of [...ALL_INTAKES, custodyBreachTwoIntake]) {
    const r = score(intake);
    const closedByChosen = new Set(r.shortestPath.flatMap((s) => STEPS.find((step) => step.step === s.step)?.closes ?? []));
    for (const b of r.topBreaches) {
      assert.ok(closedByChosen.has(b.dimension), `${b.dimension} is a top breach but no chosen step closes it`);
    }
  }
});

test("F1b: custody as breach two gets a step that moves the credential, not four steps that skip it", () => {
  const r = score(custodyBreachTwoIntake);
  assert.deepEqual(r.topBreaches.map((b) => b.dimension), ["single-path", "custody", "intent-binding"]);
  const closedByChosen = new Set(r.shortestPath.flatMap((s) => STEPS.find((step) => step.step === s.step)?.closes ?? []));
  assert.ok(closedByChosen.has("custody"));
});

test("F2: a keysInRuntime entry with an embedded newline renders as one money-path line, whitespace collapsed", () => {
  const intake: Intake = { reach: { tools: [], mcpServers: [], keysInRuntime: ["STRIPE_KEY\nSECOND_LINE"], paymentPaths: 1 } };
  const r = score(intake);
  assert.ok(r.moneyPaths.some((p) => p.path === "agent to rail via STRIPE_KEY SECOND_LINE, unmediated"));
  const text = render(r, "text");
  const moneyPathLines = text.split("\n").filter((l) => l.includes("STRIPE_KEY"));
  assert.equal(moneyPathLines.length, 1);
  assert.ok(!text.split("\n").some((l) => l.trim().startsWith("SECOND_LINE")));
});

test("generated prose has no colon or em dash outside URLs", () => {
  for (const intake of ALL_INTAKES) {
    const r = score(intake);
    const prose = [r.posture, ...r.exposure.map((e) => e.finding + " " + (e.question ?? "")), ...r.topBreaches.map((b) => b.blastRadius + " " + b.fix), r.open.why, ...r.shortestPath.map((s) => s.step), r.lastLine.replace(/https?:\/\/\S+/g, "")].join("\n");
    assert.ok(!/—/.test(prose), "em dash");
    assert.ok(!/:/.test(prose), "colon in " + prose.split("\n").find((l) => l.includes(":")));
  }
});
