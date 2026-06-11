"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { StatusMensalidade, StatusLancamento, TipoLancamento } from "@/lib/types";

export interface LancamentoRelatorio {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  fornecedor_nome: string;
  categoria_nome: string;
  categoria_pai_nome: string;
  data_vencimento: string;
  valor: number;
  status: StatusLancamento;
  data_pagamento: string | null;
  forma_pagamento_nome: string;
}

export interface MensalidadeRelatorio {
  id: string;
  aluno_nome: string;
  mes_referencia: string;
  data_vencimento: string;
  valor: number;
  status: StatusMensalidade;
  data_pagamento: string | null;
}

export interface PresencaRelatorio {
  aluno_nome: string;
  registrado_em: string;
}

export async function getRelatorioFinanceiro(filtros: {
  mes?: string;
  status?: StatusMensalidade | "todos";
}): Promise<{ ok: true; dados: MensalidadeRelatorio[] } | { ok: false; erro: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();

  let query = admin
    .from("mensalidades")
    .select("id, aluno_id, mes_referencia, data_vencimento, valor, status, data_pagamento, profiles(nome_completo)")
    .order("mes_referencia", { ascending: false })
    .order("data_vencimento", { ascending: false });

  if (filtros.mes) {
    query = query.eq("mes_referencia", `${filtros.mes}-01`);
  }
  if (filtros.status && filtros.status !== "todos") {
    query = query.eq("status", filtros.status);
  }

  const { data, error } = await query;

  if (error) return { ok: false, erro: error.message };

  const dados: MensalidadeRelatorio[] = (data ?? []).map((row: any) => ({
    id: row.id,
    aluno_nome: row.profiles?.nome_completo ?? "—",
    mes_referencia: row.mes_referencia,
    data_vencimento: row.data_vencimento,
    valor: row.valor,
    status: row.status,
    data_pagamento: row.data_pagamento,
  }));

  return { ok: true, dados };
}

export async function getRelatorioPresencas(filtros: {
  data_inicio: string;
  data_fim: string;
  turma_id?: string;
}): Promise<{ ok: true; dados: PresencaRelatorio[] } | { ok: false; erro: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();

  let alunoIds: string[] | null = null;

  if (filtros.turma_id) {
    const { data: reservas, error: erroReservas } = await admin
      .from("reservas")
      .select("aluno_id")
      .eq("turma_id", filtros.turma_id);

    if (erroReservas) return { ok: false, erro: erroReservas.message };

    alunoIds = [...new Set((reservas ?? []).map((r: any) => r.aluno_id))];
    if (alunoIds.length === 0) return { ok: true, dados: [] };
  }

  let query = admin
    .from("presencas")
    .select("aluno_id, registrado_em, profiles!presencas_aluno_id_fkey(nome_completo)")
    .gte("registrado_em", `${filtros.data_inicio}T00:00:00.000Z`)
    .lte("registrado_em", `${filtros.data_fim}T23:59:59.999Z`)
    .order("registrado_em", { ascending: false });

  if (alunoIds) {
    query = query.in("aluno_id", alunoIds);
  }

  const { data, error } = await query;

  if (error) return { ok: false, erro: error.message };

  const dados: PresencaRelatorio[] = (data ?? []).map((row: any) => ({
    aluno_nome: (row.profiles as any)?.nome_completo ?? "—",
    registrado_em: row.registrado_em,
  }));

  return { ok: true, dados };
}

export async function getRelatorioLancamentos(filtros: {
  data_inicio: string;
  data_fim: string;
  tipo?: TipoLancamento | "todos";
  categoria_id?: string;
  incluirCancelados?: boolean;
}): Promise<{ ok: true; dados: LancamentoRelatorio[] } | { ok: false; erro: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();

  let query = admin
    .from("lancamentos_financeiros")
    .select("id, tipo, descricao, data_vencimento, valor, status, data_pagamento, fornecedores(nome), categorias_financeiras(nome, parent_id), formas_pagamento(nome)")
    .gte("data_vencimento", filtros.data_inicio)
    .lte("data_vencimento", filtros.data_fim)
    .order("data_vencimento", { ascending: true });

  if (filtros.tipo && filtros.tipo !== "todos") {
    query = query.eq("tipo", filtros.tipo);
  }
  if (filtros.categoria_id) {
    query = query.eq("categoria_id", filtros.categoria_id);
  }
  if (!filtros.incluirCancelados) {
    query = query.neq("status", "cancelado");
  }

  const { data, error } = await query;
  if (error) return { ok: false, erro: error.message };

  // Resolver nomes de categorias pai (para agrupamento em relatórios)
  const parentIds = Array.from(new Set((data ?? []).map((r: any) => r.categorias_financeiras?.parent_id).filter(Boolean)));
  const paiMap: Record<string, string> = {};
  if (parentIds.length > 0) {
    const { data: pais } = await admin
      .from("categorias_financeiras")
      .select("id, nome")
      .in("id", parentIds);
    (pais ?? []).forEach((p: any) => { paiMap[p.id] = p.nome; });
  }

  const dados: LancamentoRelatorio[] = (data ?? []).map((row: any) => {
    const cat = row.categorias_financeiras;
    const catNome = cat?.nome ?? "—";
    const catPaiNome = cat?.parent_id ? (paiMap[cat.parent_id] ?? "—") : catNome;
    return {
      id: row.id,
      tipo: row.tipo,
      descricao: row.descricao,
      fornecedor_nome: row.fornecedores?.nome ?? "—",
      categoria_nome: catNome,
      categoria_pai_nome: catPaiNome,
      data_vencimento: row.data_vencimento,
      valor: Number(row.valor),
      status: row.status,
      data_pagamento: row.data_pagamento,
      forma_pagamento_nome: row.formas_pagamento?.nome ?? "—",
    };
  });

  return { ok: true, dados };
}

export async function getCategoriasParaRelatorio(): Promise<{ id: string; nome: string }[]> {
  const auth = await requireAdmin();
  if (!auth.ok) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("categorias_financeiras")
    .select("id, nome")
    .eq("ativa", true)
    .order("nome");
  return data ?? [];
}

export async function getTurmasParaRelatorio(): Promise<{ id: string; nome: string }[]> {
  const auth = await requireAdmin();
  if (!auth.ok) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("turmas")
    .select("id, nome")
    .order("nome");

  return data ?? [];
}
