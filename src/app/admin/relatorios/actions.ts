"use server";

import {
  calcularPlano,
  descreverItens,
  formatarEuro,
  idadeEmAnos,
  listarGruposRef,
  listarModalidades,
  rotuloModalidade,
  type DescontoPlano,
  type LinhaPlano,
} from "@/lib/modalidades";
import {
  alertasDoAluno,
  categoriaRelatorio,
  janelaMeses,
  kidsComValorAdulto,
  ordenarLinhas,
  rotuloStatus,
  type FiltroStatusAluno,
  type LinhaRelatorioAluno,
} from "@/lib/relatorio-alunos";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { type ItemMensalidade, StatusMensalidade, StatusLancamento, TipoLancamento } from "@/lib/types";

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
  /** Composição legível, ex.: "Jiu-Jitsu 50 € + Capoeira 20 €" */
  detalhe: string;
  status: StatusMensalidade;
  data_pagamento: string | null;
}

export interface PresencaRelatorio {
  aluno_nome: string;
  registrado_em: string;
}

function textoDetalhe(valor: number, itens: ItemMensalidade[] | null): string {
  const { linhas, ajuste } = descreverItens(valor, itens);
  if (linhas.length === 0) return "";
  if (linhas.length === 1 && ajuste === 0) return linhas[0].nome;
  const partes = linhas.map((l) => `${l.nome} ${formatarEuro(l.valor)}`);
  if (ajuste !== 0) partes.push(`Ajuste ${ajuste > 0 ? "+" : "−"}${formatarEuro(Math.abs(ajuste))}`);
  return partes.join(" + ");
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
    .select("id, aluno_id, mes_referencia, data_vencimento, valor, itens, status, data_pagamento, profiles(nome_completo)")
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
    detalhe: textoDetalhe(row.valor, row.itens),
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

type MensalidadeJanela = { aluno_id: string; mes_referencia: string; data_vencimento: string; valor: number };

/** Mensalidades entre dois meses (inclusive), paginadas — o PostgREST devolve no máximo 1000 linhas por pedido. */
async function mensalidadesNaJanela(
  admin: ReturnType<typeof createAdminClient>,
  inicio: string,
  fim: string,
): Promise<{ dados: MensalidadeJanela[]; erro?: string }> {
  const dados: MensalidadeJanela[] = [];
  const PAGE = 1000;
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await admin
      .from("mensalidades")
      .select("aluno_id, mes_referencia, data_vencimento, valor")
      .gte("mes_referencia", inicio)
      .lte("mes_referencia", fim)
      .order("id")
      .range(de, de + PAGE - 1);
    if (error) return { dados, erro: error.message };
    dados.push(...((data ?? []) as MensalidadeJanela[]));
    if (!data || data.length < PAGE) return { dados };
  }
}

/** Uma linha por aluno (activos, inactivos ou todos): categoria, vencimento, valor, plano e alertas para conferir. */
export async function getRelatorioAlunos(filtros: {
  mes: string;
  status: FiltroStatusAluno;
}): Promise<{ ok: true; dados: LinhaRelatorioAluno[] } | { ok: false; erro: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!/^\d{4}-\d{2}$/.test(filtros.mes)) return { ok: false, erro: "Mês inválido." };
  if (!["ativos", "inativos", "todos"].includes(filtros.status)) return { ok: false, erro: "Filtro de status inválido." };

  const admin = createAdminClient();
  const mesRef = `${filtros.mes}-01`;
  const janela = janelaMeses(filtros.mes);

  let alunosQuery = admin
    .from("profiles")
    .select("id, nome_completo, status, faixa, categoria, data_nascimento")
    .eq("perfil", "aluno");
  if (filtros.status === "ativos") alunosQuery = alunosQuery.eq("status", "ativo");
  if (filtros.status === "inativos") alunosQuery = alunosQuery.neq("status", "ativo");

  const [alunosRes, planoRes, descontosRes, modalidades, grupos, mensalidades] = await Promise.all([
    alunosQuery,
    admin.from("aluno_modalidades").select("aluno_id, modalidade_id, valor, cobrar"),
    admin.from("aluno_descontos").select("aluno_id, descricao, valor, origem_modalidade_id"),
    listarModalidades(admin),
    listarGruposRef(admin),
    mensalidadesNaJanela(admin, janela.inicio, janela.fim),
  ]);

  const erro = alunosRes.error?.message ?? planoRes.error?.message ?? descontosRes.error?.message ?? mensalidades.erro;
  if (erro) return { ok: false, erro };

  const rotulos = new Map(modalidades.map((m) => [m.id, rotuloModalidade(m, grupos)]));
  const porModalidade = new Map(modalidades.map((m) => [m.id, m]));

  const linhasPorAluno = new Map<string, LinhaPlano[]>();
  for (const r of planoRes.data ?? []) {
    const lista = linhasPorAluno.get(r.aluno_id) ?? [];
    lista.push({ modalidade_id: r.modalidade_id, valor: Number(r.valor), cobrar: r.cobrar });
    linhasPorAluno.set(r.aluno_id, lista);
  }
  const descontosPorAluno = new Map<string, DescontoPlano[]>();
  for (const d of descontosRes.data ?? []) {
    const lista = descontosPorAluno.get(d.aluno_id) ?? [];
    lista.push({ descricao: d.descricao, valor: Number(d.valor), origem_modalidade_id: d.origem_modalidade_id });
    descontosPorAluno.set(d.aluno_id, lista);
  }
  const mensalidadesPorAluno = new Map<string, MensalidadeJanela[]>();
  for (const m of mensalidades.dados) {
    const lista = mensalidadesPorAluno.get(m.aluno_id) ?? [];
    lista.push(m);
    mensalidadesPorAluno.set(m.aluno_id, lista);
  }

  const dados = (alunosRes.data ?? []).map((a): LinhaRelatorioAluno => {
    const linhas = linhasPorAluno.get(a.id) ?? [];
    const { total: plano } = calcularPlano(linhas, descontosPorAluno.get(a.id) ?? [], rotulos);
    const doAluno = mensalidadesPorAluno.get(a.id) ?? [];
    const doMes = doAluno.find((m) => m.mes_referencia === mesRef) ?? null;
    const mensalidade = doMes ? { valor: Number(doMes.valor), data_vencimento: doMes.data_vencimento } : null;

    return {
      aluno_id: a.id,
      nome: a.nome_completo ?? "—",
      status: rotuloStatus(a.status),
      categoria: categoriaRelatorio(a.faixa, a.categoria),
      vencimento: mensalidade?.data_vencimento ?? null,
      valor: mensalidade?.valor ?? null,
      plano,
      alertas: alertasDoAluno({
        ativo: a.status === "ativo",
        mensalidade,
        outrasDatas: doAluno.filter((m) => m.mes_referencia !== mesRef).map((m) => m.data_vencimento),
        plano,
        temPlano: linhas.length > 0,
        kidsValorAdulto: kidsComValorAdulto(idadeEmAnos(a.data_nascimento), linhas, porModalidade),
      }),
    };
  });

  return { ok: true, dados: ordenarLinhas(dados) };
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
