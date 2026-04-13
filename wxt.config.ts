import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  imports: false,
  manifestVersion: 3,
  manifest: {
    name: "SFU MyProfessor",
    description:
      "See Rate My Professor ratings directly in your SFU course schedule.",
    permissions: ["storage"],
    host_permissions: [
      "https://*.ratemyprofessors.com/*",
      "https://myschedule.erp.sfu.ca/*",
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  },
});
