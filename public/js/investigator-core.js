/*
 * Investigator core — photo types, prompts and AI-response checks.
 * Shared by the browser (window.InvestigatorCore) and the Node server (require()).
 * The prompts and confidence rules are the product: change them here, once.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.InvestigatorCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Default Gemini model. Override in the page's AI settings, or GEMINI_MODEL on the server. */
  var DEFAULT_MODEL = "gemini-2.5-flash";
  var CONFIDENCE = ["low", "medium", "high"];

var TYPES = {
  street:     { label:"Street / outdoor", icon:"🚶", hunt:"STREET / OUTDOOR. Hunt: readable signs and text with language and script; vehicle number plates (format, letters, country codes); road markings, paint style and street furniture; which side traffic drives on; architecture style and era; terrain; vegetation; clothing of people." },
  selfie:     { label:"Selfie / portrait", icon:"🤳", hunt:"SELFIE / PORTRAIT. Hunt: the background behind the subject (landmarks, shop fronts, street signs, vegetation); reflections in sunglasses or glasses (mirrored — they show the scene behind the camera); clothing style for climate, culture and season; shop fronts and brand names; any text on screens, papers or packaging." },
  flight:     { label:"Flight / window seat", icon:"✈️", hunt:"FLIGHT / WINDOW SEAT. Hunt: terrain and water bodies below; wing, engine, window and cabin features; airline livery colours and any text; which side the sun and light come from; cloud and shadow patterns. Fill the flight object fully." },
  airport:    { label:"Airport / station", icon:"🛫", hunt:"AIRPORT / STATION. Hunt: airline liveries and aircraft registrations on tails and fuselage; stand, gate and stand numbers; advertising brands on jet bridges and boards; terminal architecture and design language; ground vehicles, uniforms and service equipment. Fill the flight object with whatever fits." },
  indoor:     { label:"Indoor / home / office", icon:"🏠", hunt:"INDOOR / HOME / OFFICE. Hunt: plug and socket types (strongly regional); TV channel logos and on-screen language; product labels, packaging and their languages; date and number formats on screens or papers; keyboard layouts if visible; brands; calendars or wall text." },
  food:       { label:"Food / restaurant", icon:"🍽️", hunt:"FOOD / RESTAURANT. Hunt: menu language, script and currency symbols; brand logos on packaging, cups and bags; receipt text if visible; tableware and plating style; staff uniforms; signage language; price formats." },
  nature:     { label:"Nature / landscape", icon:"🌄", hunt:"NATURE / LANDSCAPE. Hunt: terrain type and geology; vegetation zone and recognisable species; sun angle and shadow direction; distinctive peaks, coastlines, rivers or rock formations; sky and cloud character; any human structures." },
  screenshot: { label:"Screenshot", icon:"📱", hunt:"SCREENSHOT. Hunt: UI language and script; in-image timestamps, dates and their format; app names, icons and branding; place names in map fragments or text; status-bar details (carrier name, time). Screenshots carry no camera metadata — visual text is everything." },
  vehicles:   { label:"Vehicles", icon:"🚗", hunt:"VEHICLES. Hunt: number-plate format, colours and issuing country; steering side (left-hand or right-hand drive); fuel-station brands and signage; road furniture and sign design; taxi, delivery or rental branding." },
  documents:  { label:"Documents / receipts", icon:"🧾", hunt:"DOCUMENTS / RECEIPTS. Extract the text directly: shop or company name, street address, phone numbers and their country-code format, tax IDs, currency and totals, dates. This is a document-reading task — precision over guessing; never fabricate a missing digit." }
};

var CLASSIFY_PROMPT = [
  "You are classifying a photo for an investigation tool. Look at the photo and pick exactly one type.",
  "Respond with ONLY a JSON object (no markdown fences, no extra text):",
  '{"photoType": "<id>", "confidence": "low|medium|high", "reasoning": "<one short sentence>"}',
  "Valid ids: street (outdoor street/city scene), selfie (person-focused portrait), flight (taken from an airplane window), airport (airport tarmac, terminal or station), indoor (inside a home or office), food (meal or restaurant), nature (landscape or natural outdoors), screenshot (phone or computer screenshot), vehicles (car, bike or vehicle as the subject), documents (receipt, document, paper or ticket)."
].join("\n");

