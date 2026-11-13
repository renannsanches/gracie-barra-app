import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// This spec needs a fresh unauthenticated session — no stored state
test.use({ storageState: { cookies: [], origins: [] } });

let throwawayUserId: string | undefined;

test.beforeAll(async () => {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const testEmail = `e2e-cadastro-${Date.now()}@graciebarrafamalicao.app`;
  const testPassword = "PlaywrightCadastro123!";

  // Create user already confirmed but with onboarding flag set
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { onboarding: true },
  });

  if (error || !data.user) {
    throw new Error(`Failed to create throwaway user: ${error?.message}`);
  }

  throwawayUserId = data.user.id;

  // Store credentials for tests to use
  process.env._E2E_CADASTRO_EMAIL = testEmail;
  process.env._E2E_CADASTRO_PASSWORD = testPassword;
});

test.afterAll(async () => {
  if (!throwawayUserId) return;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  // O perfil não cai com o utilizador (profiles sem FK para auth.users): apagar os dois
  await admin.from("profiles").delete().eq("id", throwawayUserId);
  await admin.auth.admin.deleteUser(throwawayUserId);
});

test.describe("Autenticação — redirecionamentos", () => {
  test("unauthenticated user at /perfil → /login", async ({ page }) => {
    await page.goto("/perfil");
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test("unauthenticated user at /admin → /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });
});

test.describe("Cadastro — fluxo de registo", () => {
  test("user with onboarding flag → redirected to /cadastro after login", async ({ page }) => {
    const email = process.env._E2E_CADASTRO_EMAIL!;
    const password = process.env._E2E_CADASTRO_PASSWORD!;

    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Middleware sees onboarding flag → forces /cadastro
    await expect(page).toHaveURL(/\/cadastro/, { timeout: 15_000 });
    // Onboarding step 0 — tipo selection buttons visible
    await expect(page.getByText(/Aluno|Responsável/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
