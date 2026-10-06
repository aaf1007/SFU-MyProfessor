import { createProfessorCache } from "./cache";
import { fetchProfessorData, searchProfessors } from "./rmp";
import {
  type FetchDataResponse,
  isFetchDataRequest,
  isOpenSearchRequest,
  isSearchProfessorsRequest,
  OPEN_SEARCH_MESSAGE_TYPE,
  type OpenSearchResponse,
  PENDING_SEARCH_KEY,
  type PendingSearch,
  SEARCH_PROFESSORS_MESSAGE_TYPE,
  type SearchProfessorsResponse,
} from "../shared/professor";

type AnyResponse = FetchDataResponse | SearchProfessorsResponse | OpenSearchResponse;

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const hasType = (message: unknown, type: string) =>
  !!message && typeof message === "object" && "type" in message && message.type === type;

export function initBackground() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error("Could not configure the professor side panel:", error));

  const cache = createProfessorCache(chrome.storage.local);
  void cache.prune();

  const lookUpProfessor = async (name: string) => {
    const cached = await cache.get(name);
    if (cached !== undefined) return cached;
    const data = await fetchProfessorData(name);
    await cache.set(name, data);
    return data;
  };

  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: AnyResponse) => void,
    ) => {
      if (hasType(message, SEARCH_PROFESSORS_MESSAGE_TYPE)) {
        if (!isSearchProfessorsRequest(message)) {
          sendResponse({ status: "Error", message: "Enter a professor name of 100 characters or fewer." });
          return;
        }
        searchProfessors(message.payload.query, message.payload.after)
          .then(data => sendResponse({ status: "Success", data }))
          .catch((error: unknown) => sendResponse({
            status: "Error",
            message: errorMessage(error, "Professor search is unavailable."),
          }));
        return true;
      }

      if (hasType(message, OPEN_SEARCH_MESSAGE_TYPE)) {
        const windowId = sender.tab?.windowId;
        if (!isOpenSearchRequest(message) || windowId === undefined) {
          sendResponse({ status: "Error", message: "Could not open professor search." });
          return;
        }
        // sidePanel.open() needs the user gesture from the click that sent this message,
        // so it must be called synchronously, before anything is awaited.
        const opened = chrome.sidePanel.open({ windowId });
        const pending: PendingSearch = { query: message.payload.query.trim(), requestedAt: Date.now() };
        Promise.all([opened, chrome.storage.session.set({ [PENDING_SEARCH_KEY]: pending })])
          .then(() => sendResponse({ status: "Success" }))
          .catch((error: unknown) => sendResponse({
            status: "Error",
            message: errorMessage(error, "Could not open professor search."),
          }));
        return true;
      }

      if (!isFetchDataRequest(message)) {
        return;
      }

      lookUpProfessor(message.payload.name)
        .then(data => sendResponse({ status: "Success", data }))
        .catch((error: unknown) => sendResponse({
          status: "Error",
          message: errorMessage(error, "Unknown background error."),
        }));
      return true;
    }
  );
}
