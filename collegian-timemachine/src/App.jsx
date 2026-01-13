import React, { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  Loader,
  Trophy,
  RefreshCw,
  XCircle,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import Confetti from "react-confetti";
import useGameAnalytics from "./hooks/useGameAnalytics";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// ✅ PDF WORKER SETUP
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// CONFIGURATION
const START_YEAR = 1940;
const END_YEAR = 2010;
const COLLEGIAN_LCCN = "sn85054904";
const CORS_PROXY = "https://corsproxy.io/?";

const getRandomDate = () => {
  const start = new Date(`${START_YEAR}-09-05`);
  const end = new Date(`${END_YEAR}-12-10`);
  let date;
  do {
    date = new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime())
    );
  } while (date.getDay() === 0 || date.getDay() === 6);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return { full: `${yyyy}-${mm}-${dd}`, year: parseInt(yyyy) };
};

export default function TimeMachine() {
  const [targetDate, setTargetDate] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [redactionBoxes, setRedactionBoxes] = useState([]);
  const [gameState, setGameState] = useState("playing");
  const [score, setScore] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  // UX State
  const [guessYear, setGuessYear] = useState(1975);
  const [shake, setShake] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const pdfWrapperRef = useRef(null);
  const [pdfWidth, setPdfWidth] = useState(600);
  const analytics = useGameAnalytics("time-machine", pageNumber);

  useEffect(() => {
    // Optional: Initialize PostHog here if you haven't done it in main.jsx
    // posthog.init('YOUR_API_KEY', { api_host: 'https://app.posthog.com' });

    startNewGame();
    const updateWidth = () => {
      if (pdfWrapperRef.current) {
        setPdfWidth(pdfWrapperRef.current.offsetWidth);
      }
    };
    window.addEventListener("resize", updateWidth);
    setTimeout(updateWidth, 500);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const startNewGame = useCallback(() => {
    setLoading(true);
    setGameState("playing");
    setPageNumber(1);
    setRedactionBoxes([]);
    setRetryCount(0);
    setFeedbackMsg(null);
    setTargetDate(getRandomDate());
    setGuessYear(1975);

    // 📊 TRACK: New Game Started
    analytics.logStart({}, 1);
  }, [analytics]);

  const handleLoadError = () => {
    if (pageNumber === 1) {
      console.log(`No paper found for ${targetDate?.full}. Retrying...`);
      setTargetDate(getRandomDate());
      setRetryCount((prev) => prev + 1);
    } else {
      setLoading(false);
      setGameState("lost");

      // 📊 TRACK: Game Lost (Ran out of pages)
      analytics.logLoss(
        {
        target_year: targetDate?.year,
        pages_viewed: pageNumber,
        score: score,
        },
        pageNumber
      );
    }
  };

  const handleSubmitGuess = () => {
    if (!targetDate) return;

    const diff = Math.abs(targetDate.year - guessYear);
    const isWin = diff <= 2;

    // 📊 TRACK: Guess Submitted
    analytics.logAction(
      "guess_submitted",
      {
        guessed_year: guessYear,
        target_year: targetDate.year,
        difference: diff,
        result: isWin ? "win" : "miss",
        page_number: pageNumber,
      },
      pageNumber
    );

    // WIN CONDITION: +/- 2 Years
    if (isWin) {
      setGameState("won");
      setScore(score + 1);
      setFeedbackMsg(null);

      // 📊 TRACK: Win Streak
      analytics.logWin(
        {
          streak: score + 1,
          target_year: targetDate.year,
        },
        pageNumber
      );
    } else {
      // WRONG GUESS UX
      setShake(true);
      setFeedbackMsg(
        `Nope! Not ${guessYear}. Loading Page ${pageNumber + 1}...`
      );

      setTimeout(() => setShake(false), 500);

      setTimeout(() => {
        setPageNumber((prev) => prev + 1);
        setLoading(true);
        setFeedbackMsg(null);
      }, 1500);
    }
  };

  const onPageLoadSuccess = async (page) => {
    setLoading(false);
    const boxes = [];
    const textContent = await page.getTextContent();
    const targetYearStr = targetDate.year.toString();
    const viewport = page.getViewport({ scale: 1 });
    const scaleFactor = pdfWidth / viewport.width;

    textContent.items.forEach((item) => {
      if (item.str.includes(targetYearStr)) {
        const pdfX = item.transform[4];
        const pdfY = item.transform[5];
        const itemHeight = item.height || 10;
        const itemWidth = item.width;
        const x = pdfX * scaleFactor;
        const y = (viewport.height - pdfY - itemHeight) * scaleFactor;

        boxes.push({
          x: x - 4,
          y: y - 4,
          w: itemWidth * scaleFactor + 12,
          h: itemHeight * scaleFactor + 8,
        });
      }
    });
    setRedactionBoxes(boxes);
  };

  const pdfUrl = targetDate
    ? `${CORS_PROXY}https://panewsarchive.psu.edu/lccn/${COLLEGIAN_LCCN}/${targetDate.full}/ed-1/seq-${pageNumber}.pdf`
    : null;

  const originalLink = targetDate
    ? `https://panewsarchive.psu.edu/lccn/${COLLEGIAN_LCCN}/${targetDate.full}/ed-1/seq-1/`
    : "#";

  // Helper for tracking external link clicks
  const handleViewFullIssue = () => {
    analytics.logContentClick({
      target_year: targetDate?.year,
      url: originalLink,
    });
  };

  useEffect(() => {
    if (gameState === "playing" && pageNumber > 1) {
      analytics.logAction("page_turn", { page_number: pageNumber }, pageNumber);
    }
  }, [analytics, gameState, pageNumber]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900">
      <style>{`
        @keyframes shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
          100% { transform: translateX(0); }
        }
        .shake-element {
          animation: shake 0.4s ease-in-out;
          border-color: #ef4444 !important; /* Red border */
        }
      `}</style>

      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
            Time Machine
          </h1>
          <p className="text-slate-500 text-sm">
            Drag the slider to guess the year. Close counts (±2 years).
          </p>
        </div>
        <div className="bg-white px-5 py-2 rounded-full shadow-sm font-bold text-blue-700 border border-blue-100 flex items-center gap-2">
          <Trophy size={18} /> Streak: {score}
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* CONTROLS (Left Side) */}
        <div
          className={`md:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6 transition-colors ${
            shake ? "border-red-400 bg-red-50" : ""
          }`}
        >
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div
                className={`w-3 h-3 rounded-full ${
                  loading ? "bg-amber-400 animate-pulse" : "bg-green-500"
                }`}
              ></div>
              <span className="font-bold text-slate-700">
                {loading
                  ? "Scanning Archives..."
                  : `Viewing Page ${pageNumber}`}
              </span>
            </div>

            {feedbackMsg && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm font-bold rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle size={16} /> {feedbackMsg}
              </div>
            )}

            {retryCount > 0 && loading && pageNumber === 1 && (
              <p className="text-xs text-slate-400 animate-pulse">
                Searching for a valid issue... (Attempt {retryCount})
              </p>
            )}
          </div>

          {gameState === "won" ? (
            <div className="text-center py-6 bg-green-50 rounded-xl border border-green-100 animate-in zoom-in duration-300">
              <Confetti recycle={false} numberOfPieces={200} gravity={0.2} />
              <h2 className="text-3xl font-black text-green-600 mb-2">
                CORRECT!
              </h2>
              <p className="text-slate-600 mb-6">
                Published in{" "}
                <span className="font-bold text-slate-900">
                  {targetDate?.year}
                </span>
              </p>

              <div className="flex flex-col gap-3 px-4">
                <a
                  href={originalLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleViewFullIssue} // 📊 TRACK CLICK
                  className="flex items-center justify-center gap-2 text-blue-600 font-bold hover:underline text-sm mb-2"
                >
                  View Full Issue <ExternalLink size={14} />
                </a>
                <button
                  onClick={startNewGame}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition shadow-lg"
                >
                  <RefreshCw size={18} /> Play Again
                </button>
              </div>
            </div>
          ) : gameState === "lost" ? (
            <div className="text-center py-6 bg-red-50 rounded-xl border border-red-100 animate-in zoom-in duration-300">
              <XCircle className="mx-auto text-red-500 mb-2" size={48} />
              <h2 className="text-3xl font-black text-red-600 mb-2">
                GAME OVER
              </h2>
              <p className="text-slate-600 mb-4">
                You ran out of pages!
                <br />
                It was{" "}
                <span className="font-bold text-slate-900">
                  {targetDate?.year}
                </span>
              </p>

              <div className="flex flex-col gap-3 px-4">
                <a
                  href={originalLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleViewFullIssue} // 📊 TRACK CLICK
                  className="flex items-center justify-center gap-2 text-blue-600 font-bold hover:underline text-sm mb-2"
                >
                  View Full Issue <ExternalLink size={14} />
                </a>
                <button
                  onClick={() => {
                    setScore(0);
                    startNewGame();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition shadow-lg"
                >
                  <RefreshCw size={18} /> Try Again
                </button>
              </div>
            </div>
          ) : (
            <div className={`space-y-6 ${shake ? "shake-element" : ""}`}>
              <div className="text-center">
                <div className="text-6xl font-black text-blue-600 mb-2 tabular-nums tracking-tighter">
                  {guessYear}
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                  Range: {guessYear - 2} – {guessYear + 2}
                </div>

                <input
                  type="range"
                  min={START_YEAR}
                  max={END_YEAR}
                  value={guessYear}
                  onChange={(e) => setGuessYear(parseInt(e.target.value))}
                  disabled={loading}
                  className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500 transition-all"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2 font-bold">
                  <span>{START_YEAR}</span>
                  <span>{END_YEAR}</span>
                </div>
              </div>

              <button
                onClick={handleSubmitGuess}
                disabled={loading}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-blue-600 transition-all shadow-lg hover:shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                {loading ? "Analyzing..." : "Lock In Guess"}{" "}
                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-slate-100 text-xs text-slate-400">
            Source: Pennsylvania Newspaper Archive
          </div>
        </div>

        {/* PDF VIEWER */}
        <div
          className="md:col-span-8 min-h-[600px] bg-slate-300 rounded-xl border border-slate-300 relative overflow-hidden"
          ref={pdfWrapperRef}
        >
          {loading && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-100/80 backdrop-blur-sm transition-all">
              <Loader className="animate-spin text-slate-400 mb-3" size={40} />
              <span className="text-slate-500 font-medium">
                {pageNumber > 1
                  ? "Loading next page..."
                  : "Fetching historical document..."}
              </span>
            </div>
          )}

          {pdfUrl && (
            <div className="relative bg-white min-h-[800px] shadow-2xl">
              <Document
                file={pdfUrl}
                onLoadError={handleLoadError}
                className="flex justify-center"
                loading={null}
              >
                <Page
                  pageNumber={1}
                  width={pdfWidth}
                  onLoadSuccess={onPageLoadSuccess}
                  renderAnnotationLayer={false}
                  renderTextLayer={true}
                  className="shadow-xl"
                />
              </Document>

              {redactionBoxes.map((box, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: box.x,
                    top: box.y,
                    width: box.w,
                    height: box.h,
                    backgroundColor: "#1a1a1a",
                    zIndex: 20,
                    pointerEvents: "none",
                    borderRadius: "2px",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
