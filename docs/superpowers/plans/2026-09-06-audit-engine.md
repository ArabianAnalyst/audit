# Audit Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@olurabian/audit`, a deterministic engine, CLI, and browser page that score an AI agent's payment setup on the eight dimensions of the Agent Payment Security Audit and produce the prompt's six-section readout with blast radius in the team's own numbers.

**Architecture:** One zero-dependency TypeScript package. `types.ts` holds the intake and readout shapes, `questions.ts` the intake schema for UIs, `money.ts` formatting, `score.ts` the rule tables, `render.ts` the three output formats, `cli.ts` the terminal entry. The deadlatch.dev page imports the published package and runs everything client-side.

**Tech Stack:** TypeScript strict, NodeNext ESM, Node 18+, `node:test` via `tsx --test`, `node:readline` for the CLI, Next.js app router for the page.

**Spec:** `docs/superpowers/specs/2026-09-06-audit-engine-design.md`

## Global Constraints

- Zero runtime dependencies. No model, no network, no telemetry in the package or the page.
- The dimensions, verdicts, framings, six sections, and voice come from the prompt at `purse/prompts/agent-payment-security-audit.md`; the rule tables in the spec are the only scoring.
- Anything not answered is `Unknown` and carries the exact intake question. Never a guess.
- Every blast-radius sentence uses the intake's own money or the word unbounded.
- Generated prose has no colons and no em dashes (URLs and money exempt); tests sweep for both.
- `score` is pure and deterministic. All import specifiers end in `.js`.
- Every repo touched ends every task with `npm run build && npm run typecheck && npm test` green.
- `.npmrc ignore-scripts=true`, an allow-scripts allowlist, CI running `npx allow-scripts`, gitleaks with the workflow token, OSV scanner.
- Versions: audit `0.1.0`. No push, no publish, no site deploy before the release tasks, which run only after ARABA confirms. Every commit ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- No counterparty names anywhere. The contact link is `https://olurabian.com/work` and nothing else.

## File structure

**audit** (new repo, branch `main`): `package.json`, `tsconfig.json`, `tsconfig.test.json`, `.npmrc`, `.gitignore`, `LICENSE`, `README.md`, `prompts/agent-payment-security-audit.md` (copied verbatim from purse), `.github/workflows/{ci,security}.yml`; `src/{types,questions,money,score,render,example,index,cli}.ts`; `test/{questions,score,render,cli}.test.ts`.

**deadlatch** (branch `audit-page`): `app/audit/page.tsx`, `components/AuditForm.tsx`, `app/globals.css` (append), `app/page.tsx` (one link).

---

### Task 1: Scaffold, types, questions

**Working directory:** `/c/Users/ARABA/Workspace/SaaS/audit`, branch `main`.

- [ ] **Step 1: Package files**

`package.json`:

```json
{
  "name": "@olurabian/audit",
  "version": "0.1.0",
  "description": "The Agent Payment Security Audit as a runnable. Can a compromised agent move money outside policy? Eight dimensions, honest Unknowns, blast radius in your own numbers.",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "bin": { "audit": "./dist/cli.js" },
  "files": ["dist", "prompts", "README.md", "LICENSE"],
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.test.json",
    "test": "tsx --test test/*.test.ts",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["ai-agents", "payments", "security", "audit", "agent-security", "deadlatch", "purse"],
  "repository": { "type": "git", "url": "git+https://github.com/ArabianAnalyst/audit.git" },
  "homepage": "https://github.com/ArabianAnalyst/audit#readme",
  "bugs": { "url": "https://github.com/ArabianAnalyst/audit/issues" },
  "license": "MIT",
  "devDependencies": {
    "@lavamoat/allow-scripts": "^5.1.0",
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  },
  "lavamoat": { "allowScripts": {} }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

`tsconfig.test.json`: `{ "extends": "./tsconfig.json", "compilerOptions": { "noEmit": true, "rootDir": "." }, "include": ["src", "test"] }`.

`.npmrc`: `ignore-scripts=true`. `.gitignore`: `node_modules`, `dist`. `LICENSE`: MIT, copyright 2026 Oluwasegun Araba (copy `../receipt/LICENSE` and keep the year). Copy `../purse/prompts/agent-payment-security-audit.md` to `prompts/` unchanged. Copy `../receipt/.github/workflows/ci.yml` and `security.yml` unchanged (they already run `npx allow-scripts` and pass `GITHUB_TOKEN` to gitleaks).

Install: `npm install --no-audit --no-fund && npx allow-scripts auto && npx allow-scripts`, then set `tsx>esbuild#<version>` to `true` in the allowlist that `auto` wrote (matching the sibling repos) and run `npx allow-scripts` once more.

- [ ] **Step 2: Types**

`src/types.ts`:

```ts
export type Money = { amount: number; currency: string };
export type Verdict = "Closed" | "Partial" | "Exposed" | "Unknown";
export type Dimension =
  | "single-path" | "custody" | "mediated-execution" | "intent-binding"
  | "no-splitting" | "human-approval" | "provable-audit" | "continuous-verification";

export const DIMENSIONS: readonly Dimension[] = [
  "single-path", "custody", "mediated-execution", "intent-binding",
  "no-splitting", "human-approval", "provable-audit", "continuous-verification",
];

export const DIMENSION_LABEL: Record<Dimension, string> = {
  "single-path": "Single path",
  "custody": "Custody",
  "mediated-execution": "Mediated execution",
  "intent-binding": "Intent-binding",
  "no-splitting": "No splitting",
  "human-approval": "Human approval",
  "provable-audit": "Provable audit",
  "continuous-verification": "Continuous verification",
};

export type Unknownable<T> = T | "unknown";

export interface Intake {
  spend?: { what: string[]; frequency: "rare" | "daily" | "continuous" | "unknown"; typical?: Money; notes?: string };
  reach?: { tools: string[]; mcpServers: string[]; keysInRuntime: string[]; paymentPaths: number | "unknown"; notes?: string };
  custody?: { where: "agent-runtime" | "separate-service" | "unknown"; notes?: string };
  execution?: { who: "agent-calls-rail" | "intent-to-executor" | "unknown"; notes?: string };
  binding?: { mode: "bound-payee-and-amount" | "any-in-policy" | "unknown"; notes?: string };
  limits?: { perAction?: Money; perDay?: Money; enforcedAt: "before-spend" | "at-settlement" | "none" | "unknown"; reservedAtGrant: boolean | "unknown"; notes?: string };
  approval?: { mode: "none" | "in-band" | "out-of-band" | "unknown"; threshold?: Money; notes?: string };
  record?: { exists: boolean | "unknown"; tamperEvident: boolean | "unknown"; settledAmountRecorded: boolean | "unknown"; notes?: string };
  drift?: { changeFrequency: "rare" | "weekly" | "daily" | "unknown"; recheck: "on-change" | "at-deploy" | "never" | "unknown"; notes?: string };
}

export type FieldKind = "choice" | "money" | "list" | "boolean" | "number" | "text";
export interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  choices?: { value: string; label: string }[];
  optional?: boolean;
}
export interface Question {
  id: keyof Intake;
  title: string;
  prompt: string;
  fields: Field[];
}

export type Openness = "open" | "partial" | "closed" | "unknown";
export type StepKind = "governance-layer" | "hosted-control-plane" | "hands-on" | "practice";

export interface Readout {
  posture: string;
  moneyPaths: { path: string; mediated: boolean | "unknown" }[];
  exposure: { dimension: Dimension; verdict: Verdict; finding: string; question?: string }[];
  topBreaches: { dimension: Dimension; blastRadius: string; fix: string }[];
  open: { forgery: Openness; misdirection: Openness; why: string };
  shortestPath: { step: string; kind: StepKind }[];
  lastLine: string;
  notes: { dimension: Dimension | "spend"; text: string }[];
}
```

