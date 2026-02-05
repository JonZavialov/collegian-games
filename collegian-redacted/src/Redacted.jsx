import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader,
  Trophy,
  Heart,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  Flag,
  Info,
  X,
} from "lucide-react";
import Confetti from "react-confetti";
import posthog from "posthog-js";
import useGameAnalytics from "./hooks/useGameAnalytics";
import DisclaimerFooter from "./components/DisclaimerFooter";
import EmailSignup from "./components/EmailSignup";

// CONFIGURATION
const DB_API_ENDPOINT = "/.netlify/functions/get-articles";
const DAILY_LIMIT = 5;
const DAILY_STORAGE_KEY = "redacted_daily_progress";

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const formatDate = (dateKey) =>
  new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

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

const formatCountdown = ({ hours, minutes }) =>
  `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

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
  // Parse date components for better seed distribution
  const [year, month, day] = dateKey.split("-").map(Number);
  const seed = year * 1000003 + month * 100003 + day * 10007;
  const sorted = [...articles].sort((a, b) =>
    getArticleSortKey(a).localeCompare(getArticleSortKey(b)),
  );
  return seededShuffle(sorted, seed).slice(0, DAILY_LIMIT);
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "and",
  "but",
  "or",
  "so",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "has",
  "have",
  "had",
  "it",
  "its",
  "from",
  "as",
  "that",
  "this",
  "these",
  "those",
  "he",
  "she",
  "they",
  "we",
  "i",
  "you",
  "his",
  "her",
  "their",
  "our",
  "will",
  "would",
  "can",
  "could",
  "should",
  "may",
  "might",
  "must",
  "up",
  "down",
  "out",
  "over",
  "under",
  "about",
  "into",
  "after",
  "before",
  "said",
  "says",
  "new",
  "more",
  "most",
  "some",
  "no",
  "not",
  "just",
  "like",
  "state",
  "penn",
  "psu",
]);

export default function Redacted() {
  // --- STATE ---
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentArticle, setCurrentArticle] = useState(null);
  const [words, setWords] = useState([]);
  const [guess, setGuess] = useState("");
  const [lives, setLives] = useState(5);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState("loading");

  // UI Animation States
  const [shake, setShake] = useState(false);
  const [lifeLostAnimation, setLifeLostAnimation] = useState(false);

  const [showTutorial, setShowTutorial] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const tutorialStorageKey = "redacted_tutorial_dismissed";
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
  const [timeUntilReset, setTimeUntilReset] = useState(getTimeUntilReset);

  const analytics = useGameAnalytics("redacted", currentRoundNumber);
  const inputRef = useRef(null);
  const listRef = useRef(null);
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

  // --- 1. FETCH NEWS ---
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const cached = sessionStorage.getItem("hh_news_cache");
        if (cached) {
          const { timestamp, data } = JSON.parse(cached);
          if (Date.now() - timestamp < 1000 * 60 * 60) {
            setArticles(data);
            setupRound(data);
            setLoading(false);
            return;
          }
        }

        const response = await fetch(DB_API_ENDPOINT);
        if (!response.ok) throw new Error("Failed to load news from database");

        const parsedItems = await response.json();
        const cleanedItems = parsedItems
          .map((item) => {
            let imageUrl = item.image;
            if (imageUrl && imageUrl.includes("?")) {
              imageUrl = imageUrl.split("?")[0];
            }
            return { ...item, image: imageUrl };
          })
          .filter((item) => item.headline && item.image);

        sessionStorage.setItem(
          "hh_news_cache",
          JSON.stringify({ timestamp: Date.now(), data: cleanedItems }),
        );

        setArticles(cleanedItems);
        setupRound(cleanedItems);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Could not load today's headlines.");
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

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilReset(getTimeUntilReset());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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

  const startReplay = useCallback(() => {
    setIsReplaying(true);
    setScore(0);
    setCurrentRoundNumber(1);
    roundCompletedRef.current = false;
    setGameState("playing");
    analytics.logAction("replay_started", {}, 1);
  }, [analytics]);

  const tutorialModal = showTutorial ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/95 backdrop-blur p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-sm sm:max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl my-auto">
        <div className="p-4 sm:p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900">
                How to play Redacted
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Unredact the headline before you run out of hearts.
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
                <span>Guess a letter or solve a full word.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                  2
                </span>
                <span>Wrong guesses cost a heart.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                  3
                </span>
                <span>Reveal every hidden word to win.</span>
              </li>
            </ol>

            <p className="mt-4 text-xs text-slate-500">
              If you&apos;re stuck, use <span className="font-semibold">Reveal Answer</span> to see the headline.
            </p>
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
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              Let&apos;s play <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const setupRound = (articleList = articles) => {
    if (!articleList || articleList.length === 0) return;
    const todayKey = getTodayKey();
    const baseProgress =
      dailyProgress.dateKey === todayKey
        ? dailyProgress
        : { dateKey: todayKey, roundsCompleted: 0 };

    // In replay mode, use currentRoundNumber directly
    // Otherwise, check if daily limit is reached
    if (!isReplaying && baseProgress.roundsCompleted >= DAILY_LIMIT) {
      setGameState("daily-complete");
      return;
    }

    const roundNumber = isReplaying ? currentRoundNumber : baseProgress.roundsCompleted + 1;
    const dailyRounds = getDailyRounds(articleList, todayKey);
    const article = dailyRounds[roundNumber - 1];
    if (!article) {
      setGameState("daily-complete");
      return;
    }
    const roundSeed = Number(todayKey.replace(/-/g, "")) + roundNumber * 97;
    const random = createSeededRandom(roundSeed);
    setCurrentRoundNumber(roundNumber);
    roundCompletedRef.current = false;

    // --- DIFFICULTY CHECK ---
    // Default to 'easy' so you can see the fix immediately locally
    const difficulty = posthog.getFeatureFlag("redacted-difficulty") || "test";
    setCurrentArticle(article);

    const cleanTitle = article.headline
      .replace(/‘|’/g, "'")
      .replace(/“|”/g, '"')
      .trim();

    const tokens =
      cleanTitle.match(/[a-z0-9]+(?:'[a-z0-9]+)*|\s+|[.,!?:;"()]/gi) ?? [];

    // --- CANDIDATE SELECTION FIX ---
    // Prevent hiding Names (Proper Nouns) and single-letter words
    const candidates = [];
    tokens.forEach((token, index) => {
      const isProperNoun = /^[A-Z]/.test(token);
      const isSingleChar = token.length <= 1;
      const lower = token.toLowerCase().trim();

      if (
        /^[a-z0-9]+(?:'[a-z0-9]+)*$/i.test(lower) &&
        !STOP_WORDS.has(lower) &&
        !isProperNoun &&
        !isSingleChar
      ) {
        candidates.push(index);
      }
    });

    // Fallback: If 0 candidates found, allow names but still block single chars
    if (candidates.length === 0) {
      tokens.forEach((token, index) => {
        const isSingleChar = token.length <= 1;
        const lower = token.toLowerCase().trim();
        if (
          /^[a-z0-9]+(?:'[a-z0-9]+)*$/i.test(lower) &&
          !STOP_WORDS.has(lower) &&
          !isSingleChar
        ) {
          candidates.push(index);
        }
      });
    }

    const maxHidable = Math.ceil(candidates.length / 2);
    const targetHideCount = Math.max(1, Math.min(3, maxHidable));

    const indicesToHide = new Set();
    let attempts = 0;
    while (
      indicesToHide.size < targetHideCount &&
      indicesToHide.size < candidates.length &&
      attempts < 50
    ) {
      const randomIndex = Math.floor(random() * candidates.length);
      indicesToHide.add(candidates[randomIndex]);
      attempts++;
    }

    const wordObjects = tokens.map((token, index) => {
      const isWord = /^[a-z0-9]+(?:'[a-z0-9]+)*$/i.test(
        token.toLowerCase().trim(),
      );
      const hidden = indicesToHide.has(index);
      const revealedMap = hidden
        ? token.split("").map((char) => !/[a-z0-9]/i.test(char))
        : [];

      if (hidden) {
        const characters = token.split("");
        const visibleIndices = characters
          .map((char, charIndex) => (/[a-z0-9]/i.test(char) ? charIndex : null))
          .filter((charIndex) => charIndex !== null);

        // --- 1. ALWAYS REVEAL FIRST LETTER (Universal Rule) ---
        const firstVisibleIndex = visibleIndices[0];
        if (firstVisibleIndex !== undefined) {
          revealedMap[firstVisibleIndex] = true;
        }

        // --- 2. BRANCH BASED ON DIFFICULTY ---
        if (difficulty === "control") {
          // === ORIGINAL HARD MODE LOGIC ===
          // Only gives extra hints if the word is very long (>5 chars)
          if (visibleIndices.length > 5) {
            const remainingIndices = visibleIndices.filter(
              (charIndex) => charIndex !== firstVisibleIndex,
            );
            // Reveal up to 2 random letters for long words
            for (let i = 0; i < 2 && remainingIndices.length > 0; i += 1) {
              const randomIndex = Math.floor(
                random() * remainingIndices.length,
              );
              const revealedIndex = remainingIndices.splice(randomIndex, 1)[0];
              revealedMap[revealedIndex] = true;
            }
          }
        } else {
          // === EASY MODE LOGIC ===
          // (Does NOT run the code above. Uses its own "50% Middle" rule instead)

          // A. Reveal Last Letter
          const lastVisibleIndex = visibleIndices[visibleIndices.length - 1];
          if (
            lastVisibleIndex !== undefined &&
            lastVisibleIndex !== firstVisibleIndex
          ) {
            revealedMap[lastVisibleIndex] = true;
          }

          // B. Reveal 50% of the MIDDLE letters
          const middleIndices = visibleIndices.filter(
            (idx) => idx !== firstVisibleIndex && idx !== lastVisibleIndex,
          );

          // Calculate 50% of just the middle chunk
          const lettersToReveal = Math.floor(middleIndices.length * 0.5);

          for (
            let i = 0;
            i < lettersToReveal && middleIndices.length > 0;
            i++
          ) {
            const randomPos = Math.floor(random() * middleIndices.length);
            const idxToReveal = middleIndices.splice(randomPos, 1)[0];
            revealedMap[idxToReveal] = true;
          }
        }
      }

      return {
        id: index,
        text: token,
        cleanText: token.toLowerCase().trim(),
        hidden,
        revealedMap,
        justRevealedIndices: [],
        isPunctuation: !isWord,
      };
    });

    setWords(wordObjects);
    setLives(5);
    setGuess("");
    setGameState("playing");
    setShake(false);
    setLifeLostAnimation(false);

    analytics.logStart(
      { headline_length: tokens.length, difficulty_variant: difficulty },
      roundNumber,
    );

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleGuess = (e) => {
    e.preventDefault();
    if (gameState !== "playing" || !guess.trim()) return;

    const currentGuess = guess.toLowerCase().trim();
    const isLetterGuess = /^[a-z]$/i.test(currentGuess);
    let found = false;

    const newWords = words.map((word) => {
      if (!word.hidden) {
        return { ...word, justRevealed: false, justRevealedIndices: [] };
      }

      if (isLetterGuess) {
        const characters = word.text.split("");
        const updatedMap =
          word.revealedMap.length > 0
            ? [...word.revealedMap]
            : characters.map((char) => !/[a-z0-9]/i.test(char));
        const newlyRevealedIndices = [];

        characters.forEach((char, index) => {
          if (
            /[a-z0-9]/i.test(char) &&
            char.toLowerCase() === currentGuess &&
            !updatedMap[index]
          ) {
            updatedMap[index] = true;
            newlyRevealedIndices.push(index);
          }
        });

        if (newlyRevealedIndices.length > 0) {
          found = true;
        }

        const fullyRevealed = characters.every(
          (char, index) =>
            !/[a-z0-9]/i.test(char) || updatedMap[index] === true,
        );

        if (fullyRevealed) {
          return {
            ...word,
            hidden: false,
            revealedMap: updatedMap,
            justRevealed: true,
            justRevealedIndices: [],
          };
        }

        return {
          ...word,
          revealedMap: updatedMap,
          justRevealed: false,
          justRevealedIndices: newlyRevealedIndices,
        };
      }

      if (word.cleanText === currentGuess) {
        found = true;
        return {
          ...word,
          hidden: false,
          justRevealed: true,
          justRevealedIndices: [],
        };
      }

      return { ...word, justRevealed: false, justRevealedIndices: [] };
    });

    if (found) {
      setWords(newWords);
      setGuess("");
      analytics.logAction(
        "guess_correct",
        { guess: currentGuess, type: isLetterGuess ? "letter" : "word" },
        currentRoundNumber,
      );

      const remaining = newWords.filter((w) => w.hidden).length;
      if (remaining === 0) {
        handleWin();
      }
    } else {
      handleLossAttempt({
        guessValue: currentGuess,
        guessType: isLetterGuess ? "letter" : "word",
      });
    }
  };

  const markRoundComplete = useCallback(() => {
    if (roundCompletedRef.current) {
      return;
    }
    roundCompletedRef.current = true;

    // Don't update localStorage progress during replay
    if (isReplaying) {
      return;
    }

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
  }, [currentRoundNumber, dailyProgress, isReplaying]);

  const handleGiveUp = () => {
    if (gameState !== "playing") return;
    setLives(0);
    setGameState("lost");
    setWords((w) =>
      w.map((word) => ({ ...word, hidden: false, revealedOnLoss: true })),
    );
    analytics.logLoss({ score, method: "surrender" }, currentRoundNumber);
    markRoundComplete();
  };

  const handleWin = () => {
    setGameState("won");
    setScore((s) => s + 1);
    analytics.logWin({ lives_remaining: lives }, currentRoundNumber);
    markRoundComplete();
  };

  const handleLossAttempt = ({ guessValue, guessType }) => {
    setShake(true);
    setLifeLostAnimation(true);
    setTimeout(() => {
      setShake(false);
      setLifeLostAnimation(false);
    }, 500);

    const newLives = lives - 1;
    setLives(newLives);
    setGuess("");

    analytics.logAction(
      "guess_wrong",
      { guess: guessValue, type: guessType, lives: newLives },
      currentRoundNumber,
    );

    if (newLives <= 0) {
      setGameState("lost");
      setWords((w) =>
        w.map((word) => ({ ...word, hidden: false, revealedOnLoss: true })),
      );
      analytics.logLoss({ score, method: "out_of_lives" }, currentRoundNumber);
      markRoundComplete();
    }
  };


  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center font-sans">
          <Loader className="animate-spin text-blue-600 mb-4" size={48} />
          <p className="text-slate-500 font-bold">Loading Headlines...</p>
        </div>
        {tutorialModal}
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
            <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Unavailable
            </h2>
            <p className="text-slate-500 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold"
            >
              Retry
            </button>
          </div>
        </div>
        {tutorialModal}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900 pb-24 md:pb-32">
      {tutorialModal}

      {/* Confetti fixed to background layer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        {gameState === "won" && (
          <Confetti recycle={false} numberOfPieces={200} gravity={0.3} />
        )}
      </div>

      <div className="max-w-2xl mx-auto mb-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center sticky top-0 bg-slate-100/95 backdrop-blur z-20 py-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-2">
            Redacted <span className="text-slate-300 hidden sm:inline">|</span>
          </h1>
          <p className="text-slate-500 text-xs md:text-sm font-medium">
            Guess letters or solve the missing words
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[0.7rem] font-semibold text-slate-500">
            <span className="rounded-full bg-slate-200/70 px-3 py-1">
              Today: {formattedDate}
            </span>
            <span className="rounded-full bg-slate-200/70 px-3 py-1">
              Rounds left: {roundsLeft} / {DAILY_LIMIT}
            </span>
          </div>
        </div>

        <div className="flex gap-2 md:gap-3 items-center flex-wrap">
          <button
            type="button"
            onClick={openTutorial}
            className="bg-white px-3 py-2 rounded-full shadow-sm font-bold text-slate-600 border border-slate-200 flex items-center gap-2 hover:border-blue-200 hover:text-blue-700 transition text-xs md:text-sm"
          >
            <Info size={14} />{" "}
            <span className="hidden sm:inline">How to play</span>
          </button>

          <button
            type="button"
            onClick={() =>
              analytics.logFeedback?.() ?? analytics.logAction("feedback_click")
            }
            className="bg-white px-3 py-2 rounded-full shadow-sm font-bold text-slate-600 border border-slate-200 flex items-center gap-2 hover:border-blue-200 hover:text-blue-700 transition text-xs md:text-sm"
          >
            Feedback
          </button>

          <div className="bg-white px-3 py-1.5 rounded-full shadow-sm font-bold text-blue-700 border border-blue-100 flex items-center gap-1.5">
            <Trophy size={16} /> {score}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto z-10 relative" ref={listRef}>
        {isReplaying && gameState !== "daily-complete" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center mb-4">
            <p className="text-amber-800 font-semibold text-sm">
              Replay Mode — Same headlines from earlier today
            </p>
            <p className="text-amber-600 text-xs mt-1">
              New rounds available tomorrow at midnight
            </p>
          </div>
        )}

        {gameState === "daily-complete" ? (
          <div className="bg-white rounded-xl shadow-xl border-4 border-white p-6 md:p-10 text-center space-y-4">
            <h2 className="text-2xl font-black text-slate-900">
              That&apos;s today&apos;s edition
            </h2>
            <p className="text-slate-600">
              You&apos;ve finished all {DAILY_LIMIT} Redacted rounds for today.
            </p>
            <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
              New rounds in{" "}
              <span className="font-black text-slate-800">
                {formatCountdown(timeUntilReset)}
              </span>
              .
            </div>
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <button
                onClick={() => {
                  startReplay();
                  setTimeout(() => setupRound(), 0);
                }}
                className="w-full px-6 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition shadow-lg"
              >
                Replay Today&apos;s Headlines
              </button>
              <p className="text-xs text-slate-500">
                Same puzzles, same fun. Come back tomorrow for fresh content!
              </p>
            </div>
            <EmailSignup gameName="Redacted" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-xl border-4 border-white p-4 md:p-10 flex flex-col justify-center gap-6 relative overflow-hidden min-h-[200px] md:min-h-[300px]">
            {currentArticle?.image && (
              <div className="w-full overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                <img
                  src={currentArticle.image}
                  alt={currentArticle.headline}
                  className="h-48 w-full object-cover md:h-64"
                  loading="lazy"
                />
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-x-2 gap-y-3 text-center leading-relaxed">
              {words.map((word) => {
                if (word.hidden) {
                  const characters = word.text.split("");
                  return (
                    <span
                      key={word.id}
                      className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 shadow-inner ring-1 ring-slate-200/80"
                    >
                      {characters.map((char, index) => {
                        const isRevealed = word.revealedMap?.[index];
                        const isVisibleCharacter = /[a-z0-9]/i.test(char);
                        const showCharacter =
                          isRevealed || !isVisibleCharacter;
                        return (
                          <span
                            key={`${word.id}-${index}`}
                            className={`flex h-8 w-6 items-center justify-center rounded border border-slate-300 bg-white text-lg font-bold uppercase text-slate-800 shadow-sm transition-all duration-300 md:h-10 md:w-8 md:text-2xl ${
                              showCharacter
                                ? "text-slate-800"
                                : "text-transparent"
                            } ${
                              word.justRevealedIndices?.includes(index)
                                ? "animate-letter-pop text-blue-700"
                                : ""
                            }`}
                          >
                            {showCharacter ? char : " "}
                          </span>
                        );
                      })}
                    </span>
                  );
                }
                return (
                  <span
                    key={word.id}
                    className={`text-2xl md:text-4xl font-bold transition-all duration-500 ${
                      word.justRevealed
                        ? "text-blue-600 scale-110"
                        : "text-slate-800"
                    } ${word.revealedOnLoss ? "text-red-500" : ""} ${
                      word.isPunctuation ? "text-slate-400" : ""
                    }`}
                  >
                    {word.text}
                  </span>
                );
              })}
            </div>

            {gameState === "won" && (
              <div className="mt-6 pt-6 border-t border-slate-100 text-center animate-in slide-in-from-bottom-4">
                <h3 className="text-xl font-black text-green-600 mb-2">
                  Headlines Restored!
                </h3>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <a
                    href={currentArticle?.link}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2.5 bg-white border border-green-200 text-green-700 rounded-lg font-bold hover:bg-green-50 flex items-center justify-center gap-2"
                    onClick={() =>
                      analytics.logAction("article_clicked", {
                        url: currentArticle.link,
                        result: "won",
                      })
                    }
                  >
                    Read Story <ExternalLink size={16} />
                  </a>
                  {(isReplaying && currentRoundNumber < DAILY_LIMIT) || roundsLeft > 0 ? (
                    <button
                      disabled={gameState !== "won"}
                      onClick={() => {
                        // Prevent double-clicks
                        if (gameState !== "won") return;
                        // Clear state immediately to prevent stale content
                        setCurrentArticle(null);
                        setWords([]);
                        if (isReplaying) {
                          setCurrentRoundNumber((prev) => prev + 1);
                          roundCompletedRef.current = false;
                          // setTimeout needed so setupRound sees updated currentRoundNumber
                          setTimeout(() => setupRound(), 0);
                        } else {
                          setupRound();
                        }
                      }}
                      className="px-5 py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-black flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                    >
                      Next Story <ArrowRight size={16} />
                    </button>
                  ) : isReplaying ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
                        Replay complete! Come back tomorrow for new headlines.
                      </div>
                      <button
                        onClick={() => {
                          setIsReplaying(false);
                          setGameState("daily-complete");
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        Back to summary
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setGameState("daily-complete")}
                      className="px-6 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition shadow-lg flex items-center gap-2"
                    >
                      See Summary <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {gameState === "lost" && (
              <div className="mt-6 pt-6 border-t border-slate-100 text-center animate-in slide-in-from-bottom-4">
                <h3 className="text-xl font-black text-red-600 mb-2">
                  Story Redacted.
                </h3>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <a
                    href={currentArticle?.link}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50 flex items-center justify-center gap-2"
                    onClick={() =>
                      analytics.logAction("article_clicked", {
                        url: currentArticle.link,
                        result: "lost",
                      })
                    }
                  >
                    Read Story <ExternalLink size={16} />
                  </a>
                  {(isReplaying && currentRoundNumber < DAILY_LIMIT) || roundsLeft > 0 ? (
                    <button
                      disabled={gameState !== "lost"}
                      onClick={() => {
                        // Prevent double-clicks
                        if (gameState !== "lost") return;
                        // Clear state immediately to prevent stale content
                        setCurrentArticle(null);
                        setWords([]);
                        if (isReplaying) {
                          setCurrentRoundNumber((prev) => prev + 1);
                          roundCompletedRef.current = false;
                          // setTimeout needed so setupRound sees updated currentRoundNumber
                          setTimeout(() => setupRound(), 0);
                        } else {
                          setScore(0);
                          setupRound();
                        }
                      }}
                      className="px-8 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-black shadow-lg disabled:opacity-50"
                    >
                      Next Story
                    </button>
                  ) : isReplaying ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
                        Replay complete! Come back tomorrow for new headlines.
                      </div>
                      <button
                        onClick={() => {
                          setIsReplaying(false);
                          setGameState("daily-complete");
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        Back to summary
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setGameState("daily-complete")}
                      className="px-6 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition shadow-lg flex items-center gap-2"
                    >
                      See Summary <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {(gameState === "won" || gameState === "lost") && (
              <EmailSignup gameName="Redacted" />
            )}
          </div>
        )}
      </div>

      <DisclaimerFooter />

      <div
        className={`fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 transition-transform duration-300 z-50 ${
          gameState !== "playing" ? "translate-y-full" : ""
        }`}
      >
        <div className="max-w-2xl mx-auto relative">
          {/* NEW LIVES INDICATOR */}
          <div className="absolute -top-12 right-0 flex justify-end w-full px-2">
            <div
              className={`bg-white px-4 py-2 rounded-t-xl shadow-lg font-black border-t border-x flex items-center gap-2 transition-all duration-200 ${
                lives <= 2
                  ? "text-red-600 border-red-200 bg-red-50"
                  : "text-slate-700 border-slate-200"
              } ${lifeLostAnimation ? "scale-125 bg-red-500 text-white" : ""}`}
            >
              <Heart
                size={20}
                fill="currentColor"
                className={lifeLostAnimation ? "animate-ping" : ""}
              />
              <span className="text-lg">{lives}</span>
            </div>
          </div>

          <form
            onSubmit={handleGuess}
            className={`relative ${shake ? "animate-shake" : ""}`}
          >
            <input
              ref={inputRef}
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Guess a letter or a word..."
              className={`w-full bg-slate-100 border-2 text-slate-900 text-lg font-bold py-3 pl-5 pr-12 rounded-xl focus:outline-none focus:bg-white transition-all placeholder-slate-400 ${
                shake
                  ? "border-red-500 bg-red-50"
                  : "border-slate-200 focus:border-blue-500"
              }`}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!guess}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 sm:p-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              <ArrowRight size={20} />
            </button>
          </form>

          <div className="flex justify-between items-center mt-2 px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {words.filter((w) => w.hidden).length} Words Left
            </span>
            <button
              type="button"
              onClick={handleGiveUp}
              className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors uppercase tracking-wider p-3 -mr-3 cursor-pointer select-none active:scale-95"
            >
              <Flag size={12} /> Reveal Answer
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        .animate-letter-pop { animation: letter-pop 0.35s ease-out both; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes letter-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
