# Agent Payment Security Audit, runnable (approved 2026-09-06)

## Goal

Turn the eight-dimension diagnostic that lives as a prompt in the Purse repo into something a team can run without a model: a deterministic scoring engine, a CLI, and a page on deadlatch.dev where the form and the engine run in the browser. Phase 0 of the Deadlatch roadmap, item "Productise the Agent Payment Security Audit". Free to run, paid to fix.

Decisions taken by ARABA on 2026-09-06: **deterministic engine with a CLI and a web page** (evidence collectors and live probes later); **contact line, no capture** (the readout ends with the first step of the shortest path and one sentence offering to do it, linking to https://olurabian.com/work).

The prompt is the source of truth for the dimensions, the four verdicts, the two framings, the six-section readout, and the voice. The engine must produce the same readout a careful model would, minus the guessing.

## The question

Can a compromised agent move money outside policy? A compromised agent means one hit by prompt injection, a poisoned tool result, or a jailbroken instruction. The engine shows whether a dishonest agent can still be stopped.

## Package

`@olurabian/audit` in a new public repo `ArabianAnalyst/audit`. Zero runtime dependencies, ESM, Node 18 or newer, TypeScript strict, `node:test`. Same supply-chain posture as the other repos (`.npmrc ignore-scripts=true`, an allow-scripts allowlist, gitleaks with the workflow token, OSV scanner).

Exports:

```ts
export const questions: Question[];                 // the intake schema, for any UI
export function score(intake: Intake): Readout;     // deterministic
export function render(readout: Readout, format: "text" | "markdown" | "html"): string;
export function exampleIntake(): Intake;            // a filled example to start from
export type { Intake, Readout, Question, Verdict, Dimension, Money };
```

CLI `npx @olurabian/audit`: interactive questions in the terminal (`node:readline`), or `--intake answers.json`; prints the text readout; `--out <dir>` writes `audit.md` and `audit.html`; `--json` prints the readout object; `--example` prints an example intake to edit.

## Intake

Nine structured fields. The prompt asks eight questions and scores eight dimensions, but intent-binding is scored without being asked, so it gets its own field. Every field carries an optional `notes` string that is echoed in the report and never scored. A field left out scores Unknown.

```ts
type Money = { amount: number; currency: string };   // major units, e.g. 50 USD

interface Intake {
  spend?:     { what: string[]; frequency: "rare" | "daily" | "continuous" | "unknown"; typical?: Money; notes?: string };
  reach?:     { tools: string[]; mcpServers: string[]; keysInRuntime: string[]; paymentPaths: number | "unknown"; notes?: string };
  custody?:   { where: "agent-runtime" | "separate-service" | "unknown"; notes?: string };
  execution?: { who: "agent-calls-rail" | "intent-to-executor" | "unknown"; notes?: string };
  binding?:   { mode: "bound-payee-and-amount" | "any-in-policy" | "unknown"; notes?: string };
  limits?:    { perAction?: Money; perDay?: Money; enforcedAt: "before-spend" | "at-settlement" | "none" | "unknown"; reservedAtGrant: boolean | "unknown"; notes?: string };
  approval?:  { mode: "none" | "in-band" | "out-of-band" | "unknown"; threshold?: Money; notes?: string };
  record?:    { exists: boolean | "unknown"; tamperEvident: boolean | "unknown"; settledAmountRecorded: boolean | "unknown"; notes?: string };
  drift?:     { changeFrequency: "rare" | "weekly" | "daily" | "unknown"; recheck: "on-change" | "at-deploy" | "never" | "unknown"; notes?: string };
}
```

`questions` describes each field for a UI: id, the question in the prompt's words, the choices with plain labels, which sub-fields are money, and the note prompt.

## Scoring

Verdicts are `Closed`, `Partial`, `Exposed`, `Unknown`. Rules, one dimension at a time. "Cap" below means `limits.perDay`, falling back to `limits.perAction`, falling back to none.

1. **Single path.** Exposed when `execution.who` is `agent-calls-rail`, or `custody.where` is `agent-runtime`, or `reach.keysInRuntime` is non-empty. Otherwise Closed when `execution.who` is `intent-to-executor` and `reach.paymentPaths` is 1. Partial when `intent-to-executor` and `paymentPaths` is above 1 or unknown. Unknown when `execution` is missing or unknown.
2. **Custody.** Closed `separate-service`. Exposed `agent-runtime`. Unknown otherwise.
3. **Mediated execution.** Closed `intent-to-executor`. Exposed `agent-calls-rail`. Unknown otherwise.
4. **Intent-binding.** Closed `bound-payee-and-amount`. Exposed `any-in-policy`. Unknown otherwise.
5. **No splitting.** Closed when `reservedAtGrant` is true and a cap exists. Exposed when `enforcedAt` is `none`, or `at-settlement`, or `reservedAtGrant` is false. Partial when `enforcedAt` is `before-spend` and `reservedAtGrant` is unknown. Unknown otherwise.
6. **Human approval.** Closed when `out-of-band` with a threshold. Partial when `out-of-band` without a threshold. Exposed when `in-band` or `none`. Unknown otherwise.
7. **Provable audit.** Closed when `exists`, `tamperEvident`, and `settledAmountRecorded` are all true. Exposed when `exists` is false, or `tamperEvident` is false, or `settledAmountRecorded` is false. Partial when `exists` is true and either of the others is unknown. Unknown when `exists` is unknown.
8. **Continuous verification.** Closed `on-change`. Partial `at-deploy`. Exposed `never`. Unknown otherwise.

Each Unknown carries the exact intake question to ask, in the prompt's words.

**Framings.** Forgery is open when any of dimensions 1, 2, 3 is Exposed; partially open when any is Partial and none Exposed; closed when all three Closed; unknown otherwise. Misdirection is open when dimension 4 is Exposed or dimension 6 is Exposed with mode `in-band`; partially open when 4 or 6 is Partial; closed when both Closed; unknown otherwise.

**Blast radius.** Every Exposed or Partial dimension gets one sentence in money, built from the intake's own numbers. With no cap at all the sentence says unbounded, up to the balance behind the credential. Templates, rendered without colons or em dashes:

- Single path, custody, mediated execution. "One poisoned tool result pays any address, up to {cap} with nothing between the agent and the rail."
- Intent-binding. "A compromised agent hands you a perfectly in-policy request that is not what you meant, {perAction} per spend and {perDay} per day."
- No splitting. "Many small spends slip under {perDay} before any of them settle, so the real cap is the per-spend limit times the settlement lag."
- Human approval. `none`: "Spends of any size execute without a person, {cap} per day at most." `in-band`: "The agent approves its own request, so the threshold of {threshold} is advice."
- Provable audit. "After an incident you cannot prove what moved. The log can be edited and the settled amount is not in it."
- Continuous verification. "A new tool or dependency can reopen a money path with no one noticing until money moves."

**Posture line.** `enforcement-grade` when dimensions 1 to 7 are Closed. `enforcement-grade except {names}` when 1 to 4 are Closed and something else is not. `advisory with caps` when execution is `agent-calls-rail` and a cap exists. `no controls` when nothing is Closed and nothing is Unknown. `mostly unknown` when four or more are Unknown. Otherwise `partial controls, {open framing} open`.

**Money-path map.** One line per path. Each entry in `reach.keysInRuntime` is "agent to rail via {key}, unmediated". `execution.who` `intent-to-executor` adds "agent to executor to rail, mediated". `agent-calls-rail` adds "agent to rail, unmediated". Unknown execution adds "unknown, execution not described".

**Top breaches.** Exposed dimensions in the fixed severity order 1, 2, 3, 4, 6, 5, 7, 8, at most three, each with its blast-radius sentence and a one-line fix.

**Shortest path.** From a fixed table keyed by the open dimensions, each step with an effort weight and the set of dimensions it closes, ordered by dimensions closed per unit of effort, two to four steps. Each step names its kind plainly: a payment-governance layer, a hosted control plane, or hands-on implementation. The final line is the first step and then one sentence, "If you want this done for you, https://olurabian.com/work".

## Readout

```ts
interface Readout {
  posture: string;
  moneyPaths: { path: string; mediated: boolean | "unknown" }[];
  exposure: { dimension: Dimension; verdict: Verdict; finding: string; question?: string }[];
  topBreaches: { dimension: Dimension; blastRadius: string; fix: string }[];
  open: { forgery: "open" | "partial" | "closed" | "unknown"; misdirection: "open" | "partial" | "closed" | "unknown"; why: string };
  shortestPath: { step: string; kind: "governance-layer" | "hosted-control-plane" | "hands-on" | "practice" }[];
  lastLine: string;
  notes: { dimension: Dimension; text: string }[];   // echoed, never scored
}
```

`render` produces the six sections in the prompt's order and nothing else, in three formats. Text for the terminal. Markdown for a file or a paste. HTML as one self-contained file with inline styles, light and dark by `prefers-color-scheme`, a system font stack, no external requests. Generated prose contains no colons and no em dashes; the tests sweep for both.

## Web

`deadlatch.dev/audit`. A client component renders `questions` as a form, runs `score` in the browser, and renders the `Readout` object as React elements (never HTML injection). Two buttons, copy as Markdown and save as HTML, both from `render`. A line under the form states that nothing leaves the browser. The page uses the site's existing type and layout tokens and links from the home page's audit section.

## Tests

Golden intakes with snapshot readouts for three postures: advisory with caps, enforcement-grade except continuous verification, everything unknown. Property tests: every Unknown carries its question; every blast-radius sentence contains a number from the intake or the word unbounded; the rendered prose in all three formats has no colon or em dash; `score` is pure (same intake, same readout). CLI tests run the built binary with `--intake` and `--json`.

## Non-goals

Evidence collectors (repo scan, running-broker probe), email capture, a model in the loop, localisation, and any scoring beyond the prompt's rules.
