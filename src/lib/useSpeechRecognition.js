import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Thin wrapper over the Web Speech API. Finalised phrases are handed to
 * `onResult` as they settle; the caller owns the text buffer so typing and
 * dictation can be mixed freely.
 *
 * `supported` is false in browsers without SpeechRecognition (notably Firefox),
 * and callers should keep the typing path usable in that case.
 */
export function useSpeechRecognition({ lang = 'en-US', onResult } = {}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)

  const recognitionRef = useRef(null)

  // Kept in a ref so a changing callback never has to restart recognition.
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  const SpeechRecognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  const supported = Boolean(SpeechRecognition)

  // Elapsed-time counter for the recorder readout.
  useEffect(() => {
    if (!listening) return undefined
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [listening])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
    setInterim('')
  }, [])

  const start = useCallback(() => {
    if (!supported) {
      setError('Voice input is not supported in this browser. Type your content instead.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let pending = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (result.isFinal) {
          onResultRef.current?.(result[0].transcript.trim())
        } else {
          pending += result[0].transcript
        }
      }
      setInterim(pending)
    }

    recognition.onerror = (event) => {
      setError(
        event.error === 'not-allowed'
          ? 'Microphone access was blocked. Allow it in your browser settings to dictate.'
          : `Voice input stopped: ${event.error}`,
      )
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
      setInterim('')
    }

    recognitionRef.current = recognition
    setError('')
    setSeconds(0)
    recognition.start()
    setListening(true)
  }, [SpeechRecognition, lang, supported])

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop])

  // Release the microphone if the component unmounts mid-recording.
  useEffect(() => () => recognitionRef.current?.abort?.(), [])

  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return { supported, listening, interim, error, elapsed, start, stop, toggle }
}