- [ ] **Step 3: Failing questions test**

`test/questions.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { questions } from "../src/questions.js";

test("nine questions, one per intake field, unique ids, choices present", () => {
  assert.equal(questions.length, 9);
  const ids = questions.map((q) => q.id);
  assert.equal(new Set(ids).size, 9);
  assert.deepEqual(ids, ["spend", "reach", "custody", "execution", "binding", "limits", "approval", "record", "drift"]);
  for (const q of questions) {
    assert.ok(q.title.length > 0 && q.prompt.length > 0, q.id);
    assert.ok(q.fields.length > 0, q.id);
    for (const f of q.fields) {
      if (f.kind === "choice") assert.ok(f.choices && f.choices.length >= 2, `${q.id}.${f.key}`);
      assert.ok(!/[:—]/.test(f.label), `${q.id}.${f.key} label has a colon or em dash`);
    }
    assert.ok(!/—/.test(q.prompt), `${q.id} prompt has an em dash`);
  }
});
```

Run `npx tsx --test test/questions.test.ts` → fails at import.

- [ ] **Step 4: Questions**

`src/questions.ts`:

```ts
import type { Question } from "./types.js";

const unknown = { value: "unknown", label: "Unknown" };

export const questions: Question[] = [
  {
    id: "spend",
    title: "What the agent buys",
    prompt: "What does the agent buy, and how often? API credits, compute, data, vendors, on-chain.",
    fields: [
      { key: "what", label: "What it buys", kind: "list" },
      { key: "frequency", label: "How often", kind: "choice", choices: [
        { value: "rare", label: "Rarely, a few times a month" }, { value: "daily", label: "Daily" }, { value: "continuous", label: "Continuously, many times an hour" }, unknown] },
      { key: "typical", label: "Typical spend", kind: "money", optional: true },
    ],
  },
  {
    id: "reach",
    title: "What the runtime can reach",
    prompt: "What can the agent's runtime reach? List every tool, MCP server, SDK, and key in the agent's process.",
    fields: [
      { key: "tools", label: "Tools and SDKs", kind: "list" },
      { key: "mcpServers", label: "MCP servers", kind: "list" },
      { key: "keysInRuntime", label: "Payment credentials present in the agent's process, prompt, memory, or tools", kind: "list" },
      { key: "paymentPaths", label: "How many distinct ways the runtime can move money", kind: "number", optional: true },
    ],
  },
  {
    id: "custody",
    title: "Where the credential lives",
    prompt: "Where does the payment credential live? In the agent's process or prompt or memory, or behind a separate service or signer.",
    fields: [{ key: "where", label: "Credential location", kind: "choice", choices: [
      { value: "agent-runtime", label: "In the agent's process, prompt, memory, or tools" }, { value: "separate-service", label: "Behind a separate service or signer the agent cannot read" }, unknown] }],
  },
  {
    id: "execution",
    title: "Who executes the payment",
    prompt: "Who executes the payment? The agent calls the rail itself, or it submits an intent to something that executes.",
    fields: [{ key: "who", label: "Executor", kind: "choice", choices: [
      { value: "agent-calls-rail", label: "The agent calls the rail itself" }, { value: "intent-to-executor", label: "The agent submits an intent and something else executes behind a boundary" }, unknown] }],
  },
  {
    id: "binding",
    title: "What a grant is bound to",
    prompt: "When a spend is approved, is it bound to a specific payee and amount, or can the agent supply any in-policy value?",
    fields: [{ key: "mode", label: "Binding", kind: "choice", choices: [
      { value: "bound-payee-and-amount", label: "Bound to an exact payee and amount, single use" }, { value: "any-in-policy", label: "The agent chooses the payee and amount within policy" }, unknown] }],
  },
  {
    id: "limits",
    title: "Limits and where they bite",
    prompt: "What limits exist and where are they enforced? Per-action, daily, per-vendor. Checked before the spend or only at settlement.",
    fields: [
      { key: "perAction", label: "Cap per spend", kind: "money", optional: true },
      { key: "perDay", label: "Cap per day", kind: "money", optional: true },
      { key: "enforcedAt", label: "Where caps are checked", kind: "choice", choices: [
        { value: "before-spend", label: "Before the spend" }, { value: "at-settlement", label: "Only when the spend settles" }, { value: "none", label: "No caps" }, unknown] },
      { key: "reservedAtGrant", label: "Budget is reserved the moment a spend is approved, not when it settles", kind: "boolean" },
    ],
  },
  {
    id: "approval",
    title: "Human approval",
    prompt: "Is there human approval for large spends? None, in-band where the agent decides, or out of band where a person approves the exact spend.",
    fields: [
      { key: "mode", label: "Approval", kind: "choice", choices: [
        { value: "none", label: "None" }, { value: "in-band", label: "In-band, the agent decides" }, { value: "out-of-band", label: "Out of band, a person approves the exact spend" }, unknown] },
      { key: "threshold", label: "Approval threshold", kind: "money", optional: true },
    ],
  },
  {
    id: "record",
    title: "The record",
    prompt: "Is there a record of every decision and the amount actually settled, and can it be tampered with?",
    fields: [
      { key: "exists", label: "A record of every decision exists", kind: "boolean" },
      { key: "tamperEvident", label: "The record is tamper-evident, hash-chained or signed", kind: "boolean" },
      { key: "settledAmountRecorded", label: "The amount actually settled is in the record", kind: "boolean" },
    ],
  },
  {
    id: "drift",
    title: "Drift",
    prompt: "How often does the agent's tool or dependency set change, and is the money-path re-checked when it does?",
    fields: [
      { key: "changeFrequency", label: "How often tools or dependencies change", kind: "choice", choices: [
        { value: "rare", label: "Rarely" }, { value: "weekly", label: "Weekly" }, { value: "daily", label: "Daily or more" }, unknown] },
      { key: "recheck", label: "When the money path is re-checked", kind: "choice", choices: [
        { value: "on-change", label: "Every time the tool or dependency set changes" }, { value: "at-deploy", label: "Once, at deploy" }, { value: "never", label: "Never" }, unknown] },
    ],
  },
];
```

