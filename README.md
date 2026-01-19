# Collegian Games

A collection of standalone, React-based games built for **The Daily Collegian**. Each game lives in its own folder with a dedicated README and setup details. This top-level README provides a single entry point for the suite.

## 🎮 Games in this repo

| Game | Folder | What it is |
| --- | --- | --- |
| **Headline Hunter** | `collegian-headlinehunter/` | A visual puzzle that zooms into a newspaper photo and asks players to match the correct headline. |
| **Beat the Editor (Weekly News Quiz)** | `collegian-quiz/` | A Google-Sheets-powered weekly quiz where players try to beat the editor’s score. |
| **Redacted** | `collegian-redacted/` | A fill‑in‑the‑blank headline game that redacts key words from live RSS headlines. |
| **Time Machine** | `collegian-timemachine/` | A historical archive guessing game where players infer the year from a redacted issue. |
| **PSU Wordle** | `psu-game-wordle/` | A Wordle-style game that pulls words (and optional hints) from a Google Sheet. |

## 🧰 Common setup

Each game is a standalone Vite + React app. To run any game locally:

```bash
cd <game-folder>
npm install
npm run dev
```

Build for production from within a game folder:

```bash
npm run build
```

> 📌 Note: Some games depend on RSS feeds, Google Sheets, or PostHog analytics keys. See each game’s README for configuration details, environment variables, and deployment instructions.

## 📰 Article data pipeline (RSS replacement)

The repo now includes a scraper and GitHub Action that keep article data up to date without relying on live RSS reads in the games:

- **`scraper.py`** pulls batches of article data from the Collegian RSS search endpoint, normalizes it, and writes two outputs:
  - **Postgres sync**: Inserts/updates rows in the `articles` table (by `guid`) with title, content, author, publish date, URL, and image URL.
  - **`articles.json` backup**: A JSON snapshot committed to the repo as a fallback data source.
- **`Refresh Article Data` workflow** (`.github/workflows/scrape.yml`) runs on a 6‑hour cron (and via manual dispatch). It installs dependencies, runs `scraper.py`, and commits any changes to `articles.json`.

### Local usage

To run the scraper locally, set the database environment variables (or put them in a `.env` file) and run:

```bash
python scraper.py
```

Required env vars (used in CI as GitHub Secrets):

```
DB_HOST
DB_NAME
DB_USER
DB_PASSWORD
```

> The workflow also supports `DB_PORT` (defaults to `5432`).

## 📂 Repo structure

```text
collegian-games/
├── collegian-headlinehunter/
├── collegian-quiz/
├── collegian-redacted/
├── collegian-timemachine/
└── psu-game-wordle/
```

## 🤝 Contributing

1. Pick a game folder and read its README for the correct setup and configuration.
2. Keep changes scoped to that game unless you’re improving shared tooling or documentation.
3. Run the game locally before opening a PR.

## 📜 License

Each game inherits its own licensing/credits as documented in its folder. If a game does not list a license, contact the project owner before reuse.
