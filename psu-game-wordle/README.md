# psu-game-wordle

## Google Sheet word source

This app loads words from a public Google Sheet (CSV) and parses them with PapaParse.

1. Publish the sheet to the web as CSV.
2. Set the CSV URL as an environment variable:

```bash
VITE_WORDS_SHEET_CSV_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vTs7NuMrLwTuAaFYnL32Ic86hdEHPY2LBg0oPg6tHC2YF9mnKeeVyhUNuFshf3bFZ1_e4xQZDjG_bZJ/pub?gid=0&single=true&output=csv"
```

### Required columns

- `word` (required)
- `article` (optional)
- `hint` (optional)

## Analytics (PostHog)

Set these environment variables to enable analytics:

```bash
VITE_PUBLIC_POSTHOG_KEY="your_posthog_project_key"
VITE_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
```
