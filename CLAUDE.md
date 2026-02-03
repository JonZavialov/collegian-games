# Collegian Games Monorepo

A collection of React-based games embedded in The Daily Collegian news website. Each top-level folder is an independent, deployable game application.

## Repository Structure

```
collegian-games/
├── collegian-headlinehunter/  # Photo zoom puzzle game
├── collegian-quiz/            # "Beat the Editor" quiz with admin panel
├── collegian-redacted/        # Word-guessing from redacted headlines
├── collegian-timemachine/     # PDF-based newspaper archive game
├── psu-game-wordle/           # "Valley Vocab" Wordle variant
└── CLAUDE.md
```

Each game is **completely independent** with its own dependencies, build config, and deployment. There is no shared package manager (no workspaces, Lerna, etc.).

## IMPORTANT: Repository Conventions

**This is a private repository.** The following conventions MUST be followed:

- **`.env` files ARE committed to git** - This repo tracks `.env` files since it's private. Do NOT add `.env` to `.gitignore`.
- **Do NOT create `.env.example` files** - The actual `.env` files are tracked instead.
- **Always check existing games for patterns** before making assumptions about how things should be done.
- **Copy configuration from existing games** (like `collegian-headlinehunter`) to maintain consistency.

## Tech Stack (All Games)

| Category | Technology |
|----------|------------|
| Framework | React 19.2 |
| Build Tool | Vite 7.2 |
| Styling | Tailwind CSS 3.4 |
| Icons | lucide-react |
| Analytics | PostHog (posthog-js) |
| Win Animation | react-confetti |
| Deployment | Netlify (with serverless functions) |
| Backend | Netlify Functions + PostgreSQL |

## Creating a New Game

### 1. Bootstrap the Project

```bash
# From repo root
npm create vite@latest collegian-[game-name] -- --template react
cd collegian-[game-name]
npm install

# Install common dependencies
npm install lucide-react posthog-js react-confetti

# Install dev dependencies
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 2. Required Configuration Files

Copy these from an existing game (e.g., `collegian-headlinehunter`):

- `tailwind.config.js` - Standard Tailwind config
- `postcss.config.js` - PostCSS with Tailwind/autoprefixer
- `eslint.config.js` - Flat ESLint config with React hooks
- `netlify.toml` - Netlify build/redirect config
- `.env` template - Environment variables

### 3. Required Directory Structure

```
collegian-[game-name]/
├── src/
│   ├── main.jsx              # Entry point (PostHog wrapper)
│   ├── [GameName].jsx        # Main game component
│   ├── index.css             # Tailwind directives
│   ├── components/
│   │   ├── DisclaimerFooter.jsx
│   │   ├── EmailSignup.jsx
│   │   └── [game-specific components]
│   └── hooks/
│       ├── useGameAnalytics.js
│       └── [game-specific hooks]
├── netlify/
│   └── functions/
│       ├── check-email.js
│       └── submit-email.js
├── public/
├── index.html
└── [config files]
```

### 4. Entry Point Pattern (main.jsx)

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import GameName from "./GameName.jsx";
import { PostHogProvider } from "posthog-js/react";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={{
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
        capture_exceptions: true,
        debug: import.meta.env.MODE === "development",
      }}
    >
      <GameName />
    </PostHogProvider>
  </StrictMode>
);
```

### 5. Environment Variables

Create `.env` file:

```env
VITE_PUBLIC_POSTHOG_KEY=your_posthog_key
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# If using database
DB_HOST=your_db_host
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_PORT=5432
```

---

## Shared Components (Copy to Each Game)

### DisclaimerFooter.jsx

Standard footer with developer credits, copyright, and accessibility note. Update `DEV_1` and `DEV_2` constants if needed.

**Usage:**
```jsx
import DisclaimerFooter from "./components/DisclaimerFooter";

// At bottom of main component
<DisclaimerFooter />
```

### EmailSignup.jsx

Email collection form for newsletter/giveaways. Integrates with `check-email` and `submit-email` Netlify functions.

**Usage:**
```jsx
import EmailSignup from "./components/EmailSignup";

// Pass game name for analytics source tracking
<EmailSignup gameName="Headline Hunter" />
```

**Features:**
- Debounced duplicate email checking
- Browser localStorage to prevent re-showing after signup
- Newsletter and giveaway checkboxes
- Loading/success/error states

### useGameAnalytics.js

PostHog analytics hook for consistent event tracking.

