"use server";

import { createClient } from "@/lib/supabase/server";
import type { PerfilUsuario } from "@/lib/types";

type GuardOk = { ok: true; userId: string };
type GuardFail = { ok: false; erro: string };
type GuardResult = GuardOk | GuardFail;
type MembroResult = { ok: true; userId: string; perfil: PerfilUsuario } | GuardFail;

const ADMIN_ROLES = ["admin", "professor"];
const TABLET_ROLES = ["admin", "professor", "tablet"];
// Quem usa o feed: tudo menos a conta do tablet da recepção
const MEMBRO_ROLES: PerfilUsuario[] = ["aluno", "responsavel", "professor", "admin"];

/** Só exige sessão. Quem chama verifica a posse dos dados (próprio ou dependente). */
export async function requireUser(): Promise<GuardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Não autenticado." };
  return { ok: true, userId: user.id };
}

/** Sessão + perfil de membro (aluno, responsável, professor ou admin) — devolve também o perfil. */
export async function requireMembro(): Promise<MembroResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Não autenticado." };
  const { data: profile } = await supabase
    .from("profiles").select("perfil").eq("id", user.id).single();
  if (!profile || !MEMBRO_ROLES.includes(profile.perfil))
    return { ok: false, erro: "Sem permissão." };
  return { ok: true, userId: user.id, perfil: profile.perfil as PerfilUsuario };
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