var PROMPT = [
  "You are a photo-location investigator. Analyse this photo and extract clues about WHERE and WHEN it was taken, and what is in it.",
  "Respond with ONLY a JSON object (no markdown fences, no extra text) with exactly these keys:",
  "{",
  '  "mostLikelyLocation": "your single best guess: place / city / region / country, or \\"Cannot tell\\" if there is genuinely no location evidence",',
  '  "locationConfidence": "low" | "medium" | "high",',
  '  "locationReasoning": "1-2 sentences: which clues drive the location guess",',
  '  "runnerUp": "the second-most-likely location if a close alternative exists, else empty string",',
  '  "separatingEvidence": "what evidence would separate the best guess from the runner-up, else empty string",',
  '  "typeClues": { "<short label>": "<what you actually found>" } (ONLY this photo type\'s signature clues that are really visible; empty object if none are readable),',
  '  "typeCluesMissing": ["<expected clues for this photo type that are NOT visible or readable>"] (be specific and honest),',
  '  "isFlightPhoto": true if the photo was taken from an aircraft / airplane window / shows a wing, airport or cabin view, else false,',
  '  "clues": {',
  '    "landmarks": "recognisable landmarks, buildings, terrain features, or empty string",',
  '    "signsAndText": { "text": "any readable words, signs, number plates", "language": "language seen", "script": "script seen e.g. Latin, Devanagari, Arabic" } (object or empty string if none),',
  '    "architecture": "architecture / building style clues, or empty string",',
  '    "terrain": "terrain and landscape type, or empty string",',
  '    "vegetation": "plants / vegetation zone clues, or empty string",',
  '    "vehiclesAndTraffic": { "details": "vehicles, plates, road markings", "drivesOn": "left" | "right" | "unknown" } (object or empty string),',
  '    "clothing": "clothing / people clues to region or season, or empty string",',
  '    "shopsAndBrands": "shop, brand or business names visible, or empty string",',
  '    "lightDirection": "where the light / sun seems to come from in the frame, or empty string"',
  "  },",
  '  "flight": { "terrainBelow": "", "waterBodies": "", "aircraftFeatures": "wing, engine, window features", "airlineLivery": "any airline colours or text, or empty string", "windowSide": "left" | "right" | "unknown" } (fill for flight or airport photos — registrations, liveries, stand numbers — else all empty strings),',
  '  "reflections": { "surfaces": "reflective surfaces visible, e.g. sunglasses, helmet, windows, water — or empty string if none", "shows": "what the reflections reveal: buildings, signs or text, road markings, landscape, sky/light — or empty string", "behindCamera": "what the reflection suggests about the scene BEHIND the camera — or empty string" },',
  '  "unknowns": ["<what is still unknown or could not be verified from this photo>"] (always at least one item — be honest),',
  '  "summary": "2-3 sentence investigator summary of what is in the photo and where it likely is"',
  "}",
  "DECISION RULES: a clue you cannot read is not a clue — say illegible, never complete text from expectation. Time from light is a range (e.g. late morning to midday), never an exact clock time. Never output an exact flight number, seat or street address unless a hard identifier visibly supports it.",
  "HONESTY RULE: if typeClues is empty or nearly empty, say so in locationReasoning and set locationConfidence to low. Never invent a precise location from weak clues — lower the confidence instead. Empty string means not visible / cannot tell."
].join("\n");

  /* The vision prompt, routed by the detected type: the type line goes first, then the shared hunt. */
  function buildPrompt(typeId, userDetails) {
    var t = TYPES[typeId];
    var typeLine = t
      ? "PHOTO TYPE (already classified): " + t.label + " (" + typeId + "). " + t.hunt
      : "PHOTO TYPE: unclassified — run the full general hunt below.";
    var details = userDetails && String(userDetails).trim()
      ? "\nUSER-SUPPLIED DETAILS (may be wrong — cross-check them against the photo and mention any contradiction in locationReasoning): " + String(userDetails).trim().slice(0, 1500)
      : "";
    return typeLine +
      "\nHunt the type-specific clues first, then run the universal pass: landmarks, terrain, vegetation, light direction. Then a separate REFLECTIONS pass over every reflective surface (sunglasses, helmets, mirrors, glass windows and doors, phone/TV screens, car paint, water): reflections are MIRRORED and often show the scene BEHIND the camera — suggestive, never conclusive on their own." +
      details + "\n" + PROMPT;
  }

  /* ---------- Gemini request / response helpers ---------- */
  function geminiUrl(model) {
    var m = String(model || DEFAULT_MODEL).replace(/[^a-zA-Z0-9._-]/g, "");
    return "https://generativelanguage.googleapis.com/v1beta/models/" + (m || DEFAULT_MODEL) + ":generateContent";
  }
  function geminiBody(promptText, image, temperature) {
    return {
      contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: image.mime, data: image.b64 } }] }],
      generationConfig: { temperature: temperature, responseMimeType: "application/json" }
    };
  }
  function geminiText(payload) {
    var c = payload && payload.candidates && payload.candidates[0];
    var parts = c && c.content && c.content.parts;
    if (!parts || !parts.length) return "";
    return parts.map(function (p) { return p && p.text ? p.text : ""; }).join("");
  }
  function friendlyGeminiError(status, payload) {
    var msg = (payload && payload.error && payload.error.message) || ("Gemini returned HTTP " + status);
    if ((status === 400 || status === 403) && /API key/i.test(msg)) return "That API key was rejected by Google. Check it in ⚙️ AI settings — it should be a Gemini key from Google AI Studio.";
    if (status === 404 && /model/i.test(msg)) return "Google doesn't recognise that model name. Open ⚙️ AI settings and pick a current Gemini model (e.g. " + DEFAULT_MODEL + ").";
    if (status === 429) return "Rate limit hit (free tier). Wait a minute and try again.";
    return msg;
  }
  function parseModelJson(text) {
    if (!text) throw new Error("Gemini returned an empty answer. Try again — if it keeps happening, the photo may have been blocked by its safety filters.");
    var clean = String(text).replace(/```json/g, "").replace(/```/g, "").trim();
    try { return JSON.parse(clean); }
    catch (e) {
      var m = clean.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* fall through */ } }
      throw new Error("The AI's answer wasn't readable as data. Raw answer:\n" + String(text).slice(0, 600));
    }
  }

  /* ---------- response checks: confidence + unknowns are mandatory ---------- */
  function str(v) { return typeof v === "string" ? v.trim() : (v == null ? "" : String(v)); }
  function conf(v) { var c = str(v).toLowerCase(); return CONFIDENCE.indexOf(c) >= 0 ? c : "low"; }

  function normalizeClassification(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    var id = str(raw.photoType).toLowerCase();
    return { photoType: TYPES[id] ? id : null, confidence: conf(raw.confidence), reasoning: str(raw.reasoning) };
  }

  function normalizeInvestigation(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("The AI's answer had the wrong shape — try again.");
    var a = raw;
    a.mostLikelyLocation = str(a.mostLikelyLocation) || "Cannot tell";
    a.locationConfidence = conf(a.locationConfidence);
    a.locationReasoning = str(a.locationReasoning);
    a.runnerUp = str(a.runnerUp);
    a.separatingEvidence = str(a.separatingEvidence);
    a.typeClues = (a.typeClues && typeof a.typeClues === "object" && !Array.isArray(a.typeClues)) ? a.typeClues : {};
    a.typeCluesMissing = Array.isArray(a.typeCluesMissing) ? a.typeCluesMissing.map(str).filter(Boolean) : [];
    a.unknowns = Array.isArray(a.unknowns) ? a.unknowns.map(str).filter(Boolean) : [];
    a.clues = (a.clues && typeof a.clues === "object") ? a.clues : {};
    a.flight = (a.flight && typeof a.flight === "object") ? a.flight : {};
    a.reflections = (a.reflections && typeof a.reflections === "object") ? a.reflections : {};
    a.isFlightPhoto = a.isFlightPhoto === true || a.isFlightPhoto === "true";
    a.summary = str(a.summary);

    /* Honesty enforcement — the model doesn't get to skip these. */
    var hasTypeClues = Object.keys(a.typeClues).some(function (k) { return a.typeClues[k]; });
    if (!hasTypeClues && a.locationConfidence === "high") {
      a.locationConfidence = "medium";
      a.unknowns.push("Confidence capped at medium: none of this photo type's signature clues were readable");
    }
    if (a.mostLikelyLocation === "Cannot tell") a.locationConfidence = "low";
    if (!a.unknowns.length) a.unknowns.push("Independent cross-check not yet done — treat the location as a lead, not proof");
    return a;
  }

  return {
    DEFAULT_MODEL: DEFAULT_MODEL,
    TYPES: TYPES,
    CLASSIFY_PROMPT: CLASSIFY_PROMPT,
    PROMPT: PROMPT,
    buildPrompt: buildPrompt,
    geminiUrl: geminiUrl,
    geminiBody: geminiBody,
    geminiText: geminiText,
    friendlyGeminiError: friendlyGeminiError,
    parseModelJson: parseModelJson,
    normalizeClassification: normalizeClassification,
    normalizeInvestigation: normalizeInvestigation
  };
});
