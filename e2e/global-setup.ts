import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_USERS = [
  {
    email: process.env.PLAYWRIGHT_TEST_EMAIL!,
    password: process.env.PLAYWRIGHT_TEST_PASSWORD!,
    perfil: "aluno",
    nome: "Aluno Teste E2E",
    authFile: "./e2e/.auth/aluno.json",
  },
  {
    email: process.env.PLAYWRIGHT_ADMIN_EMAIL!,
    password: process.env.PLAYWRIGHT_ADMIN_PASSWORD!,
    perfil: "admin",
    nome: "Admin Teste E2E",
    authFile: "./e2e/.auth/admin.json",
  },
];

async function ensureUser(
  email: string,
  password: string,
  perfil: string,
  nome: string
) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { users } } = await admin.auth.admin.listUsers();
  let user = users.find((u) => u.email === email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Failed to create user ${email}: ${error?.message}`);
    }
    user = data.user;
  } else {
    // Ensure password is correct (update in case it changed)
    await admin.auth.admin.updateUserById(user.id, { password });
  }

  // Upsert profile — idempotent
  await admin.from("profiles").upsert(
    {
      id: user.id,
      nome_completo: nome,
      perfil,
      status: "ativo",
      faixa: "branca",
      graus: 0,
      categoria: "adulto",
      sem_login: false,
      // A BD de testes é a de produção: utilizadores de teste fora do ranking
      ocultar_ranking: true,
    },
    { onConflict: "id" }
  );
}

async function saveAuthState(
  email: string,
  password: string,
  authFile: string
) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Middleware redirects to /perfil (aluno) or /admin (admin)
  await page.waitForURL(/\/(perfil|admin)/, { timeout: 20_000 });

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await context.storageState({ path: authFile });
  await browser.close();
}

export default async function globalSetup(_config: FullConfig) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
    );
  }

  for (const u of TEST_USERS) {
    if (!u.email || !u.password) {
      throw new Error(
        `Missing env vars for ${u.perfil} test user (PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_ADMIN_EMAIL)`
      );
    }
    console.log(`[global-setup] Provisioning ${u.perfil}: ${u.email}`);
    await ensureUser(u.email, u.password, u.perfil, u.nome);
    await saveAuthState(u.email, u.password, u.authFile);
    console.log(`[global-setup] Auth saved: ${u.authFile}`);
  }
}
