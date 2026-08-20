/**
 * The 19 sections the backend requires, mirroring `REQUIRED_SECTIONS` in
 * app/services/newspaper_service.py. The `page_number`, `section_key` and
 * `section_name` values are sent verbatim on PUT and are what
 * `/validate` checks, so they must stay identical to the server's list.
 *
 * Layout is expressed as rows rather than a free-flowing grid because the page
 * is a fixed tabloid sheet: each row takes a share (`weight`) of the sheet's
 * height and each block a share (`span`) of its row's three columns. That makes
 * every block a determinate box, which is what lets lib/capacity.js answer how
 * much text actually fits in it.
 *
 * `charLimit` mirrors the printed box's capacity (see lib/capacity.js) and is
 * used when the font cannot be measured. It is NOT the editor preview's size:
 * sizing copy to the preview box is what left the printed page 11% full.
 */
const PAGE_LAYOUTS = [
  {
    page_number: 1,
    name: 'Front Page',
    rows: [
      {
        weight: 3,
        blocks: [{ section_key: 'main_breaking_news', section_name: 'Main Breaking News', span: 3, size: 'lead', charLimit: 3960 }],
      },
      {
        weight: 3,
        blocks: [
          { section_key: 'kerala_highlights', section_name: 'Kerala Highlights', span: 2, size: 'body', charLimit: 2775 },
          { section_key: 'local_highlights', section_name: 'Local Highlights', span: 1, size: 'tall', charLimit: 1350 },
        ],
      },
      {
        weight: 2,
        blocks: [{ section_key: 'short_news', section_name: 'Short News', span: 3, size: 'small', charLimit: 2475 }],
      },
    ],
  },
  {
    page_number: 2,
    name: 'Kerala & District',
    rows: [
      {
        weight: 3,
        blocks: [
          { section_key: 'kerala_news', section_name: 'Kerala News', span: 2, size: 'body', charLimit: 2886 },
          { section_key: 'district_news', section_name: 'District News', span: 1, size: 'tall', charLimit: 1404 },
        ],
      },
      {
        weight: 3,
        blocks: [
          { section_key: 'politics', section_name: 'Politics', span: 2, size: 'body', charLimit: 2886 },
          { section_key: 'crime_civic', section_name: 'Crime / Civic News', span: 1, size: 'tall', charLimit: 1404 },
        ],
      },
      {
        weight: 2,
        blocks: [{ section_key: 'short_news_2', section_name: 'Short News', span: 3, size: 'small', charLimit: 2640 }],
      },
    ],
  },
  {
    page_number: 3,
    name: 'Sports & Business',
    rows: [
      {
        weight: 3,
        blocks: [
          { section_key: 'sports', section_name: 'Sports', span: 2, size: 'body', charLimit: 4200 },
          { section_key: 'cricket_football', section_name: 'Cricket/Football', span: 1, size: 'tall', charLimit: 2430 },
        ],
      },
      {
        weight: 2,
        blocks: [
          { section_key: 'business', section_name: 'Business', span: 1, size: 'small', charLimit: 1566 },
          { section_key: 'cinema', section_name: 'Cinema', span: 1, size: 'small', charLimit: 1566 },
          { section_key: 'entertainment', section_name: 'Entertainment', span: 1, size: 'small', charLimit: 1566 },
        ],
      },
    ],
  },
  {
    page_number: 4,
    name: 'Features & Evening',
    rows: [
      {
        weight: 3,
        blocks: [
          { section_key: 'special_story', section_name: 'Special Story', span: 2, size: 'body', charLimit: 4200 },
          { section_key: 'human_interest', section_name: 'Human Interest', span: 1, size: 'tall', charLimit: 2430 },
        ],
      },
      {
        weight: 2,
        blocks: [
          { section_key: 'evening_updates', section_name: 'Evening Updates', span: 1, size: 'small', charLimit: 1566 },
          { section_key: 'tomorrow', section_name: "Tomorrow / What's Next", span: 1, size: 'small', charLimit: 1566 },
          { section_key: 'short_news_4', section_name: 'Short News', span: 1, size: 'small', charLimit: 1566 },
        ],
      },
    ],
  },
]

/** Each page also carries its blocks flattened, for counting and thumbnails. */
export const PAGES = PAGE_LAYOUTS.map((page) => ({
  ...page,
  blocks: page.rows.flatMap((row) =>
    row.blocks.map((block) => ({ ...block, page_number: page.page_number })),
  ),
}))

/** Every block across all four pages, in page order. */
export const ALL_BLOCKS = PAGES.flatMap((page) => page.blocks)

export const TOTAL_SECTIONS = ALL_BLOCKS.length

/** Lookup by the key the backend uses as the section identifier. */
export const blockFor = (sectionKey) =>
  ALL_BLOCKS.find((block) => block.section_key === sectionKey) ?? null

/** Tabloid proportions (289mm x 380mm) drive the on-screen sheet's aspect. */
export const PAGE_ASPECT = 289 / 380
