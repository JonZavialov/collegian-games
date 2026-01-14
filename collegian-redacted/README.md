# Redacted - The Daily Collegian Game

A viral "fill-in-the-blank" puzzle game for _The Daily Collegian_. The game fetches the latest headlines from the newspaper's RSS feed, smartly redacts key words, and challenges users to guess the missing context.

## 🎮 Features

- **Real-time Content:** Fetches actual headlines via RSS from `psucollegian.com`.
- **Context Aware:** Hides exactly 3 words per headline, keeping "stop words" (the, a, in) visible for context.
- **Gamified:** Lives system (5 hearts), Streak counter, and Win/Loss animations.
- **Anti-Frustration:** Includes a "Give Up / Reveal Answer" feature for difficult headlines.
- **Mobile Optimized:** Sticky input bar, large touch targets, and responsive layout.
- **Smart Caching:** Uses `sessionStorage` to cache RSS data for 1 hour, preventing 429 Rate Limit errors from the source server.

## 🛠 Tech Stack

- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Analytics:** PostHog (`posthog-js`)
- **Effects:** React Confetti

## 🚀 Getting Started

### 1. Installation

```bash
npm install

```

### 2. Local Development

To run the game locally, you **must** use the Vite proxy to avoid CORS errors.

```bash
npm run dev

```

- The app will run at `http://localhost:5173`.
- The proxy will map `/rss` -> `https://www.psucollegian.com/...`

### 3. Build for Production

```bash
npm run build

```

---

## ⚠️ Critical Configuration (CORS & Proxy)

This app relies on fetching data from an external XML RSS feed. Direct browser requests to the feed will fail due to CORS. **We handle this using a Self-Hosted Proxy pattern.**

### Local Development (`vite.config.js`)

Ensure your vite config contains this proxy rule:

```javascript
server: {
  proxy: {
    '/rss': {
      target: 'https://www.psucollegian.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/rss/, '/search/?f=rss&l=50&t=article'),
    }
  }
}

```

### Production Deployment (Netlify)

This app **must** include a `netlify.toml` file in the base directory to handle production routing.

**File: `netlify.toml**`

```toml
[[redirects]]
  from = "/rss"
  to = "https://www.psucollegian.com/search/?f=rss&l=50&t=article"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

```

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
├── games/
│   └── Redacted.jsx          # Main game logic
├── hooks/
│   └── useGameAnalytics.js   # PostHog wrapper
├── App.jsx                   # Entry point
└── main.jsx

```
