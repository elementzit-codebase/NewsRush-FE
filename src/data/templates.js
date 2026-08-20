/**
 * Layout templates.
 *
 * A template rearranges the sections a page already owns — it never changes
 * *which* sections exist. The backend's `validate_edition` hardcodes the same
 * 19 `REQUIRED_SECTIONS`, so any edition must always carry exactly those keys to
 * be printable; only their arrangement is ours to choose.
 *
 * Every variant of a page therefore lists that page's sections in full, just in
 * different rows, spans and proportions. Each row's spans must total 3, the
 * width of the grid.
 */
import { PAGES } from './sections'

const PAGE_TEMPLATES = {
  1: [
    {
      key: 'classic',
      name: 'Classic',
      description: 'Full-width lead over a two-column spread.',
      rows: [
        { weight: 3, blocks: [['main_breaking_news', 3, 'lead']] },
        { weight: 3, blocks: [['kerala_highlights', 2, 'body'], ['local_highlights', 1, 'tall']] },
        { weight: 2, blocks: [['short_news', 3, 'small']] },
      ],
    },
    {
      key: 'bold-lead',
      name: 'Bold Lead',
      description: 'Dominant front story with three briefs beneath.',
      rows: [
        { weight: 4, blocks: [['main_breaking_news', 3, 'lead']] },
        {
          weight: 2,
          blocks: [
            ['kerala_highlights', 1, 'small'],
            ['local_highlights', 1, 'small'],
            ['short_news', 1, 'small'],
          ],
        },
      ],
    },
    {
      key: 'sidebar',
      name: 'Side Column',
      description: 'Lead beside a standing column, briefs below.',
      rows: [
        { weight: 3, blocks: [['main_breaking_news', 2, 'lead'], ['local_highlights', 1, 'tall']] },
        { weight: 3, blocks: [['kerala_highlights', 2, 'body'], ['short_news', 1, 'tall']] },
      ],
    },
  ],

  2: [
    {
      key: 'classic',
      name: 'Classic',
      description: 'Two paired stories over a full-width brief.',
      rows: [
        { weight: 3, blocks: [['kerala_news', 2, 'body'], ['district_news', 1, 'tall']] },
        { weight: 3, blocks: [['politics', 2, 'body'], ['crime_civic', 1, 'tall']] },
        { weight: 2, blocks: [['short_news_2', 3, 'small']] },
      ],
    },
    {
      key: 'stacked',
      name: 'Stacked',
      description: 'Regional lead across the page, pairs below.',
      rows: [
        { weight: 3, blocks: [['kerala_news', 3, 'lead']] },
        { weight: 3, blocks: [['politics', 2, 'body'], ['district_news', 1, 'tall']] },
        { weight: 2, blocks: [['crime_civic', 2, 'body'], ['short_news_2', 1, 'small']] },
      ],
    },
    {
      key: 'grid',
      name: 'Grid',
      description: 'Three equal columns over a wide pair.',
      rows: [
        {
          weight: 3,
          blocks: [['kerala_news', 1, 'tall'], ['district_news', 1, 'tall'], ['politics', 1, 'tall']],
        },
        { weight: 3, blocks: [['crime_civic', 2, 'body'], ['short_news_2', 1, 'tall']] },
      ],
    },
  ],

  3: [
    {
      key: 'classic',
      name: 'Classic',
      description: 'Sports lead with a results column and three briefs.',
      rows: [
        { weight: 3, blocks: [['sports', 2, 'body'], ['cricket_football', 1, 'tall']] },
        {
          weight: 2,
          blocks: [['business', 1, 'small'], ['cinema', 1, 'small'], ['entertainment', 1, 'small']],
        },
      ],
    },
    {
      key: 'feature',
      name: 'Feature',
      description: 'Full-width sports feature above the rest.',
      rows: [
        { weight: 3, blocks: [['sports', 3, 'lead']] },
        {
          weight: 3,
          blocks: [['cricket_football', 1, 'tall'], ['business', 1, 'tall'], ['cinema', 1, 'tall']],
        },
        { weight: 2, blocks: [['entertainment', 3, 'small']] },
      ],
    },
    {
      key: 'split',
      name: 'Split',
      description: 'Paired stories down the page, wide closer.',
      rows: [
        { weight: 3, blocks: [['sports', 2, 'body'], ['business', 1, 'tall']] },
        { weight: 3, blocks: [['cricket_football', 2, 'body'], ['cinema', 1, 'tall']] },
        { weight: 2, blocks: [['entertainment', 3, 'small']] },
      ],
    },
  ],

  4: [
    {
      key: 'classic',
      name: 'Classic',
      description: 'Special story with a sidebar and three closers.',
      rows: [
        { weight: 3, blocks: [['special_story', 2, 'body'], ['human_interest', 1, 'tall']] },
        {
          weight: 2,
          blocks: [
            ['evening_updates', 1, 'small'],
            ['tomorrow', 1, 'small'],
            ['short_news_4', 1, 'small'],
          ],
        },
      ],
    },
    {
      key: 'feature',
      name: 'Feature',
      description: 'Long read across the page, notes beneath.',
      rows: [
        { weight: 4, blocks: [['special_story', 3, 'lead']] },
        { weight: 3, blocks: [['human_interest', 2, 'body'], ['evening_updates', 1, 'tall']] },
        { weight: 2, blocks: [['tomorrow', 1, 'small'], ['short_news_4', 2, 'small']] },
      ],
    },
    {
      key: 'digest',
      name: 'Digest',
      description: 'Even three-up digest over a wide close.',
      rows: [
        {
          weight: 3,
          blocks: [
            ['special_story', 1, 'tall'],
            ['human_interest', 1, 'tall'],
            ['evening_updates', 1, 'tall'],
          ],
        },
        { weight: 3, blocks: [['tomorrow', 2, 'body'], ['short_news_4', 1, 'tall']] },
      ],
    },
  ],
}

export const DEFAULT_TEMPLATE = 'classic'

/** Section metadata keyed by section_key, taken from the canonical list. */
const META = Object.fromEntries(
  PAGES.flatMap((page) => page.blocks).map((block) => [block.section_key, block]),
)

export const templatesForPage = (pageNumber) => PAGE_TEMPLATES[pageNumber] ?? []

export function templateFor(pageNumber, templateKey) {
  const options = templatesForPage(pageNumber)
  return options.find((option) => option.key === templateKey) ?? options[0]
}

/**
 * Builds a page in the same shape `PAGES` uses, so the canvas, the print sheet
 * and the capacity maths all consume templates without knowing about them.
 *
 * `section_name`, `page_number` and the fallback `charLimit` come from the
 * canonical section list — a template may move a section, never rename it.
 */
export function buildPage(pageNumber, templateKey) {
  const base = PAGES.find((page) => page.page_number === pageNumber)
  const template = templateFor(pageNumber, templateKey)

  const rows = template.rows.map((row) => ({
    weight: row.weight,
    blocks: row.blocks.map(([sectionKey, span, size]) => ({
      ...META[sectionKey],
      span,
      size,
    })),
  }))

  return {
    ...base,
    templateKey: template.key,
    templateName: template.name,
    rows,
    blocks: rows.flatMap((row) => row.blocks),
  }
}

/** All four pages resolved against a `{ [pageNumber]: templateKey }` map. */
export const buildPages = (selection = {}) =>
  PAGES.map((page) =>
    buildPage(page.page_number, selection[page.page_number] ?? DEFAULT_TEMPLATE),
  )
