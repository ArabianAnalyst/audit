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
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const link = (s: string) => esc(s).replace(/(https?:\/\/[^\s"'<>&]+)/g, (m) => {
    const trail = m.endsWith(".") ? "." : "";
    const url = trail ? m.slice(0, -1) : m;
    return `<a href="${url}">${url}</a>${trail}`;
  });
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
