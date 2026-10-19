/**
 * Sanitizes and extracts clean readable article text from raw content.
 * Prevents raw JSON responses from AI / backend from leaking into print & canvas views.
 */

/**
 * Extracts clean body text from raw section content.
 * Handles:
 * - Plain article text (returned as-is, trimmed)
 * - Markdown JSON code fences (```json ... ```)
 * - Raw JSON strings with keys like { body, content, article, text, expanded_content, story, summary }
 */
export function cleanSectionContent(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let text = raw.trim()

  // 1. Unwrap markdown code blocks if present
  const codeBlockMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim()
  }

  // 2. Check if text is a JSON object
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        const body =
          parsed.body ??
          parsed.content ??
          parsed.article ??
          parsed.text ??
          parsed.expanded_content ??
          parsed.story ??
          parsed.summary
        if (body && typeof body === 'string') {
          return body.trim()
        }
      }
    } catch {
      // Fallback regex in case JSON has unescaped control chars or newlines
      const bodyMatch = text.match(/"(?:body|content|article|text|story)":\s*"((?:[^"\\]|\\.)*)"/s)
      if (bodyMatch && bodyMatch[1]) {
        try {
          return JSON.parse(`"${bodyMatch[1]}"`).trim()
        } catch {
          return bodyMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .trim()
        }
      }
    }
  }

  // 3. Embedded JSON object inside text
  if (text.includes('{') && text.includes('}')) {
    const jsonMatch = text.match(/\{[\s\S]*"(?:body|content|article|text|story)"[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed && typeof parsed === 'object') {
          const body =
            parsed.body ??
            parsed.content ??
            parsed.article ??
            parsed.text ??
            parsed.expanded_content ??
            parsed.story ??
            parsed.summary
          if (body && typeof body === 'string') {
            return body.trim()
          }
        }
      } catch {}
    }
  }

  return text
}

/**
 * Extracts a clean headline title.
 * If title contains raw JSON, extracts the title field.
 * If title is empty and rawContent contains a JSON object with title, extracts that title.
 */
export function cleanSectionTitle(title, rawContent = '') {
  if (typeof title === 'string' && title.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(title.trim())
      if (parsed?.title && typeof parsed.title === 'string') {
        return parsed.title.trim()
      }
    } catch {
      const match = title.match(/"title":\s*"((?:[^"\\]|\\.)*)"/)
      if (match && match[1]) return match[1].trim()
    }
  }

  if ((!title || !title.trim()) && rawContent && typeof rawContent === 'string' && rawContent.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawContent.trim())
      if (parsed?.title && typeof parsed.title === 'string') {
        return parsed.title.trim()
      }
    } catch {}
  }

  return typeof title === 'string' ? title.trim() : ''
}

