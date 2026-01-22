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
} from "lucide-react";
import Confetti from "react-confetti";
import useGameAnalytics from "./hooks/useGameAnalytics";
import DisclaimerFooter from "./components/DisclaimerFooter";

// CONFIGURATION - Updated to use the Netlify/Postgres bridge
const DB_API_ENDPOINT = "/.netlify/functions/get-articles";

// Extended Stop Words (Unchanged)
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
  // --- STATE (Unchanged) ---
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentArticle, setCurrentArticle] = useState(null);
  const [words, setWords] = useState([]);
  const [guess, setGuess] = useState("");
  const [lives, setLives] = useState(5);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState("loading");
  const [shake, setShake] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const tutorialStorageKey = "redacted_tutorial_dismissed";

  const roundIndex = score + 1;
  const analytics = useGameAnalytics("redacted", roundIndex);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // --- 1. FETCH NEWS (Updated for Database JSON) ---
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

        // Fetching from the Database Bridge instead of raw RSS
        const response = await fetch(DB_API_ENDPOINT);
        if (!response.ok) throw new Error("Failed to load news from database");

        // DB response is already clean JSON, no XML parsing needed
        const parsedItems = await response.json();
        const cleanedItems = parsedItems
          .map((item) => {
            let imageUrl = item.image;

            if (imageUrl && imageUrl.includes("?")) {
              imageUrl = imageUrl.split("?")[0];
            }

            return {
              ...item,
              image: imageUrl,
            };
          })
          .filter((item) => item.headline && item.image);

        sessionStorage.setItem(
          "hh_news_cache",
          JSON.stringify({
            timestamp: Date.now(),
            data: cleanedItems,
          })
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

  // --- EVERYTHING BELOW IS YOUR ORIGINAL LOGIC UNTOUCHED ---

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-800 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">
                Quick Tutorial
              </p>
              <h2 className="text-2xl font-black">How to play Redacted</h2>
              <p className="mt-2 text-sm text-slate-200">
                Restore hidden words in a headline before you run out of lives.
              </p>
            </div>
            <button
              type="button"
              onClick={closeTutorial}
              className="rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="space-y-5 p-6">
          <div className="grid gap-4 text-sm text-slate-700">
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">
                1
              </span>
              <p>
                Guess a letter to reveal it everywhere, or type a full word to
                solve that blank.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700">
                2
              </span>
              <p>
                Wrong letters or words cost a heart. Reveal every hidden word to
                win.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-xs font-black text-purple-700">
                3
              </span>
              <p>If you're stuck, tap Reveal Answer to see the headline.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
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
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:bg-black"
            >
              Let's go
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const setupRound = (articleList = articles) => {
    if (!articleList || articleList.length === 0) return;

    const article = articleList[Math.floor(Math.random() * articleList.length)];
    setCurrentArticle(article);

    const cleanTitle = article.headline
      .replace(/‘|’/g, "'")
      .replace(/“|”/g, '"')
      .trim();

    const tokens =
      cleanTitle.match(/[a-z0-9]+(?:'[a-z0-9]+)*|\s+|[.,!?:;"()]/gi) ?? [];

    const candidates = [];
    tokens.forEach((token, index) => {
      const lower = token.toLowerCase().trim();
      if (/^[a-z0-9]+(?:'[a-z0-9]+)*$/i.test(lower) && !STOP_WORDS.has(lower)) {
        candidates.push(index);
      }
    });

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
        token.toLowerCase().trim()
      );
      const hidden = indicesToHide.has(index);
      const revealedMap = hidden
        ? token.split("").map((char) => !/[a-z0-9]/i.test(char))
        : [];

      if (hidden) {
        const characters = token.split("");
        const visibleIndices = characters
          .map((char, charIndex) =>
            /[a-z0-9]/i.test(char) ? charIndex : null
          )
          .filter((charIndex) => charIndex !== null);
        const firstVisibleIndex = visibleIndices[0];
        if (firstVisibleIndex !== undefined) {
          revealedMap[firstVisibleIndex] = true;
          if (visibleIndices.length > 5) {
            const remainingIndices = visibleIndices.filter(
              (charIndex) => charIndex !== firstVisibleIndex
            );
            for (
              let i = 0;
              i < 2 && remainingIndices.length > 0;
              i += 1
            ) {
              const randomIndex = Math.floor(
                Math.random() * remainingIndices.length
              );
              const revealedIndex = remainingIndices.splice(randomIndex, 1)[0];
              revealedMap[revealedIndex] = true;
            }
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

    analytics.logStart({ headline_length: tokens.length }, roundIndex);

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
            !/[a-z0-9]/i.test(char) || updatedMap[index] === true
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
        roundIndex
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
      w.map((word) => ({ ...word, hidden: false, revealedOnLoss: true }))
    );
    analytics.logLoss({ score, method: "surrender" }, roundIndex);
  };

  const handleWin = () => {
    setGameState("won");
    setScore((s) => s + 1);
    analytics.logWin({ lives_remaining: lives }, roundIndex);
  };

  const handleLossAttempt = ({ guessValue, guessType }) => {
    setShake(true);
    setTimeout(() => setShake(false), 500);

    const newLives = lives - 1;
    setLives(newLives);
    setGuess("");

    analytics.logAction(
      "guess_wrong",
      { guess: guessValue, type: guessType, lives: newLives },
      roundIndex
    );

    if (newLives <= 0) {
      setGameState("lost");
      setWords((w) =>
        w.map((word) => ({ ...word, hidden: false, revealedOnLoss: true }))
      );
      analytics.logLoss({ score, method: "out_of_lives" }, roundIndex);
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
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900 pb-32">
      {tutorialModal}
      <div className="max-w-2xl mx-auto mb-4 flex justify-between items-center sticky top-0 bg-slate-100/95 backdrop-blur z-20 py-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-2">
            Redacted <span className="text-slate-300 hidden sm:inline">|</span>
          </h1>
          <p className="text-slate-500 text-xs md:text-sm font-medium">
            Guess letters or solve the missing words
          </p>
        </div>

        <div className="flex gap-2 md:gap-3 items-center">
          <button
            type="button"
            onClick={openTutorial}
            className="bg-white px-3 py-2 rounded-full shadow-sm font-bold text-slate-600 border border-slate-200 flex items-center gap-2 hover:border-blue-200 hover:text-blue-700 transition text-xs md:text-sm"
          >
            <Info size={14} /> How to play
          </button>
          <button
            type="button"
            onClick={() => analytics.logFeedback()}
            className="bg-white px-3 py-2 rounded-full shadow-sm font-bold text-slate-600 border border-slate-200 flex items-center gap-2 hover:border-blue-200 hover:text-blue-700 transition text-xs md:text-sm"
          >
            Feedback
          </button>
          <div
            className={`bg-white px-3 py-1.5 rounded-full shadow-sm font-bold border flex items-center gap-1.5 transition-colors ${
              lives === 0
                ? "text-slate-400 border-slate-200"
                : "text-red-600 border-red-100"
            }`}
          >
            <Heart size={16} fill="currentColor" /> {lives}
          </div>
          <div className="bg-white px-3 py-1.5 rounded-full shadow-sm font-bold text-blue-700 border border-blue-100 flex items-center gap-1.5">
            <Trophy size={16} /> {score}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto" ref={listRef}>
        <div className="bg-white rounded-xl shadow-xl border-4 border-white p-4 md:p-10 flex flex-col justify-center gap-6 relative overflow-hidden min-h-[200px] md:min-h-[300px]">
          {gameState === "won" && (
            <Confetti recycle={false} numberOfPieces={200} gravity={0.3} />
          )}

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
                            showCharacter ? "text-slate-800" : "text-transparent"
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
                    analytics.logContentClick({ url: currentArticle.link })
                  }
                >
                  Read Story <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => setupRound()}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-black flex items-center justify-center gap-2 shadow-lg"
                >
                  Next Story <ArrowRight size={16} />
                </button>
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
                >
                  Read Story <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => {
                    setScore(0);
                    setupRound();
                  }}
                  className="px-8 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-black shadow-lg"
                >
                  Try Again
                </button>
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
              className="w-full bg-slate-100 border-2 border-slate-200 text-slate-900 text-lg font-bold py-3 pl-5 pr-12 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder-slate-400"
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
