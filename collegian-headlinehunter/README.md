# 🦅 Headline Hunter

**Headline Hunter** is a fully automated visual puzzle game built for _The Daily Collegian_.

**The Premise:** The game pulls live imagery from the newspaper's RSS feed, zooms in 8x on a specific detail, and challenges the user to identify which headline belongs to the photo.

**The Goal:** Gamify news consumption and drive traffic to recent articles without requiring manual curation from editors.

---

## 🚀 How It Works

1.  **Automated Fetching:**
    The app scrapes the _Daily Collegian_ RSS feed (`psucollegian.com`) in real-time to get the latest 50 articles.
2.  **High-Res Hacking:**
    It parses the thumbnail URLs (e.g., `image.jpg?resize=300`) and programmatically strips the query parameters to reveal the **original high-resolution source image**.
3.  **The Game Loop:**
    - **Round 1:** Shows the image at **8x zoom** (Extreme Close-up).
    - **Wrong Guess:** Zooms out to **4x**, then **2x**, revealing more context.
    - **Correct Guess:** Zooms out to **1x** (Full Image) and provides a direct link to read the story.

---

## 🛠️ Tech Stack

- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Data Parsing:** Native `DOMParser` (No heavy XML libraries required)
- **Analytics:** PostHog
- **Proxy:** Uses `corsproxy.io` to bypass CORS restrictions on the RSS feed.

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

You can customize the content source by editing the constants at the top of `src/HeadlineHunter.jsx`.

**Changing the Feed:**
Want to make a "Sports Only" version? Change the RSS URL search parameters:

```javascript
// Current: All Articles
const RSS_URL =
  "[https://www.psucollegian.com/search/?f=rss&l=50&t=article&fulltext=collegian3345](https://www.psucollegian.com/search/?f=rss&l=50&t=article&fulltext=collegian3345)";

// Example: Sports Only
// const RSS_URL = "[https://www.psucollegian.com/search/?f=rss&t=article&c=sports](https://www.psucollegian.com/search/?f=rss&t=article&c=sports)";
```

**CORS Proxy:**
Since the news site does not allow Direct requests from the browser, a proxy is required:

```javascript
const CORS_PROXY = "[https://corsproxy.io/](https://corsproxy.io/)?";
```

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
