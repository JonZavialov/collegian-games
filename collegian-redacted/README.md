# Redacted - The Daily Collegian Game

A viral "fill-in-the-blank" puzzle game for _The Daily Collegian_. The game fetches the latest headlines from our article database (synced from the RSS feed), smartly redacts key words, and challenges users to guess the missing context.

## 🎮 Features

- **Database-Backed Content:** Headlines come from our Postgres database, synced from the RSS feed to avoid 429 rate-limit errors.
- **Context Aware:** Hides exactly 3 words per headline, keeping "stop words" (the, a, in) visible for context.
- **Gamified:** Lives system (5 hearts), Streak counter, and Win/Loss animations.
- **Anti-Frustration:** Includes a "Give Up / Reveal Answer" feature for difficult headlines.
- **Mobile Optimized:** Sticky input bar, large touch targets, and responsive layout.
- **Smart Caching:** Uses `sessionStorage` to cache database responses for 1 hour, keeping gameplay snappy.

## 🛠 Tech Stack

- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Analytics:** PostHog (`posthog-js`)
- **Effects:** React Confetti

## 🚀 How It Works

1. **Database Sync (RSS → Postgres):** A scheduled scraper ingests the _Daily Collegian_ RSS feed into Postgres, so the app never has to hit the RSS feed directly.
2. **App Fetch (Postgres → Netlify Function → Client):** The client requests `/.netlify/functions/get-articles`, which queries recent headlines and returns clean JSON.
3. **Gameplay:** Headlines are redacted (three words removed while keeping stop words) and served to the player round-by-round.

## 🚀 Getting Started

### 1. Installation

```bash
npm install

```

### 2. Local Development

```bash
npm run dev

```

- The app will run at `http://localhost:5173`.
- The app calls the Netlify function at `/.netlify/functions/get-articles` to load data.

### 3. Build for Production

```bash
npm run build

```

---

## ⚙️ Data Configuration

The Netlify function in `netlify/functions/get-articles.js` connects to Postgres using environment variables (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`). Update the SQL query there if you want to change which headlines appear in-game.

---

## 📊 Analytics Events

This game uses a standardized `useGameAnalytics` hook. Key events tracked:

| Event Name        | Trigger                  | Properties                        |
| ----------------- | ------------------------ | --------------------------------- |
| `game_start`      | Round loads              | `headline_length`                 |
| `game_won`        | User guesses all words   | `lives_remaining`, `score`        |
| `game_lost`       | User runs out of lives   | `score`, `method: "out_of_lives"` |
| `game_lost`       | User clicks "Reveal"     | `score`, `method: "surrender"`    |
| `content_clicked` | User clicks "Read Story" | `url`                             |

## 📂 Project Structure

```text
src/
├── components/
│   └── DisclaimerFooter.jsx  # Shared footer
├── hooks/
│   └── useGameAnalytics.js   # PostHog wrapper
├── Redacted.jsx              # Main game logic
└── main.jsx

```
