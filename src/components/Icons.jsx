/**
 * Single-source icon set. All icons inherit `currentColor` and size from the
 * `className` passed by the caller, so they restyle with the surrounding text.
 */
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
}

const Svg = ({ children, ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...base} {...props}>{children}</svg>
)

export const MailIcon = (p) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></Svg>
)
export const LockIcon = (p) => (
  <Svg {...p}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Svg>
)
export const EyeIcon = (p) => (
  <Svg {...p}><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.6" /></Svg>
)
export const EyeOffIcon = (p) => (
  <Svg {...p}><path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17.6 17.6 0 0 1-3.3 3.9M6.4 8.1A17.4 17.4 0 0 0 2 12s3.6 6 10 6a9.6 9.6 0 0 0 3.6-.7" /><path d="m3 3 18 18" /></Svg>
)
export const UsersIcon = (p) => (
  <Svg {...p}><circle cx="9" cy="9" r="3" /><path d="M3 19a6 6 0 0 1 12 0" /><path d="M16 7.2a3 3 0 0 1 0 5.6M17.5 19a6 6 0 0 0-1.6-4.1" /></Svg>
)
export const SearchIcon = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
)
export const BellIcon = (p) => (
  <Svg {...p}><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z" /><path d="M10.5 19a2 2 0 0 0 3 0" /></Svg>
)
export const ChevronDownIcon = (p) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
)
export const ChevronLeftIcon = (p) => (
  <Svg {...p}><path d="m14 6-6 6 6 6" /></Svg>
)
export const ChevronRightIcon = (p) => (
  <Svg {...p}><path d="m10 6 6 6-6 6" /></Svg>
)
export const ChevronsRightIcon = (p) => (
  <Svg {...p}><path d="m7 6 6 6-6 6M13 6l6 6-6 6" /></Svg>
)
export const PlusIcon = (p) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
)
export const GridIcon = (p) => (
  <Svg {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></Svg>
)
export const ListIcon = (p) => (
  <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
)
export const HomeIcon = (p) => (
  <Svg {...p}><path d="m4 10 8-6 8 6v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" /></Svg>
)
export const DocIcon = (p) => (
  <Svg {...p}><path d="M6 3.5h7L18.5 9v11.5h-12.5Z" /><path d="M13 3.5V9h5.5" /></Svg>
)
export const FileTextIcon = (p) => (
  <Svg {...p}><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" /></Svg>
)
export const SettingsIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1 2 2 0 1 1-4 0 1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6a2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 19.4 11a2 2 0 1 1 0 4Z" /></Svg>
)
export const MicIcon = (p) => (
  <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></Svg>
)
export const PencilIcon = (p) => (
  <Svg {...p}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Z" /><path d="m14.5 6.5 3 3" /></Svg>
)
export const SparkleIcon = (p) => (
  <Svg {...p}><path d="m12 3 1.9 5.4L19 10.3l-5.1 1.9L12 17.6l-1.9-5.4L5 10.3l5.1-1.9Z" /><path d="M18.5 16.2 19.2 18l1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" /></Svg>
)
export const InfoIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></Svg>
)
export const ChartIcon = (p) => (
  <Svg {...p}><path d="M6 17v-4M12 17V8M18 17v-6" /></Svg>
)
export const PlayIcon = (p) => (
  <Svg {...p}><rect x="3.5" y="5" width="17" height="14" rx="3" /><path d="m10.5 9.5 5 2.5-5 2.5Z" /></Svg>
)
export const ArrowRightIcon = (p) => (
  <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
)
export const DotsIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="5.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="18.5" r="1.3" fill="currentColor" stroke="none" /></Svg>
)
export const NewspaperMarkIcon = (p) => (
  <Svg {...p}><rect x="3.5" y="4.5" width="14" height="15" rx="2" /><path d="M17.5 8.5H20a.5.5 0 0 1 .5.5v8.5a2 2 0 0 1-2 2" /><path d="M6.5 8h8M6.5 11.5h4M6.5 15h4" /></Svg>
)
export const CheckIcon = (p) => (
  <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>
)
export const TrashIcon = (p) => (
  <Svg {...p}><path d="M4.5 6.5h15M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" /><path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" /><path d="M10.5 10v6.5M13.5 10v6.5" /></Svg>
)
export const SaveIcon = (p) => (
  <Svg {...p}><path d="M5 4.5h11L19.5 8v11.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1Z" /><path d="M8 4.5v5h7v-5M8 20.5v-5.5h8v5.5" /></Svg>
)
export const CalendarIcon = (p) => (
  <Svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3.5v3M16 3.5v3" /></Svg>
)
export const LogoutIcon = (p) => (
  <Svg {...p}><path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" /><path d="M15.5 8.5 19 12l-3.5 3.5" /><path d="M19 12H9.5" /></Svg>
)
