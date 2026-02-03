# Redacted

Redacted is a daily headline guessing game for **The Daily Collegian**. Each round presents a recent headline with three key words hidden; players must type the missing words before they run out of lives.

## How the game works

### Data flow

1. **Postgres → Netlify Function**: `netlify/functions/get-articles.js` queries the `articles` table for recent headlines with images.
2. **Netlify Function → Client**: `Redacted.jsx` fetches `/.netlify/functions/get-articles` and converts the response into playable rounds.
3. **Daily rounds**: Articles are sorted, then shuffled using a seeded RNG keyed to the date (`YYYY-MM-DD`). The first five items become the daily lineup so all players see the same puzzles each day.

### Redaction logic

- The headline is split into words.
- A stop-word list (articles, pronouns, conjunctions, etc.) is preserved for context.
- Three non-stop words are randomly selected and replaced with blanks.
- Guessing fills the blanks; wrong guesses cost a life.

### Game loop

- **Lives**: Players start with 5 hearts.
- **Win**: Fill all missing words to earn a point and advance.
- **Loss**: Run out of lives or use the “Reveal” option.
- **Daily progress**: Stored in `localStorage` under `redacted_daily_progress`.
- **Reset timer**: A countdown shows time until the next daily reset.

## Key files

| File | Responsibility |
| --- | --- |
| `src/Redacted.jsx` | Main gameplay loop, redaction logic, daily state. |
| `src/main.jsx` | React entry point + PostHog provider. |
| `src/components/EmailSignup.jsx` | Newsletter signup UI backed by Netlify functions. |
| `src/components/DisclaimerFooter.jsx` | Accessibility + credit footer. |
| `src/hooks/useGameAnalytics.js` | PostHog event helpers. |
| `netlify/functions/get-articles.js` | Postgres query for recent headlines. |

## Analytics

The game uses `useGameAnalytics` to send:

- `game_start` when a round begins
- `game_progress` for incorrect guesses
- `game_won` on success
- `game_lost` on surrender or running out of lives
- `content_clicked` when players open the linked article

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
netlify dev
```

Build:

```bash
npm run build
```
