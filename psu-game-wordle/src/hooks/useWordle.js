import { useEffect, useState } from 'react'

const useWordle = (solution, dictionary, onGuess) => {
  const [turn, setTurn] = useState(0) 
  const [currentGuess, setCurrentGuess] = useState('')
  const [guesses, setGuesses] = useState([...Array(6)]) // 6 rows
  const [history, setHistory] = useState([]) 
  const [isCorrect, setIsCorrect] = useState(false)
  const [notice, setNotice] = useState('')
  const [shakeTick, setShakeTick] = useState(0)
  const [usedKeys, setUsedKeys] = useState({})
  
  const formatGuess = () => {
    let solutionArray = [...solution]
    let formattedGuess = [...currentGuess].map((l) => ({key: l, color: 'absent'}))

    // Find Green (Exact matches)
    formattedGuess.forEach((l, i) => {
      if (solutionArray[i] === l.key) {
        formattedGuess[i].color = 'correct'
        solutionArray[i] = null
      }
    })

    // Find Yellow (Wrong spot)
    formattedGuess.forEach((l, i) => {
      if (solutionArray.includes(l.key) && l.color !== 'correct') {
        formattedGuess[i].color = 'present'
        solutionArray[solutionArray.indexOf(l.key)] = null
      }
    })

    return formattedGuess
  }

  const addNewGuess = (formatted) => {
    if (currentGuess === solution) {
      setIsCorrect(true)
    }
    setGuesses((prevGuesses) => {
      let newGuesses = [...prevGuesses]
      newGuesses[turn] = formatted
      return newGuesses
    })
    setHistory((prevHistory) => [...prevHistory, currentGuess])
    setUsedKeys((prevUsedKeys) => {
      const nextUsed = { ...prevUsedKeys }
      formatted.forEach((letter) => {
        const currentColor = nextUsed[letter.key]
        if (letter.color === 'correct') {
          nextUsed[letter.key] = 'correct'
          return
        }
        if (letter.color === 'present') {
          if (currentColor !== 'correct') {
            nextUsed[letter.key] = 'present'
          }
          return
        }
        if (!currentColor) {
          nextUsed[letter.key] = 'absent'
        }
      })
      return nextUsed
    })
    setTurn((prevTurn) => prevTurn + 1)
    setCurrentGuess('')
    setNotice('')
  }

  const handleKey = (key) => {
    if (key === 'Enter') {
      if (turn > 5) return
      if (history.includes(currentGuess)) {
        setNotice('Already guessed!')
        setShakeTick(Date.now())
        return
      }
      if (currentGuess.length !== solution.length) return
      if (!dictionary || dictionary.size === 0) {
        setNotice('Word list unavailable')
        setShakeTick(Date.now())
        return
      }
      if (currentGuess !== solution && !dictionary.has(currentGuess)) {
        setNotice('Not in word list')
        setShakeTick(Date.now())
        return
      }
      const formatted = formatGuess()
      if (onGuess) {
        onGuess({
          guess: currentGuess,
          formatted,
          isCorrect: currentGuess === solution,
          turn: turn + 1,
        })
      }
      addNewGuess(formatted)
    }
    if (key === 'Backspace') {
      setCurrentGuess((prev) => prev.slice(0, -1))
      return
    }
    if (/^[A-Za-z]$/.test(key)) {
      if (currentGuess.length < solution.length) {
        setCurrentGuess((prev) => (prev + key).toUpperCase())
      }
    }
  }

  const handleKeyup = ({ key }) => {
    handleKey(key)
  }

  useEffect(() => {
    if (!notice) return undefined
    const timeout = setTimeout(() => setNotice(''), 1500)
    return () => clearTimeout(timeout)
  }, [notice])

  return { turn, currentGuess, guesses, isCorrect, handleKeyup, handleKey, shakeTick, notice, usedKeys }
}

export default useWordle
