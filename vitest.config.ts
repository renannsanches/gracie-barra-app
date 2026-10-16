import { defineConfig } from "vitest/config";

// Testes unitários (lógica pura). Os E2E do Playwright ficam em e2e/ e correm com `npm run test:e2e`.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
