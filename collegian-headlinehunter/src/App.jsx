import React, { useState, useEffect, useCallback } from "react";
import {
  Loader,
  Trophy,
  ExternalLink,
  ArrowRight,
  XCircle,
  AlertCircle,
} from "lucide-react";
import Confetti from "react-confetti";
import useGameAnalytics from "./hooks/useGameAnalytics";
import DisclaimerFooter from "./components/DisclaimerFooter";

// CONFIGURATION
const RSS_ENDPOINT = "/rss";

export default function HeadlineHunter() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState(null); // Holds current correct answer + decoys
  const [zoomLevel, setZoomLevel] = useState(0); // 0 = Max Zoom, 3 = No Zoom
  const [gameState, setGameState] = useState("loading"); // loading, playing, won, lost
  const [score, setScore] = useState(0);
  const [wrongGuesses, setWrongGuesses] = useState([]); // Track IDs of wrong guesses to hide them
  const roundIndex = score + 1;
  const analytics = useGameAnalytics("headline-hunter", roundIndex);

  // Zoom scales: 8x -> 4x -> 2x -> 1x (Full)
  const ZOOM_SCALES = [8, 4, 2, 1];

  // 1. FETCH AND PARSE RSS FEED
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch(RSS_ENDPOINT);
        const text = await response.text();

        // Parse XML using browser's built-in parser
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");
        const items = Array.from(xml.querySelectorAll("item"));

        const parsedArticles = items
          .map((item) => {
            const enclosure = item.querySelector("enclosure");
            let imageUrl = enclosure ? enclosure.getAttribute("url") : null;

            // HACK: Remove "?resize=..." to get the high-res original image
            if (imageUrl && imageUrl.includes("?")) {
              imageUrl = imageUrl.split("?")[0];
            }

            return {
              id:
                item.querySelector("guid")?.textContent ||
                Math.random().toString(),
              headline: item.querySelector("title")?.textContent,
              link: item.querySelector("link")?.textContent,
              image: imageUrl,
            };
          })
          .filter((item) => item.image && item.headline); // Only keep items with images

        setArticles(parsedArticles);
        setLoading(false);
        // Start first round immediately after fetching
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

  // 2. SETUP NEW ROUND
  const setupRound = useCallback(
    (articleList = articles) => {
      if (articleList.length < 4) return;

      // Pick 1 correct answer
      const correctIndex = Math.floor(Math.random() * articleList.length);
      const correct = articleList[correctIndex];

      // Pick 3 decoys (ensure they aren't the correct one)
      const decoys = [];
      const usedIndices = new Set([correctIndex]);

      while (decoys.length < 3) {
        const idx = Math.floor(Math.random() * articleList.length);
        if (!usedIndices.has(idx)) {
          decoys.push(articleList[idx]);
          usedIndices.add(idx);
        }
      }

      // Shuffle options
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

  // 3. HANDLE GUESS
  const handleGuess = (articleId) => {
    if (gameState !== "playing") return;

    if (articleId === round.correct.id) {
      // WIN
      setGameState("won");
      setScore(score + 1);
      setZoomLevel(3); // Show full image
      analytics.logWin({ score: score + 1 }, roundIndex);
    } else {
      // WRONG
      const newWrong = [...wrongGuesses, articleId];
      setWrongGuesses(newWrong);

      // Zoom out one step
      if (zoomLevel < 2) {
        setZoomLevel((prev) => prev + 1);
      } else {
        // If we are at the last zoom level and guess wrong again -> Show answer but no points
        // Optional: You could make them lose here. For now, we just zoom out fully.
        setZoomLevel(3);
      }

      analytics.logAction("guess_wrong", { zoom_level: zoomLevel }, roundIndex);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center">
        <Loader className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-slate-500 font-bold">Loading Headlines...</p>
      </div>
    );
  }

  if (articles.length < 4) {
    return (
      <div className="p-10 text-center">
        Not enough articles with images found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900">
      {/* HEADER */}
      <div className="max-w-2xl mx-auto mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
            Headline Hunter
          </h1>
          <p className="text-slate-500 text-sm">
            Can you identify the story from the detail?
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-full shadow-sm font-bold text-blue-700 border border-blue-100 flex items-center gap-2">
          <Trophy size={18} /> {score}
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* IMAGE CONTAINER */}
        <div className="relative w-full aspect-[4/3] bg-slate-200 rounded-xl overflow-hidden shadow-xl border-4 border-white">
          {gameState === "won" && (
            <Confetti recycle={false} numberOfPieces={200} gravity={0.3} />
          )}

          {/* THE IMAGE */}
          <div
            className="w-full h-full transition-transform duration-700 ease-in-out"
            style={{
              backgroundImage: `url(${round?.correct.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              transform: `scale(${ZOOM_SCALES[zoomLevel]})`,
            }}
          />

          {/* OVERLAY: "Zoomed In" indicator */}
          {gameState === "playing" && (
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-white/20">
              Zoom: {ZOOM_SCALES[zoomLevel]}x
            </div>
          )}
        </div>

        {/* GAME STATE: WON */}
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
                onClick={() =>
                  analytics.logContentClick({
                    headline: round.correct.headline,
                    url: round.correct.link,
                  })
                }
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
          /* GUESSING OPTIONS */
          <div className="grid grid-cols-1 gap-3">
            {round?.options.map((option) => {
              const isWrong = wrongGuesses.includes(option.id);

              if (isWrong) return null; // Hide wrong answers to clean up UI

              return (
                <button
                  key={option.id}
                  onClick={() => handleGuess(option.id)}
                  className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left group"
                >
                  <span className="font-bold text-slate-700 group-hover:text-blue-700 text-lg leading-tight block">
                    {option.headline}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <DisclaimerFooter />
    </div>
  );
}
