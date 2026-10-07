# SFU MyProfessor

A Chrome extension that searches SFU professors in a side panel and injects Rate My Professors ratings directly into the SFU MySchedule course schedule.

## Chrome Store
https://chromewebstore.google.com/detail/agcnjhkelnjokbchcjkldkphdkdclonp?utm_source=item-share-cb

## What it does

### Professor search

Click the **SFU MyProfessor** extension icon to open the Chrome side panel on any website. Pin the extension from Chrome's Extensions menu for quick access.

- Search by first or last name; results appear after at least two characters and a short typing delay. Press Enter to search immediately.
- View names, departments, ratings, difficulty, would-retake percentages, and student rating counts. Click a professor's name to open their RMP profile in a new tab.
- Searches use the main **Simon Fraser University** listing already used by the schedule lookup. Results are checked against that school's ID; this is not a complete SFU faculty directory or an aggregation of separate campus listings.
- Shows 20 matches at a time; **Show more professors** loads the next page.
- Missing scores appear as `—`. Empty results and temporary failures have distinct states, with a retry button for failures.
- The panel remains available when switching tabs; it does not require an SFU page to be open.

### Schedule ratings

On `https://myschedule.erp.sfu.ca/*`, a new row is inserted under each instructor entry showing:

- Professor name (as listed on RMP, linked to their profile)
- Average rating, average difficulty, and would-take-again percentage (`—` when RMP has no data)
- Top student-reported rating tags
- A **Search ↗** button that opens the side panel already searching for that professor

Each schedule name is checked against the RMP result before anything is shown, so a fuzzy match on a different professor shows "No Rate My Professors match" (with a link to search RMP yourself) instead of someone else's ratings. Cells listing several instructors get one card per instructor. Lookups are cached in `chrome.storage.local` for 7 days (1 day for "not found"). Failed lookups show a **Retry** button.

## Screenshots

### New in 1.3.0: professor search

Look up an instructor while viewing their course outline. The screenshot below shows the native Chrome side panel searching for Bobby Chan beside SFU's CMPT 125 course page, with ratings, difficulty, and would-retake percentages visible without leaving the tab.

![Chrome showing an SFU CMPT 125 course outline with instructor Bobby Chan on the left and SFU MyProfessor search results in the native side panel on the right](src/public/sidepanel-in-use.jpg)

### MySchedule integration

**Card view**

![Extension rating card in the schedule table](src/public/card.png)

**Fullscreen**

![Extension UI in fullscreen context](src/public/fullscreen.png)

## Tech Stack

| Layer              | Technology                  |
| ------------------ | --------------------------- |
| Build              | WXT                         |
| Extension format   | Chrome Manifest V3          |
| Background worker  | TypeScript                  |
| Content script     | TypeScript                  |
| Styling            | Tailwind CSS v4 via PostCSS |
| RMP lookups        | Custom GraphQL client       |

## Architecture

```text
SFU MySchedule page
  |
  |-- content script: src/entrypoints/content.ts
  |    - src/content/schedule.ts: scans instructor cells (div.rightnclear[title="Instructor(s)"]),
  |      sends FETCH_DATA messages, keeps one rating <tr> in sync per cell
  |    - src/content/instructors.ts: parses a cell into names / Staff / TBD
  |    - src/content/cards.ts: builds the rating, not-found, error, and TBD cards
  |
  |-- content stylesheet: src/content/content.css
  |    - imports Tailwind CSS v4 utilities (prefix: tw:) used by injected rows
  |
  |-- background worker: src/background/background.ts
  |    - handles FETCH_DATA, SEARCH_PROFESSORS, and OPEN_SEARCH messages
  |    - caches schedule lookups in chrome.storage.local (src/background/cache.ts)
  |
  |-- RMP client: src/background/rmp.ts
  |    - custom GraphQL client for the RMP API
  |    - fetches and caches the SFU school ID for the service worker lifetime
  |    - verifies schedule matches by name (src/background/name-match.ts)
  |
  |-- shared types: src/shared/professor.ts
  |    - schedule and search data contracts, message types, and request validation
  |
  |-- side panel: src/entrypoints/sidepanel/
  |    - search form, result cards, loading/empty/error states, and scoped CSS
  |    - sends SEARCH_PROFESSORS messages to the background worker
  |
  |-- search controller: src/sidepanel/search-controller.ts
       - debounces typing and ignores stale responses
```
## Project Structure

```text
sfu-myprofessor/
├── package.json
├── postcss.config.js
├── tsconfig.json
├── wxt.config.ts
├── scripts/
│   └── patch-wxt-local-fetch.mjs
├── src/
│   ├── background/
│   │   ├── background.ts
│   │   ├── cache.ts
│   │   ├── name-match.ts
│   │   └── rmp.ts
│   ├── content/
│   │   ├── cards.ts
│   │   ├── content.css
│   │   ├── instructors.ts
│   │   └── schedule.ts
│   ├── shared/
│   │   ├── format.ts
│   │   └── professor.ts
│   ├── sidepanel/
│   │   └── search-controller.ts
│   └── entrypoints/
│       ├── background.ts
│       ├── content.ts
│       └── sidepanel/
│           ├── index.html
│           ├── main.ts
│           └── style.css
└── .output/
```

## Getting Started

### Prerequisites

- Node.js 18+
- Chrome 116+ (the side panel uses Chrome's Side Panel API)

### Install dependencies

```bash
npm install
```

### Build the extension

```bash
npm run build
```

### Development mode

```bash
npm run dev
```

WXT starts Chrome MV3 development mode and writes the dev build to `.output/chrome-mv3-dev/`.

### Verify changes

```bash
npm test
npm run typecheck
npm run build
```

Tests exercise school filtering, name matching, score normalization and formatting, caching, instructor-cell parsing, error handling, background messages, search debouncing and paging, and stale responses. CI (`.github/workflows/ci.yml`) runs all three commands on every push and pull request. They use Node's test runner and esbuild to load TypeScript; no live RMP calls are required.

After building, reload the extension at `chrome://extensions` (or load `.output/chrome-mv3/` with **Load unpacked**). Click the toolbar icon, search a partial name, follow a profile link, and switch tabs. Also check that MySchedule still inserts rating cards.


## Permissions

| Permission                         | Why it is present                                                          |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `storage`                          | Caches professor lookups; hands schedule searches to the side panel        |
| `sidePanel`                        | Displays professor search beside the current webpage                      |
| `https://*.ratemyprofessors.com/*` | Allows the background worker to fetch professor data from RMP              |
| `https://myschedule.erp.sfu.ca/*`  | Allows the content script to run on the SFU schedule site                  |

## Troubleshooting

**No ratings appear**
- Confirm the extension is enabled in `chrome://extensions`
- Make sure you loaded the built `.output/chrome-mv3/` directory, not `src/`
- Check the page URL matches `https://myschedule.erp.sfu.ca/*`
- Open DevTools console and look for extension errors

**A professor shows "No Rate My Professors match"**
- The SFU name didn't match any RMP record for Simon Fraser University closely enough. Nicknames (e.g. "Bobby" vs. "Robert") aren't matched. Use **Search RMP ↗** or **Search ↗** to look manually.
- "Not found" results are cached for a day. Removing and re-adding the extension clears the cache sooner.

## Contributing

Contributions are welcome. Open a pull request, or reach out if you want to discuss an idea before coding.

## License

MIT — see [`LICENSE`](./LICENSE).
