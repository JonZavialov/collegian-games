import { useEffect, useMemo, useState } from 'react'

export default function Row({
  guess,
  currentGuess,
  shake,
  wordLength = 5,
  tileSize,
  tileFontSize,
}) {
  const [isShaking, setIsShaking] = useState(false)
  const tileStyle = useMemo(() => ({
    width: tileSize,
    height: tileSize,
    fontSize: tileFontSize,
  }), [tileSize, tileFontSize])

  useEffect(() => {
    if (!shake) return undefined
    setIsShaking(true)
    const timeout = setTimeout(() => setIsShaking(false), 500)
    return () => clearTimeout(timeout)
  }, [shake])

  // If this row is a completed guess
  if (guess) {
    return (
      <div className="row flex justify-center text-center">
        {guess.map((l, i) => (
          <div
            key={i}
            style={tileStyle}
            className={`block border-2 flex items-center justify-center m-1 font-bold uppercase animate-flip ${l.color}`}
          >
            {l.key}
          </div>
        ))}
      </div>
    )
  }

  // If this row is the one the user is currently typing
  if (currentGuess) {
    let letters = currentGuess.split('')
    const remaining = Math.max(wordLength - letters.length, 0)
    return (
      <div className={`row flex justify-center text-center ${isShaking ? 'row-shake' : ''}`}>
        {letters.map((letter, i) => (
          <div
            key={i}
            style={tileStyle}
            className="block border-2 border-gray-500 flex items-center justify-center m-1 font-bold uppercase animate-bounceShort"
          >
            {letter}
          </div>
        ))}
        {[...Array(remaining)].map((_, i) => (
          <div key={i} style={tileStyle} className="block border-2 border-gray-300 m-1"></div>
        ))}
      </div>
    )
  }

  // Empty rows
  return (
    <div className="row flex justify-center text-center">
      {[...Array(wordLength)].map((_, i) => (
        <div key={i} style={tileStyle} className="block border-2 border-gray-300 m-1"></div>
      ))}
    </div>
  )
}
