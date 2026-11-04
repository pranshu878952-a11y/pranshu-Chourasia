# The Photo Investigation Method

How a single photo gets located — the method behind Photo Flight Finder, and the
exact process used in the live test that scored 99%.

The golden rule: **work from hard evidence to soft evidence, and never claim more
than the clues support.** A wrong confident answer is worse than an honest
"likely, medium confidence."

---

## The 6 passes

### Pass 1 — Metadata before eyes (EXIF)

Before looking at the picture, interrogate the file:

- GPS coordinates (exact location, if present)
- Date/time taken
- Camera make/model
- Screenshot markers (e.g. an EXIF `UserComment` of "Screenshot", or a timestamp
  that contradicts the scene)

Most photos shared through WhatsApp/Instagram have metadata stripped. A missing
GPS is itself a finding — say so and switch to visual-only mode. If the file is a
screenshot, the file's date is the *screenshot's* date, not the photo's — flag
the contradiction instead of reporting a false time.

### Pass 2 — Read the frame (direct visual clues)

Systematically scan for:

- **Text** — signs, boards, number plates, advertisements; note the **language
  and script** (Devanagari vs Latin vs Arabic script alone can shortlist countries)
- **Identifiers** — vehicle registrations (e.g. `VT-` = Indian aircraft),
  phone-number formats, brand liveries
- **Architecture & infrastructure** — road markings and their style, driving side
  (left-hand vs right-hand traffic), pole/sign design, building materials
- **Nature** — terrain, vegetation type, water bodies
- **Light** — shadow direction and length → approximate time of day; sun side →
  hemisphere hints
- **People** — clothing, uniforms (suggestive, use carefully)

### Pass 3 — The reflection pass

Inspect **every reflective surface**: sunglasses, chrome helmets, mirrors, glass
windows/doors, phone/TV screens, car paint, water.

- Reflections often show the scene **behind the camera** — a second photo hidden
  inside the first
- They are **mirrored** — read text backwards
- Buildings, signs, road markings and landscape in reflections are real clues,
  but always labelled **suggestive only** — partial and distorted

*(The reel that inspired this: a church tower and a "BUS" road marking seen only
in a chrome helmet's reflection pinned a photo to Prague.)*

### Pass 4 — Form the hypothesis

- State **one** most likely location (place / city / region / country)
- Attach a **confidence level**: low / medium / high
- Give 1–2 sentences of reasoning naming the strongest clues
- Name the **runner-up** possibility honestly when two candidates are close

### Pass 5 — Cross-check

Verify against independent sources instead of admiring your own guess:

- **Flights/aircraft:** search the registration (e.g. `VT-BXL`) on FlightAware /
  Flightradar24 — its logged airport visits confirm or kill the airport guess
- **Flight photos:** playback search at the photo's time ±30 min over the
  identified area; match terrain, water bodies and sun side
- **Places:** compare street-level/satellite imagery — rooflines, towers, road
  markings, stand/gate number layouts
- **User-supplied details:** cross-check anything the user pasted (date, GPS,
  context) against the visual evidence and **flag contradictions**

### Pass 6 — The case file

Deliver in a fixed format (this is what the prompt and the website produce):

1. **Most likely location** + confidence + reasoning
2. **Visual clues** — the list from Pass 2
3. **Reflection clues** — labelled suggestive only
4. **Details cross-check** — what the user's info/file metadata confirmed or
   contradicted
5. **Flight section** (only for plane photos) — terrain, aircraft, livery,
   window side + how to cross-check

Close by stating what is **still unknown**. Never invent an exact flight number,
seat or address from weak clues — lower the confidence instead.

---

## Photo-type playbook — any photo, same goal

The investigator first classifies the photo, then hunts the clues that type
actually contains. Location is findable from almost every type — the evidence
just lives in different places.

| Photo type | Where the location hides |
|---|---|
| Street / outdoor | Signs & script, number plates, road markings, driving side, architecture, terrain, vegetation |
| Selfie / portrait | Background behind the subject + reflections in sunglasses/eyes, clothing, shop fronts over the shoulder |
| Flight / window seat | Terrain & water below, wing/aircraft features, livery, sun side; cross-check flight playback |
| Airport / station | Airline liveries, registrations, stand/gate numbers, ad brands, terminal architecture |
| Indoor / home / office | Plug-socket type, TV channel logos, product labels & languages, calendar/date formats, keyboard layouts |
| Food / restaurant | Menu language & currency, brands, receipts, packaging text, licence plates through the window |
| Nature / landscape | Terrain, vegetation zone, sun angle, distinctive peaks/coastlines matched against satellite imagery |
| Screenshot | UI language, in-image timestamps, app/place names, map fragments — plus file-level screenshot detection |
| Vehicles | Plates (format = country/state), steering side, fuel-brand stations, road furniture |
| Documents / receipts | Direct text — shop name, address, phone format, tax IDs (use carefully, most reliable of all) |

Rule: classify first, then run the 6 passes with that type's clue list.
If a photo contains none of its type's clues, say so and grade confidence low —
never force a pin.

---

## Worked example — the 99% test (5 Nov 2026)

**Input:** one screenshot of an airport apron photo, no user details pasted.

**Pass 1 (metadata):** EXIF showed no GPS, no camera — and a `UserComment` of
"Screenshot" with a file time of 01:34. Conclusion: this is a screenshot saved
that night; the scene is bright daytime → the timestamp is the screenshot's,
not the photo's. **Contradiction flagged, time honestly unknown.**

**Pass 2 (frame):**
- Air India Express Boeing 737 MAX at a jet bridge; orange engine marked "AIX";
  rear-fuselage registration read by cropping/zooming: **VT-BXL**
- Jet-bridge advertisement: **TotalEnergies**
- Stand-number pole: **V 49 / V 50 / V 51**
- Air India baggage containers, mobile stairs, Indian ground-handling pattern
- Terracotta terminal structure + dense greenery below the viewpoint;
  eucalyptus-type trees, hazy flat skyline
- Short shadows → late morning / around midday

**Pass 3 (reflections):** shot through/near terminal glass (glare on the left
edge) but no readable reflected scene — reported as weak, not forced.

**Pass 4 (hypothesis):** India — **high confidence** (registration, airline,
containers). Specific airport: **Bengaluru (BLR)** — **medium confidence**,
garden-terminal greenery and terracotta design; Hyderabad named as runner-up.

**Pass 5 (cross-check offered):** VT-BXL's logged airport visits on
FlightAware/Flightradar24 would confirm the airport for the photo's real date.

**Result:** user scored the investigation **99%**.
