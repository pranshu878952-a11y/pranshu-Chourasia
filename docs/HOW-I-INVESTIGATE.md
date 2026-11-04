# HOW I INVESTIGATE — the "mind" doc

Written for rebuilding and extending this with Claude Code (or any AI builder).
This is not marketing copy — it is the actual operating procedure that ran on
the live test photo, including where every piece of data came from.

---

## 0. Mindset (read this first)

1. **Evidence has a hierarchy.** File metadata and readable identifiers
   (registrations, signs) beat visual impressions. Visual impressions beat
   vibes. Never let a later, softer clue override an earlier, harder one.
2. **Absence is data.** No GPS in the file is a finding. A timestamp that
   contradicts the scene is a finding. Report them; don't paper over them.
3. **Confidence is part of the answer.** Every claim carries low / medium /
   high. A 99%-scored investigation still said "medium" for the specific
   airport because Hyderabad could not be excluded from one frame.
4. **Verify with an independent source before celebrating.** A guess becomes
   a result only after a cross-check the guess didn't come from (e.g. tail-
   number history on FlightAware).
5. **If a detail matters and is small, zoom — don't squint.** Crop the region,
   upscale it, read it again. (How `VT-BXL` was read: crop the rear fuselage
   at native resolution, 3x upscale, re-read.)

## 1. Where the data comes from (sources actually used)

| Need | Source used tonight | Production equivalent |
|---|---|---|
| Photo file itself | User upload (chat attachment) | Website upload input |
| EXIF / metadata | Python `PIL` EXIF reader (`Image._getexif()`), `exiftool` if present | Browser: `exifr` (CDN). Server: `exiftool` / `piexif` |
| Reading small text | PIL crop + resize (region crops saved and re-read) | Canvas crop in browser; server-side PIL/sharp |
| Reel/product research | Instagram connector (`post` for caption, `media-understanding` for video content) | n/a — research only |
| Flight cross-check | Offered: FlightAware / Flightradar24 tail history for `VT-BXL` | FlightAware AeroAPI (registration → flights), FR24 playback |
| Map display | OpenStreetMap embed from GPS coords | OSM embed iframe / Leaflet |
| Place from rough area text | Nominatim geocoding (in the website) | Nominatim / any geocoder |
| Sun position | SunCalc from timestamp + coordinates | `suncalc` JS lib or `astral` in Python |
| AI visual analysis | My own vision pass over the frame + crops | Gemini Vision API (website ships bring-your-own-key) |

## 2. The exact run — test photo, step by step

1. **Received the file.** Saved upload, 1206×2622 JPEG.
2. **EXIF first, before interpreting the image.** Read all tags:
   - No GPS tags. No camera make/model.
   - `DateTimeOriginal = 2026:11:05 01:34:42`, `UserComment = "Screenshot"`.
   - Inference: the file is a **screenshot**, created at night; the scene is
     bright daylight → file time ≠ photo time. Flagged, not used.
3. **Full-frame visual pass.** Apron scene; Air India Express 737 MAX;
   TotalEnergies jet-bridge ad; stand pole `V 49 / V 50 / V 51`; Air India
   containers; terracotta structure + heavy greenery; hazy skyline; short
   shadows (late morning-ish).
4. **Targeted crop #1 — registration.** Cropped the rear fuselage region,
   upscaled, re-read → `VT-BXL` (Indian registration; Air India Express
   737 MAX 8). This single hard identifier locked the country.
5. **Targeted crop #2 — the pole labels** (stand numbers) for the airport
   shortlist.
6. **Hypothesis with graded confidence.**
   - India: **high** (registration + containers + airline).
   - Bengaluru BLR: **medium** (garden-terminal greenery, terracotta design,
     T2 apron feel) — Hyderabad kept as named runner-up.
7. **Reflection pass.** Left-edge glare suggests shooting through terminal
   glass; no readable reflected content → reported as weak/no evidence
   instead of inventing reflections.
8. **Cross-check offered, not faked.** VT-BXL's logged airport visits on
   FlightAware/FR24 would confirm the airport once the photo's real date is
   known. I did **not** claim that confirmation — the check needs the date.
9. **Delivered the case file** in the fixed 5-section format and asked the
   user to score it. (He scored 99%.)

## 3. Decision rules (the judgement layer)

- **Two candidates within reach?** Name both, rank them, say what evidence
  would separate them (here: tail-history on the real date).
- **A clue you can't read is not a clue.** If text is illegible after one
  crop+zoom attempt, say "illegible" — never complete it from expectation.
- **Time from light is a range, not a time.** Short shadows = "late morning
  to midday", never "11:42 AM".
- **Reflections are mirrored and partial.** Always labelled suggestive-only.
- **Never output an exact flight number/seat/address** unless a hard
  identifier + an independent cross-check both support it.
- **User details can be wrong.** Cross-check them (Pass 4 of the method doc)
  and flag contradictions politely and explicitly.

## 4. System architecture — how the pieces fit

```
            ┌─────────────┐
  photo ───▶│  EXIF pass  │─▶ GPS / time / device / screenshot?
            └─────────────┘
            ┌─────────────┐
     └─────▶│ Vision pass │─▶ scene clues + identifiers (crop/zoom loop)
            └─────────────┘
            ┌─────────────┐
     └─────▶│Reflection   │─▶ mirrored scene behind the camera
            │   pass      │
            └─────────────┘
            ┌─────────────┐
     └─────▶│ Sun + map   │─▶ azimuth/elevation, OSM pin
            └─────────────┘
            ┌─────────────┐
     └─────▶│ Cross-check │─▶ FlightAware (tail/flight), imagery match
            └─────────────┘
            ┌─────────────┐
     └─────▶│  Case file  │─▶ location + confidence, clues, unknowns
            └─────────────┘
```

- **V1 (shipped, now `public/` in BYOK mode)**: everything client-side; AI pass via the
  visitor's own Gemini key; no server, no cost, no accounts.
- **V2 (your Claude Code build)**: add a small backend —
  `POST /analyse` (upload → exiftool → Gemini Vision with YOUR key →
  structured JSON case file), FlightAware AeroAPI for tail/flight
  cross-checks, Postgres/SQLite for saved case files, and image export of
  the case-file card for sharing. Keep the confidence rules in the system
  prompt — they are the product.
  - **Built (Pro v2):** `server/server.js` → `POST /api/analyse` with your key,
    server-owned prompts, output validation (confidence + unknowns enforced),
    rate limiting, no photo storage; PNG case-card export; screenshot detection.
  - **Still to do:** FlightAware AeroAPI, saved case files (needs a DB + consent).
- **The system prompt is the moat.** Use `prompts/investigator-prompt.md`
  verbatim as the core, and add the decision rules from §3 as system-level
  instructions for the API version.

## 5. Failure modes to defend against

- **Stripped metadata** (WhatsApp/Instagram downloads) → visual-only mode,
  never an error state.
- **Screenshots of photos** → detect and say the real date is unknown.
- **AI overconfidence** → force the JSON/schema to include a confidence
  field and an "unknowns" list; reject outputs that skip them.
- **Privacy** → photos contain people's locations. Analyse-only-own-photos
  framing stays in the UI; don't store uploads in V2 without consent.
