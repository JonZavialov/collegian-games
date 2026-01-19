const safeNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const generateId = () =>
  `q-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;

export const createEmptyQuestion = () => ({
  id: generateId(),
  text: "",
  options: ["", "", "", ""],
  correct: 0,
  blurb: "",
  articleTitle: "",
  articleUrl: "",
});

export const normalizeQuizData = (data = {}) => {
  const base = {
    editorName: data.editorName ?? "The Editor",
    editorScore: safeNumber(data.editorScore, 0),
    editorImageUrl: data.editorImageUrl ?? "",
    editorBlurb: data.editorBlurb ?? "",
    questions: Array.isArray(data.questions) ? data.questions : [],
  };

  const questions = base.questions.map((question) => {
    const options = Array.isArray(question.options)
      ? question.options.slice(0, 4)
      : [];
    while (options.length < 4) {
      options.push("");
    }

    return {
      id: question.id ?? generateId(),
      text: question.text ?? "",
      options,
      correct: safeNumber(question.correct, 0),
      blurb: question.blurb ?? "",
      articleTitle: question.articleTitle ?? "",
      articleUrl: question.articleUrl ?? "",
    };
  });

  return {
    ...base,
    questions,
  };
};
