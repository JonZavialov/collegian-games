import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader,
  Trophy,
  ChevronUp,
  ChevronDown,
  X,
  Check,
  Info,
  RotateCcw,
  User,
} from "lucide-react";
import Confetti from "react-confetti";
import useGameAnalytics from "./hooks/useGameAnalytics";
import DisclaimerFooter from "./components/DisclaimerFooter";
import EmailSignup from "./components/EmailSignup";

const API_ENDPOINT = "/.netlify/functions/cfb-stats";
const STORAGE_KEY = "overunder_progress";
const TUTORIAL_KEY = "overunder_tutorial_dismissed";
const HIGH_SCORE_KEY = "overunder_high_score";

// Placeholder image for when ESPN headshot fails
const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect fill='%23374151' width='200' height='200'/%3E%3Ccircle cx='100' cy='70' r='40' fill='%236B7280'/%3E%3Cellipse cx='100' cy='170' rx='60' ry='50' fill='%236B7280'/%3E%3C/svg%3E";

export default function OverUnder() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameState, setGameState] = useState("loading"); // loading, playing, correct, wrong, lost
  const [leftCard, setLeftCard] = useState(null);
  const [rightCard, setRightCard] = useState(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showResult, setShowResult] = useState(null); // 'correct' | 'wrong' | null
  const [revealedValue, setRevealedValue] = useState(null);
  const [imageErrors, setImageErrors] = useState({});

  const usedCardsRef = useRef(new Set());
  const roundRef = useRef(0);
  const analytics = useGameAnalytics("over-under", roundRef.current);

  // Load high score from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(HIGH_SCORE_KEY);
    if (saved) {
      setHighScore(parseInt(saved, 10) || 0);
    }
  }, []);

  // Check tutorial dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem(TUTORIAL_KEY) === "true";
    if (!dismissed) {
      setShowTutorial(true);
    }
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
        setLoading(false);
        initGame(data.cards);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get a random card, optionally filtered by category
  const getRandomCard = useCallback((cardList, exclude = new Set(), category = null) => {
    let available = cardList.filter((c) => !exclude.has(c.id));
    if (category) {
      available = available.filter((c) => c.category === category);
    }
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }, []);

  // Get categories that have at least 2 unused players
  const getAvailableCategories = useCallback((cardList, exclude = new Set()) => {
    const categoryCounts = {};
    for (const card of cardList) {
      if (!exclude.has(card.id)) {
        categoryCounts[card.category] = (categoryCounts[card.category] || 0) + 1;
      }
    }
    return Object.keys(categoryCounts).filter((cat) => categoryCounts[cat] >= 2);
  }, []);

  const initGame = useCallback(
    (cardList = cards) => {
      usedCardsRef.current = new Set();
      roundRef.current = 0;

      // Get categories with at least 2 players
      const availableCategories = getAvailableCategories(cardList, usedCardsRef.current);
      if (availableCategories.length === 0) {
        setError("Not enough players in any category");
        return;
      }

      // Pick a random category
      const category = availableCategories[Math.floor(Math.random() * availableCategories.length)];

      const first = getRandomCard(cardList, usedCardsRef.current, category);
      if (!first) return;
      usedCardsRef.current.add(first.id);

      const second = getRandomCard(cardList, usedCardsRef.current, category);
      if (!second) return;
      usedCardsRef.current.add(second.id);

      setLeftCard(first);
      setRightCard(second);
      setScore(0);
      setGameState("playing");
      setShowResult(null);
      setRevealedValue(null);
      setImageErrors({});

      analytics.logStart({ total_cards: cardList.length, category }, 0);
    },
    [cards, getRandomCard, getAvailableCategories, analytics]
  );

  const handleGuess = useCallback(
    (guess) => {
      if (gameState !== "playing" || isAnimating) return;

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
        left_value: leftValue,
        right_value: rightValue,
        left_category: leftCard.category,
        right_category: rightCard.category,
        correct: isCorrect,
      });

      if (isCorrect) {
        setShowResult("correct");
        const newScore = score + 1;
        setScore(newScore);
        roundRef.current += 1;

        // Update high score
        if (newScore > highScore) {
          setHighScore(newScore);
          localStorage.setItem(HIGH_SCORE_KEY, newScore.toString());
        }

        // Transition to next round after delay
        setTimeout(() => {
          // Try to get next card in same category
          let nextCard = getRandomCard(cards, usedCardsRef.current, rightCard.category);

          // If no more cards in this category, pick a new category
          if (!nextCard) {
            const availableCategories = getAvailableCategories(cards, usedCardsRef.current);
            if (availableCategories.length === 0) {
              // No more valid categories - player wins!
              setGameState("won");
              analytics.logWin({ final_score: newScore });
              setIsAnimating(false);
              return;
            }
            // Pick new category and get a card from it
            const newCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];
            nextCard = getRandomCard(cards, usedCardsRef.current, newCategory);
          }

          if (!nextCard) {
            // Truly no more cards
            setGameState("won");
            analytics.logWin({ final_score: newScore });
            setIsAnimating(false);
            return;
          }

          usedCardsRef.current.add(nextCard.id);

          // Slide animation: right becomes left, new card on right
          setLeftCard(rightCard);
          setRightCard(nextCard);
          setShowResult(null);
          setRevealedValue(null);
          setIsAnimating(false);
        }, 1500);
      } else {
        setShowResult("wrong");
        setGameState("lost");
        analytics.logLoss({
          final_score: score,
          guess,
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
      leftCard,
      rightCard,
      score,
      highScore,
      cards,
      getRandomCard,
      getAvailableCategories,
      analytics,
    ]
  );

  const handlePlayAgain = () => {
    initGame();
  };

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
                <span>Look at the left player and their stat.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                  2
                </span>
                <span>
                  Guess if the right player has a HIGHER or LOWER stat.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                  3
                </span>
                <span>Build your streak! One wrong guess ends the game.</span>
              </li>
            </ol>
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
  const PlayerCard = ({
    card,
    side,
    showValue,
    result,
    revealed,
  }) => {
    const isLeft = side === "left";
    const bgClass = isLeft ? "bg-blue-900" : "bg-slate-800";
    const valueToShow = revealed !== null ? revealed : card.value;

    return (
      <div
        className={`relative flex-1 ${bgClass} flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden transition-all duration-500`}
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
              result === "correct"
                ? "bg-green-500/30"
                : "bg-red-500/30"
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
                revealed !== null
                  ? "animate-reveal text-yellow-400"
                  : "text-white"
              }`}
            >
              {valueToShow.toLocaleString()}
            </div>
          ) : (
            <div className="text-4xl sm:text-6xl font-black text-slate-500">
              ?
            </div>
          )}
        </div>
      </div>
    );
  };

  // Main Game UI
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans">
      {tutorialModal}

      {/* Confetti on game won */}
      {gameState === "won" && (
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
              Penn State Football Stats Challenge
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
            <button
              type="button"
              onClick={() => analytics.logFeedback()}
              className="bg-slate-700 px-3 py-2 rounded-full shadow-sm font-bold text-slate-300 border border-slate-600 flex items-center gap-2 hover:border-blue-400 hover:text-white transition text-sm"
            >
              Feedback
            </button>
            <div className="bg-slate-700 px-3 py-2 rounded-full shadow-sm font-bold text-slate-400 border border-slate-600 flex items-center gap-2 text-sm">
              Best: {highScore}
            </div>
            <div className="bg-blue-600 px-4 py-2 rounded-full shadow-lg font-bold text-white border border-blue-500 flex items-center gap-2">
              <Trophy size={18} /> {score}
            </div>
          </div>
        </div>
      </header>

      {/* Game Area */}
      {gameState === "lost" ? (
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
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <div className="bg-slate-700/50 rounded-xl p-4">
                <p className="text-slate-400 text-sm">Final Score</p>
                <p className="text-3xl font-black text-white">{score}</p>
              </div>
              <div className="bg-slate-700/50 rounded-xl p-4">
                <p className="text-slate-400 text-sm">High Score</p>
                <p className="text-3xl font-black text-blue-400">{highScore}</p>
              </div>
            </div>
            <button
              onClick={handlePlayAgain}
              className="px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition shadow-lg shadow-blue-900/50 flex items-center gap-2 mx-auto"
            >
              <RotateCcw size={20} /> Play Again
            </button>
            <EmailSignup gameName="Over/Under" />
          </div>
        </div>
      ) : gameState === "won" ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-green-500/50 rounded-2xl p-6 sm:p-8 max-w-lg w-full text-center shadow-2xl">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-900/50 flex items-center justify-center">
              <Trophy className="text-yellow-400" size={40} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
              Amazing!
            </h2>
            <p className="text-slate-400 mb-4">
              You went through all the players! Incredible knowledge!
            </p>
            <div className="bg-slate-700/50 rounded-xl p-4 mb-6">
              <p className="text-slate-400 text-sm">Final Score</p>
              <p className="text-4xl font-black text-yellow-400">{score}</p>
            </div>
            <button
              onClick={handlePlayAgain}
              className="px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition shadow-lg shadow-blue-900/50 flex items-center gap-2 mx-auto"
            >
              <RotateCcw size={20} /> Play Again
            </button>
            <EmailSignup gameName="Over/Under" />
          </div>
        </div>
      ) : (
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

          {/* VS Badge */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-900 border-4 border-slate-600 flex items-center justify-center shadow-2xl">
              <span className="text-xl sm:text-2xl font-black text-white">
                VS
              </span>
            </div>
          </div>

          {/* Right Card */}
          {rightCard && (
            <div className="flex-1 flex flex-col relative">
              <PlayerCard
                card={rightCard}
                side="right"
                showValue={false}
                result={showResult}
                revealed={revealedValue}
              />

              {/* Guess Buttons - positioned at bottom of right card */}
              {gameState === "playing" && !showResult && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent p-4 sm:p-6 z-20">
                  <div className="flex gap-3 justify-center max-w-xs mx-auto">
                    <button
                      onClick={() => handleGuess("higher")}
                      disabled={isAnimating}
                      className="flex-1 px-6 py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 transition shadow-lg shadow-green-900/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      <ChevronUp size={24} strokeWidth={3} />
                      <span>Higher</span>
                    </button>
                    <button
                      onClick={() => handleGuess("lower")}
                      disabled={isAnimating}
                      className="flex-1 px-6 py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-500 transition shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      <ChevronDown size={24} strokeWidth={3} />
                      <span>Lower</span>
                    </button>
                  </div>
                </div>
              )}
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
