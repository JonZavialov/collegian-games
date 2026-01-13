import words from 'an-array-of-english-words'

const dictionaryCache = new Map()

export const getDictionarySet = (wordLength) => {
  if (!wordLength) return new Set()
  if (dictionaryCache.has(wordLength)) {
    return dictionaryCache.get(wordLength)
  }

  const filtered = words.filter((word) => word.length === wordLength)
  const dictionarySet = new Set(filtered.map((word) => word.toUpperCase()))
  dictionaryCache.set(wordLength, dictionarySet)
  return dictionarySet
}
