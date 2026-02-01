# Beat the Editor (Weekly News Quiz)

Beat the Editor is a weekly news quiz for **The Daily Collegian**. Players answer a set of multiple-choice questions and compare their score to the editor’s score. Editors can publish new quizzes via an in-app admin panel.

## How the game works

### Data flow

1. **Postgres → Netlify Function**: `netlify/functions/get-quiz.js` reads the latest quiz JSON from the `quiz_configs` table.
2. **Netlify Function → Client**: `BeatTheEditor.jsx` fetches `/.netlify/functions/get-quiz`, normalizes the data, and hydrates the game UI.
3. **Admin publishing**: The admin panel (`AdminPanel.jsx`) writes new quiz payloads to `/.netlify/functions/publish-quiz`, which updates `quiz_configs` and snapshots the previous version in `quiz_config_versions`.

### Gameplay loop

- **Question set**: The app defaults to 10 questions. A PostHog feature flag (`bte-difficulty`) can switch to a 5-question variant for A/B testing.
- **Scoring**: Correct answers increment the player score; the editor score is normalized to match the selected question count.
- **Streaks**: A local `newsGameStreak` value tracks consecutive wins.
- **Tutorial modal**: First-time players see a how-to-play modal stored under `beat-the-editor_tutorial_dismissed`.

## Admin workflow

Open the quiz with `?admin=1` to access the admin UI.

- **Authentication**: `admin-login.js` verifies `QUIZ_ADMIN_PASSCODE`, stores a short-lived session in `quiz_admin_sessions`, and sets an HttpOnly cookie (`quiz_admin_session`).
- **Session checks**: `admin-session.js` and `admin-logout.js` read/clear the session cookie.
- **Version history**: `list-quiz-versions.js` and `restore-quiz-version.js` allow editors to roll back to any prior publish.
- **Lockout protection**: `quiz_admin_attempts` enforces a 5-attempt limit within a 15-minute window before locking for 30 minutes.

## Quiz data shape

Each quiz payload stored in Postgres uses the structure enforced by `normalizeQuizData`:

```json
{
  "editorName": "The Editor",
  "editorScore": 7,
  "editorImageUrl": "https://...",
  "editorBlurb": "Short editor bio",
  "authorName": "Quiz Author",
  "questions": [
    {
      "id": "q-...",
      "text": "Question text",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "blurb": "Explanation shown after answer",
      "articleTitle": "Related article",
      "articleUrl": "https://..."
    }
  ]
}
```

## Key files

| File | Responsibility |
| --- | --- |
| `src/BeatTheEditor.jsx` | Game flow, scoring, feature flag logic, analytics. |
| `src/components/AdminPanel.jsx` | Admin UI for editing, importing, and publishing quizzes. |
| `src/utils/quizData.js` | Quiz data normalization + defaults. |
| `src/hooks/useGameAnalytics.js` | PostHog event helpers. |
| `netlify/functions/get-quiz.js` | Reads the latest quiz config. |
| `netlify/functions/publish-quiz.js` | Writes new quizzes + snapshots prior version. |
| `netlify/functions/admin-login.js` | Passcode auth + session creation. |

## Analytics

The game uses `useGameAnalytics` and PostHog feature flags to track:

- `game_start`, `game_progress`, `game_won`, `game_lost`
- Quiz completion, share clicks, and article link clicks

## Environment variables

Netlify functions require Postgres credentials plus an admin passcode:

```
DB_HOST
DB_NAME
DB_USER
DB_PASSWORD
DB_PORT
QUIZ_ADMIN_PASSCODE
```

The client expects PostHog credentials in `.env`:

```
VITE_PUBLIC_POSTHOG_KEY
VITE_PUBLIC_POSTHOG_HOST
```

## Local development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```
