import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  imports: false,
  manifestVersion: 3,
  manifest: {
    name: "SFU MyProfessor",
    description:
      "Search SFU professors in your side panel and see Rate My Professors ratings in your course schedule.",
    minimum_chrome_version: "116",
    action: { default_title: "Search SFU professors" },
    permissions: ["storage", "sidePanel"],
    host_permissions: [
      "https://*.ratemyprofessors.com/*",
      "https://myschedule.erp.sfu.ca/*",
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  },
});
