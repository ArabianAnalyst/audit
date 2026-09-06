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