Every question gets an implicit `notes` text field in UIs; the CLI asks for it after the listed fields.

Run the test → passes. `npm run build && npm run typecheck && npm test`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.test.json .npmrc .gitignore LICENSE prompts .github src/types.ts src/questions.ts test/questions.test.ts
git commit -q -m "feat: scaffold @olurabian/audit with the intake types and questions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Money and the scoring engine

- [ ] **Step 1: Failing tests**

`test/score.test.ts`:

```ts
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
```

Run → fails at import.

- [ ] **Step 2: Money**

`src/money.ts`:

```ts
import type { Money } from "./types.js";

const SYMBOL: Record<string, string> = { USD: "$", GBP: "£", EUR: "€" };

export function formatMoney(m: Money): string {
  const n = m.amount.toFixed(2);
  const s = SYMBOL[m.currency.toUpperCase()];
  return s ? `${s}${n}` : `${n} ${m.currency.toUpperCase()}`;
}

/** The binding cap for blast radius: per day first, then per spend, then none. */
export function capOf(limits: { perAction?: Money; perDay?: Money } | undefined): Money | undefined {
  return limits?.perDay ?? limits?.perAction;
}
```

- [ ] **Step 3: The engine**

`src/score.ts`:

```ts
import { DIMENSIONS, DIMENSION_LABEL } from "./types.js";
import type { Dimension, Intake, Readout, Verdict, Openness, StepKind } from "./types.js";
import { formatMoney, capOf } from "./money.js";

const QUESTION: Record<Dimension, string> = {
  "single-path": "Who executes the payment, and can the agent's runtime reach a payment credential or a second payment tool?",
  "custody": "Where does the payment credential live? In the agent's process or prompt or memory, or behind a separate service or signer.",
  "mediated-execution": "Who executes the payment? The agent calls the rail itself, or it submits an intent to something that executes.",
  "intent-binding": "When a spend is approved, is it bound to a specific payee and amount, or can the agent supply any in-policy value?",
  "no-splitting": "What limits exist and where are they enforced? Is budget reserved when a spend is approved or only when it settles?",
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

function blast(d: Dimension, i: Intake): string {
  const cap = capOf(i.limits);
  const capText = cap ? `up to ${formatMoney(cap)}` : "unbounded, up to the balance behind the credential";
  const perAction = i.limits?.perAction ? formatMoney(i.limits.perAction) : "any amount";
  const perDay = i.limits?.perDay ? formatMoney(i.limits.perDay) : "any amount";
  switch (d) {
    case "single-path":
    case "custody":
    case "mediated-execution":
      return `One poisoned tool result pays any address, ${capText}, with nothing between the agent and the rail.`;
    case "intent-binding":
      return `A compromised agent hands you a perfectly in-policy request that is not what you meant, ${perAction} per spend and ${perDay} per day.`;
    case "no-splitting":
      return `Many small spends slip under ${perDay} before any of them settle, so the real cap is the per-spend limit times the settlement lag.`;
    case "human-approval":
      return i.approval?.mode === "in-band"
        ? `The agent approves its own request, so the threshold of ${i.approval.threshold ? formatMoney(i.approval.threshold) : "any size"} is advice.`
        : `Spends of any size execute without a person, ${cap ? formatMoney(cap) + " per day at most" : "unbounded"}.`;
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

function openness(verdicts: Record<Dimension, Verdict>, dims: Dimension[], exposedIf: (d: Dimension) => boolean): Openness {
  const vs = dims.map((d) => verdicts[d]);
  if (dims.some((d) => exposedIf(d))) return "open";
  if (vs.includes("Partial")) return "partial";
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
    (d === "intent-binding" && verdicts[d] === "Exposed") || (d === "human-approval" && verdicts[d] === "Exposed" && intake.approval?.mode === "in-band"));

  const unknowns = DIMENSIONS.filter((d) => verdicts[d] === "Unknown").length;
  const closed = (ds: Dimension[]) => ds.every((d) => verdicts[d] === "Closed");
  let posture: string;
  if (closed([...DIMENSIONS])) posture = "enforcement-grade";
  else if (closed(DIMENSIONS.slice(0, 4))) posture = `enforcement-grade except ${DIMENSIONS.slice(4).filter((d) => verdicts[d] !== "Closed").map((d) => DIMENSION_LABEL[d].toLowerCase()).join(", ")}`;
  else if (unknowns >= 4) posture = "mostly unknown";
  else if (intake.execution?.who === "agent-calls-rail" && capOf(intake.limits)) posture = `advisory with caps, forgery ${forgery} and misdirection ${misdirection}`;
  else if (DIMENSIONS.every((d) => verdicts[d] === "Exposed")) posture = "no controls";
  else posture = `partial controls, forgery ${forgery} and misdirection ${misdirection}`;

  const moneyPaths: Readout["moneyPaths"] = [];
  for (const k of intake.reach?.keysInRuntime ?? []) moneyPaths.push({ path: `agent to rail via ${k}, unmediated`, mediated: false });
  const who = intake.execution?.who ?? "unknown";
  if (who === "intent-to-executor") moneyPaths.push({ path: "agent to executor to rail, mediated", mediated: true });
  else if (who === "agent-calls-rail") moneyPaths.push({ path: "agent to rail, unmediated", mediated: false });
  else moneyPaths.push({ path: "unknown, execution not described", mediated: "unknown" });

  const topBreaches = SEVERITY.filter((d) => verdicts[d] === "Exposed").slice(0, 3).map((d) => ({ dimension: d, blastRadius: blast(d, intake), fix: FIX[d] }));

  const open = new Set(DIMENSIONS.filter((d) => verdicts[d] === "Exposed" || verdicts[d] === "Partial"));
  const shortestPath = STEPS
    .map((s) => ({ s, gain: s.closes.filter((d) => open.has(d)).length }))
    .filter((x) => x.gain > 0)
    .sort((a, b) => b.gain / b.s.effort - a.gain / a.s.effort || b.gain - a.gain)
    .slice(0, 4)
    .map((x) => ({ step: x.s.step, kind: x.s.kind }));
  while (shortestPath.length < 2 && shortestPath.length < STEPS.length) {
    const next = STEPS.find((s) => !shortestPath.some((p) => p.step === s.step));
    if (!next) break;
    shortestPath.push({ step: next.step, kind: next.kind });
  }

  const why = forgery === "open" && misdirection === "open"
    ? "Custody is open, so the agent can forge a payment, and binding is open, so it can misdirect one it is allowed to request."
    : forgery === "open" ? "Custody or execution is open, so a compromised agent can forge a payment it was never handed the means to make."
    : misdirection === "open" ? "Custody holds, but the agent chooses the who and the how-much within policy, so it can misdirect a spend it is allowed to request."
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
```

