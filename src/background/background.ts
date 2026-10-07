import { getCourseInstructors } from "./course-instructors";
import { fetchProfessorData, searchProfessors } from "./rmp";
import {
  COURSE_INSTRUCTORS_MESSAGE_TYPE,
  type CourseInstructorsResponse,
  isCourseInstructorsRequest,
  FETCH_DATA_MESSAGE_TYPE,
  type FetchDataResponse,
  type FetchDataSuccessResponse,
  isFetchDataRequest,
  SEARCH_PROFESSORS_MESSAGE_TYPE,
  isSearchProfessorsRequest,
  type SearchProfessorsResponse,
} from "../shared/professor";

export function initBackground() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error("Could not configure the professor side panel:", error));

  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: FetchDataResponse | SearchProfessorsResponse | CourseInstructorsResponse) => void,
    ) => {
      if (message && typeof message === "object" &&
        "type" in message && message.type === SEARCH_PROFESSORS_MESSAGE_TYPE) {
        if (!isSearchProfessorsRequest(message)) {
          sendResponse({ status: "Error", message: "Enter a professor name of 100 characters or fewer." });
          return;
        }
        searchProfessors(message.payload.query)
          .then(data => sendResponse({ status: "Success", data }))
          .catch((error: unknown) => sendResponse({
            status: "Error",
            message: error instanceof Error ? error.message : "Professor search is unavailable.",
          }));
        return true;
      }

      if (message && typeof message === "object" &&
        "type" in message && message.type === COURSE_INSTRUCTORS_MESSAGE_TYPE) {
        if (!isCourseInstructorsRequest(message)) {
          sendResponse({ status: "Error", message: "Enter a course code like CMPT 225." });
          return;
        }
        const { dept, number, year, season } = message.payload;
        getCourseInstructors({ year, season }, { dept, number })
          .then(data => sendResponse({ status: "Success", data }))
          .catch((error: unknown) => sendResponse({
            status: "Error",
            message: error instanceof Error ? error.message : "Course lookup is unavailable.",
          }));
        return true;
      }

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
