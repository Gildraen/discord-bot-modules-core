import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {

        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
        coverage: {
            reporter: ["text", "html"],
        },
    },
});