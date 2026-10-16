"use server";

import { createClient } from "@/lib/supabase/server";

type GuardOk = { ok: true; userId: string };
type GuardFail = { ok: false; erro: string };
type GuardResult = GuardOk | GuardFail;

const ADMIN_ROLES = ["admin", "professor"];
const TABLET_ROLES = ["admin", "professor", "tablet"];

/** Só exige sessão. Quem chama verifica a posse dos dados (próprio ou dependente). */
export async function requireUser(): Promise<GuardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Não autenticado." };
  return { ok: true, userId: user.id };
}

export async function requireAdmin(): Promise<GuardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Não autenticado." };
  const { data: profile } = await supabase
    .from("profiles").select("perfil").eq("id", user.id).single();
  if (!profile || !ADMIN_ROLES.includes(profile.perfil))
    return { ok: false, erro: "Sem permissão." };
  return { ok: true, userId: user.id };
}

export async function requireTablet(): Promise<GuardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Não autenticado." };
  const { data: profile } = await supabase
    .from("profiles").select("perfil").eq("id", user.id).single();
  if (!profile || !TABLET_ROLES.includes(profile.perfil))
    return { ok: false, erro: "Sem permissão." };
  return { ok: true, userId: user.id };
}
