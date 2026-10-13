/**
 * Malayalam Newspaper Typography & Syllable-Level Line Breaking
 *
 * In Malayalam newspapers (such as Malayala Manorama and Mathrubhumi), narrow
 * column layouts require words to break naturally across lines at orthographic
 * syllable (Akshara) boundaries without leaving wide word-spacing justification gaps.
 *
 * Rules:
 * 1. An Akshara (consonant cluster + matra, independent vowel, or chillu) is atomic
 *    and must NEVER be broken apart internally.
 * 2. Chillu codas (ൺ, ൻ, ർ, ൽ, ൾ, ൿ) and final virama consonants (ക്, ട്, ത്, etc.)
 *    bind to their preceding base syllable and cannot stand alone at the start of a line.
 * 3. Newspaper line-fill rule: Break opportunities are placed so that at least two
 *    syllables must be placed on the current line before any split occurs. If only
 *    one letter/syllable fits, the entire word wraps to the next line ("if only one
 *    letter can add, that time that full word add in next line").
 * 4. Words with 2 or fewer syllables are never split.
 * 5. English words and non-Malayalam text are completely untouched.
 */

// Matches a single Malayalam orthographic syllable unit
const AKSHARA_REGEX =
  /(?:[\u0D7A-\u0D7F][\u0D02\u0D03]?|[\u0D15-\u0D3A]\u0D4D\u200D[\u0D02\u0D03]?|[\u0D05-\u0D14][\u0D02\u0D03]?|[\u0D15-\u0D3A](?:\u0D4D[\u200C\u200D]?[\u0D15-\u0D3A])*(?:[\u0D3E-\u0D4C\u0D57\u0D62\u0D63]\u0D4D?|\u0D4D)?[\u0D02\u0D03]?)/g

// Zero-width space (invisible break opportunity that doesn't stretch under text justification)
const ZWSP = '\u200B'

/**
 * Checks if a string contains any Malayalam Unicode characters.
 */
export function hasMalayalamText(str) {
  return typeof str === 'string' && /[\u0D00-\u0D7F]/.test(str)
}

/**
 * Detects whether an edition is in Malayalam, checking both the edition.language
 * field and scanning section content/titles for Malayalam characters.
 */
export function isMalayalamEdition(edition) {
  if (!edition) return false
  const lang = (edition.language || '').toLowerCase()
  if (lang === 'english') return false
  if (lang === 'malayalam') return true
  const sections = edition.sections || []
  return sections.some((s) => hasMalayalamText(s.content) || hasMalayalamText(s.title))
}

/**
 * Splits a Malayalam core word into linguistic syllables, merging chillu letters
 * and coda consonants into the preceding syllable so lines never start with a chillu.
 */
function splitIntoMalayalamSyllables(coreWord) {
  const matches = coreWord.match(AKSHARA_REGEX)
  if (!matches || matches.length === 0) return [coreWord]

  const syllables = []

  for (let i = 0; i < matches.length; i++) {
    const token = matches[i]

    // Check if token is a chillu letter (U+0D7A–U+0D7F or consonant+virama+ZWJ)
    const isChillu =
      /^[\u0D7A-\u0D7F]/.test(token) || /^[\u0D15-\u0D3A]\u0D4D\u200D/.test(token)

    // Check if token is a simple pure stop coda (e.g. single consonant + virama with no vowel sign)
    const isPureViramaCoda = /^[\u0D15-\u0D3A]\u0D4D$/.test(token)

    // A chillu or coda binds to the previous syllable if one exists
    if ((isChillu || isPureViramaCoda) && syllables.length > 0) {
      syllables[syllables.length - 1] += token
    } else {
      syllables.push(token)
    }
  }

  return syllables
}

/**
 * Hyphenates a single word with zero-width break opportunities if it is a
 * multi-syllable Malayalam word.
 *
 * Implements the newspaper rule:
 * - If only 1 or 2 syllables: DO NOT SPLIT (word wraps intact).
 * - If 3 or more syllables: first break is placed AFTER syllable 2.
 *   This ensures that at least 2 full letters/syllables stay on the current line.
 *   If only 1 letter can fit, the whole word moves to the next line.
 */
export function hyphenateMalayalamWord(word) {
  if (!hasMalayalamText(word)) return word

  // Preserve leading punctuation / brackets / quotes
  const leadMatch = word.match(/^[^\u0D00-\u0D7F]+/)
  const lead = leadMatch ? leadMatch[0] : ''
  const rest = word.slice(lead.length)

  // Preserve trailing punctuation / quotes
  const trailMatch = rest.match(/[^\u0D00-\u0D7F]+$/)
  const trail = trailMatch ? trailMatch[0] : ''
  const core = rest.slice(0, rest.length - trail.length)

  if (!core) return word

  const syllables = splitIntoMalayalamSyllables(core)

  // Words with 2 or fewer syllables must not be broken across lines
  if (syllables.length <= 2) {
    return word
  }

  // First break opportunity starts strictly AFTER syllable 2
  let result = syllables[0] + syllables[1]
  for (let i = 2; i < syllables.length; i++) {
    result += ZWSP + syllables[i]
  }

  return lead + result + trail
}

/**
 * Formats body copy or headlines for Malayalam newspaper columns.
 * Words are given syllable-level line break opportunities so lines pack
 * tightly with zero justification gaps.
 */
export function formatMalayalamNewspaperText(text) {
  if (!text || typeof text !== 'string' || !hasMalayalamText(text)) {
    return text
  }

  // Preserve paragraphs and line breaks
  const paragraphs = text.split('\n')
  return paragraphs
    .map((para) => {
      // Split preserving whitespace tokens
      const tokens = para.split(/(\s+)/)
      return tokens
        .map((token) => {
          if (/^\s+$/.test(token)) return token
          return hyphenateMalayalamWord(token)
        })
        .join('')
    })
    .join('\n')
}

