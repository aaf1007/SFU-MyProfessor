import { defineContentScript } from "wxt/utils/define-content-script";

import "../content/content.css";
import { initSchedule } from "../content/schedule";

export default defineContentScript({
  matches: ["https://myschedule.erp.sfu.ca/*"],
  runAt: "document_end",
  main() {
    initSchedule();
  },
});
