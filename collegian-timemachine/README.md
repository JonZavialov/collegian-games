# 🕰️ Time Machine: The Daily Collegian Archives Game

**Time Machine** is an interactive history puzzle game built for the Daily Collegian at Penn State.

**The Premise:** Users are shown a random historical issue of the newspaper (ranging from 1940–2010). The catch? The date is surgically redacted. Users must analyze the headlines, advertisements, and fashion to guess the year.

**The Mechanic:** If you guess wrong, the game automatically loads the **next page** of that specific issue, giving you new clues (movie times, car prices, etc.) until you either solve it or run out of pages.

---

## 🚀 Features

- **Fully Automated Content:** No manual curation required. The game programmatically fetches random issues from the [Pennsylvania Newspaper Archive](https://panewsarchive.psu.edu/).
- **Smart Redaction Engine:** Uses `react-pdf` to scan the text layer of the PDF, locate the year (e.g., "1984"), and overlay a black `div` on the exact coordinates—preventing spoilers without altering the original file.
- **Self-Healing 404 Logic:** Since not every date has a published paper, the app invisibly retries new dates in the background if it hits a 404 error, ensuring a seamless user experience.
- **Interactive Slider:** Users guess within a 5-year range (±2 years margin of error).
- **Archive Integration:** Includes a "View Full Issue" link at the end of the game to drive traffic back to the actual archives.
- **Analytics:** Integrated with PostHog to track game starts, win rates, and user engagement.

---

## 🛠️ Tech Stack

- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS
- **PDF Engine:** `react-pdf` (powered by `pdfjs-dist`)
- **Icons:** Lucide React
- **Analytics:** PostHog
- **Proxy:** Uses a CORS proxy to fetch PDFs from the PSU archive.

---

## 📦 Installation & Setup

1.  **Clone the repository:**

    ```bash
    git clone [https://github.com/your-username/time-machine-game.git](https://github.com/your-username/time-machine-game.git)
    cd time-machine-game
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Run the development server:**

    ```bash
    npm run dev
    ```

4.  **Build for production:**
    ```bash
    npm run build
    ```

---

## ⚙️ Configuration

You can tweak the game rules by editing the constants at the top of `src/TimeMachine.jsx`:

```javascript
// The range of years to pick from
const START_YEAR = 1940;
const END_YEAR = 2010;

// The Newspaper ID (sn85054904 is The Daily Collegian)
const COLLEGIAN_LCCN = "sn85054904";

// Archive endpoint (handled by Netlify redirects or Vite proxy)
const ARCHIVE_BASE_PATH = "/archive";
```

---

## 📊 Analytics Events (PostHog)

The game tracks the following events to help measure engagement:

| Event Name           | Description                                                                        |
| -------------------- | ---------------------------------------------------------------------------------- |
| `tm_game_start`      | Triggered when a new round begins.                                                 |
| `tm_guess`           | Triggered on every guess. Tracks `guessed_year`, `target_year`, and `page_number`. |
| `tm_game_won`        | Triggered when the user guesses correctly. Tracks streak count.                    |
| `tm_game_lost`       | Triggered when the user runs out of pages.                                         |
| `tm_view_full_issue` | Triggered when users click the external link to read the unredacted paper.         |

---

## ⚖️ Credits & License

- **Content:** All newspaper archives are sourced from the [Pennsylvania Newspaper Archive](https://panewsarchive.psu.edu/), hosted by Penn State University Libraries.
- **License:** [MIT](https://www.google.com/search?q=LICENSE)
