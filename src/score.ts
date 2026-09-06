import { DIMENSIONS, DIMENSION_LABEL } from "./types.js";
import type { Dimension, Intake, Money, Readout, Verdict, Openness, StepKind } from "./types.js";
import { formatMoney, capOf } from "./money.js";
import { questions } from "./questions.js";

function promptFor(id: keyof Intake): string {
  const q = questions.find((q) => q.id === id);
  if (!q) throw new Error(`no question for ${id}`);
  return q.prompt;
}

const DIMENSION_QUESTION_ID: Record<Dimension, keyof Intake> = {
  "single-path": "execution",
  "custody": "custody",
  "mediated-execution": "execution",
  "intent-binding": "binding",
  "no-splitting": "limits",
  "human-approval": "approval",
  "provable-audit": "record",
  "continuous-verification": "drift",
};

// ---------- normalisation ----------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normList(v: unknown): string[] | "unknown" {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (v === "unknown") return "unknown";
  if (typeof v === "string" && v.length > 0) return [v];
  return "unknown";
}

function normMoney(v: unknown): Money | undefined {
  if (!isPlainObject(v)) return undefined;
  let amount: unknown = v.amount;
  if (typeof amount === "string" && amount.trim() !== "") {
    const n = Number(amount);
    if (Number.isFinite(n)) amount = n;
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return undefined;
  const currency = typeof v.currency === "string" && v.currency.length > 0 ? v.currency : undefined;
  return currency !== undefined ? { amount, currency } : { amount };
}

function normPaymentPaths(v: unknown): number | "unknown" {
  let n: unknown = v;
  if (typeof n === "string" && n.trim() !== "") {
    const parsed = Number(n);
    if (Number.isFinite(parsed)) n = parsed;
  }
  if (typeof n === "number" && Number.isInteger(n) && n > 0) return n;
  return "unknown";
}

function normBool(v: unknown): boolean | "unknown" {
  if (v === true || v === false) return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return "unknown";
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Normalise a hand-edited intake on a deep copy. score() never mutates its input. */
function normalize(intake: Intake): Intake {
  const src = intake as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  const spend = isPlainObject(src.spend) ? src.spend : undefined;
  if (spend) {
    const notes = str(spend.notes);
    const typical = normMoney(spend.typical);
    out.spend = {
      what: normList(spend.what),
      frequency: spend.frequency,
      ...(typical ? { typical } : {}),
      ...(notes ? { notes } : {}),
    };
  }

  const reach = isPlainObject(src.reach) ? src.reach : undefined;
  if (reach) {
    const notes = str(reach.notes);
    out.reach = {
      tools: normList(reach.tools),
      mcpServers: normList(reach.mcpServers),
      keysInRuntime: normList(reach.keysInRuntime),
      paymentPaths: normPaymentPaths(reach.paymentPaths),
      ...(notes ? { notes } : {}),
    };
  }

  const custody = isPlainObject(src.custody) ? src.custody : undefined;
  if (custody) {
    const notes = str(custody.notes);
    out.custody = { where: custody.where, ...(notes ? { notes } : {}) };
  }

  const execution = isPlainObject(src.execution) ? src.execution : undefined;
  if (execution) {
    const notes = str(execution.notes);
    out.execution = { who: execution.who, ...(notes ? { notes } : {}) };
  }

  const binding = isPlainObject(src.binding) ? src.binding : undefined;
  if (binding) {
    const notes = str(binding.notes);
    out.binding = { mode: binding.mode, ...(notes ? { notes } : {}) };
  }

  const limits = isPlainObject(src.limits) ? src.limits : undefined;
  if (limits) {
    const notes = str(limits.notes);
    const perAction = normMoney(limits.perAction);
    const perDay = normMoney(limits.perDay);
    out.limits = {
      ...(perAction ? { perAction } : {}),
      ...(perDay ? { perDay } : {}),
      enforcedAt: limits.enforcedAt,
      reservedAtGrant: normBool(limits.reservedAtGrant),
      ...(notes ? { notes } : {}),
    };
  }

  const approval = isPlainObject(src.approval) ? src.approval : undefined;
  if (approval) {
    const notes = str(approval.notes);
    const threshold = normMoney(approval.threshold);
    out.approval = { mode: approval.mode, ...(threshold ? { threshold } : {}), ...(notes ? { notes } : {}) };
  }

  const record = isPlainObject(src.record) ? src.record : undefined;
  if (record) {
    const notes = str(record.notes);
    out.record = {
      exists: normBool(record.exists),
      tamperEvident: normBool(record.tamperEvident),
      settledAmountRecorded: normBool(record.settledAmountRecorded),
      ...(notes ? { notes } : {}),
    };
  }

  const drift = isPlainObject(src.drift) ? src.drift : undefined;
  if (drift) {
    const notes = str(drift.notes);
    out.drift = { changeFrequency: drift.changeFrequency, recheck: drift.recheck, ...(notes ? { notes } : {}) };
  }

  return out as unknown as Intake;
}

// ---------- rules ----------

type Ruled = { verdict: Verdict; finding: string; question?: string };

function rule(d: Dimension, i: Intake): Ruled {
  const cap = capOf(i.limits);
  switch (d) {
    case "single-path": {
      const who = i.execution?.who ?? "unknown";
      const rawKeys = i.reach?.keysInRuntime;
      const keys = Array.isArray(rawKeys) ? rawKeys : undefined;
      if (who === "agent-calls-rail" || i.custody?.where === "agent-runtime" || (keys && keys.length > 0)) {
        let finding: string;
        if (keys && keys.length > 0) {
          const n = keys.length;
          finding = `The runtime holds ${n} payment credential${n === 1 ? "" : "s"}, so the agent can reach the rail on its own.`;
        } else if (i.custody?.where === "agent-runtime") {
          finding = "The credential lives in the agent's runtime, so the agent can reach the rail on its own whatever the executor does.";
        } else {
          finding = "The agent calls the rail itself, so nothing stands between a poisoned instruction and the money.";
        }
        return { verdict: "Exposed", finding };
      }
      if (rawKeys === "unknown" && who === "intent-to-executor") {
        return {
          verdict: "Partial",
          finding: "Execution is mediated, but whether the runtime holds a payment credential is not described.",
          question: promptFor("reach"),
        };
      }
      if (who === "intent-to-executor") {
        const paths = i.reach?.paymentPaths ?? "unknown";
        if (paths === 1) return { verdict: "Closed", finding: "Every money path funnels through one enforcement point." };
        return { verdict: "Partial", finding: paths === "unknown" ? "Execution is mediated, but the number of money paths is not described." : `Execution is mediated, but the runtime has ${paths} money paths.` };
      }
      return { verdict: "Unknown", finding: "Execution is not described.", question: promptFor("execution") };
    }
    case "custody": {
      const w = i.custody?.where ?? "unknown";
      if (w === "separate-service") return { verdict: "Closed", finding: "The credential lives behind a boundary the agent cannot read." };
      if (w === "agent-runtime") return { verdict: "Exposed", finding: "The credential sits where a compromised agent can read it." };
      return { verdict: "Unknown", finding: "Credential location is not described." };
    }
    case "mediated-execution": {
      const who = i.execution?.who ?? "unknown";
      if (who === "intent-to-executor") return { verdict: "Closed", finding: "The agent submits an intent and something else executes." };
      if (who === "agent-calls-rail") return { verdict: "Exposed", finding: "The agent calls the rail itself, so policy is advice." };
      return { verdict: "Unknown", finding: "Execution is not described." };
    }
    case "intent-binding": {
      const m = i.binding?.mode ?? "unknown";
      if (m === "bound-payee-and-amount") return { verdict: "Closed", finding: "Each approved spend is bound to an exact payee and amount." };
      if (m === "any-in-policy") return { verdict: "Exposed", finding: "The agent chooses the who and the how-much within policy." };
      return { verdict: "Unknown", finding: "Binding is not described." };
    }
    case "no-splitting": {
      const l = i.limits;
      if (!l) return { verdict: "Unknown", finding: "Limits are not described." };
      if (l.enforcedAt === "none") return { verdict: "Exposed", finding: "There is no cap to split under, and nothing stops a burst." };
      if (l.enforcedAt === "at-settlement") return { verdict: "Exposed", finding: "Caps bite only at settlement, so many small spends can clear before any of them count." };
      if (l.reservedAtGrant === false) return { verdict: "Exposed", finding: "Caps bite only at settlement, so many small spends can clear before any of them count." };
      if (l.reservedAtGrant === true && cap) return { verdict: "Closed", finding: "Budget is reserved when a spend is approved, so small spends cannot slip under the cap." };
      if (l.enforcedAt === "before-spend" && l.reservedAtGrant === "unknown") return { verdict: "Partial", finding: "Caps are checked before the spend, but reservation at approval is not described." };
      if (l.enforcedAt === "before-spend" && l.reservedAtGrant === true && !cap) return { verdict: "Partial", finding: "Budget is reserved at approval, but no cap is described." };
      return { verdict: "Unknown", finding: "Where caps are enforced is not described." };
    }
    case "human-approval": {
      const a = i.approval;
      const m = a?.mode ?? "unknown";
      if (m === "out-of-band" && a?.threshold) return { verdict: "Closed", finding: `Spends above ${formatMoney(a.threshold)} wait for a person the agent cannot impersonate.` };
      if (m === "out-of-band") return { verdict: "Partial", finding: "Approval is out of band, but the threshold is not described." };
      if (m === "in-band") return { verdict: "Exposed", finding: "The agent approves its own request." };
      if (m === "none") return { verdict: "Exposed", finding: "Large spends auto-execute." };
      return { verdict: "Unknown", finding: "Approval is not described." };
    }
    case "provable-audit": {
      const r = i.record;
      if (!r || r.exists === "unknown") return { verdict: "Unknown", finding: "The record is not described." };
      if (r.exists === false) return { verdict: "Exposed", finding: "There is no record of decisions." };
      if (r.tamperEvident === false || r.settledAmountRecorded === false) return { verdict: "Exposed", finding: r.tamperEvident === false ? "The record can be edited after the fact." : "The settled amount is not in the record." };
      if (r.tamperEvident === true && r.settledAmountRecorded === true) return { verdict: "Closed", finding: "Every decision and the settled amount sit in a tamper-evident record." };
      return { verdict: "Partial", finding: "A record exists, but its tamper evidence or the settled amount is not described." };
    }
    case "continuous-verification": {
      const c = i.drift?.recheck ?? "unknown";
      if (c === "on-change") return { verdict: "Closed", finding: "The money path is re-checked whenever the tool set changes." };
      if (c === "at-deploy") return { verdict: "Partial", finding: "The money path was verified once at deploy and the tool set can drift." };
      if (c === "never") return { verdict: "Exposed", finding: "The capability surface can drift with no re-check." };
      return { verdict: "Unknown", finding: "Re-checking is not described." };
    }
  }
}

export function blastRadius(d: Dimension, i: Intake): string {
  const cap = capOf(i.limits);
  const capText = cap ? `up to ${formatMoney(cap)}` : "unbounded, up to the balance behind the credential";
  const perActionText = i.limits?.perAction ? `${formatMoney(i.limits.perAction)} per spend` : "unbounded per spend";
  const perDayText = i.limits?.perDay ? `${formatMoney(i.limits.perDay)} per day` : "unbounded per day";
  switch (d) {
    case "single-path":
    case "custody":
    case "mediated-execution":
      return `One poisoned tool result pays any address, ${capText}, with nothing between the agent and the rail.`;
    case "intent-binding":
      return `A compromised agent hands you a perfectly in-policy request that is not what you meant, ${perActionText} and ${perDayText}.`;
    case "no-splitting": {
      if (i.limits?.perDay && i.limits?.perAction) return `Many small spends slip under ${formatMoney(i.limits.perDay)} before any of them settle, so the real cap is ${formatMoney(i.limits.perAction)} times however many spends fit inside the settlement lag.`;
      if (i.limits?.perDay) return `Many small spends slip under ${formatMoney(i.limits.perDay)} before any of them settle, so the real cap is set by the settlement lag, not the number.`;
      return "Many small spends slip through before any of them settle, unbounded.";
    }
    case "human-approval": {
      if (i.approval?.mode === "in-band") {
        return i.approval.threshold
          ? `The agent approves its own request, so the threshold of ${formatMoney(i.approval.threshold)} is advice.`
          : "The agent approves its own request and no threshold applies, so the amount is unbounded, up to the balance behind the credential.";
      }
      if (i.limits?.perDay) return `Spends of any size execute without a person, ${formatMoney(i.limits.perDay)} per day at most.`;
      if (i.limits?.perAction) return `Spends of any size execute without a person, ${formatMoney(i.limits.perAction)} per spend at most and no daily cap.`;
      return "Spends of any size execute without a person, unbounded.";
    }
    case "provable-audit":
      return "After an incident you cannot prove what moved. The log can be edited and the settled amount is not in it.";
    case "continuous-verification":
      return "A new tool or dependency can reopen a money path with no one noticing until money moves.";
  }
}

const FIX: Record<Dimension, string> = {
  "single-path": "Make one broker the only path to the rail and remove every other payment primitive from the runtime.",
  "custody": "Move the credential behind a service or signer the agent cannot read.",
  "mediated-execution": "Have the agent submit intents and let the broker execute behind the boundary.",
  "intent-binding": "Mint single-use grants bound to an exact payee and amount.",
  "no-splitting": "Reserve budget when a grant is minted, not when it settles.",
  "human-approval": "Gate spends above a threshold on an out-of-band approval.",
  "provable-audit": "Write every decision and the settled amount to a hash-chained receipt store.",
  "continuous-verification": "Re-check the money path on every tool or dependency change and alarm on drift.",
};

const SEVERITY: Dimension[] = ["single-path", "custody", "mediated-execution", "intent-binding", "human-approval", "no-splitting", "provable-audit", "continuous-verification"];

const STEPS: { closes: Dimension[]; effort: number; kind: StepKind; step: string }[] = [
  { closes: ["custody", "mediated-execution", "single-path"], effort: 3, kind: "governance-layer", step: "A payment-governance layer sits between the agent and the rail. The credential moves behind it, the agent submits intents, and the layer is the only path that can pay. Purse enforcement mode is one such layer." },
  { closes: ["intent-binding"], effort: 1, kind: "governance-layer", step: "Each approved spend is a single-use grant bound to an exact payee and amount, so an in-policy request cannot be redirected." },
  { closes: ["no-splitting"], effort: 1, kind: "governance-layer", step: "Caps are enforced before the spend and budget is reserved the moment a grant is minted, so parallel small spends cannot outrun the day's limit." },
  { closes: ["human-approval"], effort: 1, kind: "governance-layer", step: "Spends above a threshold wait for a person's approval given out of band, on a channel the agent cannot reach." },
  { closes: ["provable-audit"], effort: 1, kind: "governance-layer", step: "Every decision and the settled amount sit in a hash-chained receipt store that anyone can verify with plain SHA-256." },
  { closes: ["continuous-verification"], effort: 2, kind: "practice", step: "The money path is re-checked whenever the agent gains a tool, MCP server, or dependency, with an alarm on drift. A watcher can do the checking, the practice stays with you." },
  { closes: ["single-path"], effort: 1, kind: "hands-on", step: "The agent has exactly one payment path, through the layer, with no key, SDK, or tool in its runtime that reaches a rail on its own." },
];

function openness(verdicts: Record<Dimension, Verdict>, dims: Dimension[], exposedIf: (d: Dimension) => boolean, partialIf?: (d: Dimension) => boolean): Openness {
  const vs = dims.map((d) => verdicts[d]);
  if (dims.some((d) => exposedIf(d))) return "open";
  if (vs.includes("Partial") || dims.some((d) => partialIf?.(d))) return "partial";
  if (vs.every((v) => v === "Closed")) return "closed";
  return "unknown";
}

function cap1(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function score(rawIntake: Intake): Readout {
  const intake = normalize(rawIntake);
  const ruled = Object.fromEntries(DIMENSIONS.map((d) => [d, rule(d, intake)])) as Record<Dimension, Ruled>;
  const verdicts = Object.fromEntries(DIMENSIONS.map((d) => [d, ruled[d].verdict])) as Record<Dimension, Verdict>;

  const exposure = DIMENSIONS.map((d) => {
    const verdict = verdicts[d];
    const question = ruled[d].question ?? (verdict === "Unknown" ? promptFor(DIMENSION_QUESTION_ID[d]) : undefined);
    return { dimension: d, verdict, finding: ruled[d].finding, ...(question ? { question } : {}) };
  });

  const forgery = openness(verdicts, ["single-path", "custody", "mediated-execution"], (d) => verdicts[d] === "Exposed");
  const misdirection = openness(verdicts, ["intent-binding", "human-approval"], (d) =>
    (d === "intent-binding" && verdicts[d] === "Exposed") || (d === "human-approval" && verdicts[d] === "Exposed" && intake.approval?.mode === "in-band"),
    (d) => d === "human-approval" && verdicts[d] === "Exposed" && intake.approval?.mode === "none" && verdicts["intent-binding"] === "Closed");

  const unknowns = DIMENSIONS.filter((d) => verdicts[d] === "Unknown").length;
  const closed = (ds: Dimension[]) => ds.every((d) => verdicts[d] === "Closed");
  const noneUnknown5to8 = DIMENSIONS.slice(4).every((d) => verdicts[d] !== "Unknown");
  const noDimensionClosed = !DIMENSIONS.some((d) => verdicts[d] === "Closed");
  const noDimensionUnknown = !DIMENSIONS.some((d) => verdicts[d] === "Unknown");
  let posture: string;
  if (closed([...DIMENSIONS])) posture = "enforcement-grade";
  else if (closed(DIMENSIONS.slice(0, 4)) && noneUnknown5to8) posture = `enforcement-grade except ${DIMENSIONS.slice(4).filter((d) => verdicts[d] !== "Closed").map((d) => DIMENSION_LABEL[d].toLowerCase()).join(", ")}`;
  else if (intake.execution?.who === "agent-calls-rail" && capOf(intake.limits)) posture = `advisory with caps, forgery ${forgery} and misdirection ${misdirection}`;
  else if (noDimensionClosed && noDimensionUnknown) posture = "no controls";
  else if (unknowns >= 4) posture = "mostly unknown";
  else posture = `partial controls, forgery ${forgery} and misdirection ${misdirection}`;

  const moneyPaths: Readout["moneyPaths"] = [];
  const rawKeys = intake.reach?.keysInRuntime;
  if (Array.isArray(rawKeys)) {
    for (const k of rawKeys) moneyPaths.push({ path: `agent to rail via ${k}, unmediated`, mediated: false });
  } else if (rawKeys === "unknown") {
    moneyPaths.push({ path: "unknown, runtime credentials not described", mediated: "unknown" });
  }
  const who = intake.execution?.who ?? "unknown";
  if (who === "intent-to-executor") moneyPaths.push({ path: "agent to executor to rail, mediated", mediated: true });
  else if (who === "agent-calls-rail") moneyPaths.push({ path: "agent to rail, unmediated", mediated: false });
  else moneyPaths.push({ path: "unknown, execution not described", mediated: "unknown" });

  const topBreaches = SEVERITY.filter((d) => verdicts[d] === "Exposed").slice(0, 3).map((d) => ({ dimension: d, blastRadius: blastRadius(d, intake), fix: FIX[d] }));

  const open = new Set(DIMENSIONS.filter((d) => verdicts[d] === "Exposed" || verdicts[d] === "Partial"));
  const candidates = STEPS
    .map((s) => ({ s, gain: s.closes.filter((d) => open.has(d)).length }))
    .filter((x) => x.gain > 0)
    .sort((a, b) => b.gain / b.s.effort - a.gain / a.s.effort || b.gain - a.gain);
  const remaining = new Set(open);
  const chosen: typeof STEPS = [];
  for (const { s } of candidates) {
    if (chosen.length >= 4) break;
    if (!s.closes.some((d) => remaining.has(d))) continue;
    chosen.push(s);
    for (const d of s.closes) remaining.delete(d);
  }
  const shortestPath = chosen.map((s) => ({ step: s.step, kind: s.kind }));

  // Framing why-sentence, built from the dimensions actually open.
  const keysArr = Array.isArray(rawKeys) ? rawKeys : undefined;
  const forgeryClauses: string[] = [];
  if (keysArr && keysArr.length > 0) forgeryClauses.push("the runtime holds a payment credential");
  if (intake.custody?.where === "agent-runtime") forgeryClauses.push("the credential lives in the agent's runtime");
  if (intake.execution?.who === "agent-calls-rail") forgeryClauses.push("the agent calls the rail itself");

  const approvalNoneBound = intake.approval?.mode === "none" && verdicts["intent-binding"] === "Closed";
  const misdirectionClauses: string[] = [];
  if (intake.binding?.mode === "any-in-policy") misdirectionClauses.push("the agent chooses the who and the how-much within policy");
  if (intake.approval?.mode === "in-band") misdirectionClauses.push("the agent approves its own requests");
  if (approvalNoneBound) misdirectionClauses.push("large spends execute against bound grants without a person");

  const forgerySentence = forgeryClauses.length ? `${cap1(forgeryClauses.join(" and "))}, so a poisoned instruction can forge a spend.` : undefined;
  const misdirectionSentence = misdirectionClauses.length ? `${cap1(misdirectionClauses.join(" and "))}, so the agent can misdirect a spend it is allowed to request.` : undefined;

  let why: string;
  if (forgerySentence && misdirectionSentence) why = `${forgerySentence} ${misdirectionSentence}`;
  else if (forgerySentence) why = forgerySentence;
  else if (misdirectionSentence) why = misdirectionSentence;
  else if (forgery === "unknown" || misdirection === "unknown") why = "Not enough of the setup is described to say which is open.";
  else if (forgery === "partial" || misdirection === "partial") why = "Neither is fully open, but one side rests on something not yet closed.";
  else why = "Custody stops forgery and binding stops misdirection.";

  const lastLine = shortestPath.length > 0
    ? `Start with the first step. If you want this done for you, https://olurabian.com/work`
    : `Nothing to close from what was described. If you want it verified hands-on, https://olurabian.com/work`;

  const notes: Readout["notes"] = [];
  const noteOf = (dimension: Readout["notes"][number]["dimension"], text?: string) => { if (text?.trim()) notes.push({ dimension, text: text.trim() }); };
  noteOf("spend", intake.spend?.notes);
  noteOf("single-path", intake.reach?.notes);
  noteOf("custody", intake.custody?.notes);
  noteOf("mediated-execution", intake.execution?.notes);
  noteOf("intent-binding", intake.binding?.notes);
  noteOf("no-splitting", intake.limits?.notes);
  noteOf("human-approval", intake.approval?.notes);
  noteOf("provable-audit", intake.record?.notes);
  noteOf("continuous-verification", intake.drift?.notes);

  return { posture, moneyPaths, exposure, topBreaches, open: { forgery, misdirection, why }, shortestPath, lastLine, notes };
}
