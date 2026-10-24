import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Resolve Auth.js's extensionless Next imports through Vite, as Next does
    // in the application, while exercising its real handlers in security tests.
    server: { deps: { inline: ["next-auth"] } },
    include: ["src/server/**/__tests__/**/*.test.ts"],
    setupFiles: ["./tests/unit.setup.ts"],
  },
});
