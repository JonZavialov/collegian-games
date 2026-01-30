import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useWordle from "./hooks/useWordle";
import Row from "./components/Row";
import Modal from "./components/Modal";
import Keyboard from "./components/Keyboard";
import DisclaimerFooter from "./components/DisclaimerFooter";
import { loadWordsFromSheet } from "./data/words";
import { getDictionarySet } from "./data/dictionary";
import useGameAnalytics from "./hooks/useGameAnalytics";

function PsuWordle() {
  const [solutionObj, setSolutionObj] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [resetToken, setResetToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let pollId = null;

    const fetchWords = () => {
      loadWordsFromSheet(import.meta.env.VITE_WORDS_SHEET_CSV_URL)
        .then((loadedWords) => {
          if (!isMounted) return;
          const nextSolution = loadedWords[0];
          setSolutionObj((prev) => {
            if (!prev || prev.word !== nextSolution.word) {
              return nextSolution;
            }
            return prev;
          });
          setLoadError("");
        })
        .catch((error) => {
          if (!isMounted) return;
          setLoadError(error.message || "Failed to load words");
        });
    };

    fetchWords();
    pollId = window.setInterval(fetchWords, 60000);

    return () => {
      isMounted = false;
      if (pollId) window.clearInterval(pollId);
    };
  }, []);

  if (loadError) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center text-red-700">
        {loadError}
      </div>
    );
  }

  if (!solutionObj)
    return (
      <div className="min-h-[100svh] flex items-center justify-center">
        Loading...
      </div>
    );

  return (
    <Game
      key={`${solutionObj.word}-${resetToken}`}
      solution={solutionObj.word}
      hint={solutionObj.hint}
      articleUrl={solutionObj.articleUrl}
      reset={() => setResetToken((prev) => prev + 1)}
    />
  );
}

