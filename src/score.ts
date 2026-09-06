import { DIMENSIONS, DIMENSION_LABEL } from "./types.js";
import type { Dimension, Intake, Readout, Verdict, Openness, StepKind } from "./types.js";
import { formatMoney, capOf } from "./money.js";

const QUESTION: Record<Dimension, string> = {
  "single-path": "What can the agent's runtime reach? List every tool, MCP server, SDK, and key in the agent's process.",
  "custody": "Where does the payment credential live? In the agent's process or prompt or memory, or behind a separate service or signer.",
  "mediated-execution": "Who executes the payment? The agent calls the rail itself, or it submits an intent to something that executes.",
  "intent-binding": "When a spend is approved, is it bound to a specific payee and amount, or can the agent supply any in-policy value?",
  "no-splitting": "What limits exist and where are they enforced? Per-action, daily, per-vendor. Checked before the spend or only at settlement.",
  "human-approval": "Is there human approval for large spends? None, in-band where the agent decides, or out of band where a person approves the exact spend.",
  "provable-audit": "Is there a record of every decision and the amount actually settled, and can it be tampered with?",
  "continuous-verification": "How often does the agent's tool or dependency set change, and is the money-path re-checked when it does?",
};

type Ruled = { verdict: Verdict; finding: string };

function rule(d: Dimension, i: Intake): Ruled {
  const cap = capOf(i.limits);
  switch (d) {
    case "single-path": {
      const who = i.execution?.who ?? "unknown";
      const keys = i.reach?.keysInRuntime ?? [];
      if (who === "agent-calls-rail" || i.custody?.where === "agent-runtime" || keys.length > 0) {
        return { verdict: "Exposed", finding: keys.length > 0 ? `The runtime holds ${keys.length === 1 ? "a payment credential" : `${keys.length} payment credentials`}, so there is no single enforcement point.` : "The agent can reach the rail without an enforcement point in front of it." };
      }
      if (who === "intent-to-executor") {
        const paths = i.reach?.paymentPaths ?? "unknown";
        if (paths === 1) return { verdict: "Closed", finding: "Every money path funnels through one enforcement point." };
        return { verdict: "Partial", finding: paths === "unknown" ? "Execution is mediated, but the number of money paths is not described." : `Execution is mediated, but the runtime has ${paths} money paths.` };
      }
      return { verdict: "Unknown", finding: "Execution is not described." };
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
      if (l.reservedAtGrant === true && cap) return { verdict: "Closed", finding: "Budget is reserved when a spend is approved, so small spends cannot slip under the cap." };
      if (l.reservedAtGrant === true && !cap) return { verdict: "Partial", finding: "Budget is reserved at approval, but no cap is described." };
      if (l.enforcedAt === "none") return { verdict: "Exposed", finding: "There is no cap to split under, and nothing stops a burst." };
      if (l.enforcedAt === "at-settlement" || l.reservedAtGrant === false) return { verdict: "Exposed", finding: "Caps bite only at settlement, so many small spends can clear before any of them count." };
      if (l.enforcedAt === "before-spend") return { verdict: "Partial", finding: "Caps are checked before the spend, but reservation at approval is not described." };
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
    case "no-splitting":
      return i.limits?.perDay
        ? `Many small spends slip under ${formatMoney(i.limits.perDay)} before any of them settle, so the real cap is the per-spend limit times the settlement lag.`
        : "Many small spends slip through with no daily cap at all, unbounded, up to the balance behind the credential.";
    case "human-approval":
      if (i.approval?.mode === "in-band") {
        return i.approval.threshold
          ? `The agent approves its own request, so the threshold of ${formatMoney(i.approval.threshold)} is advice.`
          : "The agent approves its own request and no threshold applies, so the amount is unbounded, up to the balance behind the credential.";
      }
      return `Spends of any size execute without a person, ${cap ? formatMoney(cap) + " per day at most" : "unbounded"}.`;
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
  { closes: ["custody", "mediated-execution", "single-path"], effort: 3, kind: "governance-layer", step: "Put a payment-governance layer between the agent and the rail. The credential moves behind it, the agent submits intents, and the layer is the only path that can pay. Purse enforcement mode is one such layer." },
  { closes: ["intent-binding", "no-splitting"], effort: 2, kind: "governance-layer", step: "Have the layer mint single-use grants bound to an exact payee and amount, and reserve budget the moment a grant is minted rather than when it settles." },
  { closes: ["human-approval"], effort: 1, kind: "governance-layer", step: "Gate spends above a threshold on an approval a person gives out of band, on a channel the agent cannot reach." },
  { closes: ["provable-audit"], effort: 1, kind: "governance-layer", step: "Write every decision and the settled amount to a hash-chained receipt store that anyone can verify with plain SHA-256." },
  { closes: ["continuous-verification"], effort: 2, kind: "practice", step: "Re-check the money path whenever the agent gains a tool, MCP server, or dependency, and alarm on drift. A watcher can do the checking, the practice stays with you." },
  { closes: ["single-path"], effort: 1, kind: "hands-on", step: "Remove every second payment path from the agent's runtime, keys, SDKs, and tools included." },
];

function openness(verdicts: Record<Dimension, Verdict>, dims: Dimension[], exposedIf: (d: Dimension) => boolean, partialIf?: (d: Dimension) => boolean): Openness {
  const vs = dims.map((d) => verdicts[d]);
  if (dims.some((d) => exposedIf(d))) return "open";
  if (vs.includes("Partial") || dims.some((d) => partialIf?.(d))) return "partial";
  if (vs.every((v) => v === "Closed")) return "closed";
  return "unknown";
}

export function score(intake: Intake): Readout {
  const ruled = Object.fromEntries(DIMENSIONS.map((d) => [d, rule(d, intake)])) as Record<Dimension, Ruled>;
  const verdicts = Object.fromEntries(DIMENSIONS.map((d) => [d, ruled[d].verdict])) as Record<Dimension, Verdict>;

  const exposure = DIMENSIONS.map((d) => ({
    dimension: d,
    verdict: verdicts[d],
    finding: ruled[d].finding,
    ...(verdicts[d] === "Unknown" ? { question: QUESTION[d] } : {}),
  }));

  const forgery = openness(verdicts, ["single-path", "custody", "mediated-execution"], (d) => verdicts[d] === "Exposed");
  const misdirection = openness(verdicts, ["intent-binding", "human-approval"], (d) =>
    (d === "intent-binding" && verdicts[d] === "Exposed") || (d === "human-approval" && verdicts[d] === "Exposed" && intake.approval?.mode === "in-band"),
    (d) => d === "human-approval" && verdicts[d] === "Exposed" && intake.approval?.mode === "none" && verdicts["intent-binding"] === "Closed");
  const approvalNoneOpen = intake.approval?.mode === "none" && verdicts["human-approval"] === "Exposed" && verdicts["intent-binding"] === "Closed";

  const unknowns = DIMENSIONS.filter((d) => verdicts[d] === "Unknown").length;
  const closed = (ds: Dimension[]) => ds.every((d) => verdicts[d] === "Closed");
  let posture: string;
  if (closed([...DIMENSIONS])) posture = "enforcement-grade";
  else if (closed(DIMENSIONS.slice(0, 4))) posture = `enforcement-grade except ${DIMENSIONS.slice(4).filter((d) => verdicts[d] !== "Closed").map((d) => DIMENSION_LABEL[d].toLowerCase()).join(", ")}`;
  else if (intake.execution?.who === "agent-calls-rail" && capOf(intake.limits)) posture = `advisory with caps, forgery ${forgery} and misdirection ${misdirection}`;
  else if (DIMENSIONS.every((d) => verdicts[d] === "Exposed")) posture = "no controls";
  else if (unknowns >= 4) posture = "mostly unknown";
  else posture = `partial controls, forgery ${forgery} and misdirection ${misdirection}`;

  const moneyPaths: Readout["moneyPaths"] = [];
  for (const k of intake.reach?.keysInRuntime ?? []) moneyPaths.push({ path: `agent to rail via ${k}, unmediated`, mediated: false });
  const who = intake.execution?.who ?? "unknown";
  if (who === "intent-to-executor") moneyPaths.push({ path: "agent to executor to rail, mediated", mediated: true });
  else if (who === "agent-calls-rail") moneyPaths.push({ path: "agent to rail, unmediated", mediated: false });
  else moneyPaths.push({ path: "unknown, execution not described", mediated: "unknown" });

  const topBreaches = SEVERITY.filter((d) => verdicts[d] === "Exposed").slice(0, 3).map((d) => ({ dimension: d, blastRadius: blastRadius(d, intake), fix: FIX[d] }));

  const open = new Set(DIMENSIONS.filter((d) => verdicts[d] === "Exposed" || verdicts[d] === "Partial"));
  const shortestPath = STEPS
    .map((s) => ({ s, gain: s.closes.filter((d) => open.has(d)).length }))
    .filter((x) => x.gain > 0)
    .sort((a, b) => b.gain / b.s.effort - a.gain / a.s.effort || b.gain - a.gain)
    .slice(0, 4)
    .map((x) => ({ step: x.s.step, kind: x.s.kind }));

  const why = forgery === "open" && misdirection === "open"
    ? "Custody is open, so the agent can forge a payment, and binding is open, so it can misdirect one it is allowed to request."
    : forgery === "open" ? "Custody or execution is open, so a compromised agent can forge a payment it was never handed the means to make."
    : misdirection === "open" ? "Custody holds, but the agent chooses the who and the how-much within policy, so it can misdirect a spend it is allowed to request."
    : misdirection === "partial" && approvalNoneOpen ? "Binding holds, but large spends execute without a person, so a bound request can still be one you would have stopped."
    : forgery === "unknown" || misdirection === "unknown" ? "Not enough of the setup is described to say which is open."
    : forgery === "partial" || misdirection === "partial" ? "Neither is fully open, but one side rests on something not yet closed."
    : "Custody stops forgery and binding stops misdirection.";

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
