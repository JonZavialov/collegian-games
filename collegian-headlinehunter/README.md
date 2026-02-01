# Headline Hunter

Headline Hunter is a daily photo-zoom puzzle built for **The Daily Collegian**. Players see a tightly cropped image from a recent article and must match it to the correct headline. Each wrong guess zooms the photo out for more context until the full image is revealed.

## How the game works

### Data flow

1. **Postgres → Netlify Function**: `netlify/functions/get-articles.js` queries the `articles` table for the most recent two weeks of articles with images and returns the payload used by the game.
2. **Netlify Function → Client**: `HeadlineHunter.jsx` fetches `/.netlify/functions/get-articles` on load and maps the response into `{ id, headline, link, image }` objects. Any `?resize=` parameters are stripped off the image URL so the game uses the original high-resolution asset.
3. **Daily rounds**: The article list is sorted deterministically and shuffled with a seeded RNG based on the current date (`YYYY-MM-DD`). The first five items become the daily rounds so everyone gets the same puzzles each day.

### Gameplay loop

- **Zoom stages**: The photo starts at **8x** zoom and steps down to **4x → 2x → 1x** (full image).
- **Guess handling**:
  - Correct guess ends the round, increments score, and reveals the full image.
  - Incorrect guess advances the zoom level and records the incorrect option so it can’t be picked again.
- **Daily progress**: Completion state is stored in `localStorage` under `headlinehunter_daily_progress` so players can leave and come back later.
- **Reset timer**: When the daily limit is reached, a countdown shows the time until midnight reset.

## Key files

| File | Responsibility |
| --- | --- |
| `src/HeadlineHunter.jsx` | Game UI, round logic, daily challenge state, and tutorial modal. |
| `src/main.jsx` | React entry point + PostHog provider. |
| `src/components/EmailSignup.jsx` | Newsletter signup UI backed by Netlify functions. |
| `src/components/DisclaimerFooter.jsx` | Accessibility + credit footer. |
| `src/hooks/useGameAnalytics.js` | PostHog event helpers. |
| `netlify/functions/get-articles.js` | Postgres query for recent articles. |

## Analytics

The game uses `useGameAnalytics` (a PostHog wrapper) to emit:

- `game_start` when a round begins
- `game_progress` for wrong guesses (with zoom level metadata)
- `game_won` when the correct headline is chosen
- `content_clicked` when players click the “Read story” link

## Environment variables

Netlify function (`get-articles.js`) requires Postgres credentials:

```
DB_HOST
DB_NAME
DB_USER
DB_PASSWORD
DB_PORT
```

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
