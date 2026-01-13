import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import posthog from 'posthog-js'
import useWordle from './hooks/useWordle'
import Row from './components/Row'
import Modal from './components/Modal'
import Keyboard from './components/Keyboard'
import { loadWordsFromSheet } from './data/words'
import { getDictionarySet } from './data/dictionary'

function App() {
  const [solutionObj, setSolutionObj] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [resetToken, setResetToken] = useState(0)

  useEffect(() => {
    let isMounted = true
    let pollId = null

    const fetchWords = () => {
      loadWordsFromSheet(import.meta.env.VITE_WORDS_SHEET_CSV_URL)
        .then((loadedWords) => {
          if (!isMounted) return
          const nextSolution = loadedWords[0]
          setSolutionObj((prev) => {
            if (!prev || prev.word !== nextSolution.word) {
              return nextSolution
            }
            return prev
          })
          setLoadError('')
        })
        .catch((error) => {
          if (!isMounted) return
          setLoadError(error.message || 'Failed to load words')
        })
    }

    fetchWords()
    pollId = window.setInterval(fetchWords, 60000)

    return () => {
      isMounted = false
      if (pollId) window.clearInterval(pollId)
    }
  }, [])

  if (loadError) {
    return <div className="min-h-screen flex items-center justify-center text-red-700">{loadError}</div>
  }

  if (!solutionObj) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <Game
      key={`${solutionObj.word}-${resetToken}`}
      solution={solutionObj.word}
      hint={solutionObj.hint}
      articleUrl={solutionObj.articleUrl}
      reset={() => setResetToken((prev) => prev + 1)}
    />
  )
}

// Separate Game component to allow easy resetting by changing the key in App
function Game({ solution, hint, articleUrl, reset }) {
  const dictionarySet = useMemo(() => getDictionarySet(solution.length), [solution.length])
  const hasStartedRef = useRef(false)
  const hasCompletedRef = useRef(false)
  const handleGuessCapture = useCallback((payload) => {
    if (!hasStartedRef.current) {
      posthog.capture('game_started', { word_length: solution.length })
      hasStartedRef.current = true
    }
    posthog.capture('guess_submitted', {
      turn: payload.turn,
      guess: payload.guess,
      is_correct: payload.isCorrect,
      word_length: solution.length,
    })
  }, [solution.length])
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
  } = useWordle(solution, dictionarySet, handleGuessCapture)
  const [showModal, setShowModal] = useState(false)
  const tileSize = useMemo(() => {
    if (solution.length <= 5) return 56
    if (solution.length === 6) return 50
    if (solution.length === 7) return 46
    if (solution.length === 8) return 42
    return 38
  }, [solution.length])
  const tileFontSize = useMemo(() => {
    if (solution.length <= 5) return 28
    if (solution.length <= 7) return 24
    if (solution.length <= 9) return 22
    return 20
  }, [solution.length])

  useEffect(() => {
    window.addEventListener('keyup', handleKeyup)

    // End game logic
    if (isCorrect || turn > 5) {
      if (!hasCompletedRef.current) {
        posthog.capture('game_completed', {
          win: isCorrect,
          turns: isCorrect ? turn : 6,
          word_length: solution.length,
        })
        hasCompletedRef.current = true
      }
      setTimeout(() => setShowModal(true), 2000)
      window.removeEventListener('keyup', handleKeyup)
    }

    return () => window.removeEventListener('keyup', handleKeyup)
  }, [handleKeyup, isCorrect, turn])

  return (
    <div className="min-h-screen flex flex-col items-center pt-6 sm:pt-10 px-3 sm:px-6">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-penn-state-blue mb-6 sm:mb-8 tracking-tighter">Valley Vocab</h1>
      
      <div className="w-full max-w-md overflow-x-auto">
        {turn === 0 && (hint || articleUrl) && (
          <div
            className="mb-4 rounded-xl border border-blue-200 px-4 py-3 shadow-sm"
            style={{ backgroundColor: 'rgba(23, 112, 223, 0.12)' }}
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
            )
          }
          return (
            <Row
              key={i}
              guess={g}
              wordLength={solution.length}
              tileSize={tileSize}
              tileFontSize={tileFontSize}
            />
          )
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
        />
      )}
    </div>
  )
}

export default App
