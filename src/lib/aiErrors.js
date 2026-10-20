/**
 * Formats developer/technical AI error messages into user-friendly notices.
 *
 * Catches provider-specific details (Gemini model names, HTTP codes, raw JSON errors,
 * Groq traces, connection failures) and produces clean, reassuring messages for end-users.
 *
 * @param {string|Error} rawError
 * @returns {string}
 */
export function formatAiErrorMessage(rawError) {
  if (!rawError) return 'The AI writing assistant encountered an issue. Please try again.'

  const message = typeof rawError === 'string' ? rawError : rawError?.message || ''
  const lower = message.toLowerCase()

  // High demand / overloaded / 503
  if (
    lower.includes('503') ||
    lower.includes('high demand') ||
    lower.includes('overload') ||
    lower.includes('spikes in demand') ||
    lower.includes('experiencing high demand') ||
    lower.includes('service unavailable')
  ) {
    return 'The AI writing assistant is currently experiencing high demand. Please wait a moment and try again.'
  }

  // Rate limit / Quota exceeded / 429
  if (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('exhausted')
  ) {
    return 'AI generation limit reached for the moment. Please wait a few seconds before trying again.'
  }

  // Gateway / Model connection / 502
  if (
    lower.includes('502') ||
    lower.includes('bad gateway') ||
    lower.includes('failed to communicate') ||
    lower.includes('failed to respond') ||
    lower.includes('all gemini models failed') ||
    lower.includes('all groq models failed')
  ) {
    return 'The AI assistant is temporarily unavailable. Please try again in a moment.'
  }

  // Timeout / 504
  if (lower.includes('504') || lower.includes('timed out') || lower.includes('timeout')) {
    return 'The AI request took too long to complete. Please try again.'
  }

  // Safety filter blocked
  if (lower.includes('safety') || lower.includes('policy') || lower.includes('blocked')) {
    return 'The AI could not process this text due to content policy. Please adjust the input and try again.'
  }

  // Missing API keys / configuration
  if (
    lower.includes('gemini_api_key') ||
    lower.includes('groq_api_key') ||
    lower.includes('not configured') ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key')
  ) {
    return 'AI service is not configured. Please contact your administrator.'
  }

  // Network / Connection
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network error')
  ) {
    return 'Unable to connect to the server. Please check your internet connection.'
  }

  // Provider-specific traces (e.g., "Gemini API Error (xyz)..." or generic 500)
  if (
    lower.includes('gemini api error') ||
    lower.includes('groq api error') ||
    lower.includes('request failed (500)')
  ) {
    return 'The AI service encountered an issue while generating content. Please try again shortly.'
  }

  return message
}

