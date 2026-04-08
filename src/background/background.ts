import { RateMyProfessor } from "rate-my-professor-api-ts";

async function getProfessorRatings(professorName: string) {
  const rmpInstance = new RateMyProfessor(
    "Simon Fraser University",
    professorName,
  );

  return await rmpInstance.get_professor_info();
}

export function initBackground() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "FETCH_DATA") {
      // 1. Call your async function separately
      getProfessorRatings(message.payload.name)
        .then(data => sendResponse({status: "Success", data: data}))
        .catch(err => sendResponse({status: "Error", message: err}));
      // 2. CRITICAL: Return true to keep the message channel open
      return true;
    }
  });
}
