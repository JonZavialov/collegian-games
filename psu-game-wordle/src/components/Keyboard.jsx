const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE'],
]

const KEY_LABELS = {
  ENTER: 'Enter',
  BACKSPACE: '⌫',
}

const KEY_COLORS = {
  correct: 'bg-green-600 text-white',
  present: 'bg-yellow-500 text-white',
  absent: 'bg-gray-500 text-white',
}

export default function Keyboard({ onKey, usedKeys = {} }) {
  return (
    <div className="mt-4 sm:mt-6 w-full max-w-xl select-none px-1">
      {ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
          {row.map((key) => {
            const isActionKey = key === 'ENTER' || key === 'BACKSPACE'
            const label = KEY_LABELS[key] ?? key
            const keyColor = usedKeys[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === 'BACKSPACE') {
                    onKey('Backspace')
                    return
                  }
                  if (key === 'ENTER') {
                    onKey('Enter')
                    return
                  }
                  onKey(key)
                }}
                className={`min-h-[44px] h-12 sm:h-14 rounded-md font-bold tracking-wide uppercase touch-manipulation ${
                  isActionKey ? 'flex-[1.5] min-w-[52px] text-xs sm:text-sm' : 'flex-1 min-w-[28px] text-sm sm:text-base'
                } ${KEY_COLORS[keyColor] ?? 'bg-gray-300 text-gray-900'} active:scale-95 active:brightness-90 transition-all shadow-sm`}
                aria-label={key}
              >
                {label}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
