import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  KeyRound,
  LogOut,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { createEmptyQuestion, normalizeQuizData } from "../utils/quizData";

const SESSION_ENDPOINT = "/.netlify/functions/admin-session";
const LOGIN_ENDPOINT = "/.netlify/functions/admin-login";
const LOGOUT_ENDPOINT = "/.netlify/functions/admin-logout";
const LIST_VERSIONS_ENDPOINT = "/.netlify/functions/list-quiz-versions";
const RESTORE_VERSION_ENDPOINT = "/.netlify/functions/restore-quiz-version";

const cloneData = (data) => JSON.parse(JSON.stringify(data));

const questionHasIssues = (question) => {
  if (!question.text.trim()) return true;
  if (question.options.some((option) => !option.trim())) return true;
  if (question.correct < 0 || question.correct > 3) return true;
  return false;
};

export default function AdminPanel({
  data,
  onSave,
  onExit,
  onRestore,
}) {
  const [draftData, setDraftData] = useState(() => cloneData(data));
  const [importPayload, setImportPayload] = useState("");
  const [importError, setImportError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [passcodeInput, setPasscodeInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsError, setVersionsError] = useState("");
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    setDraftData(cloneData(data));
  }, [data]);

  const stats = useMemo(() => {
    const questionIssues = draftData.questions.filter((question) =>
      questionHasIssues(question)
    );
    return {
      total: draftData.questions.length,
      issues: questionIssues.length,
    };
  }, [draftData.questions]);

  const hasChanges = useMemo(
    () => JSON.stringify(draftData) !== JSON.stringify(data),
    [draftData, data]
  );

  const refreshSession = async () => {
    try {
      const response = await fetch(SESSION_ENDPOINT, { credentials: "include" });
      if (!response.ok) {
        setIsAuthenticated(false);
        return;
      }
      const payload = await response.json();
      setIsAuthenticated(Boolean(payload.authenticated));
    } catch (error) {
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const fetchVersions = async () => {
    setVersionsError("");
    setIsLoadingVersions(true);
    try {
      const response = await fetch(LIST_VERSIONS_ENDPOINT, {
        credentials: "include",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Unable to load versions.");
      }
      const payload = await response.json();
      setVersions(payload.versions || []);
    } catch (error) {
      setVersionsError(error.message || "Unable to load versions.");
    } finally {
      setIsLoadingVersions(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchVersions();
    }
  }, [isAuthenticated]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError("");
    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ passcode: passcodeInput }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Login failed.");
      }

      setIsAuthenticated(true);
      setPasscodeInput("");
    } catch (error) {
      setAuthError(error.message || "Login failed.");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(LOGOUT_ENDPOINT, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setIsAuthenticated(false);
    }
  };

  const updateField = (field, value) => {
    setDraftData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateQuestion = (index, updates) => {
    setDraftData((prev) => {
      const nextQuestions = [...prev.questions];
      nextQuestions[index] = { ...nextQuestions[index], ...updates };
      return { ...prev, questions: nextQuestions };
    });
  };

  const updateOption = (index, optionIndex, value) => {
    setDraftData((prev) => {
      const nextQuestions = [...prev.questions];
      const options = [...nextQuestions[index].options];
      options[optionIndex] = value;
      nextQuestions[index] = { ...nextQuestions[index], options };
      return { ...prev, questions: nextQuestions };
    });
  };

  const moveQuestion = (index, direction) => {
    setDraftData((prev) => {
      const nextQuestions = [...prev.questions];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= nextQuestions.length) return prev;
      [nextQuestions[index], nextQuestions[targetIndex]] = [
        nextQuestions[targetIndex],
        nextQuestions[index],
      ];
      return { ...prev, questions: nextQuestions };
    });
  };

  const duplicateQuestion = (index) => {
    setDraftData((prev) => {
      const nextQuestions = [...prev.questions];
      const copy = {
        ...nextQuestions[index],
        id: createEmptyQuestion().id,
      };
      nextQuestions.splice(index + 1, 0, copy);
      return { ...prev, questions: nextQuestions };
    });
  };

  const removeQuestion = (index) => {
    setDraftData((prev) => {
      const nextQuestions = prev.questions.filter((_, idx) => idx !== index);
      return { ...prev, questions: nextQuestions };
    });
  };

  const addQuestion = () => {
    setDraftData((prev) => ({
      ...prev,
      questions: [...prev.questions, createEmptyQuestion()],
    }));
  };

  const handleSave = async () => {
    setSaveError("");
    setIsSaving(true);
    try {
      const normalized = normalizeQuizData(draftData);
      await onSave(normalized);
      setStatusMessage("Published! Players will see the latest version.");
      setTimeout(() => setStatusMessage(""), 3500);
      await fetchVersions();
    } catch (error) {
      setSaveError(error.message || "Failed to publish. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const payload = JSON.stringify(draftData, null, 2);
    navigator.clipboard.writeText(payload);
    setStatusMessage("Quiz JSON copied to clipboard.");
    setTimeout(() => setStatusMessage(""), 3500);
  };

  const handleDownload = () => {
    const payload = JSON.stringify(draftData, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "beat-the-editor-quiz.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    setImportError("");
    if (!importPayload.trim()) return;
    try {
      const parsed = JSON.parse(importPayload);
      setDraftData(normalizeQuizData(parsed));
      setImportPayload("");
      setStatusMessage("Imported JSON successfully.");
      setTimeout(() => setStatusMessage(""), 3500);
    } catch (error) {
      setImportError("Invalid JSON. Please fix and try again.");
    }
  };

  const handleRestore = async (versionId, timestampLabel) => {
    setRestoreError("");
    const confirmed = window.confirm(
      `Restore the quiz to the version saved on ${timestampLabel}?`
    );
    if (!confirmed) return;
    setRestoringId(versionId);
    try {
      const response = await fetch(RESTORE_VERSION_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ versionId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Restore failed.");
      }
      const payload = await response.json();
      const normalized = normalizeQuizData(payload.data);
      setDraftData(normalized);
      onRestore(normalized);
      setStatusMessage("Restored! Publish again to make further edits.");
      setTimeout(() => setStatusMessage(""), 3500);
      await fetchVersions();
    } catch (error) {
      setRestoreError(error.message || "Restore failed.");
    } finally {
      setRestoringId(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black">Quiz Admin Access</h1>
              <p className="text-sm text-slate-400">
                Secure this editor before making updates.
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-300">
              Passcode
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
                <KeyRound size={16} className="text-slate-400" />
                <input
                  type="password"
                  value={passcodeInput}
                  onChange={(event) => setPasscodeInput(event.target.value)}
                  className="w-full bg-transparent text-white focus:outline-none"
                  placeholder="Enter passcode"
                />
              </div>
            </label>
            {authError && <p className="text-sm text-rose-400">{authError}</p>}
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 py-2 font-bold text-white hover:bg-blue-500"
            >
              Unlock Admin
            </button>
            <p className="text-xs text-slate-500">
              Access is verified server-side and protected by rate limits.
            </p>
          </form>

          <button
            type="button"
            onClick={onExit}
            className="mt-6 w-full rounded-lg border border-slate-700 py-2 text-sm font-semibold text-slate-300 hover:border-slate-500"
          >
            Back to the quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-blue-500">
              Beat the Editor Admin
            </p>
            <h1 className="text-2xl font-black text-slate-900">
              Quiz Builder
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-400"
              disabled={isSaving}
            >
              <Save size={16} /> {isSaving ? "Publishing..." : "Publish"}
            </button>
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400"
            >
              <LogOut size={16} /> Exit
            </button>
          </div>
        </div>
        {hasChanges && (
          <div className="border-t border-amber-200 bg-amber-50 px-6 py-3 text-sm font-semibold text-amber-800">
            You have unsaved changes. Publish to update the live quiz.
          </div>
        )}
        {saveError && (
          <div className="border-t border-rose-200 bg-rose-50 px-6 py-3 text-sm font-semibold text-rose-700">
            {saveError}
          </div>
        )}
        {restoreError && (
          <div className="border-t border-rose-200 bg-rose-50 px-6 py-3 text-sm font-semibold text-rose-700">
            {restoreError}
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 lg:flex-row">
        <section className="flex-1 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Editor & game settings
                </h2>
                <p className="text-sm text-slate-500">
                  Update the editor details and the score that players need to
                  beat.
                </p>
              </div>
              {hasChanges && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                  Unsaved changes
                </span>
              )}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-600">
                Editor name
                <input
                  value={draftData.editorName}
                  onChange={(event) => updateField("editorName", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="The Editor"
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Score to beat
                <input
                  type="number"
                  min="0"
                  value={draftData.editorScore}
                  onChange={(event) =>
                    updateField("editorScore", event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="3"
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Editor image URL
                <input
                  value={draftData.editorImageUrl}
                  onChange={(event) =>
                    updateField("editorImageUrl", event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Editor blurb
                <textarea
                  value={draftData.editorBlurb}
                  onChange={(event) =>
                    updateField("editorBlurb", event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows="3"
                  placeholder="Short bio or theme for this week."
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Version history
                </h2>
                <p className="text-sm text-slate-500">
                  Restore a previous publish if something went wrong. Restoring
                  will replace the live quiz immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchVersions}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400"
                disabled={isLoadingVersions}
              >
                <Download size={16} />{" "}
                {isLoadingVersions ? "Refreshing..." : "Refresh list"}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {isLoadingVersions && (
                <p className="text-sm text-slate-500">Loading versions...</p>
              )}
              {versionsError && (
                <p className="text-sm text-rose-500">{versionsError}</p>
              )}
              {!isLoadingVersions && !versionsError && versions.length === 0 && (
                <p className="text-sm text-slate-500">
                  No saved versions yet. Publish a quiz to start tracking
                  history.
                </p>
              )}
              {versions.map((version) => {
                const timestamp = new Date(version.versioned_at);
                const label = timestamp.toLocaleString();
                return (
                  <div
                    key={version.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        Saved {label}
                      </p>
                      <p className="text-xs text-slate-500">
                        Version ID: {version.id}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestore(version.id, label)}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-700"
                      disabled={restoringId === version.id}
                    >
                      <Upload size={16} />{" "}
                      {restoringId === version.id ? "Restoring..." : "Restore"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Questions</h2>
                <p className="text-sm text-slate-500">
                  Add, reorder, and refine each question.
                </p>
              </div>
              <button
                type="button"
                onClick={addQuestion}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
              >
                <Plus size={16} /> Add question
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {draftData.questions.map((question, index) => (
                <div
                  key={question.id}
                  className="rounded-2xl border border-slate-200 p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          Question {index + 1}
                        </h3>
                        {questionHasIssues(question) && (
                          <p className="text-xs text-amber-600">
                            Needs more info to be playable.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, -1)}
                        className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-blue-200 hover:text-blue-600"
                        title="Move up"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, 1)}
                        className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-blue-200 hover:text-blue-600"
                        title="Move down"
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateQuestion(index)}
                        className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-blue-200 hover:text-blue-600"
                        title="Duplicate"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(index)}
                        className="rounded-lg border border-rose-200 p-2 text-rose-500 hover:border-rose-300"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <label className="text-sm font-semibold text-slate-600">
                      Question text
                      <textarea
                        value={question.text}
                        onChange={(event) =>
                          updateQuestion(index, { text: event.target.value })
                        }
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        rows="2"
                        placeholder="Enter the question"
                      />
                    </label>

                    <div className="grid gap-3 md:grid-cols-2">
                      {question.options.map((option, optionIndex) => (
                        <label
                          key={optionIndex}
                          className="text-sm font-semibold text-slate-600"
                        >
                          Option {optionIndex + 1}
                          <input
                            value={option}
                            onChange={(event) =>
                              updateOption(index, optionIndex, event.target.value)
                            }
                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            placeholder={`Option ${optionIndex + 1}`}
                          />
                        </label>
                      ))}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="text-sm font-semibold text-slate-600">
                        Correct option
                        <select
                          value={question.correct}
                          onChange={(event) =>
                            updateQuestion(index, {
                              correct: Number.parseInt(event.target.value, 10),
                            })
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        >
                          {question.options.map((_, optionIndex) => (
                            <option key={optionIndex} value={optionIndex}>
                              Option {optionIndex + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm font-semibold text-slate-600 md:col-span-2">
                        Blurb / explanation
                        <textarea
                          value={question.blurb}
                          onChange={(event) =>
                            updateQuestion(index, { blurb: event.target.value })
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          rows="2"
                          placeholder="Short explainer displayed after incorrect answers."
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="text-sm font-semibold text-slate-600">
                        Article title
                        <input
                          value={question.articleTitle}
                          onChange={(event) =>
                            updateQuestion(index, {
                              articleTitle: event.target.value,
                            })
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Read the full story"
                        />
                      </label>
                      <label className="text-sm font-semibold text-slate-600">
                        Article URL
                        <input
                          value={question.articleUrl}
                          onChange={(event) =>
                            updateQuestion(index, {
                              articleUrl: event.target.value,
                            })
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="https://..."
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Import & export</h2>
            <p className="text-sm text-slate-500">
              Move data between devices or keep a versioned backup.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-600"
              >
                <Copy size={16} /> Copy JSON
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-600"
              >
                <Download size={16} /> Download JSON
              </button>
            </div>

            <div className="mt-5">
              <label className="text-sm font-semibold text-slate-600">
                Paste JSON to import
                <textarea
                  value={importPayload}
                  onChange={(event) => setImportPayload(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows="4"
                  placeholder="Paste saved quiz JSON here"
                />
              </label>
              {importError && (
                <p className="mt-2 text-sm text-rose-500">{importError}</p>
              )}
              <button
                type="button"
                onClick={handleImport}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Upload size={16} /> Import JSON
              </button>
            </div>
          </div>
        </section>

        <aside className="w-full max-w-sm space-y-6">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">
              Builder status
            </h3>
            <div className="mt-4 space-y-3 text-sm text-blue-900">
              <div className="flex items-center justify-between">
                <span>Total questions</span>
                <span className="font-bold">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Needs attention</span>
                <span className="font-bold">{stats.issues}</span>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-white/70 p-3 text-xs text-blue-700">
              Tip: leave 3-7 questions per week for the best pacing.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
              Quick actions
            </h3>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => setDraftData(cloneData(data))}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400"
              >
                Reset unsaved changes
                <ArrowUp size={16} className="rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => {
                  handleLogout();
                  onExit();
                }}
                className="flex w-full items-center justify-between rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:border-rose-300"
              >
                Sign out
                <LogOut size={16} />
              </button>
            </div>
          </div>

          {statusMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              {statusMessage}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
