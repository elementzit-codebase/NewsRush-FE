/**
 * Input level meter. The bar shape comes from a fixed pseudo-random sequence so
 * it reads as a waveform, but the height is scaled by `level` (0–1) taken from
 * the live microphone stream — a flat meter means no sound is arriving, which
 * is the point of showing it while recording.
 */
const HEIGHTS = [
  30, 55, 22, 70, 40, 90, 35, 60, 25, 80, 45, 65, 30, 95, 50, 20, 75, 40, 85, 28,
  60, 35, 70, 45, 25, 88, 52, 32, 68, 42, 78, 24, 58, 36, 92, 48, 26, 72, 38, 62,
]

// Keeps a trace of bars visible when the room is silent.
const FLOOR = 0.08

export default function Waveform({
  bars = 40,
  animated = false,
  level = 0,
  className = '',
  color = 'bg-brand-500',
}) {
  const scale = animated ? Math.max(FLOOR, level) : FLOOR

  return (
    <div className={`flex h-8 items-center gap-[3px] ${className}`} aria-hidden="true">
      {HEIGHTS.slice(0, bars).map((h, i) => (
        <span
          key={i}
          // Matches the hook's emit interval, so bars glide between updates
          // instead of snapping and holding, which reads as strobing.
          className={`w-[3px] rounded-full transition-[height] duration-150 ease-out ${color}`}
          style={{
            height: `${Math.max(4, h * scale)}%`,
            opacity: 0.35 + (h / 100) * 0.65,
          }}
        />
      ))}
    </div>
  )
}
