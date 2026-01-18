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
// In production, Netlify serves functions at this path.
// Locally, 'netlify dev' will proxy this for you.
const DB_API_ENDPOINT = "/.netlify/functions/get-articles";

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

  // --- 1. FETCH FROM DATABASE BRIDGE ---
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
        if (!response.ok) throw new Error("Database connection failed");

        const parsedItems = await response.json();

        if (parsedItems.length === 0)
          throw new Error("No recent articles found.");

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
    if (!dismissed) setShowTutorial(true);
  }, [tutorialStorageKey]);

  const closeTutorial = () => {
    if (dontShowAgain) localStorage.setItem(tutorialStorageKey, "true");
    setShowTutorial(false);
  };

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

    setWords(
      tokens.map((token, index) => ({
        id: index,
        text: token,
        cleanText: token.toLowerCase().trim(),
        hidden: indicesToHide.has(index),
        isPunctuation: !/^[a-z0-9]+$/i.test(token.toLowerCase().trim()),
      }))
    );

    setLives(5);
    setGuess("");
    setGameState("playing");
    setShake(false);
    analytics.logStart({ headline_length: tokens.length }, roundIndex);
    setTimeout(() => inputRef.current?.focus(), 100);
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
      if (newWords.filter((w) => w.hidden).length === 0) {
        setGameState("won");
        setScore((s) => s + 1);
      }
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      const newLives = lives - 1;
      setLives(newLives);
      setGuess("");
      if (newLives <= 0) {
        setGameState("lost");
        setWords((w) =>
          w.map((word) => ({ ...word, hidden: false, revealedOnLoss: true }))
        );
      }
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center font-sans">
        <Loader className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-slate-500 font-bold">Connecting to Database...</p>
      </div>
    );
  if (error)
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

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900 pb-24">
      {/* HEADER SECTION */}
      <div className="max-w-2xl mx-auto mb-4 flex justify-between items-center sticky top-0 bg-slate-100/95 backdrop-blur z-20 py-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">
            Redacted
          </h1>
          <p className="text-slate-500 text-xs md:text-sm">
            Penn State News Trivia
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="bg-white px-3 py-1.5 rounded-full shadow-sm font-bold text-red-600 border border-red-100 flex items-center gap-1.5">
            <Heart size={16} fill="currentColor" /> {lives}
          </div>
          <div className="bg-white px-3 py-1.5 rounded-full shadow-sm font-bold text-blue-700 border border-blue-100 flex items-center gap-1.5">
            <Trophy size={16} /> {score}
          </div>
        </div>
      </div>

      {/* PUZZLE AREA */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-4 md:p-10 flex flex-col justify-center relative min-h-[200px]">
          {gameState === "won" && (
            <Confetti recycle={false} numberOfPieces={200} />
          )}
          <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-2 text-center leading-relaxed">
            {words.map((word) => (
              <span
                key={word.id}
                className={`text-2xl md:text-4xl font-bold transition-all duration-500 
                ${
                  word.hidden
                    ? "bg-slate-200 text-transparent rounded px-2 animate-pulse"
                    : word.justRevealed
                    ? "text-blue-600 scale-110"
                    : "text-slate-800"
                }
                ${word.revealedOnLoss ? "text-red-500" : ""} ${
                  word.isPunctuation ? "text-slate-400" : ""
                }`}
              >
                {word.text}
              </span>
            ))}
          </div>

          {/* GAME OVER / NEXT ACTIONS */}
          {gameState !== "playing" && (
            <div className="mt-6 pt-6 border-t border-slate-100 text-center animate-in slide-in-from-bottom-4">
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <a
                  href={currentArticle?.link}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  Read Story <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => setupRound()}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-black flex items-center justify-center gap-2"
                >
                  Next Story <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* INPUT AREA */}
      <div
        className={`fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 z-50 transition-transform ${
          gameState !== "playing" ? "translate-y-full" : ""
        }`}
      >
        <div className="max-w-2xl mx-auto relative">
          <form onSubmit={handleGuess} className={shake ? "animate-shake" : ""}>
            <input
              ref={inputRef}
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Type the missing word..."
              className="w-full bg-slate-100 border-2 border-slate-200 text-slate-900 text-lg font-bold py-3 pl-5 pr-12 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!guess}
              className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-lg"
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
              onClick={() => setLives(0)}
              className="text-xs font-bold text-slate-400 hover:text-red-500 uppercase tracking-wider"
            >
              Give Up
            </button>
          </div>
        </div>
      </div>

      <DisclaimerFooter />
      <style>{`.animate-shake { animation: shake 0.4s; } @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }`}</style>
    </div>
  );
}
