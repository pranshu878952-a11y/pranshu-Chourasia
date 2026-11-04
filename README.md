# Photo Investigator — Pro

Upload **any photo** and work out where and when it was taken. The site reads hidden metadata (EXIF), calculates the sun's position, then has an AI **classify the photo type** (street, selfie, flight, airport, indoor, food, nature, screenshot, vehicle or document) and **hunt that type's signature clues**, including a separate pass over reflections. Everything ends in a case file that grades its own confidence.

> **For fun and learning.** Analyse only your own photos, or photos you have permission to investigate.

## What's new in Pro (v2)

| Area | Upgrade |
|---|---|
| **Server mode** | Optional zero-dependency Node server. Set `GEMINI_API_KEY` and visitors analyse photos **without needing their own key**. Prompts live server-side, so the endpoint can't be used as an open proxy to your key. Rate-limited per IP, upload-size capped, photos processed in memory and **never stored or logged**. |
| **Still works as a static site** | No server? The page falls back to bring-your-own-key automatically. |
| **Honesty enforcement** | AI output is validated: confidence must be low/medium/high, an **unknowns** list is mandatory, and "high" confidence is capped at medium when none of the photo type's signature clues were readable. |
| **Runner-up + cross-check** | The AI names a runner-up location and what evidence would separate the two. It also gets the file's GPS/time/camera plus your own notes, and is told to **flag contradictions**. |
| **Screenshot detection** | Detects screenshots (EXIF UserComment, software tag, filename, camera-less PNG). The screenshot's timestamp is no longer reported as the photo's time or used for the sun calculation. |
| **Shareable case card** | One-click 1080×1350 PNG case card (photo optional) with native share on mobile. |
| **Model setting** | The Gemini model is configurable (the original hard-coded `gemini-2.0-flash`, which Google has retired). Default: `gemini-2.5-flash`. |
| **No CDN dependency** | exifr and SunCalc are bundled locally, so metadata and sun clues work on networks that block jsDelivr. |
| **Bug fixes** | Reflection clues were silently dropped from the case file (a variable was used before assignment). Fixed. |
| **SEO / sharing** | Meta description, Open Graph tags, favicon. Hero image moved out of the HTML (585 KB → 80 KB page). |
| **Tests** | 15 tests for the prompts, AI-output checks and server (`npm test`). |

## Project layout

```
public/                     ← the website (deploy this folder to any static host)
  index.html
  js/investigator-core.js   ← photo types, prompts, AI-output checks (shared by browser + server)
  js/vendor/                ← exifr + SunCalc (bundled, with licences)
  assets/                   ← hero image, favicon
server/server.js            ← optional Pro server (static files + /api/analyse)
test/                       ← node:test suites
docs/                       ← the investigation method and the "how I investigate" operating procedure
prompts/                    ← copy-paste investigator prompt for any AI chat
```

## Run it

**Static (bring-your-own-key):** open `public/index.html` in a browser, or deploy `public/` to Cloudflare Pages, Netlify, Vercel or GitHub Pages. Visitors paste their own free Gemini key from [Google AI Studio](https://aistudio.google.com/apikey); it stays in their browser.

**Pro server (your key, no key needed by visitors):**

```bash
GEMINI_API_KEY=your-key npm start      # Node 18+, no npm install needed
# → http://localhost:8080
```

| Env var | Default | Meaning |
|---|---|---|
| `GEMINI_API_KEY` | — | Turns on server analysis. Without it the server just serves the site in BYOK mode. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model to call |
| `PORT` / `HOST` | `8080` / `0.0.0.0` | Where to listen |
| `RATE_LIMIT` / `RATE_WINDOW_MIN` | `20` / `60` | Analyses per IP per window (each photo uses 2 calls: classify + investigate) |
| `MAX_UPLOAD_MB` | `8` | Request size cap |
| `TRUST_PROXY` | off | Set to `1` behind a reverse proxy so rate limiting uses `X-Forwarded-For` |

Deploy the server anywhere that runs Node (Render, Railway, Fly.io, a VPS). Budget for the per-analysis Gemini cost.

### API

- `GET /api/config` → `{ serverAnalysis, model, maxUploadMb }`
- `POST /api/analyse` with `{ step: "classify" | "investigate", typeId?, userDetails?, image: { mime, b64 } }` → `{ result }`, the validated JSON case data

## Test

```bash
npm test
```

## Honest limits (keep these, they are the brand)

- Social-media downloads usually have their metadata stripped. The site says so and switches to visual-only mode.
- AI gives **likely** locations with confidence levels, never a guaranteed exact pin from weak clues.
- Reflections are labelled **suggestive only** (mirrored, partial).
- An exact flight number or seat is only "found" when flight-playback terrain matches the photo.

## Ideas for next

- Accounts and saved case files (database plus consent for storing anything).
- FlightAware AeroAPI lookup by aircraft registration (paid API).
- Crop-and-re-read: select a region of the photo and send just that zoomed crop to the AI.

See `docs/INVESTIGATION-METHOD.md` and `docs/HOW-I-INVESTIGATE.md` for the method behind it.
