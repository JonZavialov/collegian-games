# Time Machine

Time Machine is a daily archive puzzle for **The Daily Collegian**. Players are shown a historical newspaper issue with the year redacted and must guess the year based on visual clues and headlines. Wrong guesses reveal the next page of the same issue, providing more context.

## How the game works

### Architecture overview

The game displays historical newspaper pages from the Pennsylvania Newspaper Archive using OpenSeadragon for efficient tiled image loading via the IIIF Image API. Years are redacted by parsing ALTO XML OCR data and overlaying black boxes on text containing the target year.

### Image loading pipeline

The image loading system uses a multi-step proxy chain to handle CORS and rewrite URLs:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Image Loading Flow                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. TimeMachine.jsx calls get-iiif-info?date=YYYY-MM-DD&page=N              │
│                              │                                              │
│                              ▼                                              │
│  2. get-iiif-info.js scrapes the archive page HTML to find                  │
│     the IIIF ID (contains reel number that varies by date)                  │
│                              │                                              │
│                              ▼                                              │
│  3. Returns URL: /.netlify/functions/iiif-info/batch_pst.../0001.jp2        │
│                              │                                              │
│                              ▼                                              │
│  4. OpenSeadragon fetches that URL                                          │
│                              │                                              │
│                              ▼                                              │
│  5. iiif-info.js proxies the real info.json from panewsarchive.psu.edu      │
│     and REWRITES the @id field to use /iiif/ instead of the full URL        │
│                              │                                              │
│                              ▼                                              │
│  6. OpenSeadragon uses the rewritten @id to construct tile URLs             │
│     (e.g., /iiif/batch_pst.../full/1024,/0/default.jpg)                     │
│                              │                                              │
│                              ▼                                              │
│  7. Netlify redirect /iiif/* proxies to panewsarchive.psu.edu/iiif/*        │
│                              │                                              │
│                              ▼                                              │
│  8. Tiles load successfully without CORS issues                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why this complexity?**
- The PA Newspaper Archive doesn't set CORS headers, so direct requests from the browser fail
- OpenSeadragon uses the `@id` field from info.json to construct tile URLs
- If we just proxy info.json without rewriting `@id`, OpenSeadragon would try to fetch tiles directly from the archive (CORS fail)
- The `iiif-info.js` function rewrites `@id` to point to our `/iiif/` proxy path

### Redaction system

Years are hidden using ALTO XML OCR data:

1. `get-redactions.js` fetches ALTO XML from the archive's OCR endpoint
2. Parses the XML to find `<String>` elements containing the target year
3. Extracts coordinates (HPOS, VPOS, WIDTH, HEIGHT) for each match
4. Returns an array of bounding boxes
5. `ImageViewer.jsx` converts pixel coordinates to OpenSeadragon viewport coordinates and renders overlays

**Coordinate conversion:**
OpenSeadragon normalizes coordinates where image width = 1.0. Both x and y coordinates must be divided by `imageDimensions.width`:

```javascript
const rect = new OpenSeadragon.Rect(
  box.x / imageDimensions.width,
  box.y / imageDimensions.width,
  box.w / imageDimensions.width,
  box.h / imageDimensions.width
);
```

### Game loop

- **Daily limit**: 1 puzzle per day (stored in `localStorage` under `time-machine_daily_progress`)
- **Daily date selection**: A seeded RNG (based on `YYYY-MM-DD`) chooses a single date each day to ensure every player sees the same issue
- **Guessing**: Players input a year; the game allows a +/-2-year margin for a correct answer
- **Page advancement**: Incorrect guesses move to the next page (up to `MAX_PAGE_PROBE`)
- **End state**: Winning reveals a "View full issue" link; losing shows the answer and the daily countdown

## Key files

| File | Responsibility |
| --- | --- |
| `src/TimeMachine.jsx` | Core gameplay, state management, IIIF fetching, redaction coordination |
| `src/components/ImageViewer.jsx` | OpenSeadragon wrapper, handles image loading and redaction overlays |
| `src/components/EmailSignup.jsx` | Newsletter signup UI backed by Netlify functions |
| `src/components/DisclaimerFooter.jsx` | Accessibility + credit footer |
| `src/hooks/useGameAnalytics.js` | PostHog event helpers |
| `netlify/functions/get-iiif-info.js` | Scrapes archive page to find IIIF ID, returns proxied info URL |
| `netlify/functions/iiif-info.js` | Proxies info.json and rewrites @id for CORS compatibility |
| `netlify/functions/get-redactions.js` | Fetches ALTO XML and extracts year coordinates |
| `netlify.toml` | Proxy redirects for /iiif/*, /archive/*, and SPA fallback |

## Netlify redirects

```toml
# Proxy IIIF tile requests to avoid CORS
[[redirects]]
from = "/iiif/*"
to = "https://panewsarchive.psu.edu/iiif/:splat"
status = 200
force = true

# Proxy general archive requests
[[redirects]]
from = "/archive/*"
to = "https://panewsarchive.psu.edu/:splat"
status = 200
force = true

# SPA fallback
[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```

## Configuration

Top-of-file constants in `src/TimeMachine.jsx` control the game:

- `START_YEAR` / `END_YEAR` - search bounds for archive dates
- `COLLEGIAN_LCCN` - archive identifier for The Daily Collegian (`sn85054904`)
- `MAX_PAGE_PROBE` - max pages a player can reach before losing
- `DAILY_LIMIT` - daily puzzle count (set to `1`)

## Dependencies

- **openseadragon** - Deep zoom image viewer with IIIF support
- **react** / **react-dom** - UI framework
- **lucide-react** - Icons
- **posthog-js** - Analytics
- **react-confetti** - Win animation

## Analytics

`useGameAnalytics` sends:

- `game_start` when a new puzzle begins
- `game_progress` for guesses
- `game_won` on correct answers
- `game_lost` when page attempts are exhausted
- `content_clicked` when a player opens the full issue link

## Environment variables

The client expects PostHog credentials in `.env`:

```
VITE_PUBLIC_POSTHOG_KEY
VITE_PUBLIC_POSTHOG_HOST
```

## Local development

```bash
npm install
netlify dev  # Required for proxy redirects and functions
```

**Note:** Use `netlify dev` instead of `npm run dev` to ensure the Netlify redirects and functions work correctly.

Build:

```bash
npm run build
```

## Why OpenSeadragon instead of react-pdf?

The original implementation used react-pdf to render PDFs directly. This caused **memory pressure crashes on mobile Safari** when users rapidly navigated pages or zoomed, because:

1. Canvas-based PDF rendering is memory-intensive
2. Mobile Safari has strict memory limits
3. Each page render allocated significant memory that wasn't released fast enough

OpenSeadragon with IIIF solves this by:
- Loading only the visible tiles at the current zoom level
- Efficiently caching and releasing tiles
- Using a battle-tested image viewer designed for large images
