import { useEffect, useRef, useState } from 'react'

/**
 * Reports the microphone's live input level as a 0–1 value while `active`.
 *
 * SpeechRecognition gives no signal about whether sound is actually arriving —
 * it stays silent whether the mic is muted, missing, or simply not picking the
 * speaker up. Opening a parallel getUserMedia stream and reading an analyser
 * lets the recorder show real input, so "nothing is happening" can be told
 * apart from "the words are not being recognised".
 */
export function useMicLevel(active) {
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')

  // Held in a ref so the cleanup path can tear everything down regardless of
  // how far the async setup got before `active` flipped back off.
  const teardownRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined

    let cancelled = false

    async function listen() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot access the microphone.')
        return
      }

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (err) {
        // Permission denied, or no input device attached.
        setError(
          err?.name === 'NotAllowedError'
            ? 'Microphone access was blocked. Allow it in your browser settings.'
            : 'No microphone was found.',
        )
        return
      }

      // `active` may have gone false while permission was pending.
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const context = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      context.createMediaStreamSource(stream).connect(analyser)

      const samples = new Uint8Array(analyser.frequencyBinCount)
      let frame = 0

      const tick = () => {
        analyser.getByteTimeDomainData(samples)
        // Root mean square around the 128 midpoint gives loudness rather than
        // instantaneous amplitude, so the meter does not flicker on every frame.
        let sum = 0
        for (const sample of samples) {
          const offset = (sample - 128) / 128
          sum += offset * offset
        }
        const rms = Math.sqrt(sum / samples.length)
        // Speech sits low in the 0–1 range; the multiplier makes normal talking
        // fill most of the meter without clipping constantly.
        setLevel(Math.min(1, rms * 3))
        frame = requestAnimationFrame(tick)
      }
      tick()

      teardownRef.current = () => {
        cancelAnimationFrame(frame)
        stream.getTracks().forEach((track) => track.stop())
        context.close()
      }
    }

    setError('')
    listen()

    return () => {
      cancelled = true
      teardownRef.current?.()
      teardownRef.current = null
      setLevel(0)
    }
  }, [active])

  return { level, error }
}
