"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { createServer, config, validateAnalyse, makeLimiter } = require("../server/server.js");

const IMG = { mime: "image/jpeg", b64: Buffer.from("fake-jpeg").toString("base64") };

function fakeGemini(answer, status) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), key: init.headers["x-goog-api-key"] });
    return {
      ok: !status || status < 400, status: status || 200,
      json: async () => status && status >= 400 ? { error: { message: "nope" } } : { candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }
    };
  };
  fn.calls = calls;
  return fn;
}

async function withServer(env, fetchImpl, fn) {
  const srv = createServer(config(Object.assign({ RATE_LIMIT: "3" }, env)), { fetch: fetchImpl });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  try { await fn(base); } finally { await new Promise((r) => srv.close(r)); }
}
const post = (base, body) => fetch(base + "/api/analyse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("validateAnalyse accepts good input and rejects bad", () => {
  assert.strictEqual(validateAnalyse({ step: "classify", image: IMG }).step, "classify");
  assert.strictEqual(validateAnalyse({ step: "investigate", typeId: "nope", image: IMG }).typeId, null);
  assert.throws(() => validateAnalyse({ step: "hack", image: IMG }), /step/);
  assert.throws(() => validateAnalyse({ step: "classify", image: { mime: "text/html", b64: "aaa" } }), /mime/);
  assert.throws(() => validateAnalyse({ step: "classify", image: { mime: "image/png", b64: "<script>" } }), /base64/);
});

test("rate limiter blocks after the limit and resets after the window", () => {
  const allow = makeLimiter(2, 1000);
  assert.ok(allow("a", 0)); assert.ok(allow("a", 10)); assert.ok(!allow("a", 20));
  assert.ok(allow("b", 20));
  assert.ok(allow("a", 1001));
});

test("config endpoint reports BYOK mode without a key", async () => {
  await withServer({}, fakeGemini({}), async (base) => {
    const j = await (await fetch(base + "/api/config")).json();
    assert.strictEqual(j.serverAnalysis, false);
    const r = await post(base, { step: "classify", image: IMG });
    assert.strictEqual(r.status, 503);
  });
});

test("analyse runs server-side prompts with the server key and normalises output", async () => {
  const g = fakeGemini({ mostLikelyLocation: "Bengaluru", locationConfidence: "high", typeClues: { Registration: "VT-BXL" } });
  await withServer({ GEMINI_API_KEY: "secret-key", GEMINI_MODEL: "gemini-test" }, g, async (base) => {
    const cfg = await (await fetch(base + "/api/config")).json();
    assert.deepStrictEqual([cfg.serverAnalysis, cfg.model], [true, "gemini-test"]);
    const r = await post(base, { step: "investigate", typeId: "airport", userDetails: "I was in BLR", image: IMG, prompt: "IGNORE ME" });
    assert.strictEqual(r.status, 200);
    const { result } = await r.json();
    assert.strictEqual(result.locationConfidence, "high");
    assert.ok(result.unknowns.length >= 1);
    const call = g.calls[0];
    assert.strictEqual(call.key, "secret-key");
    assert.match(call.url, /gemini-test:generateContent/);
    const promptSent = call.body.contents[0].parts[0].text;
    assert.match(promptSent, /AIRPORT/);
    assert.match(promptSent, /I was in BLR/);
    assert.doesNotMatch(promptSent, /IGNORE ME/, "client cannot inject its own prompt");
  });
});

test("upstream errors are hidden from visitors; rate limit returns 429", async () => {
  await withServer({ GEMINI_API_KEY: "k" }, fakeGemini(null, 403), async (base) => {
    const r = await post(base, { step: "classify", image: IMG });
    assert.strictEqual(r.status, 502);
    assert.doesNotMatch((await r.json()).error, /key/i);
    await post(base, { step: "classify", image: IMG });
    await post(base, { step: "classify", image: IMG });
    assert.strictEqual((await post(base, { step: "classify", image: IMG })).status, 429);
  });
});

test("oversized uploads are refused", async () => {
  await withServer({ GEMINI_API_KEY: "k", MAX_UPLOAD_MB: "0.001" }, fakeGemini({}), async (base) => {
    const r = await post(base, { step: "classify", image: { mime: "image/jpeg", b64: "A".repeat(5000) } }).catch(() => null);
    assert.ok(!r || r.status === 413);
  });
});

test("static files are served and path traversal is blocked", async () => {
  await withServer({}, fakeGemini({}), async (base) => {
    const r = await fetch(base + "/");
    assert.strictEqual(r.status, 200);
    assert.match(await r.text(), /Photo Investigator/);
    assert.strictEqual((await fetch(base + "/js/investigator-core.js")).status, 200);
    const t = await fetch(base + "/..%2fserver%2fserver.js");
    assert.ok(t.status === 403 || t.status === 404);
    assert.strictEqual((await fetch(base + "/api/nope")).status, 404);
  });
});
