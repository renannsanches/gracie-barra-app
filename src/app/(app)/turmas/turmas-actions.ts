"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

interface ActionResult {
  ok: boolean;
  erro?: string;
  reservaId?: string;
}

async function estaBloqueadoFinanceiramente(
  alunoId: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<boolean> {
  const dez = new Date();
  dez.setDate(dez.getDate() - 10);
  const { data } = await admin
    .from("mensalidades")
    .select("id")
    .eq("aluno_id", alunoId)
    .neq("status", "pago")
    .lte("data_vencimento", dez.toISOString().split("T")[0])
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function reservar(aulaId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Não autenticado." };

  const admin = createAdminClient();

  const { data: aula } = await admin
    .from("aulas")
    .select("id, lotacao_maxima, status")
    .eq("id", aulaId)
    .single();

  if (!aula) return { ok: false, erro: "Aula não encontrada." };
  if (aula.status !== "agendada") return { ok: false, erro: "Esta aula não está disponível." };

  if (await estaBloqueadoFinanceiramente(user.id, admin)) {
    return { ok: false, erro: "Não é possível reservar a aula. Falar com Simone." };
  }

  const { count } = await admin
    .from("reservas")
    .select("id", { count: "exact", head: true })
    .eq("aula_id", aulaId)
    .eq("status", "confirmada");

  if ((count ?? 0) >= aula.lotacao_maxima) {
    return { ok: false, erro: "Aula sem vagas disponíveis." };
  }

  const { data: existente } = await admin
    .from("reservas")
    .select("id, status")
    .eq("aula_id", aulaId)
    .eq("aluno_id", user.id)
    .maybeSingle();

  if (existente) {
    if (existente.status === "confirmada") {
      return { ok: false, erro: "Já tens reserva nesta aula." };
    }
    const { error } = await admin
      .from("reservas")
      .update({ status: "confirmada" })
      .eq("id", existente.id);
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/turmas");
    return { ok: true, reservaId: existente.id };
  }

  const { data: nova, error } = await admin
    .from("reservas")
    .insert({ aula_id: aulaId, aluno_id: user.id, status: "confirmada" })
    .select("id")
    .single();

  if (error || !nova) return { ok: false, erro: error?.message ?? "Erro ao reservar." };

  revalidatePath("/turmas");
  return { ok: true, reservaId: nova.id };
}

export async function cancelarMinhaReserva(reservaId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Não autenticado." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("reservas")
    .update({ status: "cancelada" })
    .eq("id", reservaId)
    .eq("aluno_id", user.id);

  if (error) return { ok: false, erro: error.message };
  revalidatePath("/turmas");
  return { ok: true };
}