Run `npx tsx --test test/score.test.ts` → all pass. If the enforcement golden yields two steps other than the practice step first, check the sort (gain per effort, then lower effort) and the fixture; the fixture has only continuous-verification open, so the practice step (gain 1, effort 2) is the only step with gain and the second comes from the fill loop, which takes the first table entry. Adjust the assertion `shortestPath[0].kind === "practice"` only if the code is right and the fixture was misread; never the other way around.

- [ ] **Step 4: Commit**

```bash
git add src/money.ts src/score.ts test/score.test.ts
git commit -q -m "feat: the scoring engine, eight dimensions, blast radius in the intake's own money

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Renderers, example, index

- [ ] **Step 1: Failing test**

`test/render.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { score, render, exampleIntake } from "../src/index.js";

const SECTIONS = ["Posture", "Money-path map", "Exposure", "Top breaches", "Which is open", "Shortest path"];

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");
}

test("all three formats carry the six sections in order and nothing else before them", () => {
  const r = score(exampleIntake());
  for (const f of ["text", "markdown", "html"] as const) {
    const out = render(r, f);
    const body = f === "html" ? stripHtml(out) : out;
    let last = -1;
    for (const s of SECTIONS) { const i = body.indexOf(s); assert.ok(i > last, `${f} missing or misordered ${s}`); last = i; }
    assert.ok(body.includes("olurabian.com/work"), f);
  }
});

