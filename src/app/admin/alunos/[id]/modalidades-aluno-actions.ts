"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { inicioMesAtual, planoDoAluno } from "@/lib/modalidades";
import type { ItemMensalidade } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface PendentesDesatualizadas {
  quantidade: number;
  /** mes_referencia (YYYY-MM-01) da primeira e da última */
  de: string | null;
  ate: string | null;
}

export interface GuardarModalidadesResult {
  ok: boolean;
  erro?: string;
  totalAntes?: number;
  totalDepois?: number;
  pendentes?: PendentesDesatualizadas;
}

/** Assinatura comparável da composição (ignora nomes e ordem). */
function assinatura(itens: Pick<ItemMensalidade, "modalidade_id" | "valor">[] | null): string {
  return (itens ?? [])
    .map((i) => `${i.modalidade_id}:${Number(i.valor).toFixed(2)}`)
    .sort()
    .join("|");
}

/** Mensalidades por pagar a partir do mês actual cuja composição difere do plano. */
async function pendentesDesatualizadas(admin: AdminClient, alunoId: string) {
  const { itens, total } = await planoDoAluno(admin, alunoId);
  const { data } = await admin
    .from("mensalidades")
    .select("id, mes_referencia, valor, itens")
    .eq("aluno_id", alunoId)
    .neq("status", "pago")
    .gte("mes_referencia", inicioMesAtual())
    .order("mes_referencia", { ascending: true });

  const alvo = assinatura(itens);
  const linhas = (data ?? []).filter(
    (m) => Number(m.valor) !== total || assinatura(m.itens as ItemMensalidade[] | null) !== alvo,
  );
  return { linhas, itens, total };
}

/** Substitui as modalidades do aluno e indica quantas mensalidades pendentes ficaram desatualizadas. */
export async function guardarModalidadesAluno(
  alunoId: string,
  plano: { modalidade_id: string; valor: number }[],
): Promise<GuardarModalidadesResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (new Set(plano.map((p) => p.modalidade_id)).size !== plano.length) {
    return { ok: false, erro: "Modalidade repetida." };
  }
  if (plano.some((p) => !Number.isFinite(p.valor) || p.valor < 0)) {
    return { ok: false, erro: "Valor inválido numa das modalidades." };
  }

  const admin = createAdminClient();
  const antes = await planoDoAluno(admin, alunoId);

  const ids = plano.map((p) => p.modalidade_id);
  const del = admin.from("aluno_modalidades").delete().eq("aluno_id", alunoId);
  const { error: delErr } = ids.length > 0
    ? await del.not("modalidade_id", "in", `(${ids.join(",")})`)
    : await del;
  if (delErr) return { ok: false, erro: delErr.message };

  if (plano.length > 0) {
    const { error } = await admin
      .from("aluno_modalidades")
      .upsert(plano.map((p) => ({ aluno_id: alunoId, modalidade_id: p.modalidade_id, valor: p.valor })), {
        onConflict: "aluno_id,modalidade_id",
      });
    if (error) return { ok: false, erro: error.message };
  }

  const { linhas, total } = await pendentesDesatualizadas(admin, alunoId);
  revalidatePath(`/admin/alunos/${alunoId}`);
  revalidatePath("/admin/alunos");

  return {
    ok: true,
    totalAntes: antes.total,
    totalDepois: total,
    pendentes: {
      quantidade: linhas.length,
      de: linhas[0]?.mes_referencia ?? null,
      ate: linhas[linhas.length - 1]?.mes_referencia ?? null,
    },
  };
}

/** Reescreve valor + composição das mensalidades pendentes (deste mês em diante) com o plano actual. */
export async function aplicarPlanoPendentes(alunoId: string): Promise<{
  ok: boolean;
  erro?: string;
  /** Linhas alteradas, para a ficha actualizar sem recarregar */
  atualizadas?: { id: string; valor: number; itens: ItemMensalidade[] }[];
}> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { linhas, itens, total } = await pendentesDesatualizadas(admin, alunoId);
  if (itens.length === 0) return { ok: false, erro: "O aluno não tem modalidades — nada a aplicar." };

  for (const m of linhas) {
    const { error } = await admin
      .from("mensalidades")
      .update({ valor: total, itens })
      .eq("id", m.id)
      .neq("status", "pago");
    if (error) return { ok: false, erro: error.message };
  }

  revalidatePath(`/admin/alunos/${alunoId}`);
  revalidatePath("/admin/financeiro");
  return { ok: true, atualizadas: linhas.map((m) => ({ id: m.id as string, valor: total, itens })) };
}
