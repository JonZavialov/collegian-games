# 🦅 Headline Hunter

**Headline Hunter** is a fully automated visual puzzle game built for _The Daily Collegian_.

**The Premise:** The game pulls live imagery from the Daily Collegian article database (synced from the RSS feed), zooms in 8x on a specific detail, and challenges the user to identify which headline belongs to the photo.

**The Goal:** Gamify news consumption and drive traffic to recent articles without requiring manual curation from editors.

---

## 🚀 How It Works

1.  **Database Sync (RSS → Postgres):**
    A scheduled scraper ingests the _Daily Collegian_ RSS feed into our Postgres database. This switch avoids RSS 429 rate-limit errors while still keeping the content fresh.
2.  **App Fetch (Postgres → Netlify Function → Client):**
    The game calls `/.netlify/functions/get-articles`, which reads recent articles from the database and returns clean JSON (no XML parsing or CORS issues in the browser).
3.  **High-Res Hacking:**
    The client strips thumbnail query parameters (e.g., `image.jpg?resize=300`) to reveal the **original high-resolution source image**.
4.  **The Game Loop:**
    - **Round 1:** Shows the image at **8x zoom** (Extreme Close-up).
    - **Wrong Guess:** Zooms out to **4x**, then **2x**, revealing more context.
    - **Correct Guess:** Zooms out to **1x** (Full Image) and provides a direct link to read the story.

---

## 🛠️ Tech Stack

- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Data Source:** Postgres (synced from RSS), served via Netlify Function
- **Analytics:** PostHog
- **Proxy:** Netlify redirects (production) and Vite proxy (development).

---

## 📦 Installation & Setup

1.  **Clone the repository:**

    ```bash
    git clone [https://github.com/your-username/headline-hunter.git](https://github.com/your-username/headline-hunter.git)
    cd headline-hunter
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

You can customize the content source by editing the constants at the top of `src/App.jsx`.

**Changing the Source:**
Want to swap to a different database or endpoint? Update the API endpoint:

```javascript
// Current: Database-backed Netlify function
const DB_API_ENDPOINT = "/.netlify/functions/get-articles";
```

If you need to adjust which articles are returned, edit the SQL query in `netlify/functions/get-articles.js`.

---

## 📊 Analytics (PostHog)

The game tracks the following events to measure user engagement:

| Event Name       | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `hh_round_start` | Triggered when a new image is loaded.                      |
| `hh_guess_wrong` | Triggered when a user clicks a decoy headline.             |
| `hh_round_won`   | Triggered when the user identifies the correct headline.   |
| `hh_read_story`  | Triggered when the user clicks "Read Story" after winning. |

---

## ⚖️ Credits & License

- **Content:** All images and headlines courtesy of [The Daily Collegian](https://www.psucollegian.com/).
- **License:** [MIT](https://www.google.com/search?q=LICENSE)
