import { useEffect, useRef, useState } from 'react'

/**
 * Reports the microphone's live input level while `active`.
 *
 * SpeechRecognition gives no signal about whether sound is actually arriving —
 * it stays silent whether the mic is muted, missing, or simply not picking the
 * speaker up. Opening a parallel getUserMedia stream and reading an analyser
 * lets the recorder show real input, so "nothing is happening" can be told
 * apart from "the words are not being recognised".
 *
 * The analyser is sampled every animation frame, but state is deliberately not
 * updated that often: doing so re-renders the whole editor ~60 times a second
 * and the display visibly strobes. Instead the value is smoothed, quantised and
 * emitted at a fixed interval, and `hasSound` is latched so ordinary pauses
 * between words do not flip the caption back and forth.
 */

// Below this the input counts as silence.
const SILENCE_THRESHOLD = 0.02
// How long silence must persist before `hasSound` drops. Comfortably longer
// than the gap between words or a breath.
const SILENCE_GRACE_MS = 1500
// At most ten state updates a second, rather than one per frame.
const EMIT_INTERVAL_MS = 100
// Quantise to 5% steps so tiny fluctuations do not count as changes.
const LEVEL_STEPS = 20
// Weight of each new sample; the rest carries over, smoothing the meter.
const SMOOTHING = 0.25

export function useMicLevel(active) {
  const [level, setLevel] = useState(0)
  // Starts true so the caption does not accuse the user of silence in the
  // moment before they have begun speaking.
  const [hasSound, setHasSound] = useState(true)
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
      let smoothed = 0
      let lastEmit = 0
      let lastSoundAt = performance.now()

      const tick = () => {
        frame = requestAnimationFrame(tick)

        analyser.getByteTimeDomainData(samples)
        // Root mean square around the 128 midpoint gives loudness rather than
        // instantaneous amplitude, so the meter tracks speech, not waveform.
        let sum = 0
        for (const sample of samples) {
          const offset = (sample - 128) / 128
          sum += offset * offset
        }
        const rms = Math.sqrt(sum / samples.length)

        smoothed += (rms - smoothed) * SMOOTHING
        // Speech sits low in the 0–1 range; the multiplier makes normal talking
        // fill most of the meter without clipping constantly.
        const value = Math.min(1, smoothed * 3)

        const now = performance.now()
        if (value > SILENCE_THRESHOLD) lastSoundAt = now
        if (now - lastEmit < EMIT_INTERVAL_MS) return
        lastEmit = now

        // Returning the previous value makes React skip the re-render entirely,
        // so a steady level costs nothing.
        const quantised = Math.round(value * LEVEL_STEPS) / LEVEL_STEPS
        setLevel((current) => (current === quantised ? current : quantised))

        const heard = now - lastSoundAt < SILENCE_GRACE_MS
        setHasSound((current) => (current === heard ? current : heard))
      }
      tick()

      teardownRef.current = () => {
        cancelAnimationFrame(frame)
        stream.getTracks().forEach((track) => track.stop())
        context.close()
      }
    }

    setError('')
    setHasSound(true)
    listen()

    return () => {
      cancelled = true
      teardownRef.current?.()
      teardownRef.current = null
      setLevel(0)
    }
  }, [active])

  return { level, hasSound, error }
}
