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

test("a crafted intake value cannot break out of the html", () => {
  const intake = { ...exampleIntake(), reach: { tools: [], mcpServers: [], keysInRuntime: ['https://x"onmouseover=alert(1)', "<script>alert(2)</script>"], paymentPaths: 1 } };
  const html = render(score(intake), "html");
  assert.ok(html.includes("&quot;onmouseover=alert(1)"), "escaped quote survives as text");
  assert.ok(!/<[^>]*onmouseover/.test(html), "onmouseover must not land inside a tag");
  assert.ok(html.includes("&lt;script&gt;"), "script tag text is escaped");
  assert.ok(!/<script/.test(html), "no literal script tag");
  assert.match(html, /<a href="https:\/\/olurabian\.com\/work">/, "the real link still works");

  const r = score(exampleIntake());
  const withTrailingPeriod = { ...r, lastLine: `${r.lastLine.replace(/https:\/\/olurabian\.com\/work\.?$/, "").trimEnd()} https://olurabian.com/work.` };
  const html2 = render(withTrailingPeriod, "html");
  assert.ok(html2.includes('href="https://olurabian.com/work">https://olurabian.com/work</a>.'), "trailing period sits outside the anchor");
});
