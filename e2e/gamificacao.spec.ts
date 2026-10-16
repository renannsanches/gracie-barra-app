import { test, expect } from "@playwright/test";

// Uses aluno storageState from playwright.config.ts.
// O aluno de teste fica com ocultar_ranking = true (global-setup) para não aparecer
// no ranking real — a BD de testes é a de produção. Não alterar a visibilidade aqui.

test.describe("Gamificação", () => {
  test("perfil mostra o card de sequência com atalhos", async ({ page }) => {
    await page.goto("/perfil");
    const card = page.getByTestId("card-gamificacao");
    await expect(card).toBeVisible({ timeout: 10_000 });
    // Atalhos são <Link> (prefetch) — role "link"
    await expect(card.getByRole("link", { name: "Ranking" })).toBeVisible();
    await expect(card.getByRole("link", { name: "Conquistas" })).toBeVisible();
  });

  test("/conquistas mostra sequência e grupos de medalhas", async ({ page }) => {
    await page.goto("/conquistas");
    await expect(page.getByRole("heading", { name: "Conquistas" })).toBeVisible();
    await expect(page.getByTestId("card-sequencia")).toBeVisible();
    await expect(page.getByText("Marcos de aulas")).toBeVisible();
    await expect(page.getByText("Sequências", { exact: true })).toBeVisible();
    await expect(page.getByText("Especiais")).toBeVisible();
  });

  test("/ranking troca de período e grupo; aluno de teste aparece como oculto", async ({ page }) => {
    await page.goto("/ranking");
    await expect(page.getByRole("heading", { name: "Ranking de presenças" })).toBeVisible();
    await expect(page.getByTestId("ranking-oculto")).toBeVisible();

    const kids = page.getByRole("tab", { name: "Kids" });
    await kids.click();
    await expect(kids).toHaveAttribute("aria-selected", "true");

    const ano = page.getByRole("tab", { name: String(new Date().getFullYear()) });
    await ano.click();
    await expect(ano).toHaveAttribute("aria-selected", "true");
  });
});
