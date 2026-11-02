import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["benchmarks/**/*.benchmark.ts"],
        testTimeout: 60_000,
        reporters: ["verbose"],
        pool: "forks",
        maxWorkers: 1
    }
});
