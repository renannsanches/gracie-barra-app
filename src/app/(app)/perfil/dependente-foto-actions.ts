"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function atualizarFotoDependente(
  dependenteId: string,
  fotoUrl: string,
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Não autenticado" };

  const { data: rel } = await supabase
    .from("dependentes")
    .select("dependente_id")
    .eq("responsavel_id", user.id)
    .eq("dependente_id", dependenteId)
    .single();

  if (!rel) return { ok: false, erro: "Sem permissão" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ foto_url: fotoUrl })
    .eq("id", dependenteId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/perfil");
  return { ok: true };
}