**Usage:**
```jsx
import useGameAnalytics from "./hooks/useGameAnalytics";

function GameComponent() {
  const analytics = useGameAnalytics("game-id", roundIndex);

  // Log game start
  analytics.logStart({ difficulty: "normal" });

  // Log progress actions
  analytics.logAction("hint_used", { hint_number: 1 });

  // Log win/loss
  analytics.logWin({ score: 500, attempts: 3 });
  analytics.logLoss({ reason: "out_of_time" });

  // Log content clicks (links to articles, etc.)
  analytics.logContentClick({ article_id: "123" });
}
```

**Event Payloads Include:**
- `game_id` - Identifier for the game
- `duration_seconds` - Time since game start
- `round_index` - Current round number
- Custom metadata passed to each method

---

## Styling Conventions

### Tailwind CSS Patterns

**Container Layout:**
```jsx
<div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900">
  <div className="max-w-2xl mx-auto">
    {/* Centered content */}
  </div>
</div>
```

**Header Pattern:**
```jsx
<div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
  <div>
    <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
      Game Title
    </h1>
    <p className="text-slate-500 text-sm">Subtitle</p>
  </div>
  <div className="flex items-center gap-2">
    {/* Score badge, buttons */}
  </div>
</div>
```

**Primary Button:**
```jsx
<button className="px-5 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all">
  Button Text
</button>
```

**Disabled Button:**
```jsx
<button
  disabled
  className="px-5 py-3 bg-slate-300 text-slate-500 font-bold rounded-lg cursor-not-allowed"
>
  Disabled
</button>
```

**Card/Panel:**
```jsx
<div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
  {/* Card content */}
</div>
```

**Success State:**
```jsx
<div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
  Success message
</div>
```

**Error State:**
```jsx
<div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
  Error message
</div>
```

### Color Palette

| Purpose | Classes |
|---------|---------|
| Primary action | `bg-blue-600 hover:bg-blue-700 text-white` |
| Success | `bg-green-50 border-green-200 text-green-700` |
| Warning | `bg-yellow-50 border-yellow-400 text-yellow-700` |
| Error | `bg-red-50 border-red-200 text-red-600` |
| Neutral background | `bg-slate-100` |
| Card background | `bg-white` |
| Text primary | `text-slate-900` |
| Text secondary | `text-slate-500` |
| Border | `border-slate-200` |

### Responsive Breakpoints

Mobile-first approach:
- Base: < 640px (mobile)
- `sm:` 640px+ (tablet)
- `md:` 768px+ (desktop)

**Common Patterns:**
```jsx
// Padding scaling
className="p-4 sm:p-6"

// Text scaling
className="text-xl sm:text-2xl md:text-3xl"

// Flex direction
className="flex flex-col gap-4 sm:flex-row"
```

---

## Game State Management

All games use local React state (no Redux/Context). Common patterns:

### State Variables

```jsx
const [gameState, setGameState] = useState("loading"); // "loading", "playing", "won", "lost", "daily-complete"
const [score, setScore] = useState(0);
const [round, setRound] = useState(null);
const [roundIndex, setRoundIndex] = useState(0);
```

### Refs for One-Time Events

```jsx
const roundCompletedRef = useRef(false);

// Prevent double-logging
if (!roundCompletedRef.current) {
  roundCompletedRef.current = true;
  analytics.logWin();
}
```

### localStorage for Persistence

```jsx
// Daily progress
const STORAGE_KEY = "gamename_daily_progress";

// Load progress
useEffect(() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const data = JSON.parse(saved);
    if (data.date === getTodayDateString()) {
      setProgress(data);
    }
  }
}, []);

// Save progress
useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    date: getTodayDateString(),
    roundsCompleted: roundIndex,
    score: score
  }));
}, [roundIndex, score]);
```

---

## Daily Challenge System

**IMPORTANT:** All games use a daily challenge system with the following key requirements:

1. **5 rounds per day** - Users get exactly 5 rounds/puzzles per day
2. **Deterministic selection** - Everyone gets the SAME 5 rounds each day (seeded by date)
3. **Progress persistence** - Progress is saved to localStorage and restored on page reload
4. **Daily reset at midnight** - New rounds available at 12:00 AM local time
5. **Countdown timer** - Show time until next reset when daily limit is reached

### Why Deterministic Rounds Matter

This creates a shared experience where users can discuss the same puzzles, compare scores, and creates a "daily challenge" feel similar to Wordle. The seeded randomization ensures:
- All users see the same content each day
- Refreshing the page doesn't change the rounds
- The experience is consistent across devices for the same user

### Seeded Random Function

