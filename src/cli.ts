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
  --help                               print this list
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

const BLANK = Symbol("blank");
const INVALID = Symbol("invalid");
type AskResult = unknown | typeof BLANK | typeof INVALID;

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
        if (v === INVALID) {
          stdout.write("  Not a valid answer, marked unknown.\n");
          if (f.kind === "choice" || f.kind === "boolean" || f.kind === "number") answers[f.key] = "unknown";
          // money: left absent, as today. list and text never produce INVALID.
        } else if (v === BLANK) {
          if (f.kind === "choice" || f.kind === "boolean" || f.kind === "number" || f.kind === "list") answers[f.key] = "unknown";
          // money and text: left absent.
        } else {
          answers[f.key] = v;
          answered = true;
        }
      }
      const notes = (await rl.question("  Notes, optional. ")).trim();
      if (notes) { answers.notes = notes; answered = true; }
      if (answered) intake[q.id] = answers;
    }
  } finally { rl.close(); }
  return intake as unknown as Intake;
}

async function askField(rl: ReturnType<typeof createInterface>, f: Field): Promise<AskResult> {
  if (f.kind === "choice") {
    const cs = f.choices ?? [];
    stdout.write(`  ${f.label}\n${cs.map((c, i) => `    ${i + 1}. ${c.label}`).join("\n")}\n`);
    const a = (await rl.question("  Number. ")).trim();
    if (!a) return BLANK;
    const n = Number(a);
    if (!Number.isInteger(n) || n < 1 || n > cs.length) return INVALID;
    const v = cs[n - 1]!.value;
    return v === "unknown" ? BLANK : v;
  }
  const a = (await rl.question(`  ${f.label}${f.optional ? ", optional" : ""}. `)).trim();
  if (!a) return BLANK;
  if (f.kind === "money") { const m = parseMoney(a); return m ?? INVALID; }
  if (f.kind === "list") return a.split(",").map((s) => s.trim()).filter(Boolean);
  if (f.kind === "boolean") { if (/^(y|yes|true)$/i.test(a)) return true; if (/^(n|no|false)$/i.test(a)) return false; return INVALID; }
  if (f.kind === "number") { const n = Number(a); return Number.isFinite(n) ? n : INVALID; }
  return a;
}

async function main(): Promise<void> {
  let intake: Intake;
  if (has("--intake")) {
    const file = flag("--intake");
    if (!file) { process.stderr.write("audit: --intake needs a file path\n"); process.exit(1); }
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("expected a JSON object with the intake fields");
      intake = parsed as Intake;
    }
    catch (e) { process.stderr.write(`audit: cannot read intake ${file} (${(e as Error).message})\n`); process.exit(1); }
  } else {
    if (!stdin.isTTY) { process.stderr.write("audit: no --intake given and no terminal to ask in; try --example\n"); process.exit(1); }
    intake = await ask();
  }
  const readout = score(intake);
  const out = flag("--out");
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "audit.md"), render(readout, "markdown"));
    writeFileSync(join(out, "audit.html"), render(readout, "html"));
  }
  if (has("--json")) { stdout.write(JSON.stringify(readout, null, 2) + "\n"); return; }
  stdout.write("\n" + render(readout, "text"));
  if (out) {
    stdout.write(`\nWritten. ${join(out, "audit.md")} and ${join(out, "audit.html")}\n`);
  }
}

main().catch((e) => { process.stderr.write(`audit: ${(e as Error).message}\n`); process.exit(1); });