// Separate Game component to allow easy resetting by changing the key in PsuWordle
function Game({ solution, hint, articleUrl, reset }) {
  const dictionarySet = useMemo(
    () => getDictionarySet(solution.length),
    [solution.length]
  );
  const hasCompletedRef = useRef(false);
  const [roundIndex, setRoundIndex] = useState(1);
  const [showHint, setShowHint] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const {
    logAction,
    logContentClick,
    logFeedback,
    logLoss,
    logStart,
    logWin,
  } =
    useGameAnalytics("valley-vocab", roundIndex);
  const tutorialStorageKey = "valley-vocab_tutorial_dismissed";
  const handleGuessCapture = useCallback(
    (payload) => {
      const roundIndexValue = payload.turn + 1;
      setRoundIndex(roundIndexValue);
      if (!payload.isCorrect) {
        setShowHint(true);
      }
      logAction(
        "guess_submitted",
        {
          turn: payload.turn,
          guess: payload.guess,
          is_correct: payload.isCorrect,
          word_length: solution.length,
        },
        roundIndexValue
      );
    },
    [logAction, solution.length]
  );
  const {
    currentGuess,
    guesses,
    turn,
    isCorrect,
    handleKeyup,
    handleKey,
    shakeTick,
    notice,
    usedKeys,
  } = useWordle(solution, dictionarySet, handleGuessCapture);
  const [showModal, setShowModal] = useState(false);
  const tileSize = useMemo(() => {
    if (solution.length <= 5) return 56;
    if (solution.length === 6) return 50;
    if (solution.length === 7) return 46;
    if (solution.length === 8) return 42;
    return 38;
  }, [solution.length]);
  const tileFontSize = useMemo(() => {
    if (solution.length <= 5) return 28;
    if (solution.length <= 7) return 24;
    if (solution.length <= 9) return 22;
    return 20;
  }, [solution.length]);

  useEffect(() => {
    setRoundIndex(1);
    logStart({ word_length: solution.length }, 1);
  }, [logStart, solution.length]);

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

  useEffect(() => {
    window.addEventListener("keyup", handleKeyup);

    // End game logic
    if (isCorrect || turn > 5) {
      if (!hasCompletedRef.current) {
        const metadata = {
          win: isCorrect,
          turns: isCorrect ? turn : 6,
          word_length: solution.length,
        };
        const roundIndexValue = roundIndex;
        if (isCorrect) {
          logWin(metadata, roundIndexValue);
        } else {
          logLoss(metadata, roundIndexValue);
        }
        hasCompletedRef.current = true;
      }
      setTimeout(() => setShowModal(true), 2000);
      window.removeEventListener("keyup", handleKeyup);
    }

    return () => window.removeEventListener("keyup", handleKeyup);
  }, [
    handleKeyup,
    isCorrect,
    logLoss,
    logWin,
    roundIndex,
    solution.length,
    turn,
  ]);

  return (
    <div className="min-h-[100svh] flex flex-col">
      <div className="flex flex-col items-center pt-6 sm:pt-10 px-3 sm:px-6 flex-1">
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500 p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-100">
                    Quick Tutorial
                  </p>
                  <h2 className="text-2xl font-black">How to play Valley Vocab</h2>
                  <p className="mt-2 text-sm text-blue-100">
                    Guess the Penn State themed word in six tries or fewer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeTutorial}
                  className="rounded-full bg-white/10 px-3 py-1 text-lg font-semibold text-white/80 transition hover:bg-white/20 hover:text-white"
                  aria-label="Close tutorial"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid gap-4 text-sm text-slate-700">
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">
                    1
                  </span>
                  <p>Type a word and press enter. Letters will change color.</p>
                </div>
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700">
                    2
                  </span>
                  <p>
                    Green is the right letter in the right spot. Yellow means
                    the letter is in the word but misplaced.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-xs font-black text-purple-700">
                    3
                  </span>
                  <p>
                    Keep guessing until you solve it or run out of attempts. A
                    hint appears after a miss.
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
                  Let&apos;s play
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-penn-state-blue tracking-tighter">
          Valley Vocab
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openTutorial}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
          >
            How to play
          </button>
          <button
            type="button"
            onClick={() => logFeedback()}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
          >
            Feedback
          </button>
        </div>
      </div>

      <div className="w-full max-w-md overflow-x-auto">
        {showHint && (hint || articleUrl) && (
          <div
            className="mb-4 rounded-xl border border-blue-200 px-4 py-3 shadow-sm"
            style={{ backgroundColor: "rgba(23, 112, 223, 0.12)" }}
          >
            {hint && (
              <>
                <div className="text-xs font-semibold uppercase tracking-widest text-blue-700">
                  Editor&apos;s Hint
                </div>
                <blockquote className="mt-2 text-sm font-medium text-slate-700 italic">
                  “{hint}”
                </blockquote>
              </>
            )}
            {articleUrl && (
              <a
                href={articleUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-sm font-semibold text-blue-700 underline underline-offset-4"
                onClick={() =>
                  logContentClick({
                    url: articleUrl,
                    word_length: solution.length,
                  })
                }
              >
                Read the article
              </a>
            )}
          </div>
        )}
        {notice && (
          <div className="mb-4 flex justify-center">
            <div className="bg-grey-900 text-black text-sm font-semibold px-3 py-2 rounded shadow">
              {notice}
            </div>
          </div>
        )}
        {guesses.map((g, i) => {
          if (turn === i) {
            return (
              <Row
                key={i}
                currentGuess={currentGuess}
                shake={shakeTick}
                wordLength={solution.length}
                tileSize={tileSize}
                tileFontSize={tileFontSize}
              />
            );
          }
          return (
            <Row
              key={i}
              guess={g}
              wordLength={solution.length}
              tileSize={tileSize}
              tileFontSize={tileFontSize}
            />
          );
        })}
      </div>

      <Keyboard onKey={handleKey} usedKeys={usedKeys} />

      {showModal && (
        <Modal
          isCorrect={isCorrect}
          turn={turn}
          solution={solution}
          articleUrl={articleUrl}
          handleReset={reset}
          logAction={logAction}
          logContentClick={logContentClick}
        />
      )}
      </div>
      <DisclaimerFooter />
    </div>
  );
}

export default PsuWordle;
