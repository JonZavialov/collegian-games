Here is a professional `README.md` file tailored for your project. You can save this as `README.md` in the root of your project folder.

It covers setup, configuration for your editors (Google Sheets), analytics, and deployment instructions.

---

# Beat The Editor - Weekly News Quiz

"Beat The Editor" is a gamified, interactive news quiz designed for the school newspaper. It is built as a standalone React application that fetches weekly questions from the Collegian Postgres database and sends engagement analytics to PostHog. If no quiz is published yet, the app will show a short unavailable message.

The app is designed to be embedded via an iframe on the main news website to increase time-on-site, drive ad revenue, and traffic to articles.

## ⚡️ Quick Start

### 1. Installation

To run the project locally on your machine:

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

```

Click the link in the terminal (usually `http://localhost:5173`) to see the game.

---

## 🛠 Configuration (Database + Admin UI)

The quiz now loads from the Collegian Postgres database (the same one used for RSS/article data). Editors publish updates via the in-app admin UI, which writes to the database through a Netlify Function.

### 1. Create the quiz table

Run the SQL in `database/quiz_schema.sql` to add the quiz table to your database:

```bash
psql "$DATABASE_URL" -f database/quiz_schema.sql
```

### 2. Configure environment variables

Set these environment variables for Netlify Functions (same DB values used by other games):

- `DB_HOST`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_PORT` (optional; defaults to 5432)
- `QUIZ_ADMIN_PASSCODE` (required to publish quiz updates)

### 3. Brute-force protection

Admin login is protected by an IP-based lockout (5 attempts in 15 minutes triggers a 30-minute lock). This uses the `quiz_admin_attempts` table created in the same schema file.

### 4. Publish quiz updates

Open the game with `?admin=1` appended to the URL, sign in with the admin passcode, and press **Publish**. Successful login creates a short-lived, HttpOnly session cookie; publish requests require that session and are rejected without it.

---

## 📊 Analytics (PostHog)

The app is fully instrumented to track the following KPIs:

- **Journalism CTR:** Clicks on "Read Article" links (`clicked_article_link`).
- **Stickiness:** Weekly Retention (tracked via PostHog "Retention" tab).
- **Engagement:** Completion rates (`game_completed`) and drop-off points (`Youtubeed`).
- **Gamification:** User streaks (`streak_length`) and scores.
- **Virality:** Clicks on the Share button (`clicked_share`).

**To Setup:**

1. Get your API Key from [PostHog.com](https://posthog.com).
2. Paste it into `src/main.jsx`.

---

## 🚀 Deployment & Embedding

### 1. Deploy

This project is optimized for **Vercel** or **Netlify**.

1. Push code to GitHub.
2. Import repository into Vercel/Netlify.
3. Deploy.

### 2. Embed on Website

Use the following "Responsive CSS" code to embed the game on the newspaper website (BLOX/WordPress). This method prevents the content from being cut off on mobile devices.

```html
<div
  style="position: relative; width: 100%; min-height: 850px; overflow: hidden;"
>
  <iframe
    src="https://YOUR-VERCEL-URL.vercel.app"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
    title="Beat the Editor"
    scrolling="no"
  ></iframe>
</div>
```

_Note: If the "Results" screen is cut off on mobile, increase `min-height: 850px` to `900px` or higher._

---

## 📂 Project Structure

- **`src/App.jsx`**: The core logic. Handles fetching data, game state (Intro -> Playing -> Results), and firing analytics events.
- **`src/main.jsx`**: App entry point. Initializes PostHog.
- **`src/index.css`**: Tailwind directives and global styles.
- **`tailwind.config.js`**: Style configuration.

## 🐛 Troubleshooting

**"The questions aren't updating!"**
Verify that the Netlify functions have DB credentials, the quiz table exists, and the admin passcode matches `QUIZ_ADMIN_PASSCODE`.

**"The Analytics aren't showing up."**
Ensure your Ad Blocker isn't blocking PostHog. Check the browser console for network errors.

**"The iframe shows a double scrollbar."**
Your embed height is too short. Increase the `min-height` in the embed code.
