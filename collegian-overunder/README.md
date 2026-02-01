# Over/Under

Over/Under is a daily comparison game for **The Daily Collegian**. Players are shown two Penn State football stat cards (e.g., receiving yards, sacks) and must choose which player is higher for the given stat category.

## How the game works

### Data flow

1. **CollegeFootballData API → Netlify Function**: `netlify/functions/cfb-stats.js` fetches player season stats for Penn State from `api.collegefootballdata.com` using `CFBD_API_KEY`.
2. **Netlify Function → Client**: `OverUnder.jsx` requests `/.netlify/functions/cfb-stats`, which returns normalized cards containing `{ id, name, category, value, image }`.
3. **Daily rounds**: Cards are grouped by stat category and shuffled using a seeded RNG keyed to the date (`YYYY-MM-DD`). Each round is a pair of players from the same category; five rounds are generated per day.

### Gameplay loop

- **Choice**: Players select which card is higher for the stat category.
- **Reveal**: The actual numeric values are revealed after a choice, with correct/incorrect feedback.
- **Daily progress**: Saved to `localStorage` under `overunder_daily_progress`.
- **Reset timer**: A countdown shows the time until the next daily reset.

## Key files

| File | Responsibility |
| --- | --- |
| `src/OverUnder.jsx` | Game UI, daily rounds generation, state handling. |
| `src/main.jsx` | React entry point + PostHog provider. |
| `src/components/EmailSignup.jsx` | Newsletter signup UI backed by Netlify functions. |
| `src/components/DisclaimerFooter.jsx` | Accessibility + credit footer. |
| `src/hooks/useGameAnalytics.js` | PostHog event helpers. |
| `netlify/functions/cfb-stats.js` | CFBD API fetch + card normalization. |

## Environment variables

Netlify function requires a CollegeFootballData API key:

```
CFBD_API_KEY
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