test("html is self-contained and theme-aware", () => {
  const html = render(score(exampleIntake()), "html");
  assert.match(html, /^<!doctype html>/i);
  assert.ok(!/<script/i.test(html));
  assert.ok(!/https?:\/\/[^"']+\.(css|js|woff2?)/i.test(html), "no external assets");
  assert.match(html, /prefers-color-scheme: dark/);
});

test("rendered prose has no colon or em dash outside URLs, money, and markup", () => {
  const r = score(exampleIntake());
  for (const f of ["text", "markdown", "html"] as const) {
    const body = (f === "html" ? stripHtml(render(r, f)) : render(r, f)).replace(/https?:\/\/\S+/g, "");
    assert.ok(!/—/.test(body), `${f} em dash`);
    assert.ok(!/:/.test(body), `${f} colon near ${body.slice(Math.max(0, body.indexOf(":") - 40), body.indexOf(":") + 40)}`);
  }
});

test("unknown dimensions render their question", () => {
  const md = render(score({}), "markdown");
  assert.match(md, /Unknown/);
  assert.match(md, /Where does the payment credential live/);
});
```

Run → fails at import (`render`, `exampleIntake` missing).

- [ ] **Step 2: Renderers**

`src/render.ts`:

```ts
import { DIMENSION_LABEL } from "./types.js";
import type { Readout } from "./types.js";

export type Format = "text" | "markdown" | "html";

const TITLES = ["Posture", "Money-path map", "Exposure", "Top breaches", "Which is open", "Shortest path"] as const;

function lines(r: Readout): { title: string; body: string[] }[] {
  return [
    { title: TITLES[0], body: [r.posture] },
    { title: TITLES[1], body: r.moneyPaths.map((p) => `${p.path} (${p.mediated === "unknown" ? "unknown" : p.mediated ? "mediated" : "unmediated"})`) },
    { title: TITLES[2], body: r.exposure.map((e) => `${DIMENSION_LABEL[e.dimension]}. ${e.verdict}. ${e.finding}${e.question ? ` Ask. ${e.question}` : ""}`) },
    { title: TITLES[3], body: r.topBreaches.length ? r.topBreaches.map((b, i) => `${i + 1}. ${DIMENSION_LABEL[b.dimension]}. ${b.blastRadius} Fix. ${b.fix}`) : ["None from what was described."] },
    { title: TITLES[4], body: [`Forgery ${r.open.forgery}, misdirection ${r.open.misdirection}. ${r.open.why}`] },
    { title: TITLES[5], body: [...r.shortestPath.map((s, i) => `${i + 1}. ${s.step} (${kindLabel(s.kind)})`), r.lastLine] },
  ];
}

function kindLabel(k: Readout["shortestPath"][number]["kind"]): string {
  return { "governance-layer": "a payment-governance layer", "hosted-control-plane": "a hosted control plane", "hands-on": "hands-on implementation", practice: "a practice you keep" }[k];
}

function notesBlock(r: Readout): string[] {
  return r.notes.map((n) => `${n.dimension === "spend" ? "Spend" : DIMENSION_LABEL[n.dimension]}. ${n.text}`);
}

export function render(r: Readout, format: Format): string {
  const secs = lines(r);
  if (format === "text") {
    const out = secs.map((s, i) => `${i + 1}. ${s.title}\n${s.body.map((b) => `   ${b}`).join("\n")}`);
    if (r.notes.length) out.push(`Notes you gave, echoed and never scored\n${notesBlock(r).map((b) => `   ${b}`).join("\n")}`);
    return out.join("\n\n") + "\n";
  }
  if (format === "markdown") {
    const out = ["# Agent Payment Security Audit", "", "Can a compromised agent move money outside policy?", ""];
    secs.forEach((s, i) => { out.push(`## ${i + 1}. ${s.title}`, "", ...s.body.map((b) => (s.title === TITLES[2] || s.title === TITLES[1] ? `- ${b}` : b)), ""); });
    if (r.notes.length) out.push("## Notes you gave, echoed and never scored", "", ...notesBlock(r).map((b) => `- ${b}`), "");
    return out.join("\n");
  }
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const link = (s: string) => esc(s).replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>');
  const verdictClass = (b: string) => (/\. Exposed\./.test(b) ? "exposed" : /\. Partial\./.test(b) ? "partial" : /\. Unknown\./.test(b) ? "unknown" : "closed");
  const body = secs.map((s, i) => `<section><h2><span class="n">${i + 1}</span>${esc(s.title)}</h2>${s.title === TITLES[2] ? `<ul>${s.body.map((b) => `<li class="${verdictClass(b)}">${link(b)}</li>`).join("")}</ul>` : s.body.map((b) => `<p>${link(b)}</p>`).join("")}</section>`).join("");
  const notes = r.notes.length ? `<section class="notes"><h2>Notes you gave, echoed and never scored</h2><ul>${notesBlock(r).map((b) => `<li>${esc(b)}</li>`).join("")}</ul></section>` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Agent Payment Security Audit</title>
<style>
:root{--bg:#f7f6f2;--ink:#161a1f;--muted:#5b6470;--line:#d9d6cc;--closed:#1f7a4d;--partial:#a3660d;--exposed:#b3261e;--unknown:#4a5563}
@media (prefers-color-scheme: dark){:root{--bg:#0b0e14;--ink:#e6ebf2;--muted:#9aa4b2;--line:#252a33;--closed:#5fd39a;--partial:#f0c060;--exposed:#ff7a6e;--unknown:#9aa4b2}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 20px 64px}
h1{font-size:1.6rem;margin:0 0 4px}.q{color:var(--muted);margin:0 0 28px}
section{border-top:1px solid var(--line);padding:18px 0}
h2{font-size:1.05rem;margin:0 0 8px}.n{display:inline-block;width:1.6em;color:var(--muted);font-variant-numeric:tabular-nums}
p,li{margin:6px 0}ul{padding-left:1.2em}
li.closed::marker{color:var(--closed)}li.partial::marker{color:var(--partial)}li.exposed::marker{color:var(--exposed)}li.unknown::marker{color:var(--unknown)}
a{color:inherit}.foot{color:var(--muted);font-size:.85rem;margin-top:28px}
</style></head><body><main>
<h1>Agent Payment Security Audit</h1><p class="q">Can a compromised agent move money outside policy?</p>
${body}${notes}
<p class="foot">Produced by @olurabian/audit. Deterministic, no model, nothing left your machine.</p>
</main></body></html>
`;
}
```

- [ ] **Step 3: Example and index**

`src/example.ts`:

```ts
import type { Intake } from "./types.js";

/** A filled intake to start from. An honest, common shape, an agent with a rail key and settlement-time caps. */
export function exampleIntake(): Intake {
  return {
    spend: { what: ["API credits", "data"], frequency: "daily", typical: { amount: 12.5, currency: "USD" }, notes: "Mostly LLM and search APIs." },
    reach: { tools: ["http", "stripe-sdk", "filesystem"], mcpServers: ["search"], keysInRuntime: ["STRIPE_SECRET_KEY"], paymentPaths: 1 },
    custody: { where: "agent-runtime" },
    execution: { who: "agent-calls-rail" },
    binding: { mode: "any-in-policy" },
    limits: { perAction: { amount: 50, currency: "USD" }, perDay: { amount: 500, currency: "USD" }, enforcedAt: "at-settlement", reservedAtGrant: false },
    approval: { mode: "in-band", threshold: { amount: 100, currency: "USD" } },
    record: { exists: true, tamperEvident: false, settledAmountRecorded: false },
    drift: { changeFrequency: "weekly", recheck: "never" },
  };
}
```

`src/index.ts`:

```ts
export { DIMENSIONS, DIMENSION_LABEL } from "./types.js";
export type { Money, Verdict, Dimension, Intake, Field, FieldKind, Question, Readout, Openness, StepKind } from "./types.js";
export { questions } from "./questions.js";
export { score } from "./score.js";
export { render } from "./render.js";
export type { Format } from "./render.js";
export { exampleIntake } from "./example.js";
export { formatMoney } from "./money.js";
```

Run the render tests → pass. `npm run build && npm run typecheck && npm test`.

- [ ] **Step 4: Commit**

```bash
git add src/render.ts src/example.ts src/index.ts test/render.test.ts
git commit -q -m "feat: text, markdown, and self-contained html renderers; example intake; public index

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: CLI and README

- [ ] **Step 1: Failing CLI test**

`test/cli.test.ts`:

```ts
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
```

This test needs `dist/cli.js`, so `npm test` must run after `npm run build`; keep the scripts as they are and run build first in each verify step (CI already builds before testing).

- [ ] **Step 2: CLI**

`src/cli.ts`:

```ts
#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { questions } from "./questions.js";
import { score } from "./score.js";
import { render } from "./render.js";
import { exampleIntake } from "./example.js";
import type { Intake, Field, Money } from "./types.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const has = (name: string) => args.includes(name);

if (has("--help") || has("-h")) {
  stdout.write(`audit. Can a compromised agent move money outside policy?

  npx @olurabian/audit                 ask the nine questions in the terminal
  npx @olurabian/audit --intake a.json score a saved intake
  --out <dir>                          also write audit.md and audit.html
  --json                               print the readout as JSON
  --example                            print an example intake to edit
`);
  process.exit(0);
}

if (has("--example")) { stdout.write(JSON.stringify(exampleIntake(), null, 2) + "\n"); process.exit(0); }

function parseMoney(s: string): Money | undefined {
  const m = s.trim().match(/^([£$€])?\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]{3})?$/);
  if (!m) return undefined;
  const sym: Record<string, string> = { "£": "GBP", "$": "USD", "€": "EUR" };
  const currency = (m[3] ?? (m[1] ? sym[m[1]] : undefined) ?? "USD").toUpperCase();
  return { amount: Number(m[2]), currency };
}

async function ask(): Promise<Intake> {
  const rl = createInterface({ input: stdin, output: stdout });
  const intake: Record<string, Record<string, unknown>> = {};
  stdout.write("\nAgent Payment Security Audit. Nine questions. Leave a line blank to mark it unknown.\n");
  try {
    for (const q of questions) {
      stdout.write(`\n${q.title}\n${q.prompt}\n`);
      const answers: Record<string, unknown> = {};
      let answered = false;
      for (const f of q.fields) {
        const v = await askField(rl, f);
        if (v !== undefined) { answers[f.key] = v; answered = true; }
        else if (f.kind === "choice") answers[f.key] = "unknown";
        else if (f.kind === "boolean" || f.kind === "number") answers[f.key] = "unknown";
        else if (f.kind === "list") answers[f.key] = [];
      }
      const notes = (await rl.question("  Notes, optional. ")).trim();
      if (notes) { answers.notes = notes; answered = true; }
      if (answered) intake[q.id] = answers;
    }
  } finally { rl.close(); }
  return intake as unknown as Intake;
}

async function askField(rl: ReturnType<typeof createInterface>, f: Field): Promise<unknown> {
  if (f.kind === "choice") {
    const cs = f.choices ?? [];
    stdout.write(`  ${f.label}\n${cs.map((c, i) => `    ${i + 1}. ${c.label}`).join("\n")}\n`);
    const a = (await rl.question("  Number. ")).trim();
    const n = Number(a);
    if (!a || !Number.isInteger(n) || n < 1 || n > cs.length) return undefined;
    const v = cs[n - 1]!.value;
    return v === "unknown" ? undefined : v;
  }
  const a = (await rl.question(`  ${f.label}${f.optional ? ", optional" : ""}. `)).trim();
  if (!a) return undefined;
  if (f.kind === "money") return parseMoney(a);
  if (f.kind === "list") return a.split(",").map((s) => s.trim()).filter(Boolean);
  if (f.kind === "boolean") return /^(y|yes|true)$/i.test(a) ? true : /^(n|no|false)$/i.test(a) ? false : undefined;
  if (f.kind === "number") { const n = Number(a); return Number.isFinite(n) ? n : undefined; }
  return a;
}

async function main(): Promise<void> {
  let intake: Intake;
  const file = flag("--intake");
  if (file) {
    try { intake = JSON.parse(readFileSync(file, "utf8")) as Intake; }
    catch (e) { process.stderr.write(`audit: cannot read intake ${file} (${(e as Error).message})\n`); process.exit(1); }
  } else {
    if (!stdin.isTTY) { process.stderr.write("audit: no --intake given and no terminal to ask in; try --example\n"); process.exit(1); }
    intake = await ask();
  }
  const readout = score(intake);
  if (has("--json")) { stdout.write(JSON.stringify(readout, null, 2) + "\n"); return; }
  stdout.write("\n" + render(readout, "text"));
  const out = flag("--out");
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "audit.md"), render(readout, "markdown"));
    writeFileSync(join(out, "audit.html"), render(readout, "html"));
    stdout.write(`\nWritten. ${join(out, "audit.md")} and ${join(out, "audit.html")}\n`);
  }
}

main().catch((e) => { process.stderr.write(`audit: ${(e as Error).message}\n`); process.exit(1); });
```

`npm run build` produces `dist/cli.js` with the shebang preserved by tsc. Then `npx tsx --test test/cli.test.ts` → 3 pass. Then `npm run typecheck && npm test`.

- [ ] **Step 3: README**

`README.md`, prose without colons or em dashes:

```markdown
# @olurabian/audit

Can a compromised agent move money outside policy?

The Agent Payment Security Audit as a runnable. Nine questions about your agent's payment setup, scored on eight dimensions, with the blast radius in your own numbers. Anything you leave out comes back as Unknown with the exact question to ask, never a guess. No model in the loop, nothing leaves your machine.

## Run it

```bash
npx @olurabian/audit
```

It asks the questions in your terminal and prints the readout. To keep a copy, add `--out ./audit` and you get `audit.md` and `audit.html`. To answer once and rerun, start from `npx @olurabian/audit --example > intake.json`, edit it, then `npx @olurabian/audit --intake intake.json`.

A browser version with the same engine lives at https://deadlatch.dev/audit. Nothing you type there leaves the page either.

## What it scores

Eight dimensions, each Closed, Partial, Exposed, or Unknown.

1. Single path. Every money path funnels through one enforcement point.
2. Custody. The credential lives where the agent cannot read it.
3. Mediated execution. The agent submits an intent and something else pays.
4. Intent-binding. Each approved spend is bound to an exact payee and amount.
5. No splitting. Budget is reserved when a spend is approved, not when it settles.
6. Human approval. Large spends wait for a person the agent cannot impersonate.
7. Provable audit. Every decision and the settled amount sit in a tamper-evident record.
8. Continuous verification. The money path is re-checked whenever the tool set changes.

Two framings come out of the score. Forgery is open when custody, single path, or mediated execution is exposed, meaning the agent can make a payment it was never handed the means to make. Misdirection is open when intent-binding is exposed or the agent approves its own spends, meaning it can hand you a perfectly in-policy request that is not what you meant.

## The readout

Six sections, in this order and nothing else. Posture in one line. The money-path map, one path per line, mediated or not. Exposure, the eight verdicts with a one-line finding and the question to ask for each Unknown. Top breaches, at most three, each with the loss in money and the fix in one line. Which is open, forgery or misdirection or both. The shortest path, two to four steps ordered by blast radius closed per unit of effort, each named plainly as a governance layer, hands-on work, or a practice you keep.

The last line is a plain next step. This is a diagnostic, not a sales tool.

## Use the engine

```js
import { questions, score, render, exampleIntake } from "@olurabian/audit";

const readout = score(exampleIntake());
console.log(render(readout, "markdown"));
```

`questions` is the intake schema, so any form can render it. `score` is pure and deterministic. `render` gives you text, Markdown, or a self-contained HTML report.

## The prompt

If you would rather use a model, the original prompt is in `prompts/agent-payment-security-audit.md`. It scores the same dimensions and follows the same rules.

## License

MIT
```

- [ ] **Step 4: Verify and commit**

`npm run build && npm run typecheck && npm test`; sweep `grep -nE "^[^\`#|].*(:|—)" README.md` and confirm every hit is inside a code block, inline code, or a URL.

```bash
git add src/cli.ts test/cli.test.ts README.md
git commit -q -m "feat: terminal audit with --intake, --out, --json, --example; README

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Gate and final review

- [ ] **Step 1:** `rm -rf node_modules dist && npm ci --no-audit --no-fund && npx allow-scripts && npm run build && npm run typecheck && npm test` in the audit repo.
- [ ] **Step 2:** Confirm no remote, nothing published (`npm view @olurabian/audit version` → 404).
- [ ] **Step 3:** Final review on the most capable model over the whole repo with the Global Constraints as the lens, with attention to whether the rule tables match the spec exactly, whether any generated sentence could name a fact the intake did not give, and whether a stranger could run it from the README.

---

### Task 6: Release the package (only after ARABA confirms)

```bash
cd /c/Users/ARABA/Workspace/SaaS/audit
gh repo create ArabianAnalyst/audit --public --description "The Agent Payment Security Audit as a runnable. Can a compromised agent move money outside policy?" --source=. --remote=origin --push
npm run build && npm run typecheck && npm test && npm pack --dry-run 2>&1 | grep -E "dist/index\.js|dist/cli\.js|prompts/" && npm publish --access public && npm view @olurabian/audit version
```

Expected `0.1.0`, CI and security green. Smoke from a clean directory: `npx @olurabian/audit --example > i.json && npx @olurabian/audit --intake i.json --out out` prints the readout and writes both files.

---

### Task 7: The page on deadlatch.dev (after Task 6)

**Working directory:** `/c/Users/ARABA/Workspace/SaaS/deadlatch`, branch `audit-page`.

- [ ] **Step 1: Install the engine**

```bash
npm install @olurabian/audit@^0.1.0 --no-audit --no-fund
```

- [ ] **Step 2: The form component**

`components/AuditForm.tsx`:

```tsx
"use client";
import { useMemo, useState } from "react";
import { questions, score, render, DIMENSION_LABEL } from "@olurabian/audit";
import type { Intake, Readout, Field } from "@olurabian/audit";

type Answers = Record<string, Record<string, string>>;

function toIntake(a: Answers): Intake {
  const out: Record<string, Record<string, unknown>> = {};
  for (const q of questions) {
    const raw = a[q.id] ?? {};
    const obj: Record<string, unknown> = {};
    let any = false;
    for (const f of q.fields) {
      const v = (raw[f.key] ?? "").trim();
      if (f.kind === "choice") { obj[f.key] = v || "unknown"; if (v) any = true; }
      else if (f.kind === "list") { obj[f.key] = v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []; if (v) any = true; }
      else if (f.kind === "boolean") { obj[f.key] = v === "yes" ? true : v === "no" ? false : "unknown"; if (v) any = true; }
      else if (f.kind === "number") { obj[f.key] = v ? Number(v) : "unknown"; if (v) any = true; }
      else if (f.kind === "money") { const m = v.match(/^([£$€])?\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]{3})?$/); if (m) { const sym: Record<string, string> = { "£": "GBP", "$": "USD", "€": "EUR" }; obj[f.key] = { amount: Number(m[2]), currency: (m[3] ?? (m[1] ? sym[m[1]] : undefined) ?? "USD").toUpperCase() }; any = true; } }
      else if (v) { obj[f.key] = v; any = true; }
    }
    const notes = (raw.notes ?? "").trim();
    if (notes) { obj.notes = notes; any = true; }
    if (any) out[q.id] = obj;
  }
  return out as unknown as Intake;
}

function FieldInput({ q, f, value, onChange }: { q: string; f: Field; value: string; onChange: (v: string) => void }) {
  const id = `${q}-${f.key}`;
  if (f.kind === "choice") {
    return (
      <label className="af-field" htmlFor={id}>
        <span>{f.label}</span>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Unknown</option>
          {(f.choices ?? []).filter((c) => c.value !== "unknown").map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
    );
  }
  if (f.kind === "boolean") {
    return (
      <label className="af-field" htmlFor={id}>
        <span>{f.label}</span>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
        </select>
      </label>
    );
  }
  const hint = f.kind === "money" ? "for example $50 or 50 GBP" : f.kind === "list" ? "comma separated" : f.kind === "number" ? "a number" : "";
  return (
    <label className="af-field" htmlFor={id}>
      <span>{f.label}{f.optional ? ", optional" : ""}</span>
      <input id={id} value={value} placeholder={hint} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export default function AuditForm() {
  const [answers, setAnswers] = useState<Answers>({});
  const [readout, setReadout] = useState<Readout | null>(null);
  const [copied, setCopied] = useState(false);
  const set = (q: string, k: string, v: string) => setAnswers((a) => ({ ...a, [q]: { ...(a[q] ?? {}), [k]: v } }));
  const intake = useMemo(() => toIntake(answers), [answers]);

  const run = () => { setReadout(score(intake)); setCopied(false); };
  const copyMd = async () => { if (!readout) return; await navigator.clipboard.writeText(render(readout, "markdown")); setCopied(true); };
  const saveHtml = () => {
    if (!readout) return;
    const blob = new Blob([render(readout, "html")], { type: "text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "agent-payment-security-audit.html"; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="af">
      <form className="af-form" onSubmit={(e) => { e.preventDefault(); run(); }}>
        {questions.map((q, i) => (
          <fieldset key={q.id} className="af-q">
            <legend><span className="mono">{String(i + 1).padStart(2, "0")}</span> {q.title}</legend>
            <p className="af-prompt">{q.prompt}</p>
            {q.fields.map((f) => <FieldInput key={f.key} q={q.id} f={f} value={answers[q.id]?.[f.key] ?? ""} onChange={(v) => set(q.id, f.key, v)} />)}
            <label className="af-field" htmlFor={`${q.id}-notes`}><span>Notes, optional. Echoed in the report, never scored.</span>
              <input id={`${q.id}-notes`} value={answers[q.id]?.notes ?? ""} onChange={(e) => set(q.id, "notes", e.target.value)} /></label>
          </fieldset>
        ))}
        <div className="af-actions">
          <button type="submit" className="btn">Score it</button>
          <span className="af-note">Runs in your browser. Nothing you type leaves this page.</span>
        </div>
      </form>

      {readout && (
        <section className="af-readout" aria-live="polite">
          <div className="af-tools">
            <button type="button" className="btn" onClick={copyMd}>{copied ? "Copied" : "Copy as Markdown"}</button>
            <button type="button" className="btn" onClick={saveHtml}>Save as HTML</button>
          </div>
          <h3><span className="mono">1</span> Posture</h3><p>{readout.posture}</p>
          <h3><span className="mono">2</span> Money-path map</h3>
          <ul>{readout.moneyPaths.map((p, i) => <li key={i}>{p.path}</li>)}</ul>
          <h3><span className="mono">3</span> Exposure</h3>
          <ul className="af-exposure">{readout.exposure.map((e) => (
            <li key={e.dimension} className={e.verdict.toLowerCase()}><b>{DIMENSION_LABEL[e.dimension]}.</b> <span className="af-verdict">{e.verdict}.</span> {e.finding}{e.question ? <span className="af-ask"> Ask. {e.question}</span> : null}</li>
          ))}</ul>
          <h3><span className="mono">4</span> Top breaches</h3>
          {readout.topBreaches.length ? <ol>{readout.topBreaches.map((b) => <li key={b.dimension}><b>{DIMENSION_LABEL[b.dimension]}.</b> {b.blastRadius} <span className="af-fix">Fix. {b.fix}</span></li>)}</ol> : <p>None from what was described.</p>}
          <h3><span className="mono">5</span> Which is open</h3>
          <p>Forgery {readout.open.forgery}, misdirection {readout.open.misdirection}. {readout.open.why}</p>
          <h3><span className="mono">6</span> Shortest path</h3>
          <ol>{readout.shortestPath.map((s, i) => <li key={i}>{s.step}</li>)}</ol>
          <p className="af-last">{readout.lastLine.replace(/https?:\/\/\S+/, "")}<a href="https://olurabian.com/work">olurabian.com/work</a></p>
          {readout.notes.length > 0 && (<><h3>Notes you gave</h3><ul>{readout.notes.map((n, i) => <li key={i}>{n.text}</li>)}</ul></>)}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: The page and the link**

`app/audit/page.tsx`:

```tsx
import type { Metadata } from "next";
import AuditForm from "@/components/AuditForm";

export const metadata: Metadata = {
  title: "Agent Payment Security Audit — Deadlatch",
  description: "Can a compromised agent move money outside policy? Nine questions, eight dimensions, blast radius in your own numbers. Runs in your browser, nothing leaves the page.",
  alternates: { canonical: "https://deadlatch.dev/audit" },
};

export default function AuditPage() {
  return (
    <main className="wrap logwrap">
      <header className="log-hd">
        <div className="eyebrow">Agent Payment Security Audit</div>
        <h1>Can a compromised agent move money outside policy?</h1>
        <p>Nine questions about your agent's payment setup, scored on eight dimensions. Anything you leave out comes back as Unknown with the exact question to ask. The blast radius is in your own numbers. This is a diagnostic, not a sales tool.</p>
        <p className="mono af-cli">npx @olurabian/audit</p>
      </header>
      <AuditForm />
    </main>
  );
}
```

In `app/page.tsx`, inside the `#audit` section's `sec-head` block after the `<p>`, add:

```tsx
          <p><a className="ghlink" href="/audit">Run the free audit on your own setup →</a></p>
```

Append to `app/globals.css`:

```css
/* audit page */
.af-cli{margin-top:10px;font-size:.9rem;opacity:.85}
.af-form{display:grid;gap:18px;margin-top:8px}
.af-q{border:1px solid var(--line, #252a33);border-radius:12px;padding:16px 18px;margin:0}
.af-q legend{font-weight:600;padding:0 6px}
.af-prompt{margin:4px 0 10px;opacity:.8}
.af-field{display:grid;gap:4px;margin:8px 0;font-size:.92rem}
.af-field input,.af-field select{font:inherit;padding:8px 10px;border-radius:8px;border:1px solid var(--line, #252a33);background:transparent;color:inherit}
.af-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.af-note{opacity:.75;font-size:.9rem}
.af-readout{margin-top:32px;border-top:1px solid var(--line, #252a33);padding-top:18px}
.af-readout h3{margin:18px 0 6px;font-size:1.02rem}
.af-readout h3 .mono{opacity:.6;margin-right:8px}
.af-tools{display:flex;gap:10px;flex-wrap:wrap}
.af-exposure li{margin:6px 0}
.af-exposure li.exposed .af-verdict{color:#ff7a6e}.af-exposure li.partial .af-verdict{color:#f0c060}.af-exposure li.closed .af-verdict{color:#5fd39a}.af-exposure li.unknown .af-verdict{opacity:.7}
.af-ask,.af-fix{opacity:.8}
.af-last{margin-top:14px}
```

If the site's CSS variable for hairlines has a different name than `--line`, use the site's name (read the top of `globals.css`) and drop the fallback.

- [ ] **Step 4: Verify and commit**

`npm run build && npm run lint` in the deadlatch repo. Open `/audit` in `next dev` if possible and score the example (fill a couple of fields); confirm the readout renders and both buttons work.

```bash
git add app/audit/page.tsx components/AuditForm.tsx app/globals.css app/page.tsx package.json package-lock.json
git commit -q -m "feat(site): the Agent Payment Security Audit, run in the browser

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: Deploy (only after ARABA confirms):** merge to main, `vercel deploy --prod --yes`, then load https://deadlatch.dev/audit and score the example end to end.

## Self-review

**Spec coverage.** Package exports and CLI flags (Tasks 1, 3, 4). Intake with nine fields and notes (Task 1). Every scoring rule, framing, blast-radius template, posture line, money map, top breaches, shortest path, and last line (Task 2). Three renderers with the six sections and the voice sweep (Task 3). Web page with client-side engine, two buttons, the nothing-leaves note, and the home link (Task 7). Tests as specified (Tasks 1 to 4). Supply chain (Task 1). Non-goals untouched.

**Placeholder scan.** No TBD. Every code step carries its code. The one conditional in Task 7 (the CSS variable name) names the file to read.

**Type consistency.** `Readout.notes[].dimension` is `Dimension | "spend"` in `types.ts`, `score.ts`, `render.ts`, and the form. `Field.kind` values match between `questions.ts`, the CLI's `askField`, and the form's `toIntake`. `render`'s `Format` is exported from the index. `exampleIntake()` scores as `advisory with caps` because it mirrors the advisory fixture in `score.test.ts`, which the CLI test relies on.
