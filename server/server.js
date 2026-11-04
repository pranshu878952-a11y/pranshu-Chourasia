#!/usr/bin/env node
/*
 * Photo Investigator — optional server (Pro mode).
 *
 * Zero dependencies (Node 18+). It does two things:
 *   1. Serves the static site in ../public
 *   2. POST /api/analyse — runs the Gemini investigation with YOUR key (GEMINI_API_KEY),
 *      so visitors don't need their own. Prompts live server-side (js/investigator-core.js),
 *      so the endpoint can't be used as an open proxy to your key.
 *
 * Photos are processed in memory and never written to disk or logged.
 *
 *   GEMINI_API_KEY=... node server/server.js
 *
 * Env: PORT (8080), HOST (0.0.0.0), GEMINI_API_KEY, GEMINI_MODEL,
 *      RATE_LIMIT (analyses per IP per window, 20), RATE_WINDOW_MIN (60),
 *      MAX_UPLOAD_MB (8), TRUST_PROXY ("1" behind a reverse proxy to use X-Forwarded-For)
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const Core = require("../public/js/investigator-core.js");

const PUBLIC_DIR = path.resolve(__dirname, "..", "public");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json"
};
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];

function config(env) {
  env = env || process.env;
  return {
    port: parseInt(env.PORT, 10) || 8080,
    host: env.HOST || "0.0.0.0",
    apiKey: (env.GEMINI_API_KEY || "").trim(),
    model: (env.GEMINI_MODEL || Core.DEFAULT_MODEL).trim(),
    rateLimit: parseInt(env.RATE_LIMIT, 10) || 20,
    rateWindowMs: (parseInt(env.RATE_WINDOW_MIN, 10) || 60) * 60 * 1000,
    maxBytes: (parseFloat(env.MAX_UPLOAD_MB) || 8) * 1024 * 1024,
    trustProxy: env.TRUST_PROXY === "1"
  };
}

/* ---------- tiny fixed-window rate limiter (in memory) ---------- */
function makeLimiter(limit, windowMs) {
  const hits = new Map();
  return function allow(ip, now) {
    if (now == null) now = Date.now();
    const h = hits.get(ip);
    if (!h || now - h.start >= windowMs) { hits.set(ip, { start: now, n: 1 }); prune(now); return true; }
    if (h.n >= limit) return false;
    h.n++; return true;
  };
  function prune(now) {
    if (hits.size < 5000) return;
    for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
  }
}

function send(res, status, body, headers) {
  const isJson = typeof body !== "string" && !Buffer.isBuffer(body);
  res.writeHead(status, Object.assign({
    "Content-Type": isJson ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  }, headers || {}));
  res.end(isJson ? JSON.stringify(body) : body);
}

function readJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBytes) { reject(Object.assign(new Error("Photo too large for the server limit."), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (e) { reject(Object.assign(new Error("Request body must be JSON."), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

/* Validate the analyse request; returns { step, typeId, userDetails, image } or throws {status}. */
function validateAnalyse(body) {
  const bad = (m) => Object.assign(new Error(m), { status: 400 });
  if (!body || typeof body !== "object") throw bad("Missing request body.");
  const step = body.step;
  if (step !== "classify" && step !== "investigate") throw bad('step must be "classify" or "investigate".');
  const img = body.image || {};
  if (IMAGE_MIMES.indexOf(img.mime) < 0) throw bad("image.mime must be image/jpeg, image/png or image/webp.");
  if (typeof img.b64 !== "string" || !img.b64.length || !/^[A-Za-z0-9+/=]+$/.test(img.b64)) throw bad("image.b64 must be base64 data.");
  const typeId = body.typeId && Core.TYPES[body.typeId] ? body.typeId : null;
  const userDetails = typeof body.userDetails === "string" ? body.userDetails.slice(0, 1500) : "";
  return { step, typeId, userDetails, image: { mime: img.mime, b64: img.b64 } };
}

async function runAnalyse(cfg, reqData, fetchImpl) {
  fetchImpl = fetchImpl || fetch;
  const isClassify = reqData.step === "classify";
  const prompt = isClassify ? Core.CLASSIFY_PROMPT : Core.buildPrompt(reqData.typeId, reqData.userDetails);
  const r = await fetchImpl(Core.geminiUrl(cfg.model), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
    body: JSON.stringify(Core.geminiBody(prompt, reqData.image, isClassify ? 0.1 : 0.2))
  });
  const payload = await r.json().catch(() => null);
  if (!r.ok) {
    /* Don't leak key problems to visitors in detail. */
    const status = r.status === 429 ? 429 : 502;
    const msg = r.status === 429 ? "The service is busy right now — try again in a minute." : "The AI service returned an error. Try again shortly.";
    console.error("[analyse] Gemini HTTP " + r.status + ": " + Core.friendlyGeminiError(r.status, payload));
    throw Object.assign(new Error(msg), { status });
  }
  const parsed = Core.parseModelJson(Core.geminiText(payload));
  return isClassify ? Core.normalizeClassification(parsed) : Core.normalizeInvestigation(parsed);
}

function serveStatic(req, res) {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname); }
  catch (e) { return send(res, 400, "Bad request"); }
  if (urlPath.endsWith("/")) urlPath += "index.html";
  const file = path.resolve(PUBLIC_DIR, "." + urlPath);
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, "Forbidden");
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, "Not found");
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=86400"
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function createServer(cfg, opts) {
  cfg = cfg || config();
  opts = opts || {};
  const allow = makeLimiter(cfg.rateLimit, cfg.rateWindowMs);
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    const pathname = (req.url || "/").split("?")[0];

    if (pathname === "/api/config" && req.method === "GET") {
      return send(res, 200, { serverAnalysis: !!cfg.apiKey, model: cfg.apiKey ? cfg.model : null, maxUploadMb: cfg.maxBytes / 1048576 });
    }
    if (pathname === "/api/health") return send(res, 200, { ok: true });

    if (pathname === "/api/analyse") {
      if (req.method !== "POST") return send(res, 405, { error: "Use POST." }, { Allow: "POST" });
      if (!cfg.apiKey) return send(res, 503, { error: "Server analysis is not configured (no GEMINI_API_KEY). Use your own key in AI settings." });
      const ip = (cfg.trustProxy && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "?";
      if (!allow(ip)) return send(res, 429, { error: "Too many analyses from this connection — try again later." });
      try {
        const body = await readJson(req, cfg.maxBytes);
        const data = validateAnalyse(body);
        const result = await runAnalyse(cfg, data, opts.fetch);
        return send(res, 200, { result });
      } catch (e) {
        return send(res, e.status || 500, { error: e.status ? e.message : "Analysis failed: " + e.message });
      }
    }
    if (pathname.startsWith("/api/")) return send(res, 404, { error: "Unknown endpoint." });
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
    serveStatic(req, res);
  });
}

if (require.main === module) {
  const cfg = config();
  createServer(cfg).listen(cfg.port, cfg.host, () => {
    console.log("Photo Investigator running on http://localhost:" + cfg.port);
    console.log(cfg.apiKey
      ? "Server analysis ON (model " + cfg.model + ", " + cfg.rateLimit + " analyses per IP per " + cfg.rateWindowMs / 60000 + " min)."
      : "Server analysis OFF — no GEMINI_API_KEY set. Visitors use their own key (bring-your-own-key mode).");
  });
}

module.exports = { createServer, config, validateAnalyse, runAnalyse, makeLimiter };
