import { fetchProfessorData } from "./rmp";
import {
  FETCH_DATA_MESSAGE_TYPE,
  type FetchDataResponse,
  type FetchDataSuccessResponse,
  isFetchDataRequest,
} from "../shared/professor";

export function initBackground() {
  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: FetchDataResponse) => void,
    ) => {
      if (!isFetchDataRequest(message)) {
        return;
      }

      if (message.type === FETCH_DATA_MESSAGE_TYPE) {
        fetchProfessorData(message.payload.name)
          .then((data) => {
            const response: FetchDataSuccessResponse = {
              status: "Success",
              data,
            };
            sendResponse(response);
          })
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : "Unknown background error.";

            sendResponse({
              status: "Error",
              message,
            });
          });

        return true;
      }
    }
  );
}
