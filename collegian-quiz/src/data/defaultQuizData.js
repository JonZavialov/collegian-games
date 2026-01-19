export const defaultQuizData = {
  editorName: "The Editor",
  editorScore: 3,
  editorImageUrl: "",
  editorBlurb:
    "Set the bar for this week with a tough-but-fair score. Update your bio and headshot anytime.",
  questions: [
    {
      id: "sample-1",
      text: "Which Penn State team won its most recent matchup?",
      options: [
        "Women's volleyball",
        "Men's hockey",
        "Wrestling",
        "Field hockey",
      ],
      correct: 2,
      blurb: "Penn State wrestling stayed undefeated with a statement win.",
      articleTitle: "Read the recap",
      articleUrl: "https://www.collegian.psu.edu",
    },
    {
      id: "sample-2",
      text: "What is the focus of this week's campus spotlight?",
      options: ["Housing updates", "Student elections", "Research grants", "Arts festival"],
      correct: 1,
      blurb: "Student government elections are underway across campus.",
      articleTitle: "See the full story",
      articleUrl: "https://www.collegian.psu.edu",
    },
    {
      id: "sample-3",
      text: "Which community initiative is highlighted in The Collegian?",
      options: [
        "Food pantry expansion",
        "Local business summit",
        "Transportation survey",
        "Sustainability fair",
      ],
      correct: 0,
      blurb: "The food pantry is expanding hours and volunteer opportunities.",
      articleTitle: "Learn more",
      articleUrl: "https://www.collegian.psu.edu",
    },
  ],
};
