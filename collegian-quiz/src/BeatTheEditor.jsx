import { useState, useEffect, useMemo } from "react";
import Confetti from "react-confetti";
import posthog from "posthog-js";
import {
  ArrowRight,
  Share2,
  ExternalLink,
  Loader,
  Flame,
  XCircle,
  X,
  Info,
} from "lucide-react";
import useGameAnalytics from "./hooks/useGameAnalytics";
import DisclaimerFooter from "./components/DisclaimerFooter";
import AdminPanel from "./components/AdminPanel";
import { normalizeQuizData } from "./utils/quizData";

const ADMIN_QUERY_KEY = "admin";
const QUIZ_ENDPOINT = "/.netlify/functions/get-quiz";
const PUBLISH_ENDPOINT = "/.netlify/functions/publish-quiz";

const FEATURE_FLAG_KEY = "bte-difficulty";
const DEFAULT_DIFFICULTY_VARIANT = "control";
const CONTROL_QUESTION_COUNT = 10;
const TEST_QUESTION_COUNT = 5;

const setAdminQuery = (enabled) => {
  const url = new URL(window.location.href);
  if (enabled) {
    url.searchParams.set(ADMIN_QUERY_KEY, "1");
  } else {
    url.searchParams.delete(ADMIN_QUERY_KEY);
  }
  window.history.replaceState({}, "", url);
};

