import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Thin wrapper over the Web Speech API with auto-reconnect on silence.
 * Finalised phrases are handed to `onResult` as they settle; the caller
 * owns the text buffer so typing and dictation can be mixed freely.
 *
 * It will NOT stop automatically on 'no-speech' pauses — it continuously
 * listens until explicitly stopped by the user.
 */
export function useSpeechRecognition({ lang = 'en-US', onResult } = {}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)

  const recognitionRef = useRef(null)
  const isListeningRef = useRef(false)

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

  const startInstance = useCallback(() => {
    if (!supported || !isListeningRef.current) return

    try {
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
        // 'no-speech' or 'aborted' happens during silence or brief pauses — do NOT stop!
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return
        }

        if (event.error === 'not-allowed') {
          setError('Microphone access was blocked. Allow it in your browser settings to dictate.')
          isListeningRef.current = false
          setListening(false)
        } else {
          setError(`Voice input error: ${event.error}`)
          isListeningRef.current = false
          setListening(false)
        }
      }

      recognition.onend = () => {
        // If user hasn't stopped recording, seamlessly restart recognition so silence never cuts it off
        if (isListeningRef.current) {
          try {
            startInstance()
          } catch {
            // ignore restart collision
          }
        } else {
          setListening(false)
          setInterim('')
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch {
      // If start failed, retry shortly if still in listening mode
      if (isListeningRef.current) {
        setTimeout(() => {
          if (isListeningRef.current) startInstance()
        }, 200)
      }
    }
  }, [SpeechRecognition, lang, supported])

  const start = useCallback(() => {
    if (!supported) {
      setError('Voice input is not supported in this browser. Type your content instead.')
      return
    }
    setError('')
    setSeconds(0)
    setInterim('')
    isListeningRef.current = true
    setListening(true)
    startInstance()
  }, [startInstance, supported])

  const stop = useCallback(() => {
    isListeningRef.current = false
    try {
      recognitionRef.current?.stop()
    } catch {}
    setListening(false)
    setInterim('')
  }, [])

  const toggle = useCallback(() => (isListeningRef.current ? stop() : start()), [start, stop])

  // Release the microphone if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      isListeningRef.current = false
      try {
        recognitionRef.current?.abort?.()
      } catch {}
    }
  }, [])

  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return { supported, listening, interim, error, elapsed, start, stop, toggle }
}
