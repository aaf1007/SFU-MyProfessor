import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import manifest from "./manifest.json" with { type: "json" };

export default defineConfig({
    plugins: [
        tailwindcss(),
        crx({ manifest: manifest as any })
    ]
})