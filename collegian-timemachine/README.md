# Time Machine

Time Machine is a daily archive puzzle for **The Daily Collegian**. Players are shown a historical newspaper issue with the year redacted and must guess the year based on visual clues and headlines. Wrong guesses reveal the next page of the same issue, providing more context.

## How the game works

### Data flow

1. **Archive proxy**: Requests for PDFs are routed through Netlify redirects (`/archive/*`) to avoid CORS issues with the PSU archive.
2. **Daily date selection**: A seeded RNG (based on `YYYY-MM-DD`) chooses a single date each day to ensure every player sees the same issue.
3. **PDF rendering + redaction**:
   - `react-pdf` loads the issue page.
   - The text layer is scanned for the year string and a redaction overlay is positioned on top of the matching coordinates.

### Game loop

- **Daily limit**: 1 puzzle per day (stored in `localStorage` under `time-machine_daily_progress`).
- **Guessing**: Players input a year; the game allows a ±2-year margin for a correct answer.
- **Page advancement**: Incorrect guesses move to the next page (up to `MAX_PAGE_PROBE`).
- **End state**: Winning reveals a “View full issue” link; losing shows the answer and the daily countdown.

## Key files

| File | Responsibility |
| --- | --- |
| `src/TimeMachine.jsx` | Core gameplay, PDF rendering, redaction overlay, daily state. |
| `src/main.jsx` | React entry point + PostHog provider. |
| `src/components/EmailSignup.jsx` | Newsletter signup UI backed by Netlify functions. |
| `src/components/DisclaimerFooter.jsx` | Accessibility + credit footer. |
| `src/hooks/useGameAnalytics.js` | PostHog event helpers. |
| `netlify.toml` | Archive proxy redirect and SPA fallback. |

## Configuration

Top-of-file constants in `src/TimeMachine.jsx` control the game:

- `START_YEAR` / `END_YEAR` — search bounds for archive dates.
- `COLLEGIAN_LCCN` — archive identifier for The Daily Collegian.
- `MAX_PAGE_PROBE` — max pages a player can reach before losing.
- `DAILY_LIMIT` — daily puzzle count (set to `1`).

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
npm run dev
```

Build:

```bash
npm run build
```
