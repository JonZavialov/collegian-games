import React, { useState, useEffect, useRef } from "react";
import {
  Loader,
  Trophy,
  Heart,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  HelpCircle,
  Flag, // Icon for surrendering
} from "lucide-react";
import Confetti from "react-confetti";
import useGameAnalytics from "./hooks/useGameAnalytics";

// CONFIGURATION
const RSS_ENDPOINT = "/rss";
const WORDS_TO_HIDE = 3;

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

    const indicesToHide = new Set();
    while (
      indicesToHide.size < WORDS_TO_HIDE &&
      indicesToHide.size < candidates.length
    ) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      indicesToHide.add(candidates[randomIndex]);
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

    setTimeout(() => {
      inputRef.current?.focus();
      listRef.current?.scrollIntoView({ behavior: "smooth" });
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

  // New: Handle "Give Up"
  const handleGiveUp = () => {
    if (gameState !== "playing") return;

    setLives(0);
    setGameState("lost");
    // Reveal all words in Red
    setWords((w) =>
      w.map((word) => ({ ...word, hidden: false, revealedOnLoss: true }))
    );

    // Log the surrender
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

  // --- 3. RENDER ---
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center font-sans">
        <Loader className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-slate-500 font-bold">Loading Headlines...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Unavailable</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900 pb-32">
      {/* HEADER */}
      <div className="max-w-2xl mx-auto mb-6 flex justify-between items-center sticky top-0 bg-slate-100/90 backdrop-blur z-10 py-2">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-2">
            Redacted <span className="text-slate-300 hidden sm:inline">|</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Fill in the missing words
          </p>
        </div>

        <div className="flex gap-3">
          {/* Lives */}
          <div
            className={`bg-white px-3 py-2 rounded-full shadow-sm font-bold border flex items-center gap-1.5 transition-colors ${
              lives === 0
                ? "text-slate-400 border-slate-200"
                : "text-red-600 border-red-100"
            }`}
          >
            <Heart size={18} fill="currentColor" /> {lives}
          </div>
          {/* Score */}
          <div className="bg-white px-3 py-2 rounded-full shadow-sm font-bold text-blue-700 border border-blue-100 flex items-center gap-1.5">
            <Trophy size={18} /> {score}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-6" ref={listRef}>
        {/* GAME CARD */}
        <div className="bg-white rounded-xl shadow-xl border-4 border-white p-6 md:p-10 min-h-[300px] flex flex-col justify-center relative overflow-hidden">
          {gameState === "won" && (
            <Confetti recycle={false} numberOfPieces={200} gravity={0.3} />
          )}

          {/* HEADLINE PUZZLE */}
          <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-3 text-center leading-relaxed">
            {words.map((word) => {
              if (word.hidden) {
                return (
                  <span
                    key={word.id}
                    className="bg-slate-200 text-transparent rounded px-3 py-1 min-w-[60px] select-none border-b-4 border-slate-300 animate-pulse"
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
            <div className="mt-8 pt-8 border-t border-slate-100 text-center animate-in slide-in-from-bottom-4">
              <h3 className="text-xl font-black text-green-600 mb-2">
                Headlines Restored!
              </h3>
              <div className="flex justify-center gap-3">
                <a
                  href={currentArticle?.link}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 bg-white border border-green-200 text-green-700 rounded-lg font-bold hover:bg-green-50 flex items-center gap-2"
                  onClick={() =>
                    analytics.logContentClick({ url: currentArticle.link })
                  }
                >
                  Read Story <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => setupRound()}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-black flex items-center gap-2 shadow-lg"
                >
                  Next Story <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* LOSS STATE */}
          {gameState === "lost" && (
            <div className="mt-8 pt-8 border-t border-slate-100 text-center animate-in slide-in-from-bottom-4">
              <h3 className="text-xl font-black text-red-600 mb-2">
                Story Redacted.
              </h3>
              <div className="flex justify-center gap-3">
                <a
                  href={currentArticle?.link}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50 flex items-center gap-2"
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

          {/* Helper Row: Count & Give Up Button */}
          <div className="flex justify-between items-center mt-2 px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {words.filter((w) => w.hidden).length} Words Left
            </span>

            {/* Give Up / Reveal Button */}
            <button
              onClick={handleGiveUp}
              className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors uppercase tracking-wider"
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
