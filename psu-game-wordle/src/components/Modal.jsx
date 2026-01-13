import React from 'react'
import posthog from 'posthog-js'

export default function Modal({ isCorrect, turn, solution, articleUrl, handleReset }) {
  
  const copyToClipboard = () => {
    // Generate a simple result string (e.g. "Football Wordle: 4/6")
    const text = `Football Wordle 🏈\nScore: ${isCorrect ? turn : 'X'}/6`;
    navigator.clipboard.writeText(text);
    posthog.capture('share_clicked', { is_correct: isCorrect, turns: isCorrect ? turn : 6 })
    alert('Copied to clipboard!');
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-10 rounded-lg shadow-xl max-w-sm w-full text-center">
        <h1 className="text-3xl font-bold mb-4">
          {isCorrect ? 'TOUCHDOWN! 🏈' : 'Turnover on Downs 😞'}
        </h1>
        
        <p className="mb-6 text-gray-600">
          The word was:{' '}
          {articleUrl ? (
            <a
              className="font-bold text-penn-state-blue underline underline-offset-2"
              href={articleUrl}
              target="_blank"
              rel="noreferrer"
            >
              {solution}
            </a>
          ) : (
            <span className="font-bold text-penn-state-blue">{solution}</span>
          )}
        </p>
        
        <div className="flex flex-col gap-3">
            <button 
                onClick={copyToClipboard}
                className="bg-gray-800 text-white py-3 rounded hover:bg-gray-900 transition font-bold"
            >
                Share Score 📤
            </button>
            <button 
                onClick={handleReset}
                className="border-2 border-gray-800 text-gray-800 py-3 rounded hover:bg-gray-100 transition font-bold"
            >
                Play Again
            </button>
        </div>
      </div>
    </div>
  )
}
