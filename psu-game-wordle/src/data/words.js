import Papa from 'papaparse'

const normalizeKey = (value) => String(value || '').trim().toLowerCase()

const getField = (row, names) => {
  const keys = Object.keys(row)
  for (const name of names) {
    const target = normalizeKey(name)
    const match = keys.find((key) => normalizeKey(key) === target)
    if (match) return row[match]
  }
  return undefined
}

const normalizeWord = (row, index) => {
  const wordRaw = getField(row, ['word'])
  if (!wordRaw) return null
  const word = String(wordRaw).trim().toUpperCase()
  if (!word) return null

  const hint = getField(row, ['hint']) ?? ''
  const articleUrl =
    getField(row, ['article', 'articleUrl', 'article_url']) ?? ''
  const idRaw = getField(row, ['id'])
  const id = Number.isFinite(Number(idRaw)) ? Number(idRaw) : index + 1

  return {
    id,
    word,
    hint: String(hint || ''),
    articleUrl: String(articleUrl || ''),
  }
}

export const loadWordsFromSheet = (sheetUrl) => new Promise((resolve, reject) => {
  if (!sheetUrl) {
    reject(new Error('Missing sheet URL'))
    return
  }

  const cacheBustedUrl = sheetUrl.includes('?')
    ? `${sheetUrl}&cb=${Date.now()}`
    : `${sheetUrl}?cb=${Date.now()}`

  Papa.parse(cacheBustedUrl, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      if (results.errors?.length) {
        reject(new Error(results.errors[0]?.message || 'Failed to parse sheet'))
        return
      }

      const words = results.data
        .map((row, index) => normalizeWord(row, index))
        .filter(Boolean)

      if (!words.length) {
        reject(new Error('No valid words found in the sheet'))
        return
      }

      resolve(words)
    },
    error: (error) => reject(error),
  })
})

export const pickRandomWord = (words) => {
  return words[Math.floor(Math.random() * words.length)]
}
