# SFU ProfessorView

A Chrome extension that injects Rate My Professor ratings directly into the SFU MySchedule course schedule.

## What it does

On `https://myschedule.erp.sfu.ca/*`, a new row is inserted under each instructor entry showing:

- Professor name
- Average rating
- Average difficulty
- Would-take-again percentage

All lookups are scoped to **Simon Fraser University**.

## Tech Stack

| Layer              | Technology                  |
| ------------------ | --------------------------- |
| Build              | WXT                         |
| Extension format   | Chrome Manifest V3          |
| Background worker  | TypeScript                  |
| Content script     | JavaScript                  |
| Styling            | Tailwind CSS v4 via PostCSS |
| RMP lookups        | `rate-my-professor-api-ts`  |

## Architecture

```text
SFU MySchedule page
  |
  |-- content script: src/entrypoints/content.ts
  |    - scans instructor cells (div.rightnclear[title="Instructor(s)"])
  |    - deduplicates with a processed Map and in-flight processing Set
  |    - sends FETCH_DATA messages to the background worker
  |    - builds and inserts a <tr> rating card after each instructor row
  |
  |-- content stylesheet: src/content/content.css
  |    - imports Tailwind CSS v4 utilities (prefix: tw:) used by injected rows
  |
  |-- background worker: src/background/background.ts
       - receives FETCH_DATA messages from the content script
       - calls rate-my-professor-api-ts for Simon Fraser University
       - returns professor data to the content script
```

### Message protocol

Content script sends:
```js
chrome.runtime.sendMessage({ type: "FETCH_DATA", payload: { name: "John Smith" } })
```

Background responds:
```js
{ status: "Success", data: <professor info object> }
{ status: "Error", message: <error> }
```

### Key functions in `content.ts`

| Function | Description |
|---|---|
| `findProfessors()` | Scans the DOM for instructor elements and dispatches fetch requests |
| `buildProfessor(el, data)` | Constructs a plain professor object from the DOM element and RMP response |
| `buildDataRow(professorObj)` | Creates a `<tr>` element with the rating card HTML |
| `renderProfessorRatings(el, professorObj)` | Inserts the rating row into the DOM after the instructor's existing row |
| `debounce(fn, ms)` | Utility used to throttle MutationObserver callbacks |

### SPA handling

Two chained `MutationObserver` instances handle PeopleSoft's SPA navigation:

1. `bodyObserver` — watches `document.body` until `#under_header > table` appears, then disconnects itself
2. `observer` — watches only that schedule container and calls `findProfessors()` via a 500 ms debounce on any DOM change

### Deduplication

- `processed` Map — caches professor objects by name after a successful fetch; reused for duplicate sections taught by the same professor
- `processing` Set — tracks in-flight requests to prevent duplicate messages while async calls are pending
- `Staff` entries are added to `processed` with a `null` value and skipped

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
│   │   └── background.ts
│   ├── content/
│   │   └── content.css
│   └── entrypoints/
│       ├── background.ts
│       ├── content.ts
│       └── popup.html
└── .output/
```

## Known Limitations

- No persistent cache — the `processed` Map lives only for the current page session
- The popup (`src/entrypoints/popup.html`) is currently empty
- The `storage` permission is declared but not used yet
- No error/not-found state is shown when an RMP lookup fails or returns no match
- No name variation fallback (e.g. "John Smith" is not retried if "Dr. John A. Smith" fails)
- No automated test suite

## Getting Started

### Prerequisites

- Node.js 18+
- Chrome or another Chromium-based browser

### Install dependencies

```bash
npm install
```

### Build the extension

```bash
npm run build
```

This generates the unpacked extension in `.output/chrome-mv3/`.

### Load it in Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select the `.output/chrome-mv3/` directory
5. Open `https://myschedule.erp.sfu.ca/`

### Development mode

```bash
npm run dev
```

WXT starts Chrome MV3 development mode and writes the dev build to `.output/chrome-mv3-dev/`.

## How It Works

1. WXT injects the `content` entrypoint at `document_end` on the SFU schedule page.
2. `findProfessors()` queries all `div.rightnclear[title="Instructor(s)"]` elements.
3. For each professor not already in `processed` or `processing`, a `FETCH_DATA` message is sent to the background worker.
4. The background worker calls `rate-my-professor-api-ts` for Simon Fraser University and returns the result.
5. `buildProfessor()` creates a plain object from the response.
6. `buildDataRow()` creates a `<tr>` with rating info styled using Tailwind CSS v4 (`tw:` prefix).
7. `renderProfessorRatings()` inserts the new row immediately after the instructor's existing `<tr>`.
8. SPA navigation is handled by the two-stage `MutationObserver` chain, which re-runs `findProfessors()` after DOM changes.

## Permissions

| Permission                         | Why it is present                                                          |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `storage`                          | Declared for future persistent caching, not currently used                 |
| `https://*.ratemyprofessors.com/*` | Allows the background worker to fetch professor data from RMP              |
| `https://myschedule.erp.sfu.ca/*`  | Allows the content script to run on the SFU schedule site                  |

## Troubleshooting

**No ratings appear**
- Confirm the extension is enabled in `chrome://extensions`
- Make sure you loaded the built `.output/chrome-mv3/` directory, not `src/`
- Check the page URL matches `https://myschedule.erp.sfu.ca/*`
- Open DevTools console and look for extension errors

**Ratings stop appearing after navigating within MySchedule**
- Reload the MySchedule page so the content script re-runs

**A professor row never gets data**
- The instructor name may not match any RMP record for Simon Fraser University
- No not-found state is displayed in the current version

## License

MIT — see [`LICENSE`](./LICENSE).
