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

// Post automático de faixa nova. Só se toca no aluno de teste (PLAYWRIGHT_TEST_EMAIL): guarda-se o
// estado dele antes e repõe-se no fim, com as graduações e os posts criados por este teste.
test.describe("post automático de graduação", () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let alunoId = "";
  let original: { faixa: string | null; graus: number; categoria: string; ocultar_ranking: boolean } | null = null;
  const graduacoesAntes = new Set<string>();

  function hojeLisboa(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }

  async function perfilDoAluno(dados: Record<string, unknown>) {
    const { error } = await admin.from("profiles").update(dados).eq("id", alunoId);
    if (error) throw new Error(`perfil do aluno de teste: ${error.message}`);
  }

  async function graduacoesNovas(): Promise<string[]> {
    const { data, error } = await admin.from("historico_graduacoes").select("id").eq("aluno_id", alunoId);
    if (error) throw new Error(`historico_graduacoes: ${error.message}`);
    return (data ?? []).map((g) => g.id as string).filter((id) => !graduacoesAntes.has(id));
  }

  async function postsDe(ids: string[]) {
    if (ids.length === 0) return [];
    const { data, error } = await admin.from("feed_posts").select("id, fotos").eq("tipo", "graduacao").in("referencia", ids);
    if (error) throw new Error(`feed_posts: ${error.message}`);
    return data ?? [];
  }

  test.beforeAll(async () => {
    const email = process.env.PLAYWRIGHT_TEST_EMAIL!;
    const { data: lista, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const user = lista.users.find((u) => u.email === email);
    if (!user) throw new Error(`aluno de teste ${email} não existe`);
    alunoId = user.id;

    const { data: perfil, error: erroPerfil } = await admin
      .from("profiles")
      .select("faixa, graus, categoria, ocultar_ranking")
      .eq("id", alunoId)
      .single();
    if (erroPerfil || !perfil) throw new Error(`perfil do aluno de teste: ${erroPerfil?.message}`);
    original = perfil as typeof original;

    const { data: grads, error: erroGrads } = await admin.from("historico_graduacoes").select("id").eq("aluno_id", alunoId);
    if (erroGrads) throw new Error(`historico_graduacoes: ${erroGrads.message}`);
    for (const g of grads ?? []) graduacoesAntes.add(g.id as string);
  });

  test.afterAll(async () => {
    if (!alunoId) return;
    const novas = await graduacoesNovas();
    const posts = await postsDe(novas);
    const marca = "/object/public/feed/";
    const caminhos = posts
      .flatMap((p) => (p.fotos as string[] | null) ?? [])
      .map((url) => (url.includes(marca) ? url.slice(url.indexOf(marca) + marca.length).split(/[?#]/)[0] : ""))
      .filter(Boolean);
    if (caminhos.length > 0) {
      const { error } = await admin.storage.from("feed").remove(caminhos);
      if (error) throw new Error(`limpeza do bucket feed: ${error.message}`);
    }
    if (posts.length > 0) {
      const { error } = await admin.from("feed_posts").delete().eq("tipo", "graduacao").in("id", posts.map((p) => p.id));
      if (error) throw new Error(`limpeza de feed_posts: ${error.message}`);
    }
    if (novas.length > 0) {
      const { error } = await admin.from("historico_graduacoes").delete().eq("aluno_id", alunoId).in("id", novas);
      if (error) throw new Error(`limpeza de historico_graduacoes: ${error.message}`);
    }
    if (original) await perfilDoAluno(original);
  });

  test("faixa nova publica no feed; apagar a graduação tira o post; aluno oculto não publica", async ({ page, context }) => {
    test.setTimeout(120_000);
    const base = { faixa: "branca", graus: 0, categoria: "adulto" };
    const hoje = hojeLisboa();
    const textoPost = "Aluno E2E recebeu a faixa azul."; // nomeRanking("Aluno Teste E2E") + textoGraduacao
    const feed = await context.newPage();

    async function registarAzul(): Promise<string> {
      await page.goto(`/admin/alunos/${alunoId}`);
      await page.getByRole("button", { name: "Registar Graduação" }).click();
      await page.getByTitle("Nova faixa").selectOption("azul");
      await page.locator("#grad_data").fill(hoje);
      await page.getByRole("button", { name: "Registar Graduação" }).click();
      await expect(page.getByText("Nova Graduação", { exact: true })).toHaveCount(0, { timeout: 15_000 });
      const novas = await graduacoesNovas();
      expect(novas).toHaveLength(1);
      return novas[0];
    }

    async function apagarPelaUi() {
      // A graduação acabada de registar fica no topo do histórico
      await page.getByTitle("Eliminar graduação").first().click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
      await expect(page.getByText("Graduação eliminada")).toBeVisible({ timeout: 15_000 });
      expect(await graduacoesNovas()).toHaveLength(0);
    }

    // 1) Visível no ranking → há post
    await perfilDoAluno({ ...base, ocultar_ranking: false });
    const g1 = await registarAzul();
    expect(await postsDe([g1])).toHaveLength(1);
    await feed.goto("/perfil");
    const post = feed.getByTestId("post").filter({ hasText: textoPost });
    await expect(post).toHaveCount(1, { timeout: 15_000 });

    await apagarPelaUi();
    expect(await postsDe([g1])).toHaveLength(0);
    await feed.reload();
    await expect(feed.getByTestId("feed")).toBeVisible({ timeout: 15_000 });
    await expect(post).toHaveCount(0);

    // 2) Oculto do ranking → não há post
    await perfilDoAluno({ ...base, ocultar_ranking: true });
    const g2 = await registarAzul();
    expect(await postsDe([g2])).toHaveLength(0);
    await feed.reload();
    await expect(feed.getByTestId("feed")).toBeVisible({ timeout: 15_000 });
    await expect(post).toHaveCount(0);

    await apagarPelaUi();
  });
});
