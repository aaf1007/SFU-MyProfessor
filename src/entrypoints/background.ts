import { defineBackground } from "wxt/utils/define-background";

import { initBackground } from "../background/background";

export default defineBackground({
  type: "module",
  main() {
    initBackground();
  },
});
