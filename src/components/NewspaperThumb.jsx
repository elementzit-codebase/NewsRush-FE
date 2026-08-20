/**
 * Newspaper-page thumbnail drawn as SVG rather than shipped as an image, so a
 * card needs no asset and stays crisp at any size. `art` selects the palette of
 * the photo band; `masthead` is the paper's name across the top.
 */
const ART = {
  city: ['#1e3a8a', '#60a5fa'],
  tech: ['#111c44', '#3b82f6'],
  green: ['#14532d', '#4ade80'],
  people: ['#1f2937', '#93a3b8'],
}

// Ragged text lines look more like set type than uniform bars do.
const LINE_WIDTHS = [92, 78, 88, 64, 90, 72, 84, 58]

export default function NewspaperThumb({ masthead = 'DAILY NEWS', art = 'city', className = '' }) {
  const [from, to] = ART[art] ?? ART.city
  const gradientId = `thumb-${art}`

  return (
    <svg
      viewBox="0 0 120 160"
      role="img"
      aria-label={`${masthead} front page`}
      className={`rounded-md border border-line bg-white shadow-sm ${className}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>

      <rect width="120" height="160" fill="#fff" />

      <text
        x="60"
        y="16"
        textAnchor="middle"
        fontFamily="Playfair Display, Georgia, serif"
        fontSize="11"
        letterSpacing="0.5"
        fill="#1f2937"
      >
        {masthead}
      </text>
      <line x1="10" y1="21" x2="110" y2="21" stroke="#cbd5e1" strokeWidth="0.8" />
      <line x1="10" y1="23.5" x2="110" y2="23.5" stroke="#e2e8f0" strokeWidth="0.6" />

      <rect x="10" y="29" width="100" height="42" rx="1.5" fill={`url(#${gradientId})`} />

      {LINE_WIDTHS.map((w, i) => (
        <rect
          key={i}
          x="10"
          y={78 + i * 6}
          width={w * 0.5}
          height="2.2"
          rx="1"
          fill="#cbd5e1"
        />
      ))}
      {LINE_WIDTHS.slice(0, 6).map((w, i) => (
        <rect
          key={`r-${i}`}
          x="64"
          y={78 + i * 6}
          width={w * 0.46}
          height="2.2"
          rx="1"
          fill="#dbe2ea"
        />
      ))}
      <rect x="64" y="118" width="46" height="30" rx="1.5" fill="#eef2f7" />
    </svg>
  )
}
