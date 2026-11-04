"use strict";
const test = require("node:test");
const assert = require("node:assert");
const Core = require("../public/js/investigator-core.js");

test("ten photo types, each with label, icon and hunt list", () => {
  const ids = Object.keys(Core.TYPES);
  assert.strictEqual(ids.length, 10);
  for (const id of ids) {
    const t = Core.TYPES[id];
    assert.ok(t.label && t.icon && t.hunt, id);
  }
});

test("buildPrompt routes by type and carries the honesty rules", () => {
  const p = Core.buildPrompt("airport");
  assert.match(p, /AIRPORT \/ STATION/);
  assert.match(p, /HONESTY RULE/);
  assert.match(p, /runnerUp/);
  assert.match(p, /unknowns/);
  assert.match(Core.buildPrompt(null), /unclassified/);
});

test("buildPrompt includes user details for cross-checking, capped in length", () => {
  const p = Core.buildPrompt("street", "x".repeat(5000));
  assert.match(p, /USER-SUPPLIED DETAILS/);
  assert.ok(p.length < Core.buildPrompt("street").length + 1700);
  assert.doesNotMatch(Core.buildPrompt("street", "   "), /USER-SUPPLIED/);
});

test("parseModelJson handles fences and surrounding text", () => {
  assert.deepStrictEqual(Core.parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepStrictEqual(Core.parseModelJson('Sure! {"a":2} hope it helps'), { a: 2 });
  assert.throws(() => Core.parseModelJson(""), /empty answer/);
  assert.throws(() => Core.parseModelJson("no json here"), /readable as data/);
});

test("normalizeClassification rejects unknown types and bad confidence", () => {
  assert.deepStrictEqual(Core.normalizeClassification({ photoType: "FOOD", confidence: "High", reasoning: "plate" }),
    { photoType: "food", confidence: "high", reasoning: "plate" });
  assert.strictEqual(Core.normalizeClassification({ photoType: "spaceship" }).photoType, null);
  assert.strictEqual(Core.normalizeClassification(null).confidence, "low");
});

test("normalizeInvestigation enforces confidence + unknowns", () => {
  const a = Core.normalizeInvestigation({ mostLikelyLocation: "Prague, Czechia", locationConfidence: "high", typeClues: {} });
  assert.strictEqual(a.locationConfidence, "medium", "high confidence without type clues is capped");
  assert.ok(a.unknowns.length >= 1);

  const b = Core.normalizeInvestigation({ mostLikelyLocation: "Prague", locationConfidence: "high", typeClues: { "Road marking": "BUS" }, unknowns: ["exact street"] });
  assert.strictEqual(b.locationConfidence, "high");
  assert.deepStrictEqual(b.unknowns, ["exact street"]);

  const c = Core.normalizeInvestigation({ locationConfidence: "high" });
  assert.strictEqual(c.mostLikelyLocation, "Cannot tell");
  assert.strictEqual(c.locationConfidence, "low");

  assert.strictEqual(Core.normalizeInvestigation({ locationConfidence: "very sure" }).locationConfidence, "low");
  assert.throws(() => Core.normalizeInvestigation([]), /wrong shape/);
});

test("geminiUrl sanitises the model name", () => {
  assert.match(Core.geminiUrl("gemini-2.5-flash"), /models\/gemini-2\.5-flash:generateContent$/);
  assert.match(Core.geminiUrl("../../evil?x=1"), /models\/\.\.\.\.evilx1:generateContent$/);
  assert.match(Core.geminiUrl(""), new RegExp(Core.DEFAULT_MODEL));
});

test("geminiText joins all text parts", () => {
  assert.strictEqual(Core.geminiText({ candidates: [{ content: { parts: [{ text: '{"a"' }, { text: ":1}" }] } }] }), '{"a":1}');
  assert.strictEqual(Core.geminiText({}), "");
});
