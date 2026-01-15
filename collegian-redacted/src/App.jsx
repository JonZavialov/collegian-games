import React, { useState, useEffect, useRef } from "react";
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

// CONFIGURATION
const RSS_ENDPOINT = "/rss";

// Extended Stop Words (Words we NEVER hide)
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

  // Game State
  const [currentArticle, setCurrentArticle] = useState(null);
  const [words, setWords] = useState([]);
  const [guess, setGuess] = useState("");
  const [lives, setLives] = useState(5);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState("loading"); // loading, playing, won, lost
  const [shake, setShake] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const tutorialStorageKey = "redacted_tutorial_dismissed";

  // Analytics & Refs
  const roundIndex = score + 1;
  const analytics = useGameAnalytics("redacted", roundIndex);
  const inputRef = useRef(null);
  const listRef = useRef(null);

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

        const response = await fetch(RSS_ENDPOINT);
        if (!response.ok) throw new Error("Failed to load news");

        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");
        const items = Array.from(xml.querySelectorAll("item"));

        const parsedItems = items
          .map((item) => ({
            id:
              item.querySelector("guid")?.textContent ||
              Math.random().toString(),
            headline: item.querySelector("title")?.textContent || "",
            link: item.querySelector("link")?.textContent || "",
            author:
              item.querySelector("creator")?.textContent ||
              "The Daily Collegian",
          }))
          .filter((item) => item.headline.length > 20);

        sessionStorage.setItem(
          "hh_news_cache",
          JSON.stringify({
            timestamp: Date.now(),
            data: parsedItems,
          })
        );

        setArticles(parsedItems);
        setupRound(parsedItems);
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
              aria-label="Close tutorial"
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
                Type a missing word and press enter to reveal matching blanks.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700">
                2
              </span>
              <p>
                Each wrong guess costs a heart. Reveal every hidden word to win.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-xs font-black text-purple-700">
                3
              </span>
              <p>
                If you&apos;re stuck, tap Reveal Answer to see the headline.
              </p>
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
              Don&apos;t show again
            </label>
            <button
              type="button"
              onClick={closeTutorial}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:bg-black"
            >
              Let&apos;s go
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // --- 2. GAME LOGIC ---
  const setupRound = (articleList = articles) => {
    if (!articleList || articleList.length === 0) return;

    const article = articleList[Math.floor(Math.random() * articleList.length)];
    setCurrentArticle(article);

    const cleanTitle = article.headline
      .replace(/\|.*/, "")
      .replace(/‘|’/g, "'")
      .replace(/“|”/g, '"')
      .trim();

    const tokens = cleanTitle
      .split(/(\s+|[.,!?;:'"()])/g)
      .filter((t) => t.length > 0);

    const candidates = [];
    tokens.forEach((token, index) => {
      const lower = token.toLowerCase().trim();
      if (/^[a-z0-9]+$/i.test(lower) && !STOP_WORDS.has(lower)) {
        candidates.push(index);
      }
    });

    // --- FIX 1: DYNAMIC DIFFICULTY ---
    // Calculate how many words to hide based on length.
    // Never hide more than 50% of the candidate words.
    // Max cap is 3.
    const maxHidable = Math.ceil(candidates.length / 2);
    const targetHideCount = Math.max(1, Math.min(3, maxHidable));

    const indicesToHide = new Set();
    // Safety check: Don't infinite loop if something goes weird
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

    const wordObjects = tokens.map((token, index) => ({
      id: index,
      text: token,
      cleanText: token.toLowerCase().trim(),
      hidden: indicesToHide.has(index),
      isPunctuation: !/^[a-z0-9]+$/i.test(token.toLowerCase().trim()),
    }));

    setWords(wordObjects);
    setLives(5);
    setGuess("");
    setGameState("playing");
    setShake(false);

    analytics.logStart({ headline_length: tokens.length }, roundIndex);

    // Focus input but don't force aggressive scrolling on mobile
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleGuess = (e) => {
    e.preventDefault();
    if (gameState !== "playing" || !guess.trim()) return;

    const currentGuess = guess.toLowerCase().trim();
    let found = false;

    const newWords = words.map((w) => {
      if (w.hidden && w.cleanText === currentGuess) {
        found = true;
        return { ...w, hidden: false, justRevealed: true };
      }
      return { ...w, justRevealed: false };
    });

    if (found) {
      setWords(newWords);
      setGuess("");
      analytics.logAction("guess_correct", { word: currentGuess }, roundIndex);

      const remaining = newWords.filter((w) => w.hidden).length;
      if (remaining === 0) {
        handleWin();
      }
    } else {
      handleLossAttempt();
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

  const handleLossAttempt = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);

    const newLives = lives - 1;
    setLives(newLives);
    setGuess("");

    analytics.logAction(
      "guess_wrong",
      { guess: guess, lives: newLives },
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
    // FIX 2: Reduced bottom padding from pb-32 to pb-24 to remove excessive gap
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900 pb-24">
      {tutorialModal}
      {/* HEADER */}
      <div className="max-w-2xl mx-auto mb-4 flex justify-between items-center sticky top-0 bg-slate-100/95 backdrop-blur z-20 py-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-2">
            Redacted <span className="text-slate-300 hidden sm:inline">|</span>
          </h1>
          <p className="text-slate-500 text-xs md:text-sm font-medium">
            Fill in the missing words
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

      {/* FIX 2: Adjusted margins and padding for compactness */}
      <div className="max-w-2xl mx-auto" ref={listRef}>
        <div className="bg-white rounded-xl shadow-xl border-4 border-white p-4 md:p-10 flex flex-col justify-center relative overflow-hidden min-h-[200px] md:min-h-[300px]">
          {gameState === "won" && (
            <Confetti recycle={false} numberOfPieces={200} gravity={0.3} />
          )}

          {/* HEADLINE PUZZLE */}
          <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-2 text-center leading-relaxed">
            {words.map((word) => {
              if (word.hidden) {
                return (
                  <span
                    key={word.id}
                    className="bg-slate-200 text-transparent rounded px-2 py-0.5 min-w-[50px] select-none border-b-4 border-slate-300 animate-pulse"
                  >
                    {word.text}
                  </span>
                );
              }
              return (
                <span
                  key={word.id}
                  className={`
                    text-2xl md:text-4xl font-bold transition-all duration-500
                    ${
                      word.justRevealed
                        ? "text-blue-600 scale-110"
                        : "text-slate-800"
                    }
                    ${word.revealedOnLoss ? "text-red-500" : ""}
                    ${word.isPunctuation ? "text-slate-400" : ""}
                  `}
                >
                  {word.text}
                </span>
              );
            })}
          </div>

          {/* WIN STATE */}
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

          {/* LOSS STATE */}
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

      {/* INPUT AREA (Sticky Bottom) */}
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
              placeholder="Type the missing word..."
              className="w-full bg-slate-100 border-2 border-slate-200 text-slate-900 text-lg font-bold py-3 pl-5 pr-12 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder-slate-400"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            <button
              type="submit"
              disabled={!guess}
              className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              <ArrowRight size={20} />
            </button>
          </form>

          {/* Helper Row */}
          <div className="flex justify-between items-center mt-2 px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {words.filter((w) => w.hidden).length} Words Left
            </span>

            {/* FIX: Added onTouchEnd and styling for mobile iframe touches */}
            <button
              type="button"
              onClick={handleGiveUp}
              onTouchEnd={(e) => {
                e.preventDefault(); // Stop ghost clicks/scrolls
                handleGiveUp();
              }}
              style={{ touchAction: "manipulation" }} // Disables zoom delay
              className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors uppercase tracking-wider p-3 -mr-3 cursor-pointer select-none active:scale-95"
            >
              <Flag size={12} /> Reveal Answer
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
