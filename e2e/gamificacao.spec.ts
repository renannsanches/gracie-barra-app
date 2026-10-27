import { test, expect } from "@playwright/test";

// Uses aluno storageState from playwright.config.ts.
// O aluno de teste fica com ocultar_ranking = true (global-setup) para não aparecer
// no ranking real — a BD de testes é a de produção. Não alterar a visibilidade aqui.

test.describe("Gamificação", () => {
  test("Início mostra as pílulas e troca de separador", async ({ page }) => {
    await page.goto("/perfil");
    const nav = page.getByRole("navigation", { name: "Secções do início" });
    await expect(nav.getByRole("link", { name: "Feed" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("feed")).toBeVisible({ timeout: 10_000 });
    await nav.getByRole("link", { name: "Ranking" }).click();
    await expect(page).toHaveURL(/\/perfil\?tab=ranking/);
    await expect(page.getByTestId("ranking-oculto")).toBeVisible();
    await nav.getByRole("link", { name: "Galeria" }).click();
    await expect(page).toHaveURL(/tab=galeria/);
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
