# SFU ProfessorView

A Chrome extension that injects [Rate My Professor](https://www.ratemyprofessors.com/) ratings directly into the SFU course schedule — no tab switching, no manual searching.

> Built for Simon Fraser University students using the `myschedule.erp.sfu.ca` portal.

---

## Features

- Detects instructor names on the SFU schedule page automatically
- Fetches ratings from the Rate My Professor GraphQL API via a background service worker
- Injects inline rating cards next to each instructor's name
- Deduplicates DOM nodes to avoid redundant lookups
- Reacts to dynamic page updates using a `MutationObserver` (handles PeopleSoft's SPA navigation)
- In-memory response caching to minimize API calls

---

## Tech Stack

| Layer | Technology |
|---|---|
| Build Tool | [Vite](https://vitejs.dev/) + [@crxjs/vite-plugin](https://crxjs.dev/) |
| Extension Spec | Chrome Manifest V3 |
| Content Script | JavaScript (ES Modules) |
| Background Worker | TypeScript |
| RMP Data | [`rate-my-professor-api-ts`](https://www.npmjs.com/package/rate-my-professor-api-ts) |

---

## Architecture

```
myschedule.erp.sfu.ca (browser tab)
│
├── content.js  ← injected by Chrome at document_end
│   ├── Scans DOM for instructor name elements
│   ├── Deduplicates using a Set to avoid reprocessing
│   ├── Sends chrome.runtime.sendMessage({ professorName }) per instructor
│   └── MutationObserver re-triggers on DOM changes (SPA navigation)
│
├── background.ts  ← service worker (no DOM access)
│   ├── Listens for messages from content script
│   ├── Checks in-memory cache (5-min TTL)
│   └── Calls RMP GraphQL API → sendResponse({ data })
│
└── content.css  ← injected into <head>
    └── Styles for .rmp-card rating badges and animations
```

The content script **cannot** call the Rate My Professor API directly due to CORS restrictions. All external API calls are delegated to the background service worker, which is exempt from these restrictions via `host_permissions` declared in `manifest.json`.

---

## Project Structure

```
sfu-myprofessor/
├── src/
│   ├── background/
│   │   └── background.ts       # Service worker: RMP API calls + caching
│   ├── content/
│   │   ├── content.js          # Injected into SFU schedule: reads DOM, injects cards
│   │   ├── templates.js        # HTML factory for rating and not-found cards
│   │   └── content.css         # Rating card styles (SFU brand: #CC0633)
│   └── popup/
│       └── popup.html          # Toolbar popup UI
├── manifest.json               # Extension config: permissions, URLs, entry points
├── vite.config.ts              # Build config
├── tsconfig.json               # TypeScript config
└── package.json
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- Google Chrome (or any Chromium-based browser)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/sfu-myprofessor.git
cd sfu-myprofessor

# Install dependencies
npm install

# Build the extension
npm run build
```

### Loading in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the generated `dist/` folder
5. Navigate to [myschedule.erp.sfu.ca](https://myschedule.erp.sfu.ca) and open your course schedule

### Development (Watch Mode)

```bash
npm run dev
```

After any code change, click the refresh icon on your extension card in `chrome://extensions`.

---

## How It Works

1. Chrome injects `content.js` into the SFU schedule page when it matches `https://myschedule.erp.sfu.ca/*`
2. The content script queries the DOM for `div.rightnclear[title="Instructor(s)"]` elements
3. A `Set` tracks already-processed nodes to prevent duplicate lookups
4. For each new instructor, the content script sends a message to the background service worker with the professor's name
5. The background worker checks its cache; on a miss, it queries the RMP GraphQL API for Simon Fraser University (school ID: `1482`)
6. The result is returned to the content script, which creates and injects a rating card adjacent to the instructor's name in the DOM
7. A `MutationObserver` watches `document.body` for subtree changes and re-runs the detection logic whenever the SFU portal loads new content without a full page refresh

---

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Future: persist user preferences and cached ratings across sessions |
| `host_permissions: ratemyprofessors.com` | Background worker fetches professor data from the RMP API |
| `host_permissions: myschedule.erp.sfu.ca` | Content script is injected into the SFU schedule portal |

---

## Troubleshooting

**No rating cards appear**
- Open DevTools on the SFU schedule page and check the Console for errors
- Confirm the extension is enabled in `chrome://extensions`
- Verify the page URL matches `https://myschedule.erp.sfu.ca/*`

**Cards show "Not Found" for all professors**
- Open the background service worker logs: `chrome://extensions` → your extension → **Service Worker** → Inspect
- Confirm the professor names being extracted match how they appear on Rate My Professor

**Cards disappear after navigating within the schedule**
- The `MutationObserver` should handle this automatically. If it does not, check that `observer.observe(document.body, { childList: true, subtree: true })` is active

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change. Pull requests should be scoped to a single concern and include a clear description.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature-name`
3. Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/)
4. Open a pull request against `main`

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

---

## Disclaimer

This extension reads publicly visible data from Rate My Professor that you could look up manually. It does not automate login, does not scrape SFU's servers, and places no additional load on SFU's systems. Use responsibly and in accordance with your institution's acceptable use policy.
