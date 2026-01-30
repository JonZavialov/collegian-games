import { useState, useEffect, useRef } from "react";
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
  Calendar,
  Clock,
} from "lucide-react";
import Confetti from "react-confetti";
import posthog from "posthog-js";
import useGameAnalytics from "./hooks/useGameAnalytics";
import useDailyLimit from "./hooks/useDailyLimit";
import DisclaimerFooter from "./components/DisclaimerFooter";

// CONFIGURATION
const DB_API_ENDPOINT = "/.netlify/functions/get-articles";
const DAILY_LIMIT = 5;

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
  const [usedArticleIndices, setUsedArticleIndices] = useState([]);

  // UI Animation States
  const [shake, setShake] = useState(false);
  const [lifeLostAnimation, setLifeLostAnimation] = useState(false);

  const [showTutorial, setShowTutorial] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const tutorialStorageKey = "redacted_tutorial_dismissed";

  const roundIndex = score + 1;
  const analytics = useGameAnalytics("redacted", roundIndex);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Daily limit tracking
  const {
    playsToday,
    hasReachedLimit,
    remainingPlays,
    isLoading: isLimitLoading,
    recordPlay,
    getSeededIndex,
    seededShuffle,
    getShortDate,
    getTimeUntilReset,
  } = useDailyLimit("redacted", DAILY_LIMIT);

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

  const tutorialModal = showTutorial ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/95 backdrop-blur p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="p-6 md:p-8">
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

  const setupRound = (articleList = articles, roundNum = playsToday) => {
    if (!articleList || articleList.length === 0) return;

    // Check if limit reached before setting up a new round
    if (roundNum >= DAILY_LIMIT) {
      setGameState("limit_reached");
      return;
    }

    // --- DIFFICULTY CHECK ---
    // Default to 'easy' so you can see the fix immediately locally
    const difficulty = posthog.getFeatureFlag("redacted-difficulty") || "test";

    // Use seeded random for consistent daily content
    // Each round gets a different article based on the round number
    const articleIndex = getSeededIndex(articleList.length, roundNum);
    const article = articleList[articleIndex];
    setUsedArticleIndices((prev) => [...prev, articleIndex]);
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
      const randomIndex = Math.floor(Math.random() * candidates.length);
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
                Math.random() * remainingIndices.length,
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
            const randomPos = Math.floor(Math.random() * middleIndices.length);
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
      roundIndex,
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
        roundIndex,
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

  const handleGiveUp = () => {
    if (gameState !== "playing") return;
    setLives(0);
    setGameState("lost");
    setWords((w) =>
      w.map((word) => ({ ...word, hidden: false, revealedOnLoss: true })),
    );
    // Record the play for daily limit tracking
    recordPlay();
    analytics.logLoss({ score, method: "surrender" }, roundIndex);
  };

  const handleWin = () => {
    setGameState("won");
    setScore((s) => s + 1);
    // Record the play for daily limit tracking
    recordPlay();
    analytics.logWin({ lives_remaining: lives }, roundIndex);
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
      roundIndex,
    );

    if (newLives <= 0) {
      setGameState("lost");
      setWords((w) =>
        w.map((word) => ({ ...word, hidden: false, revealedOnLoss: true })),
      );
      // Record the play for daily limit tracking
      recordPlay();
      analytics.logLoss({ score, method: "out_of_lives" }, roundIndex);
    }
  };

  if (loading || isLimitLoading) {
    return (
      <>
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center font-sans">
          <Loader className="animate-spin text-blue-600 mb-4" size={48} />
          <p className="text-slate-500 font-bold">Loading today&apos;s headlines...</p>
        </div>
        {tutorialModal}
      </>
    );
  }

  // Show "come back tomorrow" screen when limit is reached
  if (hasReachedLimit || gameState === "limit_reached") {
    return (
      <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900">
        <div className="max-w-lg mx-auto mt-8">
          {/* Daily Status Banner */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar size={24} />
              <span className="text-amber-100 text-sm font-medium">{getShortDate()}</span>
            </div>
            <h1 className="text-2xl font-black">Redacted</h1>
            <p className="text-amber-100 text-sm mt-1">Daily headline word puzzle</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock size={40} className="text-amber-600" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-3">
              All done for today!
            </h2>

            <p className="text-slate-600 mb-6 leading-relaxed">
              You&apos;ve completed all {DAILY_LIMIT} headlines for today.
              Come back tomorrow for new puzzles!
            </p>

            <div className="bg-slate-100 rounded-xl p-4 mb-6">
              <div className="text-sm font-medium text-slate-500 mb-1">New headlines in</div>
              <div className="text-3xl font-black text-slate-900">{getTimeUntilReset()}</div>
            </div>

            <div className="text-sm text-slate-500">
              Today&apos;s score: <span className="font-bold text-amber-600">{score}</span> / {DAILY_LIMIT}
            </div>
          </div>
        </div>
        <DisclaimerFooter />
      </div>
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
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900 pb-32">
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

      {/* DAILY STATUS BANNER */}
      <div className="max-w-2xl mx-auto mb-3">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-3 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <Calendar size={18} className="hidden sm:block" />
              <div>
                <div className="text-xs text-amber-100 font-medium">Today&apos;s Headlines</div>
                <div className="font-bold text-sm">{getShortDate()}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur rounded-lg px-3 py-1.5">
                <span className="text-xs text-amber-100">Round: </span>
                <span className="font-black">{playsToday + 1}/{DAILY_LIMIT}</span>
              </div>
              <div className="bg-white/20 backdrop-blur rounded-lg px-3 py-1.5">
                <span className="text-xs text-amber-100">Left: </span>
                <span className="font-black">{remainingPlays}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto mb-4 flex justify-between items-center sticky top-0 bg-slate-100/95 backdrop-blur z-20 py-2">
        <div>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-2">
            Redacted
          </h1>
          <p className="text-slate-500 text-xs font-medium">
            Guess letters or solve the missing words
          </p>
        </div>

        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={openTutorial}
            className="bg-white px-2.5 py-1.5 rounded-full shadow-sm font-bold text-slate-600 border border-slate-200 flex items-center gap-1.5 hover:border-amber-200 hover:text-amber-700 transition text-xs"
          >
            <Info size={14} />
            <span className="hidden sm:inline">How to play</span>
          </button>

          <button
            type="button"
            onClick={() =>
              analytics.logFeedback?.() ?? analytics.logAction("feedback_click")
            }
            className="bg-white px-2.5 py-1.5 rounded-full shadow-sm font-bold text-slate-600 border border-slate-200 flex items-center gap-1.5 hover:border-amber-200 hover:text-amber-700 transition text-xs"
          >
            Feedback
          </button>

          <div className="bg-white px-3 py-1.5 rounded-full shadow-sm font-bold text-amber-600 border border-amber-100 flex items-center gap-1.5">
            <Trophy size={16} /> {score}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto z-10 relative" ref={listRef}>
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
                      const showCharacter = isRevealed || !isVisibleCharacter;
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

              {/* Show remaining rounds or come back tomorrow */}
              {remainingPlays > 0 ? (
                <p className="text-sm text-slate-500 mb-4">
                  {remainingPlays} {remainingPlays === 1 ? "headline" : "headlines"} left today
                </p>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 mx-4">
                  <div className="flex items-center justify-center gap-2 text-amber-700 font-bold mb-1">
                    <Clock size={18} />
                    <span>All done for today!</span>
                  </div>
                  <p className="text-sm text-amber-600">
                    New headlines in {getTimeUntilReset()}
                  </p>
                </div>
              )}

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
                {remainingPlays > 0 && (
                  <button
                    onClick={() => setupRound(articles, playsToday)}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-black flex items-center justify-center gap-2 shadow-lg"
                  >
                    Next Story <ArrowRight size={16} />
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

              {/* Show remaining rounds or come back tomorrow */}
              {remainingPlays > 0 ? (
                <p className="text-sm text-slate-500 mb-4">
                  {remainingPlays} {remainingPlays === 1 ? "headline" : "headlines"} left today
                </p>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 mx-4">
                  <div className="flex items-center justify-center gap-2 text-amber-700 font-bold mb-1">
                    <Clock size={18} />
                    <span>All done for today!</span>
                  </div>
                  <p className="text-sm text-amber-600">
                    New headlines in {getTimeUntilReset()}
                  </p>
                </div>
              )}

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
                {remainingPlays > 0 && (
                  <button
                    onClick={() => {
                      setScore(0);
                      setupRound(articles, playsToday);
                    }}
                    className="px-8 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-black shadow-lg"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
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
              className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors"
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
