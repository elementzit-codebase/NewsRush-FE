/**
 * Audio waveform. Bar heights come from a fixed pseudo-random sequence so the
 * shape is stable across renders; `animated` makes them pulse while recording.
 */
const HEIGHTS = [
  30, 55, 22, 70, 40, 90, 35, 60, 25, 80, 45, 65, 30, 95, 50, 20, 75, 40, 85, 28,
  60, 35, 70, 45, 25, 88, 52, 32, 68, 42, 78, 24, 58, 36, 92, 48, 26, 72, 38, 62,
]

export default function Waveform({ bars = 40, animated = false, className = '', color = 'bg-brand-500' }) {
  return (
    <div className={`flex h-8 items-center gap-[3px] ${className}`} aria-hidden="true">
      {HEIGHTS.slice(0, bars).map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${color} ${animated ? 'animate-pulse' : ''}`}
          style={{
            height: `${h}%`,
            opacity: 0.35 + (h / 100) * 0.65,
            animationDelay: animated ? `${(i % 8) * 90}ms` : undefined,
          }}
        />
      ))}
    </div>
  )
}
