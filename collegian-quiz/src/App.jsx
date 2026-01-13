import React, { useState, useEffect } from "react";
import posthog from "posthog-js";
import Confetti from "react-confetti";
import Papa from "papaparse";
import {
  Trophy,
  ArrowRight,
  Share2,
  ExternalLink,
  Loader,
  Flame,
  XCircle,
} from "lucide-react";

// REPLACE WITH YOUR PUBLISHED CSV LINK
const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3oYKiXAYFCy7osf9f0OjhuL2doMz14bmrugOP7ZPEqkYHA5JBTqgJF8svCDIlSU9y6fPj_rnrwAkf/pub?gid=0&single=true&output=csv";

const getWeekInfo = (date) => {
  const weekDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  weekDate.setUTCDate(weekDate.getUTCDate() + 4 - (weekDate.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(weekDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((weekDate - yearStart) / 86400000 + 1) / 7);
  return { year: weekDate.getUTCFullYear(), week };
};

const toWeekKey = (info) => `${info.year}-W${info.week}`;

export default function BeatTheEditor() {
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState(null);
  const [gameState, setGameState] = useState("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);

  // Engagement / Streak State
  const [streak, setStreak] = useState(0);

  // Visual Feedback
  const [selectedOption, setSelectedOption] = useState(null);
  const [answerStatus, setAnswerStatus] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // 1. FETCH DATA & HANDLE STREAKS
  useEffect(() => {
    // Load Streak from Local Storage
    const savedStreak = parseInt(localStorage.getItem("newsGameStreak") || "0");
    setStreak(savedStreak);

    Papa.parse(GOOGLE_SHEET_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawRows = results.data;
        if (rawRows.length > 0) {
          // --- ROBUST HEADER FINDER ---
          const headers = Object.keys(rawRows[0]);

          const findKey = (search) =>
            headers.find((h) =>
              h.toLowerCase().replace(/\s/g, "").includes(search.toLowerCase())
            );

          const editorScoreKey = findKey("editorscore");
          const editorRow = rawRows[0];

          const editorName =
            editorRow.EditorName || editorRow["Editor Name"] || "The Editor";
          const editorScore = parseInt(editorRow[editorScoreKey] || "0");
          const editorImageKey = findKey("editorimage");
          const editorBlurbKey = findKey("editorblurb");
          const editorImageUrl = editorImageKey
            ? editorRow[editorImageKey]
            : null;
          const editorBlurb = editorBlurbKey ? editorRow[editorBlurbKey] : null;

          const processedQuestions = rawRows
            .map((row, index) => {
              if (!row.Question && !row.question) return null;

              const correctKey = findKey("correct") || findKey("answer");
              const rawCorrect = row[correctKey];
              const cleanCorrect = parseInt(
                rawCorrect ? rawCorrect.toString().trim() : -1
              );

              return {
                id: index,
                text: row.Question || row.question,
                options: [
                  row[findKey("option1")],
                  row[findKey("option2")],
                  row[findKey("option3")],
                  row[findKey("option4")],
                ],
                correct: isNaN(cleanCorrect) ? 0 : cleanCorrect,
                blurb: row.Blurb || row.blurb,
                articleUrl: row.ArticleURL || row.articleUrl,
                articleTitle:
                  row.ArticleTitle || row.articleTitle || "Read Story",
              };
            })
            .filter((q) => q !== null);

          setQuizData({
            editorName,
            editorScore,
            editorImageUrl,
            editorBlurb,
            questions: processedQuestions,
          });
          setLoading(false);
        }
      },
    });
  }, []);

  // 2. HANDLE NEXT QUESTION (Manual or Auto)
  const advanceGame = (finalScore) => {
    setSelectedOption(null);
    setAnswerStatus(null);

    if (currentQ < quizData.questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      finishGame(finalScore);
    }
  };

  // 3. HANDLE ANSWER SELECTION
  const handleAnswer = (index) => {
    if (selectedOption !== null) return;

    setSelectedOption(index);
    const isCorrect = index === quizData.questions[currentQ].correct;
    setAnswerStatus(isCorrect ? "correct" : "wrong");

    posthog.capture("question_answered", {
      question_index: currentQ + 1,
      is_correct: isCorrect,
      question_text: quizData.questions[currentQ].text,
    });

    setUserAnswers([
      ...userAnswers,
      {
        qId: quizData.questions[currentQ].id,
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

    posthog.capture("game_completed", {
      streak_length: newStreak,
      score: finalScore,
      beat_editor: finalScore > quizData.editorScore,
    });

    if (finalScore > quizData.editorScore) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
  };

  const shareResults = () => {
    const squares = userAnswers
      .map((a) => (a.isCorrect ? "🟩" : "🟥"))
      .join("");
    const text = `I beat the editor! ${score}/${quizData.questions.length}\nStreak: ${streak}🔥\n${squares}\nRead more at: collegian.psu.edu`;
    navigator.clipboard.writeText(text);
    alert("Score copied to clipboard!");
    posthog.capture("clicked_share", { score });
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin text-blue-600" />
      </div>
    );

  // --- VIEW 1: INTRO ---
  if (gameState === "intro") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50 p-6 text-center rounded-xl font-sans">
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
            <div className="text-3xl font-black text-slate-300 italic">VS</div>
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
                Score to Beat: {quizData.editorScore}
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
            posthog.capture("game_start");
            setGameState("playing");
          }}
          className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl shadow-blue-200 shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2"
        >
          Start Quiz <ArrowRight size={20} />
        </button>
      </div>
    );
  }

  // --- VIEW 2: PLAYING ---
  if (gameState === "playing") {
    const question = quizData.questions[currentQ];
    const progress = (currentQ / quizData.questions.length) * 100;

    // Check if we are in "Feedback Mode" (user answered wrong)
    const showFeedback = selectedOption !== null && answerStatus === "wrong";

    return (
      <div className="min-h-[400px] bg-white p-6 rounded-xl max-w-md mx-auto relative">
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
                      posthog.capture("clicked_article_link", {
                        article_title: question.articleTitle,
                        destination_url: question.articleUrl,
                        source_question: question.text,
                        context: "wrong_answer_feedback",
                      })
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
    );
  }

  // --- VIEW 3: RESULTS ---
  if (gameState === "results") {
    const userWon = score > quizData.editorScore;

    return (
      <div className="bg-slate-50 p-6 rounded-xl max-w-md mx-auto relative overflow-hidden">
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
              : score === quizData.editorScore
              ? "DRAW!"
              : "DEFEAT!"}
          </h2>
          <p className="text-slate-600 text-lg">
            You: <span className="font-bold text-blue-600">{score}</span> —
            Editor:{" "}
            <span className="font-bold text-slate-800">
              {quizData.editorScore}
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
          {quizData.questions.map((q, idx) => {
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
                        posthog.capture("clicked_article_link", {
                          article_title: q.articleTitle,
                          destination_url: q.articleUrl,
                          source_question: q.text,
                        })
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
    );
  }
}
