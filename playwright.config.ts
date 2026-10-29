import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  globalSetup: "./e2e/global-setup.ts",

  projects: [
    {
      name: "aluno",
      use: {
        storageState: "./e2e/.auth/aluno.json",
        ...devices["Pixel 5"],  // Android = chromium, already installed
      },
      testMatch: ["**/cadastro.spec.ts", "**/presenca.spec.ts", "**/gamificacao.spec.ts", "**/reset-senha.spec.ts"],
    },
    {
      name: "admin",
      use: {
        storageState: "./e2e/.auth/admin.json",
        viewport: { width: 1280, height: 800 },
      },
      testMatch: ["**/financeiro.spec.ts", "**/feed.spec.ts", "**/tema.spec.ts"],
    },
  ],
});
