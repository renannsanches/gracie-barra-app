"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { sendPushAviso } from "@/lib/push-sender";

export async function criarAviso(
  titulo: string,
  conteudo: string,
  fixado: boolean,
  publicado: boolean
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("avisos")
    .insert({ titulo, conteudo, fixado, publicado, autor_id: auth.userId });
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/admin/avisos");
  if (publicado) sendPushAviso().catch(() => {});
  return { ok: true };
}

export async function editarAviso(
  id: string,
  titulo: string,
  conteudo: string,
  fixado: boolean,
  publicado: boolean
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();

  const { data: atual } = await admin
    .from("avisos")
    .select("publicado")
    .eq("id", id)
    .single();

  const { error } = await admin
    .from("avisos")
    .update({ titulo, conteudo, fixado, publicado })
    .eq("id", id);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/admin/avisos");
  // Only push if just transitioning from draft → published
  if (publicado && atual?.publicado === false) sendPushAviso().catch(() => {});
  return { ok: true };
}

export async function apagarAviso(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  const { error } = await admin.from("avisos").delete().eq("id", id);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/admin/avisos");
  return { ok: true };
}

export async function toggleFixado(id: string, fixado: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  const { error } = await admin.from("avisos").update({ fixado }).eq("id", id);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/admin/avisos");
  return { ok: true };
}

export async function togglePublicado(id: string, publicado: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const admin = createAdminClient();
  const { error } = await admin.from("avisos").update({ publicado }).eq("id", id);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/admin/avisos");
  if (publicado) sendPushAviso().catch(() => {});
  return { ok: true };
}
