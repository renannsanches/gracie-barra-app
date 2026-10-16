"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import {
  gravarPlanoAluno, inicioMesAtual, planoDoAluno, validarPlano,
  type DescontoPlano, type LinhaPlano,
} from "@/lib/modalidades";
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
function assinatura(itens: Pick<ItemMensalidade, "modalidade_id" | "valor" | "tipo">[] | null): string {
  return (itens ?? [])
    .map((i) => `${i.tipo ?? "modalidade"}:${i.modalidade_id}:${Number(i.valor).toFixed(2)}`)
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

/** Substitui modalidades + descontos do aluno e indica quantas mensalidades pendentes ficaram desatualizadas. */
export async function guardarModalidadesAluno(
  alunoId: string,
  linhas: LinhaPlano[],
  descontos: DescontoPlano[],
): Promise<GuardarModalidadesResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const invalido = validarPlano(linhas, descontos);
  if (invalido) return { ok: false, erro: invalido };

  const admin = createAdminClient();
  const antes = await planoDoAluno(admin, alunoId);

  const erro = await gravarPlanoAluno(admin, alunoId, linhas, descontos);
  if (erro) return { ok: false, erro };

  const { linhas: pendentes, total } = await pendentesDesatualizadas(admin, alunoId);
  revalidatePath(`/admin/alunos/${alunoId}`);
  revalidatePath("/admin/alunos");

  return {
    ok: true,
    totalAntes: antes.total,
    totalDepois: total,
    pendentes: {
      quantidade: pendentes.length,
      de: pendentes[0]?.mes_referencia ?? null,
      ate: pendentes[pendentes.length - 1]?.mes_referencia ?? null,
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
