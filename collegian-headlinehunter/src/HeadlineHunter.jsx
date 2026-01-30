import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader,
  Trophy,
  ExternalLink,
  ArrowRight,
  X,
  Info,
} from "lucide-react";
import Confetti from "react-confetti";
import useGameAnalytics from "./hooks/useGameAnalytics";
import DisclaimerFooter from "./components/DisclaimerFooter";

// CONFIGURATION - Pointing to your Netlify/Postgres bridge
const DB_API_ENDPOINT = "/.netlify/functions/get-articles";
const DAILY_LIMIT = 5;
const DAILY_STORAGE_KEY = "headlinehunter_daily_progress";

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const formatDate = (dateKey) =>
  new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

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

const getArticleSortKey = (item) =>
  `${item?.id ?? item?.link ?? item?.headline ?? ""}`;

const getDailyRounds = (articles, dateKey) => {
  const seed = Number(dateKey.replace(/-/g, ""));
  const sorted = [...articles].sort((a, b) =>
    getArticleSortKey(a).localeCompare(getArticleSortKey(b)),
  );
  return seededShuffle(sorted, seed).slice(0, DAILY_LIMIT);
};

export default function HeadlineHunter() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [gameState, setGameState] = useState("loading");
  const [score, setScore] = useState(0);
  const [wrongGuesses, setWrongGuesses] = useState([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [dailyProgress, setDailyProgress] = useState(() => {
    if (typeof window === "undefined") {
      return { dateKey: getTodayKey(), roundsCompleted: 0 };
    }
    const stored = localStorage.getItem(DAILY_STORAGE_KEY);
    if (!stored) {
      return { dateKey: getTodayKey(), roundsCompleted: 0 };
    }
    try {
      const parsed = JSON.parse(stored);
      const roundsCompleted = Number.isInteger(parsed?.roundsCompleted)
        ? parsed.roundsCompleted
        : Number.isInteger(parsed?.roundsPlayed)
          ? parsed.roundsPlayed
          : 0;
      if (typeof parsed?.dateKey === "string") {
        return { dateKey: parsed.dateKey, roundsCompleted };
      }
    } catch (error) {
      console.warn("Failed to read daily progress:", error);
    }
    return { dateKey: getTodayKey(), roundsCompleted: 0 };
  });
  const [currentRoundNumber, setCurrentRoundNumber] = useState(1);
  const roundCompletedRef = useRef(false);

  const analytics = useGameAnalytics("headline-hunter", currentRoundNumber);
  const tutorialStorageKey = "headlinehunter_tutorial_dismissed";
  const todayKey = getTodayKey();
  const effectiveProgress =
    dailyProgress.dateKey === todayKey
      ? dailyProgress
      : { dateKey: todayKey, roundsCompleted: 0 };
  const roundsLeft = Math.max(
    DAILY_LIMIT - effectiveProgress.roundsCompleted,
    0,
  );
  const formattedDate = formatDate(todayKey);

  // Zoom scales: 8x -> 4x -> 2x -> 1x (Full) - Original Logic
  const ZOOM_SCALES = [8, 4, 2, 1];

  // --- 1. FETCH FROM DATABASE BRIDGE (Original XML Parsing Removed) ---
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch(DB_API_ENDPOINT);
        if (!response.ok) throw new Error("Failed to load news");

        const data = await response.json();

        // Map database fields to game fields and clean image URLs
        const parsedArticles = data
          .map((item) => {
            let imageUrl = item.image;

            // Original high-res HACK: Remove "?resize=..."
            if (imageUrl && imageUrl.includes("?")) {
              imageUrl = imageUrl.split("?")[0];
            }

            return {
              id: item.id,
              headline: item.headline,
              link: item.link,
              image: imageUrl,
            };
          })
          .filter((item) => item.image && item.headline);

        setArticles(parsedArticles);
        setLoading(false);
        if (parsedArticles.length > 0) {
          setupRound(parsedArticles);
        }
      } catch (err) {
        console.error("Failed to fetch news:", err);
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  useEffect(() => {
    if (dailyProgress.dateKey !== todayKey) {
      const refreshed = { dateKey: todayKey, roundsCompleted: 0 };
      setDailyProgress(refreshed);
      localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(refreshed));
    }
  }, [dailyProgress.dateKey, todayKey]);

  // --- EVERYTHING BELOW IS YOUR ORIGINAL UNTOUCHED COMPONENT ---

  useEffect(() => {
    const dismissed = localStorage.getItem(tutorialStorageKey) === "true";
    if (!dismissed) {
      setShowTutorial(true);
    }
  }, [tutorialStorageKey]);

  const openTutorial = () => {
    setDontShowAgain(false);
    setShowTutorial(true);
  };

  const closeTutorial = () => {
    if (dontShowAgain) {
      localStorage.setItem(tutorialStorageKey, "true");
    }
    setShowTutorial(false);
  };

  const setupRound = useCallback(
    (articleList = articles) => {
      if (articleList.length < 4) return;

      const todayKey = getTodayKey();
      const baseProgress =
        dailyProgress.dateKey === todayKey
          ? dailyProgress
          : { dateKey: todayKey, roundsCompleted: 0 };
      if (baseProgress.roundsCompleted >= DAILY_LIMIT) {
        setGameState("daily-complete");
        return;
      }

      const roundNumber = baseProgress.roundsCompleted + 1;
      const dailyRounds = getDailyRounds(articleList, todayKey);
      const correct = dailyRounds[roundNumber - 1];
      if (!correct) {
        setGameState("daily-complete");
        return;
      }

      const roundSeed = Number(todayKey.replace(/-/g, "")) + roundNumber * 53;
      const remaining = articleList.filter((item) => item.id !== correct.id);
      const decoys = seededShuffle(remaining, roundSeed).slice(0, 3);
      const options = seededShuffle(
        [correct, ...decoys],
        roundSeed + 17,
      );
      setCurrentRoundNumber(roundNumber);
      roundCompletedRef.current = false;

      setRound({ correct, options });
      setZoomLevel(0);
      setWrongGuesses([]);
      setGameState("playing");

      analytics.logStart({ total_articles: articleList.length }, roundNumber);
      analytics.logAction(
        "round_start",
        { options_count: options.length },
        roundNumber,
      );
    },
    [analytics, articles, dailyProgress]
  );

  const markRoundComplete = useCallback(() => {
    if (roundCompletedRef.current) {
      return;
    }
    roundCompletedRef.current = true;
    const todayKey = getTodayKey();
    const baseProgress =
      dailyProgress.dateKey === todayKey
        ? dailyProgress
        : { dateKey: todayKey, roundsCompleted: 0 };
    const updatedProgress = {
      dateKey: todayKey,
      roundsCompleted: Math.max(
        baseProgress.roundsCompleted,
        currentRoundNumber,
      ),
    };
    setDailyProgress(updatedProgress);
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(updatedProgress));
  }, [currentRoundNumber, dailyProgress]);

  const handleGuess = (articleId) => {
    if (gameState !== "playing") return;

    if (articleId === round.correct.id) {
      setGameState("won");
      setScore(score + 1);
      setZoomLevel(3);
      analytics.logWin({ score: score + 1 }, currentRoundNumber);
      markRoundComplete();
    } else {
      const newWrong = [...wrongGuesses, articleId];
      setWrongGuesses(newWrong);

      if (zoomLevel < 2) {
        setZoomLevel((prev) => prev + 1);
      } else {
        setZoomLevel(3);
      }

      analytics.logAction(
        "guess_wrong",
        { zoom_level: zoomLevel },
        currentRoundNumber,
      );
    }
  };

  const tutorialModal = showTutorial ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/95 backdrop-blur p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                How to play Headline Hunter
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Match the zoomed-in photo to the correct headline.
              </p>
            </div>
            <button
              type="button"
              onClick={closeTutorial}
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
              aria-label="Close tutorial"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-5">
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">
              Core gameplay
            </div>
            <ol className="mt-3 space-y-3 text-sm text-slate-700">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                  1
                </span>
                <span>Look at the photo.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                  2
                </span>
                <span>Pick the headline that matches.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                  3
                </span>
                <span>Wrong guesses zoom out—solve before it&apos;s fully revealed.</span>
              </li>
            </ol>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(event) => setDontShowAgain(event.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              Don't show again
            </label>
            <button
              type="button"
              onClick={closeTutorial}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center">
        <Loader className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-slate-500 font-bold">Connecting to Database...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900">
      {tutorialModal}
      <div className="max-w-2xl mx-auto mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
            Headline Hunter
          </h1>
          <p className="text-slate-500 text-sm">
            Can you identify the story from the detail?
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-full bg-slate-200/70 px-3 py-1">
              Today: {formattedDate}
            </span>
            <span className="rounded-full bg-slate-200/70 px-3 py-1">
              Rounds left: {roundsLeft} / {DAILY_LIMIT}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openTutorial}
            className="bg-white px-3 py-2 rounded-full shadow-sm font-bold text-slate-600 border border-slate-200 flex items-center gap-2 hover:border-blue-200 hover:text-blue-700 transition"
          >
            <Info size={16} /> How to play
          </button>
          <button
            type="button"
            onClick={() => analytics.logFeedback()}
            className="bg-white px-3 py-2 rounded-full shadow-sm font-bold text-slate-600 border border-slate-200 flex items-center gap-2 hover:border-blue-200 hover:text-blue-700 transition"
          >
            Feedback
          </button>
          <div className="bg-white px-4 py-2 rounded-full shadow-sm font-bold text-blue-700 border border-blue-100 flex items-center gap-2">
            <Trophy size={18} /> {score}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {gameState === "daily-complete" ? (
          <div className="bg-white border border-slate-200 p-8 rounded-xl text-center shadow-sm space-y-4">
            <h2 className="text-2xl font-black text-slate-900">
              That&apos;s it for today
            </h2>
            <p className="text-slate-600">
              You&apos;ve completed all {DAILY_LIMIT} Headline Hunter rounds.
            </p>
            <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
              Come back tomorrow for a fresh lineup.
            </div>
          </div>
        ) : (
          <>
            <div className="relative w-full aspect-[4/3] bg-slate-200 rounded-xl overflow-hidden shadow-xl border-4 border-white">
              {gameState === "won" && (
                <Confetti recycle={false} numberOfPieces={200} gravity={0.3} />
              )}
              <div
                className="w-full h-full transition-transform duration-700 ease-in-out"
                style={{
                  backgroundImage: `url(${round?.correct.image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  transform: `scale(${ZOOM_SCALES[zoomLevel]})`,
                }}
              />
              {gameState === "playing" && (
                <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-white/20">
                  Zoom: {ZOOM_SCALES[zoomLevel]}x
                </div>
              )}
            </div>

            {gameState === "won" ? (
              <div className="bg-green-50 border border-green-200 p-6 rounded-xl text-center animate-in zoom-in duration-300">
                <h2 className="text-2xl font-black text-green-700 mb-2">
                  Great Eye!
                </h2>
                <p className="text-green-800 mb-6 font-medium leading-tight">
                  "{round.correct.headline}"
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <a
                    href={round.correct.link}
                    target="_blank"
                    rel="noreferrer"
                    className="px-6 py-3 bg-white border border-green-200 text-green-700 rounded-lg font-bold hover:bg-green-100 transition flex items-center gap-2"
                  >
                    Read Story <ExternalLink size={16} />
                  </a>
                  {roundsLeft > 0 ? (
                    <button
                      onClick={() => setupRound()}
                      className="px-6 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition shadow-lg flex items-center gap-2"
                    >
                      Next Round <ArrowRight size={16} />
                    </button>
                  ) : (
                    <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
                      You&apos;re done for today. Come back tomorrow!
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {round?.options.map(
                  (option) =>
                    !wrongGuesses.includes(option.id) && (
                      <button
                        key={option.id}
                        onClick={() => handleGuess(option.id)}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left group"
                      >
                        <span className="font-bold text-slate-700 group-hover:text-blue-700 text-lg leading-tight block">
                          {option.headline}
                        </span>
                      </button>
                    ),
                )}
              </div>
            )}
          </>
        )}
      </div>
      <DisclaimerFooter />
    </div>
  );
}
