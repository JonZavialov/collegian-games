# Collegian Games

A monorepo of standalone, React-based games built for **The Daily Collegian**. Each top-level folder is a fully independent Vite app with its own dependencies, build config, Netlify functions, and deployment target. There are **no shared workspaces or packages**—treat every game as its own project.

## 🎮 Games in this repo

| Game | Folder | What it is | Primary data source |
| --- | --- | --- | --- |
| **Headline Hunter** | `collegian-headlinehunter/` | Zoom-in photo puzzle that asks players to match a headline to an image. | Postgres `articles` table via Netlify function |
| **Over/Under** | `collegian-overunder/` | Daily over/under comparisons of Penn State football stats. | CollegeFootballData API via Netlify function |
| **Beat the Editor** | `collegian-quiz/` | Weekly news quiz with an editor score and admin publishing UI. | Postgres `quiz_configs` table via Netlify function |
| **Redacted** | `collegian-redacted/` | Daily fill-in-the-blank headline guessing game. | Postgres `articles` table via Netlify function |
| **Time Machine** | `collegian-timemachine/` | Daily historical archive puzzle built on PSU newspaper PDFs. | Pennsylvania Newspaper Archive via Netlify redirect |

## 🧰 Common tech stack

All games share the same client-side stack:

- **React 19 + Vite 7**
- **Tailwind CSS 3.4**
- **Lucide React** icon set
- **PostHog** analytics
- **React Confetti** win effects
- **Netlify** for hosting and serverless functions

## 📁 Repository conventions

- **`.env` files are tracked in git.** This is a private repository—do not add `.env` to `.gitignore` and do not create `.env.example` files.
- **Copy configuration from existing games** (Tailwind, ESLint, Netlify) when creating new games to keep consistency.

## 🚀 Local development (per game)

```bash
cd <game-folder>
npm install
npm run dev
```

Production build (per game):

```bash
npm run build
```

> Some games rely on Postgres credentials, PostHog keys, or third-party API keys. See each game’s README for exact environment variables.

## 🧠 Daily challenge system

Most games implement a deterministic daily challenge system:

- **Fixed rounds per day** (typically 5; Time Machine uses 1)
- **Seeded randomness** so every player gets the same rounds for a given date
- **LocalStorage persistence** so progress survives refreshes
- **Midnight reset** with a countdown timer on the “daily complete” screen

See each game’s README for the specific storage keys and round logic.

## 📰 Article data pipeline (RSS replacement)

Headline Hunter and Redacted use a database-backed pipeline instead of live RSS calls:

- **`scraper.py`** pulls content from the Collegian RSS search endpoint, normalizes it, and writes to:
  - **Postgres** (`articles` table)
  - **`articles.json`** as a backup snapshot committed to the repo
- **`.github/workflows/scrape.yml`** runs the scraper on a schedule and commits updated `articles.json`.

Run locally:

```bash
python scraper.py
```

Required env vars (same as Netlify functions):

```
DB_HOST
DB_NAME
DB_USER
DB_PASSWORD
DB_PORT
```

## 🤝 Contributing

1. Pick a game folder and read its README for architecture and configuration.
2. Keep changes scoped to that game unless you are updating shared tooling or docs.
3. Run the game locally before opening a PR.

## 📜 License

Each game lists its own licensing/credits in its README. Contact the project owner if a game does not list explicit licensing details.
