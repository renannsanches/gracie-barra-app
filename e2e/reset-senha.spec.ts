import { test, expect } from "@playwright/test";

// Fluxo de recuperação de password, sem sessão. Usa tokens falsos: inofensivo na BD partilhada.
test.use({ storageState: { cookies: [], origins: [] } });

const TOKEN_FALSO = "token-falso-e2e-1234567890";

test.describe("Reset de password — link do email", () => {
  test("/nova-senha com token_hash mostra Continuar e não o campo de senha", async ({ page }) => {
    await page.goto(`/nova-senha?token_hash=${TOKEN_FALSO}&type=recovery`);
    await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
    await expect(page.getByLabel("Nova senha")).toHaveCount(0);
  });

  test("Continuar com token inválido mostra link expirado e ligação para pedir novo", async ({ page }) => {
    await page.goto(`/nova-senha?token_hash=${TOKEN_FALSO}&type=recovery`);
    await page.getByRole("button", { name: "Continuar" }).click();
    // O verifyOtp vai ao Supabase: dar-lhe mais tempo. Não usar role=alert — o Next
    // tem um anunciador de rotas com esse role.
    await expect(page.getByText("O link expirou ou já foi usado.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: "Pedir novo link" })).toBeVisible();
    await expect(page.getByLabel("Nova senha")).toHaveCount(0);
  });

  test("/auth/callback com token_hash de recovery não verifica no GET: reencaminha para /nova-senha", async ({ page }) => {
    await page.goto(`/auth/callback?token_hash=${TOKEN_FALSO}&type=recovery&next=/nova-senha`);
    await expect(page).toHaveURL(/\/nova-senha\?token_hash=token-falso-e2e-1234567890&type=recovery/);
    await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
  });

  test("/esqueci-senha?erro=link mostra a mensagem de link expirado", async ({ page }) => {
    await page.goto("/esqueci-senha?erro=link");
    await expect(page.getByText("O link expirou ou já foi usado. Pede um novo abaixo.")).toBeVisible();
  });

  test("/nova-senha sem token vai direto ao formulário (sessão criada por /auth/callback)", async ({ page }) => {
    await page.goto("/nova-senha");
    await expect(page.getByLabel("Nova senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar" })).toHaveCount(0);
  });
});