```jsx
const createSeededRandom = (seed) => {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
};

const seededShuffle = (items, seed) => {
  const random = createSeededRandom(seed);
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// Generate daily rounds from date
const getTodayKey = () => new Date().toISOString().slice(0, 10); // "2024-01-15"
const seed = Number(getTodayKey().replace(/-/g, "")); // 20240115
const dailyRounds = seededShuffle(allItems, seed).slice(0, DAILY_LIMIT);
```

### Daily Reset Pattern

```jsx
const DAILY_LIMIT = 5;
const DAILY_STORAGE_KEY = "gamename_daily_progress";

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const getTimeUntilReset = () => {
  const now = new Date();
  const nextReset = new Date(now);
  nextReset.setHours(24, 0, 0, 0);
  const diffMs = Math.max(nextReset - now, 0);
  const totalMinutes = Math.ceil(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes };
};

// Save progress with date check
const saveDailyProgress = (roundIndex, score, completed) => {
  localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({
    date: getTodayKey(),
    roundIndex,
    score,
    completed
  }));
};

// Load progress - only if from today
const loadDailyProgress = () => {
  const saved = localStorage.getItem(DAILY_STORAGE_KEY);
  if (saved) {
    const data = JSON.parse(saved);
    if (data.date === getTodayKey()) return data;
  }
  return null;
};
```

### Daily Complete Screen

When a user completes their daily rounds (win or lose), show:
- Final score (e.g., "3/5")
- Countdown to next reset
- Email signup form
- NO "Play Again" button (they must wait for tomorrow)

---

## Netlify Functions

### Standard Function Structure

```javascript
// netlify/functions/function-name.js
const { Client } = require("pg");

exports.handler = async (event) => {
  // Method check
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method not allowed" }),
    };
  }

  const client = new Client({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Your logic here
    const result = await client.query(`SELECT * FROM table`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.rows),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Server error" }),
    };
  } finally {
    await client.end();
  }
};
```

### Required Functions for Email Signup

Copy from existing game:
- `check-email.js` - Check if email exists (POST)
- `submit-email.js` - Submit new email (POST)

---

## netlify.toml Template

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

# API proxy (if needed)
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
  force = true

# SPA fallback (required)
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## Animation Patterns

### Win Confetti

```jsx
import Confetti from "react-confetti";

{gameState === "won" && (
  <Confetti
    recycle={false}
    numberOfPieces={200}
    gravity={0.3}
  />
)}
```

### Shake Animation (Invalid Input)

```css
/* In index.css */
@keyframes row-shake {
  0% { transform: translateX(0); }
  10% { transform: translateX(-6px); }
  20% { transform: translateX(6px); }
  30% { transform: translateX(-5px); }
  40% { transform: translateX(5px); }
  50% { transform: translateX(-3px); }
  60% { transform: translateX(3px); }
  70% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
  90% { transform: translateX(-1px); }
  100% { transform: translateX(0); }
}

.shake {
  animation: row-shake 0.45s ease-in-out;
}
```

### Button Press Effect

```jsx
className="active:scale-95 transition-transform"
```

---

## Common UI Components

### Modal/Dialog

```jsx
{showModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
      <h2 className="text-2xl font-black mb-4">Modal Title</h2>
      <p className="text-slate-600 mb-6">Modal content...</p>
      <button
        onClick={() => setShowModal(false)}
        className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
      >
        Close
      </button>
    </div>
  </div>
)}
```

### Loading Spinner

```jsx
import { Loader } from "lucide-react";

<Loader className="animate-spin" size={24} />
```

### Score Badge

```jsx
<div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full font-bold">
  <Trophy size={18} />
  <span>{score} pts</span>
</div>
```

---

## Development Workflow

### Local Development

```bash
cd collegian-[game-name]
npm install
netlify dev      # Start dev server with Netlify Functions support
```

### Build & Preview

```bash
npm run build    # Build to dist/
npm run preview  # Preview production build
```

### Deployment

Games auto-deploy via Netlify when pushed to main branch. Each game has its own Netlify site.

---

## Database Schema Reference

### email_signups Table

```sql
CREATE TABLE email_signups (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  newsletter BOOLEAN DEFAULT false,
  giveaways BOOLEAN DEFAULT false,
  source VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### articles Table (for Headline Hunter, Redacted)

```sql
CREATE TABLE articles (
  guid VARCHAR(255) PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  author VARCHAR(255),
  image_url TEXT,
  pub_date TIMESTAMP NOT NULL
);
```

---

## Accessibility Notes

- Include accessibility disclaimer in footer for visually-dependent games
- Use semantic HTML elements
- Ensure color is not the only indicator (pair with icons/text)
- Support keyboard navigation where applicable
- Test with screen readers for text-based interactions
