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

// CONFIGURATION
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
  const ZOOM_SCALES = [8, 4, 2, 1];

  // 1. FETCH FROM DATABASE BRIDGE
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch(DB_API_ENDPOINT);
        if (!response.ok) throw new Error("Database error");

        const data = await response.json();

        const parsedArticles = data
          .map((item) => {
            let imageUrl = item.image;
            // Clean the image URL to get high-res original
            if (imageUrl && imageUrl.includes("?")) {
              imageUrl = imageUrl.split("?")[0];
            }
            return { ...item, image: imageUrl };
          })
          .filter((item) => item.image);

        setArticles(parsedArticles);
        setLoading(false);
        if (parsedArticles.length > 0) setupRound(parsedArticles);
      } catch (err) {
        console.error("Failed to fetch news from DB:", err);
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

  // 2. SETUP NEW ROUND
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
    },
    [articles]
  );

  // 3. HANDLE GUESS
  const handleGuess = (articleId) => {
    if (gameState !== "playing") return;

    if (articleId === round.correct.id) {
      setGameState("won");
      setScore(score + 1);
      setZoomLevel(3);
    } else {
      const newWrong = [...wrongGuesses, articleId];
      setWrongGuesses(newWrong);
      if (zoomLevel < 2) setZoomLevel((prev) => prev + 1);
      else setZoomLevel(3);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center">
        <Loader className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-slate-500 font-bold">Connecting to Database...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900">
      {/* HEADER */}
      <div className="max-w-2xl mx-auto mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-black uppercase tracking-tighter">
          Headline Hunter
        </h1>
        <div className="bg-white px-4 py-2 rounded-full shadow-sm font-bold text-blue-700 border border-blue-100 flex items-center gap-2">
          <Trophy size={18} /> {score}
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        <div className="relative w-full aspect-[4/3] bg-slate-200 rounded-xl overflow-hidden shadow-xl border-4 border-white">
          {gameState === "won" && (
            <Confetti recycle={false} numberOfPieces={200} />
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
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold uppercase">
              Zoom: {ZOOM_SCALES[zoomLevel]}x
            </div>
          )}
        </div>

        {gameState === "won" ? (
          <div className="bg-green-50 border border-green-200 p-6 rounded-xl text-center animate-in zoom-in">
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
                className="px-6 py-3 bg-white border border-green-200 text-green-700 rounded-lg font-bold flex items-center gap-2"
              >
                Read Story <ExternalLink size={16} />
              </a>
              <button
                onClick={() => setupRound()}
                className="px-6 py-3 bg-slate-900 text-white rounded-lg font-bold shadow-lg flex items-center gap-2"
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
                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 transition-all text-left group"
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
