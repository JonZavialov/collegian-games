import React, { useState, useEffect, useCallback } from "react";
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

  const roundIndex = score + 1;
  const analytics = useGameAnalytics("headline-hunter", roundIndex);
  const tutorialStorageKey = "headlinehunter_tutorial_dismissed";

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

      const correctIndex = Math.floor(Math.random() * articleList.length);
      const correct = articleList[correctIndex];

      const decoys = [];
      const usedIndices = new Set([correctIndex]);

      while (decoys.length < 3) {
        const idx = Math.floor(Math.random() * articleList.length);
        if (!usedIndices.has(idx)) {
          decoys.push(articleList[idx]);
          usedIndices.add(idx);
        }
      }

      const options = [correct, ...decoys].sort(() => Math.random() - 0.5);

      setRound({ correct, options });
      setZoomLevel(0);
      setWrongGuesses([]);
      setGameState("playing");

      analytics.logStart({ total_articles: articleList.length }, roundIndex);
      analytics.logAction(
        "round_start",
        { options_count: options.length },
        roundIndex
      );
    },
    [analytics, articles, roundIndex]
  );

  const handleGuess = (articleId) => {
    if (gameState !== "playing") return;

    if (articleId === round.correct.id) {
      setGameState("won");
      setScore(score + 1);
      setZoomLevel(3);
      analytics.logWin({ score: score + 1 }, roundIndex);
    } else {
      const newWrong = [...wrongGuesses, articleId];
      setWrongGuesses(newWrong);

      if (zoomLevel < 2) {
        setZoomLevel((prev) => prev + 1);
      } else {
        setZoomLevel(3);
      }

      analytics.logAction("guess_wrong", { zoom_level: zoomLevel }, roundIndex);
    }
  };

  const tutorialModal = showTutorial ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-100">
                Quick Tutorial
              </p>
              <h2 className="text-2xl font-black">
                How to play Headline Hunter
              </h2>
              <p className="mt-2 text-sm text-blue-100">
                Zoomed-in photo puzzles. Find the matching headline before the
                image zooms out.
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
                Study the zoomed-in photo and read each headline choice
                carefully.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700">
                2
              </span>
              <p>
                Pick the headline that best matches the image. Wrong guesses
                zoom the photo out.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-xs font-black text-purple-700">
                3
              </span>
              <p>
                Score points by finding the right headline before the full image
                is revealed.
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
              Don't show again
            </label>
            <button
              type="button"
              onClick={closeTutorial}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:bg-black"
            >
              Got it
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
            <div className="flex gap-3 justify-center">
              <a
                href={round.correct.link}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 bg-white border border-green-200 text-green-700 rounded-lg font-bold hover:bg-green-100 transition flex items-center gap-2"
              >
                Read Story <ExternalLink size={16} />
              </a>
              <button
                onClick={() => setupRound()}
                className="px-6 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition shadow-lg flex items-center gap-2"
              >
                Next Round <ArrowRight size={16} />
              </button>
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
                )
            )}
          </div>
        )}
      </div>
      <DisclaimerFooter />
    </div>
  );
}
