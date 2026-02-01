import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader,
  Trophy,
  ChevronUp,
  ChevronDown,
  X,
  Check,
  Info,
  User,
  Clock,
} from "lucide-react";
import Confetti from "react-confetti";
import useGameAnalytics from "./hooks/useGameAnalytics";
import DisclaimerFooter from "./components/DisclaimerFooter";
import EmailSignup from "./components/EmailSignup";

// CONFIGURATION
const API_ENDPOINT = "/.netlify/functions/cfb-stats";
const DAILY_LIMIT = 5;
const DAILY_STORAGE_KEY = "overunder_daily_progress";
const TUTORIAL_KEY = "overunder_tutorial_dismissed";

// Placeholder image for when ESPN headshot fails
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect fill='%23374151' width='200' height='200'/%3E%3Ccircle cx='100' cy='70' r='40' fill='%236B7280'/%3E%3Cellipse cx='100' cy='170' rx='60' ry='50' fill='%236B7280'/%3E%3C/svg%3E";

// Date utilities
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

const formatCountdown = ({ hours, minutes }) =>
  `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

// Seeded random for deterministic daily puzzles
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

// Generate deterministic daily rounds
// Each round is a pair of cards from the same category
const getDailyRounds = (cards, dateKey) => {
  const seed = Number(dateKey.replace(/-/g, ""));
  const random = createSeededRandom(seed);

  // Group cards by category
  const byCategory = {};
  for (const card of cards) {
    if (!byCategory[card.category]) {
      byCategory[card.category] = [];
    }
    byCategory[card.category].push(card);
  }

  // Get categories with at least 2 cards
  const validCategories = Object.keys(byCategory).filter(
    (cat) => byCategory[cat].length >= 2
  );

  if (validCategories.length === 0) return [];

  // Shuffle categories
  const shuffledCategories = seededShuffle(validCategories, seed);

  // Generate rounds - each round picks a category and two players
  const rounds = [];
  const usedCardIds = new Set();

  for (let i = 0; i < DAILY_LIMIT; i++) {
    // Pick category (cycle through if needed)
    const category = shuffledCategories[i % shuffledCategories.length];
    const categoryCards = byCategory[category].filter(
      (c) => !usedCardIds.has(c.id)
    );

    if (categoryCards.length < 2) {
      // Try to find another category with enough cards
      let found = false;
      for (const altCategory of shuffledCategories) {
        const altCards = byCategory[altCategory].filter(
          (c) => !usedCardIds.has(c.id)
        );
        if (altCards.length >= 2) {
          const shuffled = seededShuffle(altCards, seed + i);
          const left = shuffled[0];
          const right = shuffled[1];
          usedCardIds.add(left.id);
          usedCardIds.add(right.id);
          rounds.push({ left, right, category: altCategory });
          found = true;
          break;
        }
      }
      if (!found) break; // Can't generate more rounds
    } else {
      // Shuffle and pick two cards
      const shuffled = seededShuffle(categoryCards, seed + i);
      const left = shuffled[0];
      const right = shuffled[1];
      usedCardIds.add(left.id);
      usedCardIds.add(right.id);
      rounds.push({ left, right, category });
    }
  }

  return rounds;
};

export default function OverUnder() {
  const [cards, setCards] = useState([]);
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameState, setGameState] = useState("loading"); // loading, playing, won, lost, daily-complete
  const [dailyRounds, setDailyRounds] = useState([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showResult, setShowResult] = useState(null);
  const [revealedValue, setRevealedValue] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [countdown, setCountdown] = useState(getTimeUntilReset());

  const roundCompletedRef = useRef(false);
  const analytics = useGameAnalytics("over-under", roundIndex);

  // Update countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getTimeUntilReset());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check tutorial dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem(TUTORIAL_KEY) === "true";
    if (!dismissed) {
      setShowTutorial(true);
    }
  }, []);

  // Load daily progress from localStorage
  const loadDailyProgress = useCallback(() => {
    const saved = localStorage.getItem(DAILY_STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.date === getTodayKey()) {
          return data;
        }
      } catch {
        // Invalid data, ignore
      }
    }
    return null;
  }, []);

  // Save daily progress to localStorage
  const saveDailyProgress = useCallback((roundIdx, finalScore, completed) => {
    const data = {
      date: getTodayKey(),
      roundIndex: roundIdx,
      score: finalScore,
      completed,
    };
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(data));
  }, []);

  // Fetch player data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) throw new Error("Failed to load player data");

        const data = await response.json();

        if (data.error || !data.cards || data.cards.length < 10) {
          throw new Error(data.error || "Not enough player data available");
        }

        setCards(data.cards);
        setSeason(data.season);

        // Generate daily rounds
        const todayKey = getTodayKey();
        const rounds = getDailyRounds(data.cards, todayKey);
        setDailyRounds(rounds);

        // Check for saved progress
        const savedProgress = loadDailyProgress();
        if (savedProgress) {
          if (savedProgress.completed) {
            setGameState("daily-complete");
            setScore(savedProgress.score);
            setRoundIndex(savedProgress.roundIndex);
          } else {
            // Resume from saved round
            setRoundIndex(savedProgress.roundIndex);
            setScore(savedProgress.score);
            setGameState("playing");
          }
        } else {
          setGameState("playing");
        }

        setLoading(false);
        analytics.logStart({ total_rounds: rounds.length, season: data.season }, 0);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [loadDailyProgress, analytics]);

  const currentRound = dailyRounds[roundIndex];
  const leftCard = currentRound?.left;
  const rightCard = currentRound?.right;

  const handleGuess = useCallback(
    (guess) => {
      if (gameState !== "playing" || isAnimating || !currentRound) return;

      setIsAnimating(true);
      const leftValue = leftCard.value;
      const rightValue = rightCard.value;

      // Reveal the right card value
      setRevealedValue(rightValue);

      // Determine if correct
      let isCorrect = false;
      if (guess === "higher") {
        isCorrect = rightValue >= leftValue;
      } else {
        isCorrect = rightValue <= leftValue;
      }

      analytics.logAction("guess", {
        guess,
        left_player: leftCard.name,
        right_player: rightCard.name,
        left_value: leftValue,
        right_value: rightValue,
        category: currentRound.category,
        correct: isCorrect,
        round: roundIndex + 1,
      });

      if (isCorrect) {
        setShowResult("correct");
        const newScore = score + 1;
        setScore(newScore);

        // Transition to next round after delay
        setTimeout(() => {
          const nextRoundIndex = roundIndex + 1;

          if (nextRoundIndex >= dailyRounds.length) {
            // Completed all rounds - daily complete!
            setGameState("daily-complete");
            saveDailyProgress(nextRoundIndex, newScore, true);
            if (!roundCompletedRef.current) {
              roundCompletedRef.current = true;
              analytics.logWin({ final_score: newScore, rounds_completed: nextRoundIndex });
            }
          } else {
            // Move to next round
            setRoundIndex(nextRoundIndex);
            saveDailyProgress(nextRoundIndex, newScore, false);
          }

          setShowResult(null);
          setRevealedValue(null);
          setIsAnimating(false);
        }, 1500);
      } else {
        setShowResult("wrong");
        setGameState("lost");
        saveDailyProgress(roundIndex, score, true);
        analytics.logLoss({
          final_score: score,
          guess,
          round: roundIndex + 1,
          left_value: leftValue,
          right_value: rightValue,
        });

        setTimeout(() => {
          setIsAnimating(false);
        }, 500);
      }
    },
    [
      gameState,
      isAnimating,
      currentRound,
      leftCard,
      rightCard,
      score,
      roundIndex,
      dailyRounds.length,
      saveDailyProgress,
      analytics,
    ]
  );

  const openTutorial = () => {
    setDontShowAgain(false);
    setShowTutorial(true);
  };

  const closeTutorial = () => {
    if (dontShowAgain) {
      localStorage.setItem(TUTORIAL_KEY, "true");
    }
    setShowTutorial(false);
  };

  const handleImageError = (cardId) => {
    setImageErrors((prev) => ({ ...prev, [cardId]: true }));
  };

  const getImageSrc = (card) => {
    if (imageErrors[card.id]) {
      return PLACEHOLDER_IMAGE;
    }
    return card.image;
  };

  // Tutorial Modal
  const tutorialModal = showTutorial ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-xs sm:max-w-md rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl my-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white">
                How to play Over/Under
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Guess if the next player has higher or lower stats.
              </p>
            </div>
            <button
              type="button"
              onClick={closeTutorial}
              className="rounded-full border border-slate-600 bg-slate-700 p-2 text-slate-400 shadow-sm transition hover:border-blue-400 hover:text-white"
              aria-label="Close tutorial"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-5">
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">
              Core gameplay
            </div>
            <ol className="mt-3 space-y-3 text-sm text-slate-300">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                  1
                </span>
                <span>
                  Two players are shown with the same stat category.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                  2
                </span>
                <span>
                  Guess if the right player has a HIGHER or LOWER value.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                  3
                </span>
                <span>
                  Complete all {DAILY_LIMIT} rounds to win! One wrong guess ends the game.
                </span>
              </li>
            </ol>
          </div>

          <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
            <p className="text-xs text-blue-300">
              <strong>Daily Challenge:</strong> Everyone gets the same {DAILY_LIMIT} matchups each day. Come back tomorrow for new rounds!
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-700 pt-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-400">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(event) => setDontShowAgain(event.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              Don&apos;t show again
            </label>
            <button
              type="button"
              onClick={closeTutorial}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-900/50 transition hover:bg-blue-500"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
        <Loader className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-slate-400 font-bold">Loading Penn State Stats...</p>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-red-900/50 border border-red-500 rounded-xl p-6 max-w-md text-center">
          <X className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-black text-red-400 mb-2">
            Failed to Load
          </h2>
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Player Card Component
  const PlayerCard = ({ card, side, showValue, result, revealed }) => {
    const isLeft = side === "left";
    const bgClass = isLeft ? "bg-blue-900" : "bg-slate-800";
    const valueToShow = revealed !== null ? revealed : card.value;

    return (
      <div
        className={`relative flex-1 ${bgClass} flex flex-col items-center justify-center p-6 sm:p-8 overflow-hidden transition-all duration-500 min-h-[280px] sm:min-h-0`}
      >
        {/* Background gradient overlay */}
        <div
          className={`absolute inset-0 ${
            isLeft
              ? "bg-gradient-to-br from-blue-800/50 to-blue-950/80"
              : "bg-gradient-to-br from-slate-700/50 to-slate-900/80"
          }`}
        />

        {/* Result overlay */}
        {result && (
          <div
            className={`absolute inset-0 flex items-center justify-center z-20 ${
              result === "correct" ? "bg-green-500/30" : "bg-red-500/30"
            } animate-pulse`}
          >
            {result === "correct" ? (
              <Check className="text-green-400" size={80} strokeWidth={3} />
            ) : (
              <X className="text-red-400" size={80} strokeWidth={3} />
            )}
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-xs">
          {/* Player Image */}
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 mb-4 rounded-full overflow-hidden border-4 border-white/20 bg-slate-700 shadow-xl">
            {imageErrors[card.id] ? (
              <div className="w-full h-full flex items-center justify-center bg-slate-700">
                <User className="text-slate-500" size={48} />
              </div>
            ) : (
              <img
                src={getImageSrc(card)}
                alt={card.name}
                className="w-full h-full object-cover"
                onError={() => handleImageError(card.id)}
              />
            )}
          </div>

          {/* Player Name */}
          <h2 className="text-xl sm:text-2xl font-black text-white mb-2 drop-shadow-lg">
            {card.name}
          </h2>

          {/* Stat Category */}
          <p className="text-sm sm:text-base font-bold text-slate-300 uppercase tracking-wider mb-3">
            {card.category}
          </p>

          {/* Stat Value */}
          {showValue || revealed !== null ? (
            <div
              className={`text-4xl sm:text-6xl font-black transition-all duration-500 ${
                revealed !== null ? "animate-reveal text-yellow-400" : "text-white"
              }`}
            >
              {valueToShow.toLocaleString()}
            </div>
          ) : (
            <div className="text-4xl sm:text-6xl font-black text-slate-500">?</div>
          )}
        </div>
      </div>
    );
  };

  // Daily Complete State
  const dailyCompleteScreen = (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-lg w-full text-center shadow-2xl">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-900/50 flex items-center justify-center">
          <Clock className="text-blue-400" size={40} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
          {score === DAILY_LIMIT ? "Perfect Score!" : "Daily Complete"}
        </h2>
        <p className="text-slate-400 mb-4">
          {score === DAILY_LIMIT
            ? `You got all ${DAILY_LIMIT} correct! Amazing knowledge of Penn State football!`
            : `You scored ${score}/${DAILY_LIMIT} today. Come back tomorrow for new matchups!`}
        </p>
        <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
          <p className="text-slate-400 text-sm">Your Score</p>
          <p className="text-4xl font-black text-blue-400">
            {score}/{DAILY_LIMIT}
          </p>
        </div>
        <div className="bg-slate-700/50 rounded-xl p-4 mb-6">
          <p className="text-slate-400 text-sm">Next challenge in</p>
          <p className="text-2xl font-black text-white font-mono">
            {formatCountdown(countdown)}
          </p>
        </div>
        <EmailSignup gameName="Over/Under" />
      </div>
    </div>
  );

  // Game Over (Lost) State
  const gameOverScreen = (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-lg w-full text-center shadow-2xl">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-900/50 flex items-center justify-center">
          <X className="text-red-400" size={40} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
          Game Over!
        </h2>
        <p className="text-slate-400 mb-4">
          {rightCard?.name} had{" "}
          <span className="text-yellow-400 font-bold">
            {revealedValue?.toLocaleString()}
          </span>{" "}
          {rightCard?.category}
        </p>
        <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
          <p className="text-slate-400 text-sm">Final Score</p>
          <p className="text-4xl font-black text-white">
            {score}/{DAILY_LIMIT}
          </p>
        </div>
        <div className="bg-slate-700/50 rounded-xl p-4 mb-6">
          <p className="text-slate-400 text-sm">Next challenge in</p>
          <p className="text-2xl font-black text-white font-mono">
            {formatCountdown(countdown)}
          </p>
        </div>
        <EmailSignup gameName="Over/Under" />
      </div>
    </div>
  );

  // Main Game UI
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans">
      {tutorialModal}

      {/* Confetti on perfect score */}
      {gameState === "daily-complete" && score === DAILY_LIMIT && (
        <Confetti recycle={false} numberOfPieces={300} gravity={0.2} />
      )}

      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-white">
              Over/Under
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm">
              Penn State Football • {season ? `${season} Season` : "Loading..."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={openTutorial}
              className="bg-slate-700 px-3 py-2 rounded-full shadow-sm font-bold text-slate-300 border border-slate-600 flex items-center gap-2 hover:border-blue-400 hover:text-white transition text-sm"
            >
              <Info size={16} />
              <span className="hidden sm:inline">How to play</span>
            </button>
            <div className="bg-slate-700 px-3 py-2 rounded-full shadow-sm font-bold text-slate-400 border border-slate-600 flex items-center gap-2 text-sm">
              Round {Math.min(roundIndex + 1, DAILY_LIMIT)}/{DAILY_LIMIT}
            </div>
            <div className="bg-blue-600 px-4 py-2 rounded-full shadow-lg font-bold text-white border border-blue-500 flex items-center gap-2">
              <Trophy size={18} /> {score}
            </div>
          </div>
        </div>
      </header>

      {/* Game Area */}
      {gameState === "daily-complete" ? (
        dailyCompleteScreen
      ) : gameState === "lost" ? (
        gameOverScreen
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Cards Container */}
          <div className="flex-1 flex flex-col sm:flex-row relative">
            {/* Left Card */}
            {leftCard && (
              <PlayerCard
                card={leftCard}
                side="left"
                showValue={true}
                result={null}
                revealed={null}
              />
            )}

            {/* VS Badge - centered between cards */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-slate-900 border-4 border-slate-600 flex items-center justify-center shadow-2xl">
                <span className="text-lg sm:text-2xl font-black text-white">
                  VS
                </span>
              </div>
            </div>

            {/* Right Card */}
            {rightCard && (
              <PlayerCard
                card={rightCard}
                side="right"
                showValue={false}
                result={showResult}
                revealed={revealedValue}
              />
            )}
          </div>

          {/* Guess Buttons - always at bottom, not overlapping cards */}
          {gameState === "playing" && !showResult && (
            <div className="bg-slate-900 border-t border-slate-700 p-4">
              <div className="flex gap-3 justify-center max-w-sm mx-auto">
                <button
                  onClick={() => handleGuess("higher")}
                  disabled={isAnimating}
                  className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 transition shadow-lg shadow-green-900/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  <ChevronUp size={24} strokeWidth={3} />
                  <span>Higher</span>
                </button>
                <button
                  onClick={() => handleGuess("lower")}
                  disabled={isAnimating}
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-500 transition shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  <ChevronDown size={24} strokeWidth={3} />
                  <span>Lower</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="bg-slate-800 border-t border-slate-700">
        <div className="max-w-4xl mx-auto">
          <DisclaimerFooter />
        </div>
      </div>
    </div>
  );
}