const getWeekInfo = (date) => {
  const weekDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  weekDate.setUTCDate(weekDate.getUTCDate() + 4 - (weekDate.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(weekDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((weekDate - yearStart) / 86400000 + 1) / 7);
  return { year: weekDate.getUTCFullYear(), week };
};

const toWeekKey = (info) => `${info.year}-W${info.week}`;

const resolveDifficultyVariant = (rawVariant) =>
  rawVariant === "test" ? "test" : DEFAULT_DIFFICULTY_VARIANT;

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

export default function BeatTheEditor() {
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [gameState, setGameState] = useState("intro");
  const [viewMode, setViewMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get(ADMIN_QUERY_KEY) === "1" ? "admin" : "game";
  });
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [difficultyVariant, setDifficultyVariant] = useState(
    DEFAULT_DIFFICULTY_VARIANT,
  );
  const roundIndex = currentQ + 1;
  const analytics = useGameAnalytics("beat_the_editor", roundIndex);

  // Engagement / Streak State
  const [streak, setStreak] = useState(0);

  // Visual Feedback
  const [selectedOption, setSelectedOption] = useState(null);
  const [answerStatus, setAnswerStatus] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const tutorialStorageKey = "beat-the-editor_tutorial_dismissed";

  const questionLimit =
    difficultyVariant === "test" ? TEST_QUESTION_COUNT : CONTROL_QUESTION_COUNT;
  const totalQuestions = quizData?.questions?.length ?? 0;
  const questionCount = Math.min(questionLimit, totalQuestions);
  const gameQuestions = useMemo(() => {
    if (!quizData?.questions) return [];
    const questions = [...quizData.questions];

    if (difficultyVariant === "test") {
      for (let i = questions.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
    }

    return questions.slice(0, questionCount);
  }, [difficultyVariant, questionCount, quizData]);
  const effectiveEditorScore = (() => {
    if (!quizData || totalQuestions === 0) return 0;
    const scaled = Math.round((quizData.editorScore / totalQuestions) * questionCount);
    return clampNumber(scaled, 0, questionCount);
  })();

  useEffect(() => {
    // Load Streak from Local Storage
    const savedStreak = parseInt(localStorage.getItem("newsGameStreak") || "0");
    setStreak(savedStreak);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchQuizData = async () => {
      try {
        const response = await fetch(QUIZ_ENDPOINT);
        if (!response.ok) {
          throw new Error("Failed to load quiz data.");
        }
        const payload = await response.json();
        if (isMounted) {
          setQuizData(normalizeQuizData(payload.data));
          setLoadError("");
        }
      } catch (error) {
        if (isMounted) {
          setQuizData(null);
          setLoadError("Quiz data is unavailable. Please try again later.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchQuizData();

    return () => {
      isMounted = false;
    };
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
        <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-100">
                Quick Tutorial
              </p>
              <h2 className="text-2xl font-black">How to beat the editor</h2>
              <p className="mt-2 text-sm text-blue-100">
                Answer weekly news questions and outscore the editor&apos;s
                benchmark.
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
                Read each question and pick the best answer from the four
                choices.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700">
                2
              </span>
              <p>
                Correct answers give you points and move you forward. Missed
                answers reveal a quick explainer.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-xs font-black text-purple-700">
                3
              </span>
              <p>
                At the end, compare your score to the editor&apos;s score to see
                if you won.
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
  ) : null;

  const tutorialButton = (
    <button
      type="button"
      onClick={openTutorial}
      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
    >
      <Info size={14} /> How to play
    </button>
  );

  const feedbackButton = (
    <button
      type="button"
      onClick={() => analytics.logFeedback()}
      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
    >
      Feedback
    </button>
  );

  const resetGameState = (nextData) => {
    setQuizData(nextData);
    setGameState("intro");
    setCurrentQ(0);
    setScore(0);
    setUserAnswers([]);
    setSelectedOption(null);
    setAnswerStatus(null);
    setShowConfetti(false);
  };

  const handleAdminSave = async (nextData) => {
    const response = await fetch(PUBLISH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        quiz: nextData,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.message || "Failed to publish quiz data.");
    }

    const payload = await response.json();
    resetGameState(normalizeQuizData(payload.data || nextData));
  };

  const handleAdminRestore = (nextData) => {
    resetGameState(normalizeQuizData(nextData));
  };

  const handleAdminExit = () => {
    setAdminQuery(false);
    setViewMode("game");
  };

  // 2. HANDLE NEXT QUESTION (Manual or Auto)
  const advanceGame = (finalScore) => {
    setSelectedOption(null);
    setAnswerStatus(null);

    if (currentQ < gameQuestions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      finishGame(finalScore);
    }
  };

  // 3. HANDLE ANSWER SELECTION
  const handleAnswer = (index) => {
    if (selectedOption !== null) return;

    setSelectedOption(index);
    const isCorrect = index === gameQuestions[currentQ].correct;
    setAnswerStatus(isCorrect ? "correct" : "wrong");

    analytics.logAction(
      "question_answered",
      {
        question_index: currentQ + 1,
        is_correct: isCorrect,
        question_text: gameQuestions[currentQ].text,
        difficulty_variant: difficultyVariant,
      },
      currentQ + 1,
    );

    setUserAnswers([
      ...userAnswers,
      {
        qId: gameQuestions[currentQ].id,
        userPick: index,
        isCorrect,
      },
    ]);

    if (isCorrect) {
      // IF CORRECT: Auto-advance after 1 second (Fast flow)
      const newScore = score + 1;
      setScore(newScore);
      setTimeout(() => {
        advanceGame(newScore);
      }, 1000);
    }
    // IF WRONG: Do nothing. The UI will show the "Missed It" card and a Next button.
  };

  const finishGame = (finalScore) => {
    setGameState("results");

    const currentWeekInfo = getWeekInfo(new Date());
    const currentWeekKey = toWeekKey(currentWeekInfo);
    const lastPlayedWeek = localStorage.getItem("lastPlayedWeek");
    let newStreak = streak;

    if (lastPlayedWeek !== currentWeekKey) {
      const lastWeekDate = new Date();
      lastWeekDate.setDate(lastWeekDate.getDate() - 7);
      const lastWeekKey = toWeekKey(getWeekInfo(lastWeekDate));
      newStreak = lastPlayedWeek === lastWeekKey ? streak + 1 : 1;
    }

    setStreak(newStreak);
    localStorage.setItem("newsGameStreak", newStreak);
    localStorage.setItem("lastPlayedWeek", currentWeekKey);

    const resultMetadata = {
      streak_length: newStreak,
      score: finalScore,
      beat_editor: finalScore > effectiveEditorScore,
      difficulty_variant: difficultyVariant,
    };
    if (finalScore > effectiveEditorScore) {
      analytics.logWin({ ...resultMetadata, result: "win" }, roundIndex);
    } else if (finalScore === effectiveEditorScore) {
      analytics.logLoss({ ...resultMetadata, result: "draw" }, roundIndex);
    } else {
      analytics.logLoss({ ...resultMetadata, result: "loss" }, roundIndex);
    }

    if (finalScore > effectiveEditorScore) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
  };

  const shareResults = () => {
    const squares = userAnswers
      .map((a) => (a.isCorrect ? "🟩" : "🟥"))
      .join("");
    const text = `I beat the editor! ${score}/${gameQuestions.length}\nStreak: ${streak}🔥\n${squares}\nRead more at: collegian.psu.edu`;
    navigator.clipboard.writeText(text);
    alert("Score copied to clipboard!");
    analytics.logAction(
      "share_results",
      { score, difficulty_variant: difficultyVariant },
      roundIndex,
    );
  };

  if (loading) {
    return (
      <>
        <div className="flex justify-center items-center h-64">
          <Loader className="animate-spin text-blue-600" />
        </div>
        {tutorialModal}
        <DisclaimerFooter />
      </>
    );
  }

  if (!quizData) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-xl bg-slate-50 p-6 text-center font-sans">
          <h2 className="text-xl font-black text-slate-800">
            Quiz unavailable
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {loadError || "We couldn't load this week's quiz right now."}
          </p>
        </div>
        <DisclaimerFooter />
      </>
    );
  }

  if (viewMode === "admin") {
    return (
      <AdminPanel
        data={quizData}
        onSave={handleAdminSave}
        onExit={handleAdminExit}
        onRestore={handleAdminRestore}
      />
    );
  }

  // --- VIEW 1: INTRO ---
  if (gameState === "intro") {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50 p-6 text-center rounded-xl font-sans relative">
          {tutorialModal}
          <div className="absolute top-4 right-4 flex gap-2">
            {tutorialButton}
            {feedbackButton}
          </div>
          {streak > 0 && (
            <div className="mb-4 flex items-center gap-1 text-orange-500 font-bold bg-orange-100 px-3 py-1 rounded-full text-xs uppercase tracking-wide">
              <Flame size={14} /> {streak} Game Streak
            </div>
          )}
          <h1 className="text-3xl font-black text-slate-800 mb-2 uppercase tracking-tighter">
            Beat The Editor
          </h1>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 w-full max-w-sm mb-8 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-2 shadow-lg ring-4 ring-blue-100">
                  YOU
                </div>
              </div>
              <div className="text-3xl font-black text-slate-300 italic">
                VS
              </div>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center text-white font-bold text-lg mb-2 shadow-lg overflow-hidden">
                  {quizData.editorImageUrl ? (
                    <img
                      src={quizData.editorImageUrl}
                      alt={`${quizData.editorName} headshot`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    "ED"
                  )}
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {quizData.editorName}
                </span>
                <span className="text-sm font-bold text-slate-800 bg-slate-200 px-2 rounded mt-1">
                  Score to Beat: {effectiveEditorScore}
                </span>
                {quizData.editorBlurb && (
                  <p className="text-xs text-slate-500 mt-2 leading-snug max-w-[180px]">
                    {quizData.editorBlurb}
                  </p>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              //posthog.featureFlags.overrideFeatureFlags({ flags: { "bte-difficulty": "test" } });
              const nextVariant = resolveDifficultyVariant(
                posthog.getFeatureFlag(FEATURE_FLAG_KEY) ||
                  DEFAULT_DIFFICULTY_VARIANT,
              );
              setDifficultyVariant(nextVariant);
              analytics.logStart(
                { game_id: "beat_the_editor", difficulty_variant: nextVariant },
                roundIndex,
              );
              setGameState("playing");
            }}
            className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl shadow-blue-200 shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2"
          >
            Start Quiz <ArrowRight size={20} />
          </button>
        </div>
        <DisclaimerFooter />
      </>
    );
  }

  // --- VIEW 2: PLAYING ---
  if (gameState === "playing") {
    const question = gameQuestions[currentQ];
    const progress = (currentQ / gameQuestions.length) * 100;

    // Check if we are in "Feedback Mode" (user answered wrong)
    const showFeedback = selectedOption !== null && answerStatus === "wrong";

    return (
      <>
        <div className="min-h-[400px] bg-white p-6 rounded-xl max-w-md mx-auto relative">
          {tutorialModal}
          <div className="absolute top-4 right-4 flex gap-2">
            {tutorialButton}
            {feedbackButton}
          </div>
          <div className="absolute top-0 left-0 h-1.5 bg-slate-100 w-full">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <div className="mt-4 mb-6">
            <span className="text-xs font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded">
              Question {currentQ + 1}
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-3 leading-snug">
              {question.text}
            </h2>
          </div>

          <div className="space-y-3">
            {question.options.map((opt, idx) => {
              let btnClass =
                "w-full text-left p-4 rounded-xl border-2 font-bold transition-all transform duration-200 ";
              if (selectedOption === null) {
                btnClass +=
                  "border-slate-100 bg-white text-slate-600 hover:border-blue-400 hover:bg-blue-50";
              } else if (idx === selectedOption) {
                if (answerStatus === "correct")
                  btnClass +=
                    "border-green-500 bg-green-500 text-white scale-105 shadow-lg";
                else
                  btnClass +=
                    "border-red-500 bg-red-500 text-white shake-animation";
              } else if (idx === question.correct && selectedOption !== null) {
                // Show correct answer if they got it wrong
                btnClass += "border-green-500 bg-white text-green-600";
              } else {
                btnClass += "border-slate-100 text-slate-300";
              }

              return (
                <button
                  key={idx}
                  disabled={selectedOption !== null}
                  onClick={() => handleAnswer(idx)}
                  className={btnClass}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {/* NEW: WRONG ANSWER FEEDBACK CARD */}
          {showFeedback && (
            <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  <XCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-bold text-red-800 mb-1">
                      Missed it!
                    </p>
                    <p className="text-sm text-slate-600 mb-3 italic">
                      "{question.blurb}"
                    </p>

                    <a
                      href={question.articleUrl}
                      target="_top"
                      onClick={() =>
	                        analytics.logContentClick(
	                          {
	                            article_title: question.articleTitle,
	                            destination_url: question.articleUrl,
	                            source_question: question.text,
	                            context: "wrong_answer_feedback",
	                            difficulty_variant: difficultyVariant,
	                          },
	                          currentQ + 1,
	                        )
	                      }
                      className="inline-flex items-center text-xs font-black text-blue-600 uppercase tracking-wide hover:underline bg-white border border-blue-100 px-3 py-2 rounded shadow-sm"
                    >
                      Read: {question.articleTitle}
                      <ExternalLink size={12} className="ml-1" />
                    </a>
                  </div>
                </div>
              </div>

              <button
                onClick={() => advanceGame(score)}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                Next Question <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
        <DisclaimerFooter />
      </>
    );
  }

  // --- VIEW 3: RESULTS ---
  if (gameState === "results") {
    const userWon = score > effectiveEditorScore;

    return (
      <>
        <div className="bg-slate-50 p-6 rounded-xl max-w-md mx-auto relative overflow-hidden">
          {tutorialModal}
          <div className="absolute top-4 right-4 z-10">{tutorialButton}</div>
          {showConfetti && (
            <Confetti
              width={window.innerWidth}
              height={window.innerHeight}
              recycle={false}
              numberOfPieces={500}
            />
          )}

          <div className="text-center mb-8 mt-4">
            <h2 className="text-4xl font-black text-slate-900 mb-2 italic">
	              {userWon
	                ? "VICTORY!"
	                : score === effectiveEditorScore
	                  ? "DRAW!"
	                  : "DEFEAT!"}
            </h2>
            <p className="text-slate-600 text-lg">
              You: <span className="font-bold text-blue-600">{score}</span> —
              Editor:{" "}
	              <span className="font-bold text-slate-800">
	                {effectiveEditorScore}
	              </span>
            </p>

            <button
              onClick={shareResults}
              className="mt-6 bg-slate-900 text-white text-sm font-bold py-3 px-6 rounded-full flex items-center justify-center gap-2 mx-auto hover:bg-black transition-all"
            >
              <Share2 size={16} /> Share Result
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">
              Your Answers
            </h3>
	            {gameQuestions.map((q, idx) => {
	              const userAnswer = userAnswers.find((a) => a.qId === q.id);
	              return (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-3">
                    <div
                      className={`mt-1 min-w-[24px] h-6 rounded-full flex items-center justify-center text-xs text-white font-bold ${
                        userAnswer?.isCorrect ? "bg-green-500" : "bg-red-500"
                      }`}
                    >
                      {userAnswer?.isCorrect ? "✓" : "X"}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-2 leading-tight">
                        {q.text}
                      </h3>
                      <p className="text-xs text-slate-500 mb-3 italic border-l-2 border-slate-300 pl-2">
                        "{q.blurb}"
                      </p>

                      <a
                        href={q.articleUrl}
                        target="_top"
	                        onClick={() =>
	                          analytics.logContentClick(
	                            {
	                              article_title: q.articleTitle,
	                              destination_url: q.articleUrl,
	                              source_question: q.text,
	                              difficulty_variant: difficultyVariant,
	                            },
	                            idx + 1,
	                          )
	                        }
                        className="inline-flex items-center text-xs font-black text-blue-600 uppercase tracking-wide hover:underline bg-blue-50 px-2 py-1 rounded"
                      >
                        Read: {q.articleTitle}{" "}
                        <ExternalLink size={10} className="ml-1" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DisclaimerFooter />
      </>
    );
  }
}
