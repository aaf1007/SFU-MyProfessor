// Finds instructor cells on MySchedule, looks each name up via the background worker,
// and keeps one injected rating row in sync with each cell.

import { buildLookupCard, buildRow, buildTBDCard, type CardActions, type LookupResult } from "./cards";
import { type InstructorCell, parseInstructorCell } from "./instructors";
import {
  FETCH_DATA_MESSAGE_TYPE,
  type FetchDataRequest,
  type FetchDataResponse,
  OPEN_SEARCH_MESSAGE_TYPE,
  type OpenSearchRequest,
  type OpenSearchResponse,
} from "../shared/professor";

const INSTRUCTOR_SELECTOR = 'div.rightnclear[title="Instructor(s)"]';
const ROW_ATTRIBUTE = "data-sfu-myprofessor";
const SCAN_DEBOUNCE_MS = 500;

export function initSchedule() {
  // Settled lookups by name, shared across sections taught by the same professor.
  // Errors stay here until the user clicks Retry, so a failing lookup is not re-sent
  // on every DOM mutation.
  const results = new Map<string, LookupResult>();
  const inFlight = new Set<string>();
  // Each injected row, its owning instructor cell, and what it was rendered from.
  const rows = new Map<HTMLTableRowElement, Element>();
  const rendered = new WeakMap<Element, { signature: string; row: HTMLTableRowElement | null }>();

  const actions: CardActions = {
    retry(name) {
      results.delete(name);
      scan();
    },
    openSearch(name) {
      const request: OpenSearchRequest = { type: OPEN_SEARCH_MESSAGE_TYPE, payload: { query: name } };
      chrome.runtime.sendMessage(request)
        .then((response?: OpenSearchResponse) => {
          if (response?.status !== "Success") {
            console.error("Could not open professor search:", response?.message);
          }
        })
        .catch((error: unknown) => console.error("Could not open professor search:", error));
    },
  };

  const lookUp = async (name: string) => {
    inFlight.add(name);
    let result: LookupResult;
    try {
      const request: FetchDataRequest = { type: FETCH_DATA_MESSAGE_TYPE, payload: { name } };
      const response: FetchDataResponse | undefined = await chrome.runtime.sendMessage(request);
      if (!response) result = { kind: "error", message: "No response from the extension." };
      else if (response.status === "Error") result = { kind: "error", message: response.message };
      else result = response.data ? { kind: "found", data: response.data } : { kind: "missing" };
    } catch (error) {
      // e.g. "Extension context invalidated" after the extension is reloaded.
      result = { kind: "error", message: error instanceof Error ? error.message : String(error) };
    }
    if (result.kind === "error") console.error(`Rating lookup failed for ${name}:`, result.message);
    inFlight.delete(name);
    results.set(name, result);
    scan();
  };

  const signatureOf = (cell: InstructorCell) => {
    if (cell.kind !== "names") return cell.kind;
    return cell.names.map(name => {
      const result = results.get(name);
      return `${name}:${result?.kind ?? "pending"}`;
    }).join("|");
  };

  const cardsFor = (cell: InstructorCell): HTMLElement[] => {
    if (cell.kind === "tbd") return [buildTBDCard()];
    if (cell.kind !== "names") return [];
    return cell.names.flatMap(name => {
      const result = results.get(name);
      return result ? [buildLookupCard(name, result, actions)] : [];
    });
  };

  const renderCell = (element: Element, cell: InstructorCell) => {
    const signature = signatureOf(cell);
    const previous = rendered.get(element);
    if (previous && previous.signature === signature && (!previous.row || previous.row.isConnected)) return;

    if (previous?.row) {
      previous.row.remove();
      rows.delete(previous.row);
    }
    const tableRow = element.closest("tr");
    const cards = cardsFor(cell);
    let row: HTMLTableRowElement | null = null;
    if (tableRow && cards.length > 0) {
      row = buildRow(cards);
      tableRow.after(row);
      rows.set(row, element);
    }
    rendered.set(element, { signature, row });
  };

  function scan() {
    // Drop rows whose instructor cell was removed by a MySchedule re-render.
    for (const [row, element] of rows) {
      if (!element.isConnected) {
        row.remove();
        rows.delete(row);
      }
    }

    for (const element of document.querySelectorAll<HTMLElement>(INSTRUCTOR_SELECTOR)) {
      // innerText keeps <br> as a line break, which separates multiple instructors.
      const cell = parseInstructorCell(element.innerText || element.textContent || "");
      if (cell.kind === "names") {
        for (const name of cell.names) {
          if (!results.has(name) && !inFlight.has(name)) void lookUp(name);
        }
      }
      renderCell(element, cell);
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduleScan = () => {
    clearTimeout(timer);
    timer = setTimeout(scan, SCAN_DEBOUNCE_MS);
  };

  const isOwnRow = (node: Node) => {
    const element = node instanceof Element ? node : node.parentElement;
    return !!element && (element.hasAttribute(ROW_ATTRIBUTE) || !!element.closest(`[${ROW_ATTRIBUTE}]`));
  };

  // Watch the whole body: MySchedule is a SPA that can replace the schedule table
  // itself, which would strand an observer attached to the old table. Mutations caused
  // only by our own rows are ignored.
  const observer = new MutationObserver(mutations => {
    const external = mutations.some(mutation => {
      if (isOwnRow(mutation.target)) return false;
      if (mutation.type !== "childList") return true;
      return [...mutation.addedNodes, ...mutation.removedNodes].some(node => !isOwnRow(node));
    });
    if (external) scheduleScan();
  });

  scan();
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
