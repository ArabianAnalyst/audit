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
