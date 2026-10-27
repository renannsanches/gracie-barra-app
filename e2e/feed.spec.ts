import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Projecto admin (storageState de staff). Push desligado localmente (só sai com VERCEL_ENV=production).

const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

// Rede de segurança se o teste falhar a meio: a BD e o bucket são os de produção, por isso só se
// toca em posts cujo texto começa por "e2e-feed-" (e nas fotos dessas linhas).
test.afterAll(async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: restos, error } = await admin.from("feed_posts").select("id, fotos").like("texto", "e2e-feed-%");
  if (error) throw new Error(`limpeza do feed: ${error.message}`);
  if (!restos || restos.length === 0) return;

  const marca = "/object/public/feed/";
  const caminhos = restos
    .flatMap((p) => (p.fotos as string[] | null) ?? [])
    .map((url) => (url.includes(marca) ? url.slice(url.indexOf(marca) + marca.length).split(/[?#]/)[0] : ""))
    .filter(Boolean);
  if (caminhos.length > 0) {
    const { error: erroStorage } = await admin.storage.from("feed").remove(caminhos);
    if (erroStorage) throw new Error(`limpeza do bucket feed: ${erroStorage.message}`);
  }

  const { error: erroDelete } = await admin
    .from("feed_posts")
    .delete()
    .in("id", restos.map((p) => p.id))
    .like("texto", "e2e-feed-%");
  if (erroDelete) throw new Error(`limpeza de feed_posts: ${erroDelete.message}`);
});

test("staff publica, dá gosto, comenta e apaga", async ({ page }) => {
  const marca = `e2e-feed-${Date.now()}`;
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Nova publicação" }).click();
  await page.getByPlaceholder("Escreve algo para a academia…").fill(marca);
  // Na página há outro input de ficheiro (foto de perfil): procura-se só dentro do compositor
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({ name: "f.png", mimeType: "image/png", buffer: PNG_1PX });
  await page.getByRole("button", { name: "Publicar" }).click();
  const post = page.getByTestId("post").filter({ hasText: marca });
  await expect(post).toBeVisible({ timeout: 15_000 });

  await post.getByRole("button", { name: "Gostar" }).click();
  await expect(post.getByRole("button", { name: "Retirar gosto" })).toHaveAttribute("aria-pressed", "true");

  await post.getByRole("button", { name: "Ver comentários" }).click();
  const campo = page.getByPlaceholder("Escreve um comentário…");
  await campo.fill("a".repeat(301));
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Máximo de 300 caracteres.")).toBeVisible();
  await campo.fill("comentário e2e");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("comentário e2e")).toBeVisible();
  await page.keyboard.press("Escape");

  await post.getByRole("button", { name: "Opções da publicação" }).click();
  await page.getByRole("menuitem", { name: "Apagar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Apagar" }).click(); // label por defeito de confirmar({ destrutivo: true })
  await expect(post).toHaveCount(0);
});
