import { test, expect, type Page } from "@playwright/test";

// Corre no projecto admin: staff tem a linha "Dashboard" em Minha conta, o que
// permite confirmar que o tema escuro não passa para o /admin.

const temDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

test.describe("Modo escuro", () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem("tema")).catch(() => {});
  });

  test("interruptor em Minha conta, sem flash ao recarregar, admin fica claro", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/conta");
    await page.evaluate(() => localStorage.removeItem("tema"));
    await page.reload();

    const interruptor = page.getByRole("switch", { name: "Modo escuro" });
    await expect(interruptor).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("Segue o sistema")).toBeVisible();

    await interruptor.click();
    await expect(interruptor).toHaveAttribute("aria-checked", "true");
    expect(await temDark(page)).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem("tema"))).toBe("escuro");

    // O script do <head> põe a classe antes da hidratação
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await temDark(page)).toBe(true);

    // Navegação client-side para o painel admin → claro
    await page.getByRole("link", { name: /Dashboard/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect.poll(() => temDark(page)).toBe(false);

    // Carregamento directo do admin com a preferência escura → claro
    await page.reload();
    expect(await temDark(page)).toBe(false);

    // De volta a Minha conta: escuro outra vez; desligar
    await page.goto("/conta");
    expect(await temDark(page)).toBe(true);
    await page.getByRole("switch", { name: "Modo escuro" }).click();
    expect(await temDark(page)).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem("tema"))).toBe("claro");
  });

  test("sem preferência segue o sistema", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/perfil");
    await page.evaluate(() => localStorage.removeItem("tema"));
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await temDark(page)).toBe(true);

    // O tablet fica coberto pelo teste unitário do script (src/lib/tema.test.ts)
    await page.goto("/admin/alunos");
    expect(await temDark(page)).toBe(false);
  });
});
